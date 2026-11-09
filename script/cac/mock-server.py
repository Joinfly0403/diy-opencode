#!/usr/bin/env python3
# 本地 mock CAC 服务：用于在没有内网服务的环境里验证包装层与 provider 配置
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18080
TOKEN = "mock-token"
ACCOUNT = "mockuser"
MODELS = [
    {"modelId": "mock-chat", "des": "Mock Chat", "context": 32000,
     "routModels": [{"modelId": "mock-chat-large", "modelLevel": "large"}]},
    {"modelId": "mock-flash", "des": "Mock Flash", "context": 16000, "routModels": []},
]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + (fmt % args) + "\n")

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/chat/modles"):
            self._json(MODELS)
        elif self.path.startswith("/v1/models"):
            self._json({"object": "list", "data": [
                {"id": "mock-chat", "object": "model", "owned_by": "mock"},
                {"id": "mock-chat-large", "object": "model", "owned_by": "mock"},
            ]})
        elif self.path.startswith("/oauth2/authorize"):
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("mock authorize ok".encode("utf-8"))
        else:
            self._json({"error": "not found", "path": self.path}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        if self.path.startswith("/oauth/getToken"):
            self._json({"access_token": TOKEN, "refresh_token": "mock-refresh", "userAccount": ACCOUNT})
            return
        if self.path.startswith("/auth/internal/getUserDetail"):
            self._json({"data": {"w3account": ACCOUNT, "region": "y", "departmentPath": "000/111/222"}})
            return
        if self.path.startswith("/chat/completions"):
            try:
                body = json.loads(raw)
            except ValueError:
                body = {}
            if body.get("stream"):
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                for piece in ["你好", "，我是 mock 模型"]:
                    chunk = {"id": "mock", "object": "chat.completion.chunk",
                             "choices": [{"index": 0, "delta": {"content": piece}, "finish_reason": None}]}
                    self.wfile.write(("data: " + json.dumps(chunk, ensure_ascii=False) + "\n\n").encode("utf-8"))
                    self.wfile.flush()
                done = {"id": "mock", "object": "chat.completion.chunk",
                        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
                self.wfile.write(("data: " + json.dumps(done) + "\n\n").encode("utf-8"))
                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
                return
            self._json({
                "id": "mock", "object": "chat.completion", "model": body.get("model"),
                "choices": [{"index": 0, "finish_reason": "stop",
                             "message": {"role": "assistant", "content": "mock 回答：你好"}}],
                "usage": {"prompt_tokens": 3, "completion_tokens": 5, "total_tokens": 8},
            })
            return
        self._json({"error": "not found", "path": self.path}, 404)


if __name__ == "__main__":
    print("[mock] listening on " + str(PORT), flush=True)
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
