# OSSDesign 270.x

| 项 | 值 |
|---|---|
| 注册方式 | 平台自研 ROA：`rest.INIT_APPLICATION()` → `rest.REGISTER_SERVANT()` → `rest.START_APPLICATION()`；`OSSApplication` **没有 add_handlers** |
| 底层 | **Tornado 6.6**（`tornado.web` / `tornado.httpserver` / `tornado.ioloop`），`OSSRequestHandler` 继承 `tornado.web.RequestHandler` |
| 本项目做法 | 给 `tornado.web.Application.__init__` 打旁路，把 `/hud/*` **insert(0)** 到路由表最前（append 会被平台兜底 handler 吞掉） |
| 检测特征 | `ossdiyservice.py` 里**没有** `.add_handlers(`，但有 `rest.INIT_APPLICATION` |
| 前端位置 | **必须** `webapps/ossdesignwebsite/osmuwebsite_app/`（`plugin/` 目录不被静态服务认） |
| 其它注意 | ① 登录票据可能停在 serving（serve-only 不打印 listening 行）→ broker 用 `WAIT_READY_V1` 主动探测；② 桥白名单必须含 `login/reset`、`login/active` |
