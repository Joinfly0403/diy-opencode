# cogagent HUD broker (M2)

安装：

    bash install-broker.sh

验证：

    systemctl status cogagent-hud-broker --no-pager
    curl -s http://127.0.0.1:18765/status

发起一次登录（返回 SSO 链接，浏览器打开授权）：

    curl -s -X POST http://127.0.0.1:18765/login/start
    # 记下返回的 ticket，然后轮询：
    curl -s "http://127.0.0.1:18765/login/status?ticket=<ticket>"

拿到 handle 后：

    H=<handle>
    curl -s -H "X-Hud-Handle: $H" http://127.0.0.1:18765/agent/sessions
    curl -sN -H "X-Hud-Handle: $H" http://127.0.0.1:18765/agent/events

注意：本机测试请加 --noproxy '*'，避免代理干扰。
