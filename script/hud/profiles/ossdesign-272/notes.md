# OSSDesign 272.x

| 项 | 值 |
|---|---|
| 注册方式 | `ossdiyservice.py` 的 `main()` 里直接 `rest.G_APPLICATION.add_handlers(...)`（Tornado 应用） |
| 检测特征 | 文件里含 `.add_handlers(` |
| 前端位置 | `webapps/ossdesignwebsite/plugin/hud/` 或 `osmuwebsite_app/` 均可（本项目统一用后者） |
| 静态服务 | 允许 `plugin/` 子目录 |
| 已知注意 | 升级会替换 app_main.js，需重跑 deploy 补 bootstrap |
