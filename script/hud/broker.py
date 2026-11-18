#!/usr/bin/env python3
"""cogagent HUD broker.

职责（只做这三件事）：
  1. 驱动 cogagent 的 SSO 登录（无 TTY），拿到 cogagent 账号
  2. 按 cogagent 账号启动/复用 serve 实例，读取其凭据
  3. 发放 handle，并把前端请求代理到对应实例

不做什么：不存会话、不碰 OSSDIY 数据、不读 X-User-Name。

用法：
  python3 broker.py --port 18765
"""

import argparse
import base64
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import zlib
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

URL_RE = re.compile(r"^https://\S*oauth2/authorize\S*$")
ACCOUNT_RE = re.compile(r"^COGAGENT_LOGIN_ACCOUNT=(\S+)$")
LISTEN_RE = re.compile(r"server listening on http://127\.0\.0\.1:(\d+)")

STATE_LOCK = threading.RLock()
TICKETS = {}
HANDLES = {}
INSTANCES = {}


def log(msg):
    sys.stderr.write(time.strftime("[%H:%M:%S] ") + msg + "\n")
    sys.stderr.flush()


def account_port(account):
    return 41000 + (zlib.crc32(account.encode("utf-8")) % 20000)


def credential(root_base, account):
    path = os.path.join(root_base, account, "state", "cogagent", "service-local.json")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    password = data.get("password") or ""
    url = data.get("url") or ""
    port = None
    if url:
        try:
            port = int(urlparse(url).port or 0) or None
        except ValueError:
            port = None
    if not password:
        return None
    return {"password": password, "port": port or account_port(account)}


def basic(password):
    raw = ("opencode:" + password).encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def upstream_get(base, path, password, timeout=15):
    req = urllib.request.Request(base + path, method="GET")
    req.add_header("Authorization", basic(password))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


class Server:
    def __init__(self, args):
        self.args = args
        self.root_base = args.root
        self.state_dir = args.state_dir
        os.makedirs(self.state_dir, exist_ok=True)
        self.handles_path = os.path.join(self.state_dir, "handles.json")
        self._load_handles()

    # ---------- 持久化 ----------
    def _load_handles(self):
        try:
            with open(self.handles_path, encoding="utf-8") as fh:
                data = json.load(fh)
            HANDLES.update(data.get("handles") or {})
        except (OSError, ValueError):
            pass

    def _save_handles(self):
        tmp = self.handles_path + ".tmp"
        payload = json.dumps({"handles": HANDLES}, ensure_ascii=False)
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(payload)
        os.replace(tmp, self.handles_path)

    # ---------- 实例 ----------
    def instance(self, account):
        entry = INSTANCES.get(account)
        if not entry:
            return None
        proc = entry.get("proc")
        if proc is not None and proc.poll() is not None:
            log("instance for %s exited with %s" % (account, proc.returncode))
            entry["state"] = "exited"
        return entry

    def ensure_instance(self, account):
        """复用已有实例；没有则起一个（登录由调用方先完成，这里只起 serve）。"""
        entry = self.instance(account)
        if entry and entry.get("state") == "ready":
            cred = credential(self.root_base, account)
            if cred and self.probe(cred["port"], cred["password"]):
                return entry
        cred = credential(self.root_base, account)
        if cred and self.probe(cred["port"], cred["password"]):
            entry = {"account": account, "port": cred["port"], "state": "ready", "proc": None}
            INSTANCES[account] = entry
            return entry
        return None

    def probe(self, port, password, timeout=4):
        try:
            status, _ = upstream_get("http://127.0.0.1:%d" % port, "/api/session", password, timeout)
            return status == 200
        except Exception:
            return False

    def start_login(self):
        """起一个登录进程；它成功后自身变成 serve。"""
        if any(t.get("state") in ("pending", "serving") for t in TICKETS.values()):
            return None, "另一个登录正在进行"
        ticket = secrets.token_urlsafe(16)
        env = dict(os.environ)
        env["COGAGENT_SERVE_ONLY"] = "1"
        env.pop("COGAGENT_NO_SANDBOX", None)
        proc = subprocess.Popen(
            [self.args.launcher],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            bufsize=1,
        )
        entry = {
            "state": "pending",
            "proc": proc,
            "url": None,
            "account": None,
            "port": None,
            "reason": None,
            "created": time.time(),
            "deadline": time.time() + self.args.login_timeout,
        }
        with STATE_LOCK:
            TICKETS[ticket] = entry
        threading.Thread(target=self._pump, args=(ticket, entry), daemon=True).start()
        return ticket, None

    def _pump(self, ticket, entry):
        proc = entry["proc"]
        try:
            for line in proc.stdout:
                line = line.rstrip("\n")
                m = URL_RE.match(line.strip())
                if m and not entry["url"]:
                    entry["url"] = line.strip()
                    log("ticket %s url captured" % ticket)
                    continue
                m = ACCOUNT_RE.match(line.strip())
                if m:
                    entry["account"] = m.group(1)
                    entry["state"] = "serving"
                    log("ticket %s account %s" % (ticket, m.group(1)))
                    reused = self.ensure_instance(entry["account"])
                    if reused:
                        entry["port"] = reused["port"]
                        log("ticket %s reuse existing instance on %d" % (ticket, reused["port"]))
                        try:
                            proc.terminate()
                        except Exception:
                            pass
                        self._finish(ticket, entry, proc=None)
                        return
                    continue
                m = LISTEN_RE.search(line)
                if m:
                    entry["port"] = int(m.group(1))
                    log("ticket %s listening on %s" % (ticket, m.group(1)))
                    self._finish(ticket, entry)
                    continue
            proc.wait(timeout=5)
        except Exception as exc:  # noqa: BLE001
            log("pump error for %s: %s" % (ticket, exc))
        if entry["state"] in ("pending", "serving"):
            entry["state"] = "failed"
            entry["reason"] = "登录进程已退出"

    def _finish(self, ticket, entry, proc="keep"):
        account = entry["account"]
        port = entry["port"]
        cred = None
        for _ in range(20):
            cred = credential(self.root_base, account)
            if cred and self.probe(port, cred["password"]):
                break
            time.sleep(0.5)
        if not cred:
            entry["state"] = "failed"
            entry["reason"] = "读不到 service-local.json"
            return
        handle = secrets.token_urlsafe(32)
        with STATE_LOCK:
            HANDLES[handle] = {"account": account, "port": port, "created": time.time()}
            if (INSTANCES.get(account) or {}).get("state") != "ready":
                INSTANCES[account] = {"account": account, "port": port, "state": "ready",
                                      "proc": entry["proc"] if proc == "keep" else proc}
            entry["handle"] = handle
            entry["state"] = "ready"
            self._save_handles()
        log("ticket %s ready, account=%s port=%d" % (ticket, account, port))

    def resolve(self, handle):
        info = HANDLES.get(handle)
        if not info:
            return None
        cred = credential(self.root_base, info["account"])
        if not cred:
            return None
        return {"account": info["account"], "port": cred["port"], "password": cred["password"]}


