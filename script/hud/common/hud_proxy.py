#!/usr/bin/env python3
"""OSSDesign 侧的 HUD 桥。

放在 $APP_ROOT/pyscript/ossdesign/interface/hud_proxy.py
暴露 /rest/ossdesign/v1/designer/hud/*，把请求原样转给本机 broker（127.0.0.1:18765）。

约束（review 时可直接 grep）：
  - 不读 X-User-Name
  - 不读 /srv/cogagent（凭据只在 broker 手里）
  - 不 import ossdesign.domain.*

兼容 Tornado 4.x / 5.x / 6.x：统一用 tornado.gen.coroutine。
"""

import json

from tornado import gen
from tornado.httpclient import AsyncHTTPClient, HTTPRequest
from tornado.web import RequestHandler

BROKER = "http://127.0.0.1:18765"  # STREAM_DIAG_V1
TIMEOUT = 60
STREAM_TIMEOUT = 86400


def _diag(msg):
    try:
        with open("/tmp/hud_bridge.log", "a") as fh:
            fh.write(msg + "\n")
    except Exception:
        pass
ROUTES = {
    "status": ("GET", "/status"),
    "login/start": ("POST", "/login/start"),
    "login/status": ("GET", "/login/status"),
    "login/cancel": ("POST", "/login/cancel"),
    "login/reset": ("POST", "/login/reset"),
    "login/active": ("GET", "/login/active"),
    "macro/list": ("GET", "/agent/macro/list"),
    "macro/get": ("GET", "/agent/macro/get"),
    "macro/save": ("POST", "/agent/macro/save"),
    "macro/delete": ("POST", "/agent/macro/delete"),
    "macro/run": ("POST", "/agent/macro/run"),
    "macro/result": ("POST", "/agent/macro/result"),
    "macro/pending": ("GET", "/agent/macro/pending"),
    "macro/runs": ("GET", "/agent/macro/runs"),
    "macro/whoami": ("GET", "/agent/macro/whoami"),
    "macro/cancel": ("POST", "/agent/macro/cancel"),
    "logout": ("POST", "/logout"),
    "sessions": ("GET", "/agent/sessions"),
    "session": ("POST", "/agent/session"),
    "messages": ("GET", "/agent/messages"),
    "prompt": ("POST", "/agent/prompt"),
    "reply": ("POST", "/agent/reply"),
    "interrupt": ("POST", "/agent/interrupt"),
    "forms": ("GET", "/agent/forms"),
    "form/reply": ("POST", "/agent/form/reply"),
    "events": ("GET", "/agent/events"),
}


class HudProxyHandler(RequestHandler):
    """一个 handler 覆盖 hud 下所有路径。"""

    def set_default_headers(self):
        self.set_header("Cache-Control", "no-store")

    @gen.coroutine
    def get(self, route):
        yield self.dispatch("GET", route)

    @gen.coroutine
    def post(self, route):
        yield self.dispatch("POST", route)

    @gen.coroutine
    def dispatch(self, method, route):
        route = (route or "").strip("/")
        mapping = ROUTES.get(route)
        if mapping:
            expect, target = mapping
            if expect != method:
                self.set_status(405)
                self.finish(json.dumps({"error": "method_not_allowed"}))
                return
        else:
            # PASSTHROUGH_V1: 未登记的路由一律转发到 broker 的 /agent/<route>
            target = "/agent/" + route

        query = self.request.query
        url = BROKER + target + (("?" + query) if query else "")
        headers = {"Accept": "application/json, text/event-stream"}
        handle = self.request.headers.get("X-Hud-Handle")
        if handle:
            headers["X-Hud-Handle"] = handle
        body = None
        if method == "POST":
            body = self.request.body or b"{}"
            headers["Content-Type"] = "application/json"

        web_user = self.request.headers.get("X-User-Name")   # WEB_USER_V1
        if web_user:
            headers["X-Hud-Web-User"] = web_user

        if route == "events":
            yield self.stream(url, headers)
            return

        request = HTTPRequest(url, method=method, body=body, headers=headers,
                              request_timeout=TIMEOUT, follow_redirects=False)
        try:
            response = yield AsyncHTTPClient().fetch(request, raise_error=False)
        except Exception as exc:  # noqa: BLE001
            self.set_status(502)
            self.finish(json.dumps({"error": "broker_unreachable", "detail": str(exc)}))
            return
        self.set_status(response.code)
        self.set_header("Content-Type", response.headers.get("Content-Type", "application/json; charset=utf-8"))
        self.finish(response.body or b"")

    @gen.coroutine
    def stream(self, url, headers):  # STREAM_FUTURE_V6
        import socket
        import threading
        from tornado.concurrent import Future
        from tornado.ioloop import IOLoop, PeriodicCallback
        from urllib.parse import urlparse as _urlparse

        self.set_header("Content-Type", "text/event-stream")
        self.set_header("Cache-Control", "no-store")
        self.set_header("X-Accel-Buffering", "no")

        u = _urlparse(url)
        host = u.hostname or "127.0.0.1"
        port = u.port or 80
        path = u.path + (("?" + u.query) if u.query else "")
        handle = headers.get("X-Hud-Handle") or ""

        loop = IOLoop.current()
        state = {"done": False}
        done_future = Future()

        try:
            self.write(b": open\n\n")
            self.flush()
            _diag("[stream] opened")
        except Exception as exc:
            _diag("[stream] write ERROR " + repr(exc))
            state["done"] = True

        def beat():
            if state["done"]:
                return
            try:
                self.write(b": ping\n\n")
                self.flush()
            except Exception:
                state["done"] = True

        pc = PeriodicCallback(beat, 5000)
        pc.start()

        def push(chunk):
            if state["done"]:
                return
            try:
                self.write(chunk)
                self.flush()
            except Exception:
                state["done"] = True

        def finish_stream():
            try:
                pc.stop()
            except Exception:
                pass
            if not state["done"]:
                state["done"] = True
                try:
                    self.finish()
                except Exception:
                    pass
            if not done_future.done():
                done_future.set_result(None)

        def pump():
            try:
                sock = socket.create_connection((host, port), timeout=10)
                sock.settimeout(None)
                req = (
                    "GET " + path + " HTTP/1.1\r\n"
                    "Host: " + str(host) + ":" + str(port) + "\r\n"
                    "Accept: text/event-stream\r\n"
                    "X-Hud-Handle: " + handle + "\r\n"
                    "Connection: close\r\n\r\n"
                )
                sock.sendall(req.encode("utf-8"))
                _diag("[stream] request sent")
                buf = b""
                header_done = False
                while True:
                    data = sock.recv(4096)
                    if not data:
                        break
                    if not header_done:
                        buf += data
                        idx = buf.find(b"\r\n\r\n")
                        if idx < 0:
                            continue
                        head = buf[:idx]
                        rest = buf[idx + 4:]
                        header_done = True
                        status = head.split(b"\r\n")[0]
                        _diag("[stream] " + status.decode("latin1", "ignore"))
                        if b" 200 " not in status:
                            break
                        if rest:
                            loop.add_callback(push, rest)
                        continue
                    loop.add_callback(push, data)
                try:
                    sock.close()
                except Exception:
                    pass
            except Exception as exc:
                _diag("[stream] socket ERROR " + repr(exc))
            finally:
                loop.add_callback(finish_stream)

        t = threading.Thread(target=pump, name="hud-sse")
        t.daemon = True
        t.start()

        yield done_future
