#!/usr/bin/env python3
"""270 风格注册：Tornado Application.__init__ 旁路（不依赖 OSSApplication 内部结构）。"""
import sys, os, shutil, time
import py_compile

MARK = "HUD_BRIDGE_V6"

BLOCK = '''# HUD_BRIDGE_V6：HUD 路由插到 Tornado 路由表最前面（先于平台兜底 handler）
def _hud_install_bridge():
    import tornado.web as _tw
    from interface.hud_proxy import HudProxyHandler as _HudProxyHandler

    _HUD_PATTERN = r"/rest/ossdesign/v1/designer/hud/(.*)"
    _orig_init = _tw.Application.__init__
    _orig_add = _tw.Application.add_handlers

    def _log(msg):
        try:
            with open("/tmp/hud_boot.log", "a") as fp:
                fp.write(msg + "\\n")
        except Exception:
            pass

    def _hud_init(self, handlers=None, default_host=None, transforms=None, **settings):
        hs = list(handlers or [])
        if not any(isinstance(h, (list, tuple)) and len(h) >= 2 and "designer/hud" in str(h[0]) for h in hs):
            hs.insert(0, (_HUD_PATTERN, _HudProxyHandler))
        _log("[hud] app init: %d handlers, first=%s" % (len(hs), str(hs[0][0])[:60] if hs else "none"))
        return _orig_init(self, hs, default_host, transforms, **settings)

    def _hud_add(self, host_pattern, host_handlers, *a, **k):
        entries = list(host_handlers or [])
        if not any(isinstance(h, (list, tuple)) and len(h) >= 2 and "designer/hud" in str(h[0]) for h in entries):
            entries.append((_HUD_PATTERN, _HudProxyHandler))
        _log("[hud] add_handlers: %d entries" % len(entries))
        return _orig_add(self, host_pattern, entries, *a, **k)

    _tw.Application.__init__ = _hud_init
    _tw.Application.add_handlers = _hud_add
    _log("[hud] V6 preinstalled (prepend + add_handlers hook)")
    print("[hud] V6 preinstalled")

_hud_install_bridge()'''


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
    # 插在 import 段之后（模块级，早于 main 执行）
    idx = None
    for i, l in enumerate(lines):
        if l.startswith("import ") or l.startswith("from "):
            idx = i
    if idx is None:
        print("NO_INSERTION_POINT"); return 3
    print("STRATEGY:module-import-tail")
    print("INSERT_AFTER_LINE:%d" % (idx + 1))

    new = lines[:idx + 1] + [""] + BLOCK.split("\n") + lines[idx + 1:]
    if not apply_:
        print("DRY_RUN_OK"); return 0

    bak = path + ".bak." + time.strftime("%Y%m%d%H%M%S")
    shutil.copy2(path, bak)
    open(path, "w", encoding="utf-8").write("\n".join(new))
    try:
        py_compile.compile(path, cfile="/tmp/_hud270.pyc", doraise=True)
    except Exception as e:
        shutil.copy2(bak, path); print("SYNTAX_ERROR:" + str(e)); print("ROLLED_BACK"); return 4
    print("REGISTERED"); return 0


if __name__ == "__main__":
    sys.exit(main())
