#!/usr/bin/env python3
"""HUD 动作存储：动作 CRUD、版本、软删除、执行记录（审计）。

纯标准库；由 broker 以 root 调用。
目录布局（root = /var/lib/cogagent-hud）：
  macros/index.json              轻量索引
  macros/<owner>/<id>.json       动作全文（含版本历史）
  runs/<owner>/<yyyy-mm>.jsonl   执行记录（每行一条）
"""
import json
import os
import re
import tempfile
import time

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")
ACTIONS = {"click", "fill", "select", "check", "press", "wait", "read", "navigate", "sleep", "api", "refresh", "verify"}
TARGET_KEYS = ("label", "text", "placeholder", "ariaLabel", "testId", "selector", "class", "menuKey")
LIMITS = {"steps": 50, "params": 20, "valueLen": 2000, "macroBytes": 256 * 1024, "macrosPerOwner": 200}


class MacroError(Exception):
    def __init__(self, code, detail=""):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail


def _now():
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def _atomic_write(path, data):
    d = os.path.dirname(path)
    os.makedirs(d, mode=0o750, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(data)
        os.chmod(tmp, 0o640)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


class Store:
    def __init__(self, root):
        self.root = root
        self.macros = os.path.join(root, "macros")
        self.runs = os.path.join(root, "runs")
        self.index = os.path.join(self.macros, "index.json")

    # ---------- 读取 ----------
    def _load_index(self):
        try:
            with open(self.index, encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return {"macros": []}

    def _save_index(self, idx):
        _atomic_write(self.index, json.dumps(idx, ensure_ascii=False, indent=1))

    def list(self, owner, scope="all", query=""):
        idx = self._load_index()
        out = []
        q = (query or "").lower()
        for item in idx.get("macros", []):
            if item.get("deletedAt"):
                continue
            vis = item.get("scope", "private")
            if scope == "mine" and item.get("owner") != owner:
                continue
            if scope == "shared" and (vis == "private" or item.get("owner") == owner):
                continue
            if vis == "private" and item.get("owner") != owner:
                continue
            if q and q not in (item.get("name", "") + item.get("description", "")).lower():
                continue
            out.append(item)
        out.sort(key=lambda x: (not x.get("pinned"), x.get("order", 999), x.get("name", "")))
        return out

    def get(self, owner, macro_id):
        idx = self._load_index()
        item = next((m for m in idx.get("macros", [])
                     if m.get("id") == macro_id and (m.get("owner") == owner or m.get("scope", "private") != "private")), None)  # PER_OWNER_ID_V1
        if not item or item.get("deletedAt"):
            raise MacroError("macro_not_found")
        if item.get("scope", "private") == "private" and item.get("owner") != owner:
            raise MacroError("forbidden")
        path = os.path.join(self.macros, item["owner"], macro_id + ".json")
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    # ---------- 校验 ----------
    def validate(self, macro):
        mid = macro.get("id") or ""
        if not ID_RE.match(mid):
            raise MacroError("macro_invalid", "id 需匹配 ^[a-z0-9][a-z0-9-]{1,39}$")
        name = (macro.get("name") or "").strip()
        if not (1 <= len(name) <= 40):
            raise MacroError("macro_invalid", "name 长度需 1-40")
        steps = macro.get("steps") or []
        if not (1 <= len(steps) <= LIMITS["steps"]):
            raise MacroError("macro_invalid", "steps 数量需 1-%d" % LIMITS["steps"])
        for i, step in enumerate(steps, 1):
            act = step.get("action")
            if act not in ACTIONS:
                raise MacroError("macro_invalid", "第 %d 步 action 非法: %s" % (i, act))
            if act in ("click", "fill", "select", "check", "press", "read", "verify"):
                target = step.get("target") or {}
                if not any(k in target for k in TARGET_KEYS):
                    raise MacroError("macro_invalid", "第 %d 步缺少 target 定位字段" % i)
            if act in ("fill", "select") and len(str(step.get("value", ""))) > LIMITS["valueLen"]:
                raise MacroError("macro_invalid", "第 %d 步 value 过长" % i)
            if act == "api":
                ep = step.get("endpoint") or ""
                if not ep.startswith("/rest/ossdesign/v1/designer/"):
                    raise MacroError("macro_invalid", "第 %d 步 api.endpoint 不在白名单前缀" % i)
        params = macro.get("params") or {}
        if len(params) > LIMITS["params"]:
            raise MacroError("macro_invalid", "params 过多")
        if len(json.dumps(macro, ensure_ascii=False).encode("utf-8")) > LIMITS["macroBytes"]:
            raise MacroError("macro_invalid", "动作过大（>256KB）")
        return True

    # ---------- 写入 ----------
    def save(self, owner, macro, mode="upsert", actor=None):
        self.validate(macro)
        idx = self._load_index()
        mid = macro["id"]
        item = next((m for m in idx.get("macros", [])
                     if m.get("id") == mid and m.get("owner") == owner), None)   # PER_OWNER_ID_V1
        if item and item.get("deletedAt") and mode != "create":
            item.pop("deletedAt", None)
        if mode == "create" and item and not item.get("deletedAt"):
            raise MacroError("macro_conflict", "同名动作已存在")

        mine = [m for m in idx.get("macros", []) if m.get("owner") == owner and not m.get("deletedAt")]
        if not item and len(mine) >= LIMITS["macrosPerOwner"]:
            raise MacroError("macro_invalid", "动作数量超过上限 %d" % LIMITS["macrosPerOwner"])
        for other in idx.get("macros", []):
            if other.get("owner") == owner and other.get("name") == macro["name"] and other.get("id") != mid:
                raise MacroError("macro_conflict", "同名动作已存在: %s" % macro["name"])

        prev = None
        if item:
            path = os.path.join(self.macros, item["owner"], mid + ".json")
            try:
                with open(path, encoding="utf-8") as fh:
                    prev = json.load(fh)
            except OSError:
                prev = None

        version = int((prev or {}).get("version", 0)) + 1
        now = _now()
        out = dict(macro)
        out.update({
            "id": mid,
            "owner": (prev or {}).get("owner", owner),
            "scope": macro.get("scope", (prev or {}).get("scope", "private")),
            "version": version,
            "createdAt": (prev or {}).get("createdAt", now),
            "updatedAt": now,
            "deletedAt": None,
        })
        history = list((prev or {}).get("versionHistory", []))
        if prev:
            history.append({"version": prev.get("version"), "updatedAt": prev.get("updatedAt"), "by": actor})
        out["versionHistory"] = history[-20:]

        _atomic_write(os.path.join(self.macros, out["owner"], mid + ".json"),
                      json.dumps(out, ensure_ascii=False, indent=1))

        entry = {k: out.get(k) for k in ("id", "name", "version", "scope", "owner", "description", "pinned", "order")}
        entry["updatedAt"] = now
        if item:
            item.update(entry)
            item.pop("deletedAt", None)
        else:
            idx.setdefault("macros", []).append(entry)
        self._save_index(idx)

        diff = {"added": len(out["steps"]), "removed": 0, "changed": 0}
        if prev:
            diff = {
                "added": max(0, len(out.get("steps", [])) - len(prev.get("steps", []))),
                "removed": max(0, len(prev.get("steps", [])) - len(out.get("steps", []))),
                "changed": 1 if prev.get("steps") != out.get("steps") else 0,
            }
        return {"id": mid, "version": version, "diff": diff}

    def delete(self, owner, macro_id, hard=False, actor=None):
        idx = self._load_index()
        item = next((m for m in idx.get("macros", [])
                     if m.get("id") == macro_id and m.get("owner") == owner), None)   # PER_OWNER_ID_V1
        if not item:
            raise MacroError("macro_not_found")
        path = os.path.join(self.macros, item["owner"], macro_id + ".json")
        if hard:
            try:
                os.unlink(path)
            except OSError:
                pass
            idx["macros"] = [m for m in idx.get("macros", []) if m.get("id") != macro_id]
        else:
            item["deletedAt"] = _now()
        self._save_index(idx)
        return {"deleted": True, "hard": bool(hard)}

    def migrate(self, old_owner, new_owner, actor=None):
        """把某账号名下的动作整体迁移到另一个 owner（网页账户接管时用）。"""
        if not old_owner or not new_owner or old_owner == new_owner:
            return 0
        idx = self._load_index()
        moved = 0
        for item in idx.get("macros", []):
            if item.get("owner") != old_owner:
                continue
            mid = item.get("id")
            src = os.path.join(self.macros, old_owner, mid + ".json")
            dst = os.path.join(self.macros, new_owner, mid + ".json")
            try:
                with open(src, encoding="utf-8") as fh:
                    body = json.load(fh)
            except OSError:
                continue
            body["owner"] = new_owner
            body["updatedAt"] = _now()
            _atomic_write(dst, json.dumps(body, ensure_ascii=False, indent=1))
            try:
                os.unlink(src)
            except OSError:
                pass
            item["owner"] = new_owner
            item["updatedAt"] = body["updatedAt"]
            moved += 1
        if moved:
            self._save_index(idx)
        return moved

    # ---------- 执行记录 ----------
    def start_run(self, owner, macro_id, version, params, trigger):
        run_id = "run_%s_%s" % (time.strftime("%Y%m%d%H%M%S"), os.urandom(3).hex())
        return {
            "runId": run_id, "macroId": macro_id, "version": version, "trigger": trigger,
            "by": owner, "startedAt": _now(), "endedAt": None, "params": params,
            "result": "running", "failedStep": None, "steps": [], "outputs": {}, "fallbackUsed": False,
        }

    def append_run(self, owner, record):
        path = os.path.join(self.runs, owner, time.strftime("%Y-%m") + ".jsonl")
        os.makedirs(os.path.dirname(path), mode=0o750, exist_ok=True)
        line = json.dumps(record, ensure_ascii=False)[:4096]
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def list_runs(self, owner, macro_id=None, limit=20):
        path = os.path.join(self.runs, owner, time.strftime("%Y-%m") + ".jsonl")
        out = []
        try:
            with open(path, encoding="utf-8") as fh:
                for line in fh:
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    if macro_id and rec.get("macroId") != macro_id:
                        continue
                    out.append(rec)
        except OSError:
            return []
        return out[-limit:]
