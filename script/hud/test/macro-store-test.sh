#!/bin/bash
# macro_store.py 单测（本地跑，无需服务器）
#   bash test/macro-store-test.sh
set -uo pipefail
SRC=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  [PASS] $*"; }
no(){ FAIL=$((FAIL+1)); echo "  [FAIL] $*"; }
chk(){ if eval "$2"; then ok "$1"; else no "$1"; fi; }

cat > "$T/t.py" <<'PY'
import json, os, sys, tempfile
sys.path.insert(0, os.environ["SRC"] + "/common")
import macro_store

root = tempfile.mkdtemp()
st = macro_store.Store(root)
owner = "acct1"
other = "acct2"

m1 = {
  "id": "create-site",
  "name": "新建站点",
  "steps": [{"action": "click", "target": {"text": "创建站点"}}],
  "params": {"siteName": {"label": "站点名称", "template": "XX-{{datetime}}"}},
}
r1 = st.save(owner, m1)
print("save1", json.dumps(r1))
st.save(owner, dict(m1, steps=m1["steps"] + [{"action": "wait", "for": {"text": "保存成功"}}]))
m = st.get(owner, "create-site")
print("version", m["version"], "steps", len(m["steps"]))
lst = st.list(owner)
print("list_owner", len(lst))
try:
    st.get(other, "create-site")
    print("other_get", "ALLOWED")
except macro_store.MacroError as e:
    print("other_get", e.code)

# 共享
st.save(owner, dict(m1, id="shared-1", name="共享动作", scope="team"))
print("other_list_shared", len(st.list(other, scope="shared")))

# 非法
try:
    st.save(owner, {"id": "BAD ID", "name": "x", "steps": []})
    print("invalid_allowed", True)
except macro_store.MacroError as e:
    print("invalid", e.code)

# 软删/恢复/硬删
print("del_soft", st.delete(owner, "create-site")["hard"])
try:
    st.get(owner, "create-site"); print("after_soft", "VISIBLE")
except macro_store.MacroError as e:
    print("after_soft", e.code)
st.save(owner, dict(m1, id="create-site", name="新建站点"))
print("restored", st.get(owner, "create-site")["deletedAt"])
print("del_hard", st.delete(owner, "create-site", hard=True)["deleted"])

# 运行记录
rec = st.start_run(owner, "shared-1", 1, {"a": "b"}, "user")
st.append_run(owner, rec)
print("runs", len(st.list_runs(owner, "shared-1")))
PY

echo "== 运行单测 =="
SRC="$SRC" python3 "$T/t.py" > "$T/out.txt" 2>&1
cat "$T/out.txt"

chk "保存返回 version=1" "grep -q 'save1 {\"id\": \"create-site\", \"version\": 1' '$T/out.txt'"
chk "二次保存 version=2" "grep -q 'version 2' '$T/out.txt'"
chk "list 自己可见" "grep -q 'list_owner 1' '$T/out.txt'"
chk "他人访问 private → forbidden" "grep -q 'other_get forbidden' '$T/out.txt'"
chk "他人可见共享动作" "grep -q 'other_list_shared 1' '$T/out.txt'"
chk "非法 id → macro_invalid" "grep -q 'invalid macro_invalid' '$T/out.txt'"
chk "软删除后不可见" "grep -q 'after_soft macro_not_found' '$T/out.txt'"
chk "保存可恢复软删" "grep -q 'restored None' '$T/out.txt'"
chk "硬删除成功" "grep -q 'del_hard True' '$T/out.txt'"
chk "运行记录可查" "grep -q 'runs 1' '$T/out.txt'"

echo
echo "===== 结果: PASS=$PASS FAIL=$FAIL ====="
rm -rf "$T"
[ "$FAIL" = "0" ] && exit 0 || exit 1
