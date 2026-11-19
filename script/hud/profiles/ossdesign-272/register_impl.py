#!/usr/bin/env python3
"""272 风格注册：找 <recv>.add_handlers(...) 或 X = ...Application(...)，在其后插块。"""
import sys, os, re, shutil, time
import py_compile

MARK = "HUD_BRIDGE_V3"


def build_block(indent, recv):
    i = indent
    return (
        i + "# " + MARK + "\n"
        + i + "try:\n"
        + i + "    from interface.hud_proxy import HudProxyHandler\n"
        + i + "    " + recv + ".add_handlers(\n"
        + i + '        r".*", [(r"/rest/ossdesign/v1/designer/hud/(.*)", HudProxyHandler)])\n'
        + i + '    print("[hud] bridge enabled")\n'
        + i + "except Exception as _hud_exc:\n"
        + i + '    print("[hud] bridge disabled:", _hud_exc)\n'
    )


def stmt_end(lines, start):
    depth = 0; opened = False
    for i in range(start, min(len(lines), start + 200)):
        for ch in lines[i].split("#")[0]:
            if ch in "([{": depth += 1; opened = True
            elif ch in ")]}": depth -= 1
        if opened and depth <= 0: return i
    return start


def find(lines):
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(.+?)\.add_handlers\s*\(", line)
        if m and not m.group(2).strip().startswith(("def", "class")):
            return stmt_end(lines, i) + 1, m.group(1), m.group(2).strip(), "S1:add_handlers"
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)([A-Za-z_][\w\.]*)\s*=\s*.*Application\s*\(", line)
        if m:
            return stmt_end(lines, i) + 1, m.group(1), m.group(2), "S2:Application="
    return None


def main():
    if len(sys.argv) < 2:
        print("用法: register.sh <ossdiyservice.py> [--apply|--dry-run]"); return 2
    path = sys.argv[1]; apply_ = "--apply" in sys.argv
    if not os.path.isfile(path):
        print("FILE_NOT_FOUND"); return 3
    s = open(path, encoding="utf-8").read()
    if MARK in s:
        print("ALREADY_REGISTERED"); return 0
    lines = s.split("\n")
    hit = find(lines)
    if not hit:
        print("NO_INSERTION_POINT")
        for i, l in enumerate(lines):
            if any(k in l for k in ("G_APPLICATION", "add_handlers", "Application(")):
                print("%4d| %s" % (i + 1, l.rstrip()))
        return 3
    idx, indent, recv, strategy = hit
    print("STRATEGY:" + strategy); print("RECEIVER:" + recv); print("INSERT_AFTER_LINE:%d" % idx)
    new = lines[:idx] + build_block(indent, recv).split("\n")[:-1] + lines[idx:]
    if not apply_:
        print("DRY_RUN_OK"); return 0
    bak = path + ".bak." + time.strftime("%Y%m%d%H%M%S")
    shutil.copy2(path, bak)
    open(path, "w", encoding="utf-8").write("\n".join(new))
    try:
        py_compile.compile(path, cfile="/tmp/_hud272.pyc", doraise=True)
    except Exception as e:
        shutil.copy2(bak, path); print("SYNTAX_ERROR:" + str(e)); print("ROLLED_BACK"); return 4
    print("REGISTERED"); return 0


if __name__ == "__main__":
    sys.exit(main())