class Handler(BaseHTTPRequestHandler):
    server_version = "cogagent-hud-broker/1.0"
    protocol_version = "HTTP/1.1"

    @property
    def app(self):
        return self.server.app

    def log_message(self, fmt, *args):  # noqa: A003
        log("http %s - %s" % (self.address_string(), fmt % args))

    # ---------- 工具 ----------
    def body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            return {}

    def send_json(self, code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def require_handle(self):
        # EventSource 不能自定义请求头，因此也接受 ?handle=
        handle = self.headers.get("X-Hud-Handle") or ""
        if not handle:
            from urllib.parse import urlparse as _u, parse_qs as _q
            handle = (_q(_u(self.path).query).get("handle") or [""])[0]
        info = self.app.resolve(handle)
        if not info:
            self.send_json(401, {"error": "handle_invalid"})
            return None, None
        return handle, info

    # ---------- 路由 ----------
    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/status":
            with STATE_LOCK:
                items = [
                    {"account": i["account"], "port": i["port"], "state": i["state"]}
                    for i in INSTANCES.values()
                ]
            self.send_json(200, {"instances": items, "count": len(items)})
            return
        if path == "/login/status":
            ticket = (parse_qs(parsed.query).get("ticket") or [""])[0]
            entry = TICKETS.get(ticket)
            if not entry:
                self.send_json(404, {"error": "ticket_not_found"})
                return
            if entry["state"] in ("pending", "serving") and time.time() > entry["deadline"]:
                entry["state"] = "failed"
                entry["reason"] = "登录超时"
                try:
                    entry["proc"].terminate()
                except Exception:
                    pass
            payload = {"state": entry["state"]}
            for key in ("url", "account", "handle", "reason"):
                if entry.get(key):
                    payload[key] = entry[key]
            self.send_json(200, payload)
            return
        if path.startswith("/agent/"):
            handle, info = self.require_handle()
            if not info:
                return
            self.proxy(path, info, parsed)
            return
        self.send_json(404, {"error": "not_found"})

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/login/start":
            ticket, error = self.app.start_login()
            if error:
                self.send_json(503, {"error": error})
                return
            entry = TICKETS[ticket]
            for _ in range(100):
                if entry.get("url"):
                    break
                time.sleep(0.1)
            self.send_json(200, {"ticket": ticket, "url": entry.get("url"), "expiresIn": self.app.args.login_timeout})
            return
        if path == "/login/cancel":
            ticket = (self.body().get("ticket") or "")
            entry = TICKETS.get(ticket)
            if not entry:
                self.send_json(404, {"error": "ticket_not_found"})
                return
            try:
                entry["proc"].terminate()
            except Exception:
                pass
            entry["state"] = "failed"
            entry["reason"] = "已取消"
            self.send_json(200, {"state": "idle"})
            return
        if path == "/logout":
            handle = (self.body().get("handle") or self.headers.get("X-Hud-Handle") or "")
            with STATE_LOCK:
                HANDLES.pop(handle, None)
                self.app._save_handles()
            self.send_json(200, {"state": "idle"})
            return
        if path.startswith("/agent/"):
            handle, info = self.require_handle()
            if not info:
                return
            self.proxy(path, info, parsed)
            return
        self.send_json(404, {"error": "not_found"})

    # ---------- 代理 ----------
    def proxy(self, path, info, parsed):
        body = b""
        if self.command == "POST":
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
        method = self.command
        if path == "/agent/events":
            self.stream_events(info)
            return
        target, payload = self.map_path(path, parsed, body)
        if target is None:
            self.send_json(400, {"error": "bad_request"})
            return
        req = urllib.request.Request(
            "http://127.0.0.1:%d%s" % (info["port"], target), data=payload, method=method
        )
        req.add_header("Authorization", basic(info["password"]))
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
                status = resp.status
        except urllib.error.HTTPError as exc:
            data = exc.read()
            status = exc.code
        except Exception as exc:  # noqa: BLE001
            self.send_json(502, {"error": "upstream_failed", "detail": str(exc)})
            return
        if status == 401:
            self.send_json(401, {"error": "upstream_unauthorized"})
            return
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def map_path(self, path, parsed, body):
        if path == "/agent/sessions":
            return "/api/session", None
        if path == "/agent/session":
            return "/api/session", body
        if path == "/agent/messages":
            session = (parse_qs(parsed.query).get("sessionID") or [""])[0]
            if not session:
                return None, None
            return "/api/session/%s/message" % session, None
        if path == "/agent/prompt":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            if not session:
                return None, None
            return "/api/session/%s/prompt" % session, json.dumps({"text": data.get("text", "")}).encode("utf-8")
        if path == "/agent/reply":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            request = data.get("requestID")
            if not session or not request:
                return None, None
            payload = {"decision": data.get("decision", "once")}
            if data.get("message"):
                payload["message"] = data["message"]
            return "/api/session/%s/permission/%s/reply" % (session, request), json.dumps(payload).encode("utf-8")
        if path == "/agent/models":
            return "/api/model", None
        if path == "/agent/model":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            model = data.get("model") or {}
            if not session or not model.get("providerID") or not model.get("id"):
                return None, None
            return "/api/session/%s/model" % session, json.dumps({"model": model}).encode("utf-8")
        if path == "/agent/permissions":
            return "/api/permission/request", None
        if path == "/agent/forms":
            session = (parse_qs(parsed.query).get("sessionID") or [""])[0]
            if not session:
                return None, None
            return "/api/session/%s/form" % session, None
        if path == "/agent/form/reply":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            form = data.get("formID")
            if not session or not form:
                return None, None
            payload = {"answer": data.get("answer") or {}}
            return "/api/session/%s/form/%s/reply" % (session, form), json.dumps(payload).encode("utf-8")
        if path == "/agent/interrupt":
            try:
                data = json.loads(body.decode("utf-8"))
            except ValueError:
                return None, None
            session = data.get("sessionID")
            if not session:
                return None, None
            return "/api/session/%s/interrupt" % session, b"{}"
        return None, None

    def stream_events(self, info):
        conn = HTTPConnection("127.0.0.1", info["port"], timeout=None)
        try:
            conn.request("GET", "/api/event", headers={
                "Authorization": basic(info["password"]),
                "Accept": "text/event-stream",
            })
            upstream = conn.getresponse()
        except Exception as exc:  # noqa: BLE001
            self.send_json(502, {"error": "upstream_failed", "detail": str(exc)})
            return
        if upstream.status != 200:
            self.send_json(upstream.status, {"error": "upstream_status"})
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        self.close_connection = True
        self.end_headers()
        last_ping = time.time()
        try:
            while True:
                chunk = upstream.read(1)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()
                if time.time() - last_ping > 15:
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
                    last_ping = time.time()
        except Exception:  # noqa: BLE001
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=18765)
    parser.add_argument("--hostname", default="127.0.0.1")
    parser.add_argument("--root", default="/srv/cogagent/users")
    parser.add_argument("--state-dir", default="/var/lib/cogagent-hud")
    parser.add_argument("--launcher", default="/usr/local/bin/cogagent")
    parser.add_argument("--login-timeout", type=int, default=300)
    args = parser.parse_args()

    app = Server(args)
    httpd = ThreadingHTTPServer((args.hostname, args.port), Handler)
    httpd.app = app
    httpd.daemon_threads = True
    log("broker listening on http://%s:%d" % (args.hostname, args.port))
    httpd.serve_forever()


if __name__ == "__main__":
    main()
