#!/usr/bin/env python3
"""HUD 注册器：把 /rest/ossdesign/v1/designer/hud/* 挂到 OSSDesign 的 Tornado 应用上。

兼容多种 ossdiyservice.py 结构（新旧版本）：
  S1  已存在 <recv>.add_handlers(...) 调用   → 在该语句之后插入
  S2  存在 G_APPLICATION = ... 赋值         → 在赋值之后插入
  S3  main() 内出现 rest 导入                → 在 main() 开头插入（最后手段）

用法：
  python3 hud_register.py <ossdiyservice.py> --dry-run   只报告，不改
  python3 hud_register.py <ossdiyservice.py> --apply     修改（自动备份 + 语法校验）
  python3 hud_register.py <ossdiyservice.py> --force-s3  允许使用 S3

退出码：0 已注册/已存在；3 找不到插入点；4 语法校验失败
"""
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
    """从 start 行开始，按括号配平找到语句结束行（含分号续行处理）。"""
    depth = 0
    opened = False
    for i in range(start, min(len(lines), start + 200)):
        line = lines[i]
        j = 0
        while j < len(line):
            c = line[j]
            if c == "#":
                break
            if c in "([{":
                depth += 1
                opened = True
            elif c in ")]}":
                depth -= 1
            j += 1
        if opened and depth <= 0:
            return i
        if not opened and i > start:
            return i
    return start


def find_insert(lines):
    """返回 (行号, 缩进, receiver, 策略名) 或 None。"""
    # S1: 任意 .add_handlers( 调用
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(.+?)\.add_handlers\s*\(", line)
        if not m:
            continue
        indent, recv = m.group(1), m.group(2).strip()
        if recv in ("def", "class") or recv.startswith("#"):
            continue
        end = stmt_end(lines, i)
        return (end + 1, indent, recv, "S1:add_handlers")

    # S2: G_APPLICATION = ...
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)([A-Za-z_][\w\.]*)\s*=\s*.*Application\s*\(", line)
        if not m:
            continue
        indent, recv = m.group(1), m.group(2)
        end = stmt_end(lines, i)
        return (end + 1, indent, recv, "S2:G_APPLICATION=")
    return None


def main():
    if len(sys.argv) < 2:
        print("用法: hud_register.py <ossdiyservice.py> [--dry-run|--apply] [--force-s3]")
        return 2
    path = sys.argv[1]
    apply_ = "--apply" in sys.argv
    force_s3 = "--force-s3" in sys.argv
    if not os.path.isfile(path):
        print("FILE_NOT_FOUND:" + path)
        return 3

    s = open(path, encoding="utf-8").read()
    if MARK in s:
        print("ALREADY_REGISTERED")
        return 0

    lines = s.split("\n")
    hit = find_insert(lines)

    if hit is None and force_s3:
        for i, line in enumerate(lines):
            m = re.match(r"^(\s*)def\s+main\s*\(", line)
            if m and "import rest" in s:
                hit = (i + 1, m.group(1) + "    ", "rest.G_APPLICATION", "S3:main()")
                break

    if hit is None:
        print("NO_INSERTION_POINT")
        print("--- 诊断：含 G_APPLICATION / add_handlers / Application( 的行 ---")
        for i, line in enumerate(lines):
            if any(k in line for k in ("G_APPLICATION", "add_handlers", "Application(")):
                print("%4d| %s" % (i + 1, line.rstrip()))
        print("--- 前 20 行 ---")
        for i, line in enumerate(lines[:20]):
            print("%4d| %s" % (i + 1, line.rstrip()))
        return 3

    idx, indent, recv, strategy = hit
    block = build_block(indent, recv)
    print("STRATEGY:" + strategy)
    print("INSERT_AFTER_LINE:%d" % idx)
    print("RECEIVER:" + recv)
    print("INDENT:%d" % len(indent))

    new_lines = lines[:idx] + block.split("\n")[:-1] + lines[idx:]
    out = "\n".join(new_lines)

    if not apply_:
        print("--- 插入位置上下文 ---")
        lo = max(0, idx - 4)
        for k in range(lo, min(len(new_lines), idx + 12)):
            print("%4d| %s" % (k + 1, new_lines[k].rstrip()))
        print("DRY_RUN_OK（未修改）")
        return 0

    bak = path + ".bak." + time.strftime("%Y%m%d%H%M%S")
    shutil.copy2(path, bak)
    open(path, "w", encoding="utf-8").write(out)
    try:
        py_compile.compile(path, cfile="/tmp/_hud_reg_check.pyc", doraise=True)
    except Exception as exc:
        shutil.copy2(bak, path)
        print("SYNTAX_ERROR:" + str(exc))
        print("ROLLED_BACK")
        return 4
    print("REGISTERED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
