/* cogagent HUD v1 — 单文件浮窗（Shadow DOM，无外部依赖） */
(function () {
  if (window.__COGAGENT_HUD__) return;

  // ERRHOOK_V23：把真实出错位置打出来
  try {
    window.addEventListener("error", function (e) {
      console.log("[hud] ERROR", e.message, "| at", e.filename, ":", e.lineno, ":", e.colno);
      if (e.error && e.error.stack) console.log("[hud] STACK", e.error.stack);
    });
    window.addEventListener("unhandledrejection", function (e) {
      console.log("[hud] REJECT", String(e.reason && (e.reason.stack || e.reason.message || e.reason)));
    });
    console.log("[hud] version", "V24", "loaded at", new Date().toISOString());
  } catch (e) {}
  window.__COGAGENT_HUD__ = true;

  var API = "/rest/ossdesign/v1/designer/hud";
  var LS_KEY = "ossdesign.hud.v1";
  var CSS = [
    ".item .del{opacity:0;transition:opacity .12s}",       // HOVERBTN_V58
    ".item:hover .del{opacity:1}",
    ".sendcol{display:flex;flex-direction:column;gap:4px;align-items:stretch}",
    ".listening{color:#dc2626 !important;animation:hudpulse 1.2s infinite}",
    "@keyframes hudpulse{50%{opacity:.35}}",
    ":host{all:initial}",
    ".ball{position:fixed;right:24px;bottom:24px;width:56px;height:56px;border-radius:50%;letter-spacing:.5px;font-size:12px;",
    "background:#2F6BFF;color:#fff;display:flex;align-items:center;justify-content:center;",
    "font:600 13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;cursor:pointer;",
    "box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:2147483000;user-select:none}",
    ".panel{position:fixed;right:24px;bottom:92px;width:min(760px,92vw);height:min(620px,80vh);",
    "background:#fff;color:#1f2329;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);",
    "display:flex;flex-direction:column;overflow:hidden;z-index:2147483001;",
    "font:13px/1.6 system-ui,-apple-system,'Segoe UI',sans-serif}",
    ".hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #e9ecf0;",
    "background:#f7f9fc;cursor:move}",
    ".dot{width:8px;height:8px;border-radius:50%;background:#c9ced6}",
    ".dot.ok{background:#22a06b}.dot.bad{background:#d64545}.dot.wait{background:#e0a400}",
    ".hd b{font-weight:600}.hd .sp{flex:1}",
    ".btn{border:1px solid #d8dde5;background:#fff;border-radius:6px;padding:3px 9px;cursor:pointer;",
    "font:inherit;color:inherit}.btn:hover{background:#f0f3f8}",
    ".btn.primary{background:#2F6BFF;border-color:#2F6BFF;color:#fff}",
    ".body{flex:1;display:flex;min-height:0}",
    ".list{width:190px;border-right:1px solid #e9ecf0;display:flex;flex-direction:column;background:#fbfcfe}",
    ".list .top{display:flex;gap:6px;padding:8px}",
    ".list .items{flex:1;overflow:auto}",
    ".item{padding:7px 10px;border-bottom:1px solid #f0f2f6;cursor:pointer;font-size:12px}",
    ".item:hover{background:#f2f6ff}.item.on{background:#e8f0ff}",
    ".search{margin:0 8px 8px;padding:4px 8px;border:1px solid #d8dde5;border-radius:6px;font:inherit;font-size:12px}", // SEARCH_V39
    ".item .del{float:right;color:#9aa3af;font-weight:700;padding:0 2px;cursor:pointer}",
    ".item .del:hover{color:#d64545}",
    ".item .t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".item .s{color:#7a828e;font-size:11px}",
    ".chat{flex:1;display:flex;flex-direction:column;min-width:0}",
    ".msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px;",
    "overflow-anchor:none;overscroll-behavior:contain}",
    ".m{max-width:82%;padding:8px 10px;border-radius:10px;white-space:pre-wrap;word-break:break-word}",
    ".m.user{align-self:flex-end;background:#e8f0ff}",
    ".reason{margin:2px 0 6px;font-size:12px;color:#6b7280}",
    ".reason summary{cursor:pointer;color:#64748b}",
    ".reason pre{margin:4px 0 0;background:#f8fafc;border:1px solid #e5e7eb;color:#475569;",
    "padding:6px;border-radius:6px;white-space:pre-wrap;max-height:200px;overflow:auto}",
    ".m.assistant{position:relative}",
    ".m.assistant.has-copy{padding-bottom:20px}",
    ".copyicon{position:absolute;bottom:3px;right:4px;font-size:10px;padding:0 5px;border-radius:4px;", // COPYBOTTOM_V52
    "border:1px solid #d8dde5;background:#fff;color:#64748b;cursor:pointer;opacity:0;transition:opacity .15s}",
    ".m.assistant:hover .copyicon{opacity:.9}",
    ".usage{color:#7a828e;font-size:11px;margin-left:6px}", // REASON_V51
    ".m.assistant{align-self:flex-start;background:#f4f6f9}",
    ".m.sys{align-self:center;background:#fff6e5;color:#8a6d3b;font-size:12px}",
    ".m.assistant p{margin:0 0 6px}.m.assistant p:last-child{margin-bottom:0}",
    ".m.assistant pre{background:#0f172a;color:#e2e8f0;padding:8px;border-radius:6px;overflow:auto;font-size:12px}",
    ".m.assistant code{background:#eef2f7;padding:1px 4px;border-radius:4px;font-size:12px}",
    ".m.assistant pre code{background:none;padding:0;color:inherit}",
    ".m.assistant ul,.m.assistant ol{margin:4px 0 6px 18px;padding:0}",
    ".m.assistant a{color:#2F6BFF}",
    ".m.assistant table{border-collapse:collapse;margin:6px 0;font-size:12px;display:block;overflow:auto}", // MD_TABLE_V37
    ".m.assistant th,.m.assistant td{border:1px solid #d8dde5;padding:4px 8px;text-align:left}",
    ".m.assistant th{background:#eef2f7;font-weight:600}",
    ".m.assistant h3,.m.assistant h4,.m.assistant h5{margin:6px 0 4px}",
    ".codewrap{position:relative}",
    ".copybtn{position:absolute;top:4px;right:4px;font-size:11px;padding:1px 6px;border-radius:4px;",
    "border:1px solid #334155;background:#1e293b;color:#cbd5e1;cursor:pointer;opacity:.85}",
    ".copybtn:hover{opacity:1}",
    ".toolcard{align-self:flex-start;max-width:82%;border:1px solid #dbe2ea;background:#f8fafc;",
    "border-radius:8px;padding:6px 8px;font-size:12px;color:#334155}",
    ".toolcard .toolhd{font-weight:600}",
    ".toolcard details{margin-top:4px}",
    ".toolcard summary{cursor:pointer;color:#64748b}",
    ".toolcard pre{margin:4px 0 0;background:#0f172a;color:#e2e8f0;padding:6px;border-radius:6px;",
    "max-height:180px;overflow:auto;font-size:11px;white-space:pre-wrap;word-break:break-word}",
    ".card{align-self:flex-start;border:1px solid #ffd8a8;background:#fff9f0;border-radius:10px;padding:8px 10px;font-size:12px}",
    ".card .row{display:flex;gap:6px;margin-top:6px}",
    ".composer{border-top:1px solid #e9ecf0;padding:8px;display:flex;flex-direction:column;gap:6px}",
    ".crow{display:flex;gap:8px;align-items:flex-end}",
    ".modelsel{max-width:100%;font-size:11px;padding:2px 4px;border-radius:4px;border:1px solid #d8dde5;",
    "background:#fff;color:#334155;text-overflow:ellipsis}", // LAYOUT_V25
    ".composer textarea{flex:1;resize:none;min-height:34px;max-height:120px;padding:8px;border:1px solid #d8dde5;",
    "border-radius:8px;font:inherit;outline:none}",
    ".empty{padding:16px;color:#7a828e;font-size:12px}",
    ".toast{position:absolute;left:12px;right:12px;bottom:64px;background:#ffeaea;color:#a12626;",
    "border:1px solid #f3c2c2;border-radius:8px;padding:6px 10px;font-size:12px;display:none}",
    ".toast.ok{background:#e8f0ff;color:#1e40af;border-color:#bfdbfe}", // TOAST_V26
    ".connect{padding:22px;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;",
    ".modelsel{max-width:190px;font:inherit;font-size:12px;padding:3px 4px;border:1px solid #d8dde5;",
    "border-radius:6px;background:#fff;color:#1f2329}",
    ".spin{display:inline-block;width:10px;height:10px;border:2px solid #cbd5e1;border-top-color:#2F6BFF;",
    "border-radius:50%;animation:hudspin .8s linear infinite;vertical-align:-1px}",
    "@keyframes hudspin{to{transform:rotate(360deg)}}",
    ".thinking{color:#6b7280;font-style:italic}",
    ".resizer{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;",
    "background:linear-gradient(135deg,transparent 50%,#c9ced6 50%);border-bottom-right-radius:12px}",
    "height:100%;text-align:center;color:#4b5563}"
  ].join("");

  var state = { handle: null, account: "", sessions: [], active: null, msgs: {}, msgsSig: {}, conn: "idle", ticket: null, models: [], query: "" }; // STATE_MODELS_V24

  var host = document.createElement("div");
  host.id = "cogagent-hud-host";
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  var ball = el("div", "ball", "COG"); // BRAND_V38
  ball.style.pointerEvents = "auto";
  root.appendChild(ball);

  var panel = el("div", "panel");
  panel.style.display = "none";
  panel.style.pointerEvents = "auto";
  root.appendChild(panel);

  var toast = el("div", "toast");
  panel.appendChild(toast);

  var hd = el("div", "hd");
  var dot = el("span", "dot");
  var title = el("b", "", "cog助手"); // BRAND_V38
  var statusText = el("span", "s", "");
  statusText.style.color = "#7a828e";
  statusText.style.fontSize = "11px";
  var spacer = el("span", "sp");
  var minBtn = el("button", "btn", "—");

  hd.appendChild(dot); hd.appendChild(title); hd.appendChild(statusText); hd.appendChild(spacer); hd.appendChild(minBtn);

  var spinEl = el("span", "spin");
  spinEl.style.display = "none";
  hd.insertBefore(spinEl, statusText);
  var usageEl = el("span", "usage", "");  // REASON_V51
  hd.insertBefore(usageEl, spacer);
  panel.appendChild(hd);

  var body = el("div", "body");
  panel.appendChild(body);

  var listBox = el("div", "list");
  var listTop = el("div", "top");
  var newBtn = el("button", "btn primary", "+ 新建");
  listTop.appendChild(newBtn);
  var items = el("div", "items");
  var search = document.createElement("input"); // SEARCH_V39
  search.className = "search";
  search.placeholder = "搜索会话…";
  search.oninput = function () { state.query = search.value.trim(); renderList(); };
  listBox.appendChild(listTop); listBox.appendChild(search); listBox.appendChild(items);
  body.appendChild(listBox);

  var chat = el("div", "chat");
  var msgs = el("div", "msgs");
  var composer = el("div", "composer");
  var input = document.createElement("textarea");
  input.placeholder = "输入消息，Enter 发送，Shift+Enter 换行";
  var sendBtn = el("button", "btn primary", "发送");
  var modelSel = document.createElement("select"); // MODEL_V19
  modelSel.className = "modelsel";
  modelSel.title = "切换模型（对当前会话后续生效）";
  var modeSel = document.createElement("select"); // PERMMODE_V40
  modeSel.className = "modelsel";
  modeSel.title = "权限模式：询问（默认）或 全放行（bypass）";
  [["ask", "询问（默认）"], ["bypass", "全放行 bypass"]].forEach(function (o) {
    var op = document.createElement("option");
    op.value = o[0]; op.textContent = o[1];
    modeSel.appendChild(op);
  });
  var agentSel = document.createElement("select");   // AGENTMODE_V59
  agentSel.className = "modelsel";
  agentSel.title = "用户模式=只读规划；开发者模式=可修改执行";
  [["plan", "用户模式"], ["build", "开发者模式"]].forEach(function (o) {
    var op = document.createElement("option");
    op.value = o[0]; op.textContent = o[1];
    agentSel.appendChild(op);
  });
  var topRow = el("div", "crow");
  topRow.appendChild(modelSel); topRow.appendChild(agentSel); topRow.appendChild(modeSel);
  var stopBtn = el("button", "btn", "■");   // STOP_MOVE_V46
  stopBtn.title = "中断当前执行";
  stopBtn.style.display = "none";
  stopBtn.style.color = "#d64545";
  var micBtn = el("button", "btn", "🎤");   // MIC_V53
  micBtn.title = "语音输入（Web Speech API，Chrome/Edge）";
  var crow = el("div", "crow");
  var sendCol = el("div", "sendcol");   // MIC_ABOVE_V54
  sendCol.appendChild(micBtn);
  sendCol.appendChild(sendBtn);
  crow.appendChild(input); crow.appendChild(stopBtn); crow.appendChild(sendCol);
  composer.appendChild(topRow); composer.appendChild(crow);  // LAYOUT_V25
  chat.appendChild(msgs); chat.appendChild(composer);
  body.appendChild(chat);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ handle: state.handle, account: state.account, active: state.active }));
    } catch (e) {}
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }

  function showToast(msg, kind) { // TOAST_V26
    toast.textContent = msg;
    toast.className = "toast" + (kind === "ok" ? " ok" : "");
    toast.style.display = "block";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.style.display = "none"; }, kind === "ok" ? 600 : 4000);
  }

  function setStatus(kind, text) {
    dot.className = "dot" + (kind === "ok" ? " ok" : kind === "bad" ? " bad" : kind === "wait" ? " wait" : "");
    statusText.textContent = text || "";
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign(
      { roarand: (window.common && window.common.csrfToken) || "" },
      opts.headers || {}
    );
    if (state.handle) headers["X-Hud-Handle"] = state.handle;
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401) {
        resetLogin();
        throw new Error("登录已失效，请重新连接");
      }
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((data && (data.error || data.detail)) || ("HTTP " + r.status));
        return data;
      });
    });
  }

  function resetLogin() {
    state.handle = null; state.account = ""; state.sessions = []; state.active = null; state.msgs = {};
    setStatus("bad", "未连接");
    renderConnect();
    save();
  }

  function renderConnect() {
    items.innerHTML = "";
    msgs.innerHTML = "";
    var box = el("div", "connect");
    var p1 = el("div", "", "尚未连接 cogagent");
    var p2 = el("div", "", "点击下方按钮，用你的 w3 账号完成授权");
    p2.style.color = "#7a828e";
    var b = el("button", "btn primary", "连接 cogagent");
    b.onclick = startLogin;
    box.appendChild(p1); box.appendChild(p2); box.appendChild(b);
    msgs.appendChild(box);
  }

  function startLogin() {   // LOGIN_RETRY_V2
    doStartLogin(true);
  }

  function doStartLogin(canRetry) {
    setStatus("wait", "正在发起登录…");
    api("/login/start", { method: "POST" }).then(function (d) {
      state.ticket = d.ticket;
      if (d.url) window.open(d.url, "_blank");
      showToast("已在新标签页打开登录页，完成授权后会自动连接", "ok");
      pollLogin(0);
    }).catch(function (e) {
      var msg = String(e.message || e);
      if (canRetry && msg.indexOf("另一个登录") >= 0) {
        showToast("检测到残留登录，正在重置…", "ok");
        api("/login/reset", { method: "POST" }).then(function () {
          setTimeout(function () { doStartLogin(false); }, 600);
        }).catch(function () { setStatus("bad", msg); showToast(msg); });
        return;
      }
      setStatus("bad", msg);
      showToast(msg);
    });
  }

  function pollLogin(n) {
    if (!state.ticket) return;
    if (n > 150) { setStatus("bad", "登录超时"); return; }
    api("/login/status?ticket=" + encodeURIComponent(state.ticket)).then(function (d) {
      if (d.state === "ready") {
        state.handle = d.handle;
        state.account = d.account || "";
        state.ticket = null;
        setStatus("ok", state.account ? state.account + " 已连接" : "已连接");
        save();
        loadSessions();
        connectSSE();
        macroStart();   // MACRO_BOOT_V2
        return;
      }
      if (d.state === "failed") {
        setStatus("bad", d.reason || "登录失败");
        showToast(d.reason || "登录失败，请重试");
        return;
      }
      setTimeout(function () { pollLogin(n + 1); }, 2000);
    }).catch(function () { setTimeout(function () { pollLogin(n + 1); }, 2000); });
  }

  function loadSessions() {
    api("/sessions").then(function (d) {
      if (typeof macroStart === "function") macroStart();   // MACRO_BOOT_V2
      var arr = (d && d.data) || [];
      state.sessions = arr.map(function (s) {
        if (!state.usage) state.usage = {};
        if (s.tokens) state.usage[s.id] = { cost: s.cost, tokens: s.tokens };
        return { id: s.id, title: s.title || s.id, time: (s.time && s.time.updated) || 0, model: s.model || null, agent: s.agent || null };
      });
      renderList();
      syncModelSelect();
      if (!state.active && state.sessions.length) selectSession(state.sessions[0].id);
      if (!state.sessions.length) {
        msgs.innerHTML = "";
        msgs.appendChild(el("div", "empty", "还没有会话，点左上角「+ 新建」开始"));
      }
    }).catch(function (e) { showToast(String(e.message || e)); });
  }

  function renderList() { // SEARCH_V39
    items.innerHTML = "";
    var q = (state.query || "").toLowerCase();
    var shown = 0;
    state.sessions.forEach(function (s) {
      var title = s.title || s.id;
      if (q && title.toLowerCase().indexOf(q) < 0 && s.id.toLowerCase().indexOf(q) < 0) return;
      shown++;
      var it = el("div", "item" + (state.active === s.id ? " on" : ""));   // RENAME2_V57
      it.dataset.sid = s.id;
      var t = el("div", "t", title);
      t.title = "双击重命名";                              // RENAME_V56
      t.ondblclick = function (e) { e.stopPropagation(); renameSession(s.id, title, t); };
      var pen = el("span", "del", "✎");   // RENAME2_V57
      pen.title = "重命名";
      pen.onclick = function (e) { e.stopPropagation(); renameSession(s.id, title, t); };
      t.appendChild(pen);
      var del = el("span", "del", "×");
      del.title = "删除这个会话";
      del.onclick = function (e) {
        e.stopPropagation();
        if (!window.confirm("删除会话「" + title + "」？此操作不可恢复。")) return;
        api("/session/delete", { method: "POST", body: { sessionID: s.id } })
          .then(function () {
            if (state.active === s.id) { state.active = null; state.msgs[s.id] = null; msgs.innerHTML = ""; }
            loadSessions();
            showToast("已删除会话", "ok");
          })
          .catch(function (err) { showToast("删除失败：" + String(err.message || err)); });
      };
      t.appendChild(del);
      it.appendChild(t);
      it.appendChild(el("div", "s", s.id.slice(0, 12) + "…"));
      it.onclick = function () { selectSession(s.id); };
      items.appendChild(it);
    });
    if (!shown) items.appendChild(el("div", "empty", state.query ? "没有匹配的会话" : "还没有会话"));
  }

  items.addEventListener("dblclick", function (e) {   // RENAME2_V57
    var t = e.target && e.target.closest ? e.target.closest(".t") : null;
    var item = e.target && e.target.closest ? e.target.closest(".item") : null;
    if (!t || !item || !item.dataset.sid) return;
    e.stopPropagation();
    var sid2 = item.dataset.sid;
    var cur = "";
    for (var i = 0; i < state.sessions.length; i++) if (state.sessions[i].id === sid2) cur = state.sessions[i].title || state.sessions[i].id;
    renameSession(sid2, cur, t);
  });

  function selectSession(id) {
    state.active = id;
    renderList();
    syncModelSelect();
    syncAgentMode();
    syncPermMode();   // PERMMODE_V40
    refreshMessages();
    save();
  }

  function refreshMessages() { // PAGING_V42：首屏只取最新 30 条
    if (!state.active) return;
    var sid = state.active;
    api("/messages?sessionID=" + encodeURIComponent(sid) + "&order=desc&limit=30").then(function (d) {
      var desc = (d && d.data) || [];
      var arr = desc.slice().reverse();
      if (!state.cursor) state.cursor = {};
      if (!state.hasMore) state.hasMore = {};
      state.cursor[sid] = (d && d.cursor && d.cursor.previous) || null;
      state.hasMore[sid] = !!state.cursor[sid];
      var sig = arr.map(function (m) { return m.id + ":" + (m.content ? m.content.length : 0); }).join("|") + "|p" + arr.length;
      var same = sig === state.msgsSig[sid];
      state.msgs[sid] = arr;
      if (same) { loadForms(); loadPermissions(); return; }
      state.msgsSig[sid] = sig;
      if (typeof streamState !== "undefined" && streamState.text) { loadForms(); loadPermissions(); return; }
      if (sid === state.active) renderMessages();
      loadForms(); loadPermissions();
    }).catch(function (e) { showToast(String(e.message || e)); });
  }

  function loadMore() { // PAGING_V42：向上加载更早的 30 条
    var sid = state.active;
    var cur = state.cursor && state.cursor[sid];
    if (!sid || !cur) return;
    // PAGING_V44：cursor 不能与 order 同时出现
    api("/messages?sessionID=" + encodeURIComponent(sid) + "&limit=30&cursor=" + encodeURIComponent(cur)).then(function (d) {
      var older = ((d && d.data) || []).slice().reverse();
      if (!older.length) { state.hasMore[sid] = false; renderMessages(); return; }
      state.msgs[sid] = older.concat(state.msgs[sid] || []);
      state.cursor[sid] = (d && d.cursor && d.cursor.previous) || null;
      state.hasMore[sid] = !!state.cursor[sid];
      var box = msgs;
      var prevH = box.scrollHeight - box.scrollTop;
      renderMessages();
      box.scrollTop = box.scrollHeight - prevH;   // 保持视口位置
    }).catch(function (e) { showToast("加载更多失败：" + String(e.message || e)); });
  }
  function textOf(m) { // TEXTOF_V2
    if (typeof m.text === "string" && m.text) return m.text;
    var parts = m.content || (m.payload && m.payload.parts) || [];
    var out = [];
    if (Array.isArray(parts)) {
      parts.forEach(function (p) {
        if (!p) return;
        if (p.type === "text" && typeof p.text === "string" && p.text) { out.push(p.text); return; }
        if (p.type === "reasoning") return;
        if (p.type === "tool") {
          var st = (p.state && p.state.status) || "";
          out.push("[工具] " + (p.name || "tool") + (st ? " · " + st : ""));
          return;
        }
        if (typeof p.text === "string" && p.text) out.push(p.text);
      });
    }
    if (out.length) return out.join("\n");
    var q = m.payload || {};
    if (typeof q.text === "string" && q.text) return q.text;
    return "";
  }

  function copyText(text) { // COPY_V10
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) resolve(); else reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  function enhanceCode(rootEl) {
    var pres = rootEl.querySelectorAll("pre");
    for (var i = 0; i < pres.length; i++) {
      (function (pre) {
        if (pre.parentNode && pre.parentNode.className === "codewrap") return;
        var wrap = el("div", "codewrap");
        pre.parentNode.insertBefore(wrap, pre);
        wrap.appendChild(pre);
        var btn = el("button", "copybtn", "复制");
        btn.onclick = function () {
          var code = pre.innerText || pre.textContent || "";
          copyText(code).then(function () {
            btn.textContent = "已复制";
            setTimeout(function () { btn.textContent = "复制"; }, 1500);
          }).catch(function () { btn.textContent = "复制失败"; });
        };
        wrap.appendChild(btn);
      })(pres[i]);
    }
  }

  function mdEsc(v) { // MD_RENDER_V9
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mdInline(v) {
    v = v.replace(/`([^`]+)`/g, "<code>$1</code>");
    v = v.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    v = v.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    v = v.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return v;
  }

  function mdCells(line) { // MD_TABLE_V37
    var t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return t.split("|").map(function (c) { return c.trim(); });
  }

  function mdIsSep(line) {
    return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
  }

  function mdTable(head, rows) {
    var out = ["<table><thead><tr>"];
    head.forEach(function (c) { out.push("<th>" + mdInline(c) + "</th>"); });
    out.push("</tr></thead><tbody>");
    rows.forEach(function (r) {
      out.push("<tr>");
      for (var i = 0; i < head.length; i++) out.push("<td>" + mdInline(r[i] || "") + "</td>");
      out.push("</tr>");
    });
    out.push("</tbody></table>");
    return out.join("");
  }

  function mdToHtml(text) {
    var lines = mdEsc(text).split("\n");
    var out = [], code = [], inCode = false, list = null;

    function flushList() {
      if (list) { out.push("</" + list + ">"); list = null; }
    }

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (/^```/.test(ln)) {
        if (inCode) { out.push("<pre><code>" + code.join("\n") + "</code></pre>"); code = []; inCode = false; }
        else { flushList(); inCode = true; }
        continue;
      }
      if (inCode) { code.push(ln); continue; }
      if (/^\s*[-*]\s+/.test(ln)) {
        if (list !== "ul") { flushList(); out.push("<ul>"); list = "ul"; }
        out.push("<li>" + mdInline(ln.replace(/^\s*[-*]\s+/, "")) + "</li>");
        continue;
      }
      if (/^\s*\d+\.\s+/.test(ln)) {
        if (list !== "ol") { flushList(); out.push("<ol>"); list = "ol"; }
        out.push("<li>" + mdInline(ln.replace(/^\s*\d+\.\s+/, "")) + "</li>");
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && mdIsSep(lines[i + 1])) {
        flushList();
        var head = mdCells(ln);
        var rows = [];
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(mdCells(lines[i])); i++; }
        i--;
        out.push(mdTable(head, rows));
        continue;
      }
      flushList();
      var h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        var tag = "h" + (h[1].length + 2);
        out.push("<" + tag + ">" + mdInline(h[2]) + "</" + tag + ">");
        continue;
      }
      if (/^\s*$/.test(ln)) { out.push(""); continue; }
      out.push("<p>" + mdInline(ln) + "</p>");
    }
    if (inCode) out.push("<pre><code>" + code.join("\n") + "</code></pre>");
    flushList();
    return out.join("");
  }

  function attachCopy(container, text) { // COPYBOTTOM_V52
    container.classList.add("has-copy");
    var b = el("button", "copyicon", "复制");
    b.onclick = function (e) {
      e.stopPropagation();
      copyText(text).then(function () {
        b.textContent = "已复制"; setTimeout(function () { b.textContent = "复制"; }, 1200);
      }).catch(function () {
        b.textContent = "失败"; setTimeout(function () { b.textContent = "复制"; }, 1200);
      });
    };
    container.appendChild(b);
  }

  function addTextBubble(txt) {
    if (!txt) return;
    var b = el("div", "m assistant");
    b.innerHTML = mdToHtml(txt);
    enhanceCode(b);
    attachCopy(b, txt);
    msgs.appendChild(b);
  }

  function addReasoningBlock(text) {
    if (!text) return;
    var d = document.createElement("details");
    d.className = "reason";
    var sm = document.createElement("summary");
    sm.textContent = "思考过程（" + text.length + " 字）";
    d.appendChild(sm);
    var pre = document.createElement("pre");
    pre.textContent = text;
    d.appendChild(pre);
    msgs.appendChild(d);
  }

  function addToolCard(p) {
    var card = el("div", "toolcard");
    var st = (p.state && p.state.status) || "";
    var hd2 = el("div", "toolhd", "🔧 " + (p.name || "tool") + (st ? " · " + st : ""));
    card.appendChild(hd2);
    var inp = p.state && p.state.input;
    if (inp) {
      var det = document.createElement("details");
      var sum = document.createElement("summary");
      sum.textContent = "参数";
      det.appendChild(sum);
      var pre = document.createElement("pre");
      var txt = "";
      try { txt = JSON.stringify(inp, null, 2); } catch (e) { txt = String(inp); }
      pre.textContent = txt.length > 2000 ? txt.slice(0, 2000) + "…" : txt;
      det.appendChild(pre);
      card.appendChild(det);
    }
    var outp = p.state && p.state.output;  // TOOLOUT_V18
    if (outp !== undefined && outp !== null && outp !== "") {
      var d2 = document.createElement("details");
      var s2 = document.createElement("summary");
      s2.textContent = "输出";
      d2.appendChild(s2);
      var pre2 = document.createElement("pre");
      var t2 = "";
      try { t2 = typeof outp === "string" ? outp : JSON.stringify(outp, null, 2); } catch (e) { t2 = String(outp); }
      pre2.textContent = t2.length > 3000 ? t2.slice(0, 3000) + "…" : t2;
      d2.appendChild(pre2);
      card.appendChild(d2);
    }
    msgs.appendChild(card);
  }

  function renderAssistant(m) {
    var parts = m.content || [];
    if (!Array.isArray(parts) || !parts.length) { addTextBubble(textOf(m)); return; }
    var buf = [], reason = [];
    function flush() { if (buf.length) { addTextBubble(buf.join("\n")); buf = []; } }
    parts.forEach(function (pt) {
      if (!pt) return;
      if (pt.type === "text" && pt.text) { buf.push(pt.text); return; }
      if (pt.type === "reasoning") { if (pt.text) reason.push(pt.text); return; }
      if (pt.type === "tool") { flush(); addToolCard(pt); return; }
    });
    if (reason.length) addReasoningBlock(reason.join("\n"));
    flush();
  }

  function renderMessages() { // ORDER_V3
    msgs.innerHTML = "";
    if (state.hasMore && state.hasMore[state.active]) {   // PAGING_V42
      var more = el("button", "btn", "加载更早的消息");
      more.style.alignSelf = "center";
      more.onclick = function () { more.disabled = true; more.textContent = "加载中…"; loadMore(); };
      msgs.appendChild(more);
    }
    var arr = (state.msgs[state.active] || []).slice().sort(function (x, y) {
      var tx = (x.time && (x.time.created || x.time.updated)) || 0;
      var ty = (y.time && (y.time.created || y.time.updated)) || 0;
      return tx - ty;
    });
    if (!arr.length) {
      msgs.appendChild(el("div", "empty", "这个会话还没有消息"));
      return;
    }
    arr.forEach(function (m) { // RENDER_V2
      var role = m.type === "user" ? "user" : (m.type === "assistant" ? "assistant" : "sys");
      if (role === "assistant") { renderAssistant(m); return; }
      var txt = textOf(m);
      if (!txt) return;
      var b = el("div", "m " + role);
      b.textContent = txt;
      msgs.appendChild(b);
    });
    msgs.scrollTop = msgs.scrollHeight;
    if (typeof streamState !== "undefined" && streamState.text) renderStream(); // STREAM_KEEP_V11
    if (typeof busy !== "undefined" && busy) renderThinking();
  }

  var forms = [];
  function loadForms() { // FORMS_V6
    if (!state.active || !state.handle) return;
    api("/forms?sessionID=" + encodeURIComponent(state.active)).then(function (d) {
      forms = (d && d.data) || [];
      renderForms();
    }).catch(function () { forms = []; });
  }

  function renderForms() {
    if (!forms || !forms.length) return;
    forms.forEach(function (f) {
      if (msgs.querySelector("#hud-form-" + f.id)) return; // DEDUPE_FIX_V49
      var card = el("div", "card");
      card.id = "hud-form-" + f.id;
      var hd2 = el("div", "", "需要你回答：" + (f.title || "问题"));
      hd2.style.fontWeight = "600";
      card.appendChild(hd2);

      var inputs = {};
      (f.fields || []).forEach(function (fd) {
        if (fd.type === "external") {
          var a = document.createElement("a");
          a.href = fd.url; a.target = "_blank"; a.textContent = fd.title || fd.url;
          a.style.display = "block"; a.style.marginTop = "6px";
          card.appendChild(a);
          return;
        }
        var row = el("div", "");
        row.style.marginTop = "8px";
        if (fd.title) {
          var t = el("div", "", fd.title);
          t.style.fontWeight = "600";
          row.appendChild(t);
        }
        if (fd.description) {
          var d = el("div", "", fd.description);
          d.style.color = "#6b7280"; d.style.fontSize = "12px";
          row.appendChild(d);
        }

        if (fd.options && fd.options.length) {
          var box = el("div", "");
          box.style.marginTop = "4px";
          var radios = [];
          (fd.options || []).forEach(function (op, i) {
            var lab = el("label", "");
            lab.style.display = "block";
            var rb = document.createElement("input");
            rb.type = "radio"; rb.name = "hudf-" + f.id + "-" + fd.key;
            rb.value = op.value;
            if (i === 0) rb.checked = true;
            radios.push(rb);
            lab.appendChild(rb);
            lab.appendChild(document.createTextNode(" " + op.label));
            box.appendChild(lab);
          });
          var custom = null;
          if (fd.custom) {
            var cl = el("label", "");
            cl.style.display = "block";
            var cr = document.createElement("input");
            cr.type = "radio"; cr.name = "hudf-" + f.id + "-" + fd.key; cr.value = "__custom__";
            radios.push(cr);
            cl.appendChild(cr);
            cl.appendChild(document.createTextNode(" 自定义："));
            custom = document.createElement("input");
            custom.type = "text"; custom.placeholder = "输入自己的答案";
            custom.style.width = "60%";
            cl.appendChild(custom);
            box.appendChild(cl);
          }
          row.appendChild(box);
          inputs[fd.key] = function () {
            var chosen = null;
            radios.forEach(function (r) { if (r.checked) chosen = r.value; });
            if (chosen === "__custom__") return custom && custom.value ? custom.value : "";
            return chosen || "";
          };
        } else if (fd.type === "multiselect") {
          var mbox = el("div", "");
          var sel = [];
          (fd.options || []).forEach(function (op) {
            var lab2 = el("label", "");
            lab2.style.display = "block";
            var cb = document.createElement("input");
            cb.type = "checkbox"; cb.value = op.value;
            cb.onchange = function () {
              var i2 = sel.indexOf(op.value);
              if (cb.checked && i2 < 0) sel.push(op.value);
              if (!cb.checked && i2 >= 0) sel.splice(i2, 1);
            };
            lab2.appendChild(cb);
            lab2.appendChild(document.createTextNode(" " + op.label));
            mbox.appendChild(lab2);
          });
          row.appendChild(mbox);
          inputs[fd.key] = function () { return sel; };
        } else if (fd.type === "boolean") {
          var cbb = document.createElement("input");
          cbb.type = "checkbox";
          row.appendChild(cbb);
          inputs[fd.key] = function () { return cbb.checked; };
        } else {
          var inp = document.createElement("input");
          inp.type = (fd.type === "number" || fd.type === "integer") ? "number" : "text";
          inp.style.width = "100%"; inp.style.marginTop = "4px";
          if (fd.placeholder) inp.placeholder = fd.placeholder;
          if (fd["default"] !== undefined && fd["default"] !== null) inp.value = fd["default"];
          row.appendChild(inp);
          inputs[fd.key] = function () {
            if (fd.type === "number" || fd.type === "integer") return Number(inp.value);
            return inp.value;
          };
        }
        card.appendChild(row);
      });

      var btns = el("div", "row");
      var ok2 = el("button", "btn primary", "提交回答");
      ok2.onclick = function () {
        var answer = {};
        Object.keys(inputs).forEach(function (k) { answer[k] = inputs[k](); });
        ok2.disabled = true;
        api("/form/reply", { method: "POST", body: { sessionID: state.active, formID: f.id, answer: answer } })
          .then(function () {
            card.remove();
            forms = [];
            showToast("已回答，继续执行中…", "ok");
            setTimeout(refreshMessages, 800);
            pollTick(0);
          })
          .catch(function (e) {
            ok2.disabled = false;
            showToast("提交失败：" + String(e.message || e));
          });
      };
      btns.appendChild(ok2);
      card.appendChild(btns);
      msgs.appendChild(card);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  var perms = [];
  function loadPermissions() { // PERM_V7
    if (!state.handle) return;
    api("/permissions").then(function (d) {
      var arr = (d && d.data) || [];
      perms = arr.filter(function (r) { return !state.active || r.sessionID === state.active; });
      renderPermissions();
    }).catch(function () {});
  }

  function renderPermissions() {
    (perms || []).forEach(function (r) {
      var domID = "hud-perm-" + r.id;
      if (document.getElementById(domID)) return;
      var card = el("div", "card");
      card.id = domID;
      card.style.borderColor = "#f0b429";
      card.style.background = "#fffbea";
      var t = el("div", "", "需要授权：" + (r.action || "操作"));
      t.style.fontWeight = "600";
      card.appendChild(t);
      if (r.resources && r.resources.length) {
        var res = el("div", "", r.resources.join("  "));
        res.style.color = "#6b7280"; res.style.fontSize = "12px"; res.style.wordBreak = "break-all";
        card.appendChild(res);
      }
      if (r.message) {
        var mm = el("div", "", r.message);
        mm.style.color = "#6b7280"; mm.style.fontSize = "12px";
        card.appendChild(mm);
      }
      var meta = r.metadata || {};   // PERMHL_V48
      var keyCmd = meta.command || meta.cmd || meta.shell;
      var keyPath = meta.path || meta.filePath || meta.file || meta.target;
      if (keyCmd) {
        var preC = document.createElement("pre");
        preC.textContent = String(keyCmd).slice(0, 800);
        preC.style.cssText = "background:#0f172a;color:#e2e8f0;padding:6px;border-radius:6px;margin:6px 0 0;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:140px;overflow:auto";
        card.appendChild(preC);
      }
      if (keyPath) {
        var divP = el("div", "", "路径：" + String(keyPath).slice(0, 300));
        divP.style.cssText = "margin-top:6px;color:#92400e;font-size:12px;word-break:break-all";
        card.appendChild(divP);
      }
      if (meta.description) {
        var divD = el("div", "", String(meta.description).slice(0, 300));
        divD.style.cssText = "margin-top:4px;color:#6b7280;font-size:12px";
        card.appendChild(divD);
      }
      if (r.metadata) {  // PERMDETAIL_V18
        var d3 = document.createElement("details");
        var s3 = document.createElement("summary");
        s3.textContent = "详情";
        d3.appendChild(s3);
        var pre3 = document.createElement("pre");
        var t3 = "";
        try { t3 = JSON.stringify(r.metadata, null, 2); } catch (e) { t3 = String(r.metadata); }
        pre3.textContent = t3.length > 2000 ? t3.slice(0, 2000) + "…" : t3;
        d3.appendChild(pre3);
        card.appendChild(d3);
      }
      var row = el("div", "row");
      [["once", "允许一次"], ["always", "始终允许"], ["reject", "拒绝"]].forEach(function (q) {
        var b = el("button", "btn" + (q[0] === "once" ? " primary" : ""), q[1]);
        b.onclick = function () {
          api("/reply", { method: "POST", body: { sessionID: r.sessionID, requestID: r.id, decision: q[0] } })
            .then(function () { card.remove(); loadPermissions(); setTimeout(refreshMessages, 800); })
            .catch(function (e) { showToast("回复失败：" + String(e.message || e)); });
        };
        row.appendChild(b);
      });
      card.appendChild(row);
      msgs.appendChild(card);
    });
    msgs.scrollTop = msgs.scrollHeight;
  }

  var pollTimer = null;
  function pollTick(n) { // POLL_V4
    if (n > 10) return;                          // NOFLICKER_V29：轮询降频
    clearTimeout(pollTimer);
    pollTimer = setTimeout(function () {
      if (!(typeof streamState !== "undefined" && streamState.text)) refreshMessages();
      pollTick(n + 1);
    }, 3000);
  }

  var modelsLoaded = false;

  function loadModels() { // MODEL_V19
    if (!state.models) state.models = []; // MODELS_GUARD_V21
    if (modelsLoaded || !state.handle) return;
    api("/models").then(function (d) {
      var arr = (d && d.data) || [];
      state.models = arr.filter(function (m) {
        return m && m.enabled !== false && (!m.type || m.type === "chat");
      });
      modelsLoaded = true;
      renderModels();
    }).catch(function () {});
  }

  function renderModels() {
    if (!state.models) state.models = []; // MODELS_GUARD_V21
    var cur = currentModelRef();
    if (!cur) {
      var dft = defaultModelRef();
      if (dft) cur = dft.providerID + "/" + dft.id;
    }
    modelSel.innerHTML = "";
    if (!state.models.length) {
      var o0 = document.createElement("option");
      o0.textContent = "默认模型";
      o0.value = "";
      modelSel.appendChild(o0);
      return;
    }
    state.models.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.providerID + "/" + m.id;
      o.textContent = m.id;
      o.title = (m.providerID + "/" + m.id) + (m.name ? "  " + m.name : "");
      if (cur && cur === o.value) o.selected = true;
      modelSel.appendChild(o);
    });
  }

  function currentModelRef() {
    for (var i = 0; i < state.sessions.length; i++) {
      if (state.sessions[i].id === state.active && state.sessions[i].model) {
        var mm = state.sessions[i].model;
        return mm.providerID + "/" + mm.id;
      }
    }
    return "";
  }

  function defaultModelRef() { // DEFAULT_MODEL_V28：新会话默认用第二个模型
    if (!state.models || state.models.length === 0) return null;
    var m = state.models.length > 1 ? state.models[1] : state.models[0];
    return { providerID: m.providerID, id: m.id };
  }

  function syncModelSelect() {
    if (!state.models.length) { loadModels(); return; }
    renderModels();
    var cur = currentModelRef();
    if (cur) modelSel.value = cur;
  }

  function isBypassRules(perms) { // PERMMODE_V40
    if (!Array.isArray(perms)) return false;
    for (var i = 0; i < perms.length; i++) {
      var r = perms[i] || {};
      if (r.action === "*" && r.resource === "*" && r.effect === "allow") return true;
    }
    return false;
  }

  function syncPermMode() {
    if (!state.active || !state.handle) return;
    api("/session/perms?sessionID=" + encodeURIComponent(state.active)).then(function (d) {
      var info = (d && d.data) || d || {};
      modeSel.value = isBypassRules(info.permissions) ? "bypass" : "ask";
    }).catch(function () {});
  }

  function switchPermMode() {
    if (!state.active) { showToast("请先选择一个会话"); return; }
    var mode = modeSel.value;
    api("/session/perms", { method: "POST", body: { sessionID: state.active, mode: mode } })
      .then(function () {
        showToast(mode === "bypass" ? "已开启全放行（bypass）" : "已恢复询问模式", "ok");
      })
      .catch(function (e) { showToast("切换失败：" + String(e.message || e)); });
  }

  function setupMic() {   // MIC_V53
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recog = null, listening = false;
    micBtn.onclick = function () {
      if (!SR) { showToast("当前浏览器不支持语音识别（需 Chrome/Edge）"); return; }
      if (listening) { try { recog.stop(); } catch (e) {} return; }
      recog = new SR();
      recog.lang = "zh-CN";
      recog.interimResults = true;
      recog.continuous = false;
      var before = input.value;
      recog.onstart = function () {   // MIC_FOCUS_V55
        listening = true; micBtn.classList.add("listening"); micBtn.textContent = "●";
        try { input.focus(); } catch (e) {}
        showToast("正在聆听…", "ok");
      };
      recog.onresult = function (ev) {
        var txt = "";
        for (var i = ev.resultIndex; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        input.value = (before ? before + " " : "") + txt;
        try { input.focus(); } catch (e) {}   // MIC_FOCUS_V55
      };
      recog.onerror = function (e) { showToast("语音识别不可用：" + ((e && e.error) || "权限/离线")); };
      recog.onend = function () { listening = false; micBtn.classList.remove("listening"); micBtn.textContent = "🎤"; };
      try { input.focus(); } catch (e) {}
      try { recog.start(); } catch (e) { showToast("无法启动语音"); }
    };
  }

  function stopRun() {  // STOP_V45
    if (!state.active) { showToast("请先选择一个会话"); return; }
    api("/interrupt", { method: "POST", body: { sessionID: state.active } })
      .then(function (d) {
        setBusy(false); clearStream();
        var okFlag = !!(d && d.interrupted);
        showToast(okFlag ? "已请求停止" : "当前没有在执行的步骤", "ok");
      })
      .catch(function (e) { showToast("停止失败：" + String(e.message || e)); });
  }

  function renameSession(id, oldTitle, titleEl) {   // RENAME_V56
    var inp = document.createElement("input");
    inp.value = oldTitle;
    inp.style.cssText = "width:100%;font:inherit;font-size:12px;padding:0 2px;border:1px solid #2F6BFF;border-radius:3px";
    titleEl.textContent = "";
    titleEl.appendChild(inp);
    inp.focus(); inp.select();
    var done = false;
    function finish(save) {
      if (done) return;
      done = true;
      var v = (inp.value || "").trim();
      if (save && v && v !== oldTitle) {
        api("/session/title", { method: "POST", body: { sessionID: id, title: v } })
          .then(function () { showToast("已重命名", "ok"); loadSessions(); })
          .catch(function (e) { showToast("重命名失败：" + String(e.message || e)); loadSessions(); });
      } else {
        loadSessions();
      }
    }
    inp.onkeydown = function (e) {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    };
    inp.onblur = function () { finish(true); };
    inp.onclick = function (e) { e.stopPropagation(); };
  }

  function syncAgentMode() {    // AGENTMODE_V59
    if (!state.active) return;
    for (var i = 0; i < state.sessions.length; i++) {
      if (state.sessions[i].id === state.active) {
        agentSel.value = (state.sessions[i].agent === "plan") ? "plan" : "build";
        return;
      }
    }
  }

  function switchAgentMode() {
    if (!state.active) { showToast("请先选择一个会话"); return; }
    var mode = agentSel.value;
    api("/switchAgent", { method: "POST", body: { sessionID: state.active, agent: mode } })
      .then(function () {
        for (var i = 0; i < state.sessions.length; i++) {
          if (state.sessions[i].id === state.active) state.sessions[i].agent = mode;
        }
        showToast(mode === "plan" ? "已切换到用户模式（只读规划）" : "已切换到开发者模式", "ok");
      })
      .catch(function (e) { showToast("切换失败：" + String(e.message || e)); });
  }

  function switchModel() {
    var v = modelSel.value;
    if (!v || !state.active) return;
    var parts = v.split("/");
    var providerID = parts.shift();
    var id = parts.join("/");
    api("/model", { method: "POST", body: { sessionID: state.active, model: { providerID: providerID, id: id } } })
      .then(function () {
        for (var i = 0; i < state.sessions.length; i++) {
          if (state.sessions[i].id === state.active) state.sessions[i].model = { providerID: providerID, id: id };
        }
        showToast("已切换模型：" + modelSel.options[modelSel.selectedIndex].textContent, "ok");
      })
      .catch(function (e) { showToast("切换失败：" + String(e.message || e)); });
  }

  var busy = false;
  var busyLabel = "运行中";
  var busySince = 0;
  var busyTimer = null;
  var dotN = 0;
  var thinkEl = null;

  function thinkingText() { // BUSY_V16
    var dots = ["", ".", "..", "..."][dotN % 4];
    var secs = busySince ? Math.floor((Date.now() - busySince) / 1000) : 0;
    return busyLabel + dots + (secs >= 2 ? "  (" + secs + "s)" : "");
  }

  function renderThinking() {  // THINK_GUARD_V33
    if (!busy) return;
    if (typeof streamState !== "undefined" && streamState.text) { hideThinking(); return; }
    if (!thinkEl || !thinkEl.parentNode) {
      thinkEl = el("div", "m assistant thinking");
      msgs.appendChild(thinkEl);
      if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) {
        msgs.scrollTop = msgs.scrollHeight;
      }
    }
    thinkEl.textContent = thinkingText();
    statusText.textContent = busyLabel + ["", ".", "..", "..."][dotN % 4];
  }

  function showThinking() { renderThinking(); } // BUSY_FIX_V16c

  function startBusyTimer() {
    if (busyTimer) return;
    busyTimer = setInterval(function () {
      if (!busy) { stopBusyTimer(); return; }
      dotN++;
      renderThinking();
    }, 500);
  }

  function stopBusyTimer() {
    if (busyTimer) { clearInterval(busyTimer); busyTimer = null; }
  }

  function hideThinking() {
    if (thinkEl) { thinkEl.remove(); thinkEl = null; }
  }

  function setBusy(on, label) {
    var was = busy;
    busy = !!on;
    spinEl.style.display = busy ? "inline-block" : "none";
    if (typeof stopBtn !== "undefined") stopBtn.style.display = busy ? "inline-block" : "none";
    if (busy) {
      busyLabel = label || busyLabel || "运行中";
      if (!was) { busySince = Date.now(); dotN = 0; }
      startBusyTimer();
      renderThinking();
      return;
    }
    stopBusyTimer();
    hideThinking();
  }

  function send() { // SEND_V4
    var text = (input.value || "").trim();
    if (!text) return;
    if (!state.active) { showToast("请先新建或选择一个会话"); return; }
    input.value = "";
    api("/prompt", { method: "POST", body: { sessionID: state.active, text: text } })
      .then(function (d) {
        setBusy(true, "已发送，等待回复…");
        var m = d && d.data;
        if (m && m.sessionID === state.active) {
          var arr = state.msgs[state.active] || (state.msgs[state.active] = []);
          var exists = false;
          for (var i = 0; i < arr.length; i++) { if (arr[i].id === m.id) { exists = true; break; } }
          if (!exists) arr.push(m);
          renderMessages();
        }
        setTimeout(refreshMessages, 800);
        pollTick(0);
      })
      .catch(function (e) { showToast("发送失败：" + String(e.message || e)); });
  }

  var streamEl = null;
  var liveReason = null;   // REASON_V51
  function onReasoning(d) {
    if (!d || d.sessionID !== state.active) return;
    if (!liveReason || !liveReason.parentNode) {
      var det = document.createElement("details");
      det.className = "reason";
      det.open = true;
      var sm = document.createElement("summary");
      sm.textContent = "思考中…";
      var pre = document.createElement("pre");
      det.appendChild(sm); det.appendChild(pre);
      msgs.appendChild(det);
      liveReason = det; det._pre = pre; det._sum = sm;
    }
    liveReason._pre.textContent += d.delta || "";
    liveReason._sum.textContent = "思考中…（" + liveReason._pre.textContent.length + " 字）";
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) msgs.scrollTop = msgs.scrollHeight;
  }

  function endReasoning() {
    if (liveReason) { liveReason.open = false; liveReason = null; }
  }

  function fmtTok(n) {
    if (!n) return "0";
    return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
  }

  function setUsage(sid, u) {
    if (!state.usage) state.usage = {};
    if (u) state.usage[sid] = u;
    if (sid !== state.active) return;
    var cur = state.usage[sid];
    if (!usageEl) return;
    if (!cur) { usageEl.textContent = ""; return; }
    var tk = cur.tokens || {};
    var total = (tk.input || 0) + (tk.output || 0) + (tk.reasoning || 0) + ((tk.cache && tk.cache.read) || 0);
    var cost = typeof cur.cost === "number" ? cur.cost : 0;
    usageEl.textContent = fmtTok(total) + " tok" + (cost ? " · $" + cost.toFixed(4) : "");
  }

  var streamState = { messageID: null, text: "" }; // STREAM_V8
  var streamEnded = false;  // STREAM_SWAP_V34

  var streamRaf = 0;  // STREAM_SMOOTH_V32
  function onDelta(d) {
    if (!d || d.sessionID !== state.active) return;
    if (streamState.messageID !== d.assistantMessageID) {
      streamState.messageID = d.assistantMessageID;
      streamState.text = "";
    }
    streamState.text += d.delta || "";
    if (!streamRaf) {
      streamRaf = requestAnimationFrame(function () {
        streamRaf = 0;
        renderStream();
      });
    }
  }

  function renderStream() {
    if (!streamState.text) return;
    if (!streamEl || !streamEl.parentNode) {
      streamEl = el("div", "m assistant");
      streamEl.id = "hud-stream";
      msgs.appendChild(streamEl);
    }
    streamEl.textContent = streamState.text + "▍";
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) {
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  var finalEl = null;
  function finalizeStream() {  // STREAM_FINALIZE_V35：流式气泡就地转正（Markdown + 去光标）
    var txt = streamState.text;
    if (!txt) return;
    if (finalEl) { finalEl.remove(); finalEl = null; }
    finalEl = el("div", "m assistant");
    finalEl.id = "hud-final";
    finalEl.innerHTML = mdToHtml(txt);
    enhanceCode(finalEl);
    msgs.appendChild(finalEl);
    if (streamEl) { streamEl.remove(); streamEl = null; }
    streamState.messageID = null;
    streamState.text = "";
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) {
      msgs.scrollTop = msgs.scrollHeight;
    }
  }

  function clearStream() {
    if (finalEl) { finalEl.remove(); finalEl = null; }
    streamState.messageID = null;
    streamState.text = "";
    if (streamEl) { streamEl.remove(); streamEl = null; }
  }

  function newSession() { // DEFAULT_MODEL_V28
    api("/session", { method: "POST", body: { title: "" } }).then(function (d) {
      var id = d && d.data && d.data.id;
      var def = defaultModelRef();
      if (id && def) {
        api("/model", { method: "POST", body: { sessionID: id, model: def } })
          .then(function () {
            if (state.models && state.models.length > 1) showToast("新会话默认模型：" + def.id, "ok");
          })
          .catch(function () {});
      }
      loadSessions();
      if (id) setTimeout(function () { selectSession(id); }, 300);
    }).catch(function (e) { showToast(String(e.message || e)); });
  }

  var es = null;
  function connectSSE() {
    if (!state.handle) return;
    if (es) { try { es.close(); } catch (e) {} }
    es = new EventSource(API + "/events?handle=" + encodeURIComponent(state.handle));
    es.onopen = function () {  // SSE_CATCHUP_V56
      if (state.sseDropped) {
        state.sseDropped = false;
        setStatus("ok", state.account ? state.account + " 已连接" : "已连接");
        refreshMessages(); loadForms(); loadPermissions();
        showToast("已恢复连接，已补拉最新", "ok");
      }
    };
    es.onmessage = function (ev) {
      var obj = null;
      try { obj = JSON.parse(ev.data); } catch (e) { return; }
      var t = obj.type || "";
      var sid = obj.data && (obj.data.sessionID || (obj.data.request && obj.data.request.sessionID));
      if (t === "server.connected") { setStatus("ok", state.account + " 已连接"); return; }
      if (t === "permission.asked") { loadPermissions(); return; } // PERM_V7
      if (t.indexOf("form.") === 0) { loadForms(); return; }
      if (t === "session.text.delta") { hideThinking(); onDelta(obj.data); return; }
      if (t === "session.reasoning.delta") { onReasoning(obj.data); return; }   // REASON_V51
      if (t === "session.reasoning.ended") { endReasoning(); return; }
      if (t === "session.usage.updated" && obj.data) { setUsage(obj.data.sessionID, obj.data); return; }
      if (t === "session.text.ended") { finalizeStream(); streamEnded = true; setTimeout(refreshMessages, 1200); }
      if (t === "session.idle") { setBusy(false); streamEnded = true; setTimeout(refreshMessages, 900); } // IDLE_KEEP_V36
      if (t === "session.execution.started") { setBusy(true, "运行中…"); }
      if (t === "session.step.started") { setBusy(true, "思考中…"); }
      if (t.indexOf("session.tool.called") === 0) { setBusy(true, "调用工具中…"); }
      if (t === "session.retry.scheduled") { setBusy(true, "限流重试中…"); }
      if (t === "provider.rate-limit") { setBusy(true, "被限流，等待中…"); }
      if (t === "session.execution.succeeded" || t === "session.execution.failed" || t === "session.execution.interrupted") { setBusy(false); }
      if (sid && sid === state.active) {
        if (t.indexOf("session.execution") === 0) setStatus("wait", "运行中…");
        if (t === "session.idle") setStatus("ok", state.account + " 已连接");
        if (!(typeof streamState !== "undefined" && streamState.text)) {
          clearTimeout(connectSSE._t);
          connectSSE._t = setTimeout(refreshMessages, 800);   // NOFLICKER_V31
        }
      }
    };
    es.onerror = function () { state.sseDropped = true; setStatus("bad", "事件流断开，重连中…"); }; // SSE_CATCHUP_V56
  }

  modelSel.onchange = switchModel;
  agentSel.onchange = switchAgentMode;
  stopBtn.onclick = stopRun;
  setupMic();
  modeSel.onchange = switchPermMode;
  newBtn.onclick = newSession;
  sendBtn.onclick = send;
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  minBtn.onclick = function () { panel.style.display = "none"; };
  ball.onclick = function () {
    panel.style.display = "flex";
    if (!state.handle) renderConnect();
  };

  (function drag() {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    hd.addEventListener("mousedown", function (e) {
      on = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function (e) {
      if (!on) return;
      panel.style.left = (ox + e.clientX - sx) + "px";
      panel.style.top = (oy + e.clientY - sy) + "px";
      panel.style.right = "auto"; panel.style.bottom = "auto";
    });
    window.addEventListener("mouseup", function () { on = false; });
  })();

  (function resizer() {  // RESIZE_V13
    var RECT_KEY = LS_KEY + ".rect";
    try {
      var r = JSON.parse(localStorage.getItem(RECT_KEY) || "null");
      if (r && r.w && r.h) {
        panel.style.width = r.w + "px";
        panel.style.height = r.h + "px";
        if (r.left != null) { panel.style.left = r.left + "px"; panel.style.top = r.top + "px"; panel.style.right = "auto"; panel.style.bottom = "auto"; }
      }
    } catch (e) {}

    var grip = el("div", "resizer");
    panel.appendChild(grip);

    var dragging = false, sx = 0, sy = 0, sw = 0, sh = 0;
    grip.addEventListener("mousedown", function (e) {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      var b = panel.getBoundingClientRect();
      sw = b.width; sh = b.height;
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      var w = Math.max(320, Math.min(window.innerWidth - 40, sw + e.clientX - sx));
      var h = Math.max(240, Math.min(window.innerHeight - 40, sh + e.clientY - sy));
      panel.style.width = w + "px";
      panel.style.height = h + "px";
    });
    window.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false;
      var b = panel.getBoundingClientRect();
      try {
        localStorage.setItem(RECT_KEY, JSON.stringify({
          w: Math.round(b.width), h: Math.round(b.height),
          left: Math.round(b.left), top: Math.round(b.top)
        }));
      } catch (e) {}
    });
  })();

  // ===== MACRO_V1：动作工具栏 + 页面执行器（UI 优先）=====
  var macroBar = el("div", "macrobar");
  macroBar.style.cssText = "display:flex;gap:6px;align-items:center;overflow-x:auto;padding:6px 8px;border-bottom:1px solid #e8ecf3;background:#fbfcfe;flex:0 0 auto";
  if (hd.nextSibling) panel.insertBefore(macroBar, hd.nextSibling); else panel.appendChild(macroBar);
  var macroList = el("div");                       // RECORD_V3
  macroList.style.cssText = "display:flex;gap:6px;align-items:center;overflow-x:auto;flex:1 1 auto";
  macroBar.appendChild(macroList);

  var macroRunning = false;
  var macroPollTimer = null;

  function macroToast(msg, ok) {
    if (ok) showToast(msg, "ok"); else showToast(msg);
  }

  function loadMacros() {
    api("/macro/list").then(function (d) {
      var list = (d && d.macros) || [];
      macroList.innerHTML = "";
      if (!list.length) return;
      list.slice(0, 12).forEach(function (m) {
        var b = el("button", "btn", m.name || m.id);
        b.title = (m.description || "") + "（v" + m.version + (m.owner ? " · " + m.owner : "") + "）";
        b.style.cssText = "flex:0 0 auto;font-size:11px;padding:2px 8px";
        b.onclick = function () { runMacroById(m.id); };
        b.oncontextmenu = function (ev) { ev.preventDefault(); deleteMacro(m.id); };
        b.title = b.title + "（右键删除）";
        macroList.appendChild(b);
      });
      if (list.length > 12) {
        var more = el("button", "btn", "⋯ " + (list.length - 12));
        more.style.cssText = "flex:0 0 auto;font-size:11px;padding:2px 8px";
        more.onclick = function () { showToast("还有 " + (list.length - 12) + " 个动作（列表功能开发中）"); };
        macroList.appendChild(more);
      }
    }).catch(function () {});
  }

  function deleteMacro(id) {   // MACRO_DEL_V1
    if (!window.confirm("删除动作「" + id + "」？（可在审计日志里追溯）")) return;
    api("/macro/delete", { method: "POST", body: { id: id } })
      .then(function () { showToast("已删除：" + id, "ok"); loadMacros(); })
      .catch(function (e) { showToast("删除失败：" + String(e.message || e)); });
  }

  function runMacroById(id, retried) {   // BUSY_RETRY_V1
    if (macroRunning) { macroToast("已有动作在执行"); return; }
    api("/macro/run", { method: "POST", body: { id: id, trigger: "user", sessionID: state.active } })
      .then(function (d) { macroToast("已开始执行：" + id + "（" + (d.runId || "") + "）", true); })
      .catch(function (e) {
        var msg = String(e.message || e);
        if (!retried && msg.indexOf("macro_busy") >= 0) {
          macroToast("检测到残留执行，正在释放…", "ok");
          api("/macro/cancel", { method: "POST", body: {} })
            .then(function () { runMacroById(id, true); })
            .catch(function () { macroToast("执行失败：" + msg); });
          return;
        }
        macroToast("执行失败：" + msg);
      });
  }

  // ===== ANNOTATE_V1：运行时稳定标识（只加内存属性，刷新即消失）=====
  var hudVKey = "";   // INULA_V1

  function hudVNode(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (hudVKey && node[hudVKey]) return node[hudVKey];
      var keys = Object.keys(node);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf("vNode") >= 0 && node[keys[i]] && node[keys[i]].props) {
          hudVKey = keys[i];
          return node[keys[i]];
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function hudFieldName(el) {
    var v = hudVNode(el);
    var node = v, depth = 0;
    while (node && depth++ < 12) {
      var pr = node.props || {};
      var n = pr.name || pr.field || pr.prop || pr.dataKey;
      if (n && typeof n === "string") return n;
      node = node.parent;
    }
    return "";
  }

  function hudAncestorField(el) {   // FIELD_FROM_CONTAINER_V2
    var n = el.parentElement, depth = 0;
    while (n && n !== document.body && depth++ < 12) {
      var a = n.getAttribute && n.getAttribute("data-hud-id");
      if (a && a.indexOf("field=") === 0) {
        var m = a.match(/^field=([^|]+)/);
        if (m) return m[1];
      }
      if (typeof hudFieldName === "function") {
        var f2 = hudFieldName(n);
        if (f2) return f2;
      }
      n = n.parentElement;
    }
    return "";
  }

  function hudTestType(el) {
    var n = el, depth = 0;
    while (n && n.nodeType === 1 && depth++ < 4) {
      var v = n.getAttribute && n.getAttribute("data-test-type");
      if (v) return v;
      n = n.parentElement;
    }
    return "";
  }

  function hudText(el) {
    if (!el) return "";
    return ((el.innerText || el.textContent || "") + "").replace(/\s+/g, " ").trim();
  }

  function hudDialogTitle(el) {
    var d = el.closest ? el.closest(".eui-dialog-box,[class*=dialog],[class*=Dialog]") : null;
    if (!d) return "";
    var t = d.querySelector(".eui-dialog-title-text,.eui-dialog-title,[class*=dialog-title]");
    var v = hudText(t);
    return v ? v.slice(0, 20) : "";
  }

  function hudFieldLabel(el) {
    var aria = el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("placeholder"));
    if (aria) return String(aria).trim().slice(0, 20);
    var node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 4) {
      var lab = node.querySelector ? node.querySelector("label,.eui-form-label-required,[class*=form-label],[class*=formLabel]") : null;
      var t = hudText(lab).replace(/[:：]$/, "").trim();
      if (t) return t.slice(0, 20);
      node = node.parentElement; depth++;
    }
    return "";
  }

  function hudName(el) {
    var v = (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("alt"))) || "";
    if (!v) v = hudText(el);
    return String(v).replace(/\s+/g, " ").trim().slice(0, 20);
  }

  function hudKind(el) {
    var tag = (el.tagName || "").toLowerCase();
    var role = (el.getAttribute && el.getAttribute("role")) || "";
    if (tag === "input" || tag === "textarea") return "input";
    if (tag === "select") return "select";
    if (tag === "img") return "img";
    if (role) return role;
    if (tag === "button" || tag === "a") return "act";
    if (/btn|button/i.test(((el.className || "") + ""))) return "act";
    return "item";
  }

  function hudIdFor(el) {
    var parts = [];
    var __field = hudFieldName(el) || hudAncestorField(el);
    if (__field) parts.push("field=" + __field);
    var __tt = hudTestType(el);
    if (__tt) parts.push("tt=" + __tt);
    var dlg = hudDialogTitle(el);
    if (dlg) parts.push("dlg=" + dlg);
    var treeA = el.closest ? el.closest("a[id^='eui_tree_node_id']") : null;
    if (treeA) {
      var tid = (treeA.getAttribute("id") || "").replace("eui_tree_node_id", "");
      parts.push("tree=" + (tid || hudText(treeA).slice(0, 20)));
    }
    if (el.closest && el.closest("[id^='eui_popup_']")) parts.push("popup");
    if (!treeA && el.parentElement) {
      var anc = el.parentElement.closest("[id]");
      if (anc && anc !== el && !/\d/.test(String(anc.id))) parts.push("in=" + String(anc.id).slice(0, 24));
    }
    parts.push(hudKind(el));
    var nm = hudName(el);
    if (nm) parts.push("name=" + nm);
    if (parts.length <= 2) {
      var cls = ((el.className || "") + "").split(/\s+/).filter(Boolean)[0];
      if (cls) parts.push("cls=" + cls.slice(0, 24));
    }
    if (parts.join("|").length < 5) parts.unshift((el.tagName || "").toLowerCase());
    return parts.join("|");
  }

  var annotateTimer = 0;

  function annotateNow() {
    var nodes = document.querySelectorAll(
      "input,textarea,select,button,a,[role=button],[role=option],[role=menuitem],[role=tab],img," +
      "span.eui-textButton,[class*=item],[class*=Item],[class*=option],[class*=Option],[class*=menu_item],.eui-select_item"
    );
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest && el.closest('[id^="cogagent-hud-host"]')) continue;
      var base = hudIdFor(el);
      if (base) list.push([el, base]);
    }
    var counts = {};
    for (var ci = 0; ci < list.length; ci++) counts[list[ci][1]] = (counts[list[ci][1]] || 0) + 1;
    var seen = {};
    for (var ai = 0; ai < list.length; ai++) {
      var node = list[ai][0], b = list[ai][1], id = b;
      if (counts[b] > 1) { seen[b] = (seen[b] || 0) + 1; id = b + "|i=" + seen[b]; }
      if (node.getAttribute("data-hud-id") !== id) node.setAttribute("data-hud-id", id);
    }
  }

  function annotateSoon() {
    if (annotateTimer) return;
    annotateTimer = setTimeout(function () {
      annotateTimer = 0;
      try { annotateNow(); } catch (err) {}
    }, 250);
  }

  function startAnnotator() {
    annotateSoon();
    if (!window.__hudAnnotateObserver && window.MutationObserver && document.documentElement) {
      var mo = new MutationObserver(function () { annotateSoon(); });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      window.__hudAnnotateObserver = mo;
    }
  }

  window.__hudAnnotate = function () { annotateNow(); return document.querySelectorAll("[data-hud-id]").length; };
  // ===== /ANNOTATE_V1 =====

  // ===== MACRO_RECORD_V2：页面内录制（文本优先 + 作用域 + 顺序正确）=====
  var recSteps = [], recording = false, pendingFill = [];

  var recBtn = el("button", "btn", "● 录制");
  recBtn.style.cssText = "flex:0 0 auto;font-size:11px;padding:2px 8px;white-space:nowrap";
  recBtn.onclick = function () { if (recording) stopRecord(); else startRecord(); };
  macroBar.appendChild(recBtn);

  function recUnique(sel) {
    try { return document.querySelectorAll(sel).length === 1; } catch (e) { return false; }
  }

  function recClickable(e) {   // REC_TARGET_V3
    var n = e;
    while (n && n.nodeType === 1) {
      var tag = (n.tagName || "").toLowerCase();
      if (tag === "button" || tag === "a" || n.getAttribute("role") === "button") return n;
      var cn = n.className && n.className.toString ? n.className.toString() : "";
      if (/btn|Button|textButton|select_item|menu_item|menuItem|dropdown_item/i.test(cn)) return n;
      n = n.parentElement;
    }
    return e;
  }

  function recScope(e) {
    var d = e.closest ? e.closest(".eui-dialog-box,[class*=dialog],[class*=Dialog],[class*=drawer],[class*=Drawer]") : null;
    if (!d) return null;
    if (d.classList && d.classList.contains("eui-dialog-box")) return ".eui-dialog-box";
    return null;
  }

  function recTarget(e) {
    var n = recClickable(e);
    var t = {};
    var hid = n.getAttribute && n.getAttribute("data-hud-id");
    if (!hid && n.closest) { var host = n.closest("[data-hud-id]"); if (host) hid = host.getAttribute("data-hud-id"); }
    if (hid) t.testId = hid;
    var txt = (n.innerText || n.textContent || "").trim().replace(/\s+/g, " ");
    if (txt && txt.length <= 40) t.text = txt;
    var id = n.getAttribute && n.getAttribute("id");
    if (id && recUnique("#" + id)) t.selector = "#" + id;
    if (!t.selector && !t.text) {   // ANCHOR_V1
      var anc = n.parentElement;
      while (anc && anc !== document.body) {
        if (anc.id) {
          var own = (n.tagName || "").toLowerCase();
          var ocn = n.className && n.className.toString ? n.className.toString().trim().split(/\s+/).filter(Boolean)[0] : "";
          t.selector = "#" + anc.id + " " + own + (ocn && /^[A-Za-z][A-Za-z0-9_-]*$/.test(ocn) ? "." + ocn : "");
          break;
        }
        anc = anc.parentElement;
      }
    }
    var cls = n.className && n.className.toString ? n.className.toString().trim().split(/\s+/).filter(Boolean)[0] : "";
    if (!t.selector && cls && /^[A-Za-z][A-Za-z0-9_-]*$/.test(cls) && recUnique("." + cls)) t.class = cls;
    var r = recScope(n);
    if (r) t.scope = r;
    var ph = n.getAttribute && (n.getAttribute("placeholder") || n.getAttribute("aria-label"));
    if (!t.text && ph) t.placeholder = ph;
    return t;
  }

  function recCssPath(e) {   // REC_FIELD_V1：最后的兜底选择器
    if (!e || !e.tagName) return "";
    if (e.id) return "#" + e.id;
    var parts = [], node = e, depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      var sel = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var same = 0, idx = 0;
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].tagName === node.tagName) { same++; if (parent.children[i] === node) idx = same; }
        }
        if (same > 1) sel += ":nth-of-type(" + idx + ")";
      }
      parts.unshift(sel);
      if (node.id) break;
      node = parent; depth++;
    }
    return parts.join(" > ");
  }

  function recFieldTarget(e) {
    var t = recTarget(e);
    var fld = hudFieldName(e) || hudAncestorField(e);   // FIELD_AT_RECORD_V2
    if (fld && !(t.testId && t.testId.indexOf("field=") === 0)) t.testId = "field=" + fld + "|input";
    var lab = hudFieldLabel(e);   // FIELD_HINT_V1
    if (lab) t.label = lab;
    var ph = e.getAttribute && e.getAttribute("placeholder");
    if (ph && !t.placeholder) t.placeholder = String(ph).slice(0, 20);
    if (t.testId || t.selector || t.class || t.label || t.placeholder) return t;
    var box = e.closest ? e.closest(".eui-form_item,[class*=form_item],[class*=formItem],tr,li,div") : null;
    if (box) {
      var lab = box.querySelector("label,[class*=form-label],[class*=formLabel]");
      var lt = lab ? (lab.innerText || "").trim() : "";
      if (lt && lt.length <= 20) { t.label = lt.replace(/[:：]$/, "").trim(); return t; }
    }
    var ph = e.getAttribute && e.getAttribute("placeholder");
    if (ph) { t.placeholder = ph; return t; }
    t.selector = recCssPath(e);
    return t;
  }

  function recFlushFill() {
    while (pendingFill.length) {
      var item = pendingFill.shift();
      recSteps.push({ action: "fill", target: item.target, value: item.value });
    }
  }

  function recPush(step) {
    var last = recSteps[recSteps.length - 1];
    if (last && last.action === step.action && JSON.stringify(last.target) === JSON.stringify(step.target)
        && last.action !== "fill") return;
    recSteps.push(step);
  }

  var recLastClick = null;   // CHOOSE_REC_V1

  function recIsOption(el) {   // OPTION_DETECT_V2
    var n = el, depth = 0;
    while (n && n.nodeType === 1 && n !== document.body && depth++ < 5) {
      var cn = (n.className || "") + "";
      if (/option|dropdown_item|menu_item|select_item/i.test(cn)) return true;
      var role = n.getAttribute && n.getAttribute("role");
      if (role === "option" || role === "menuitem") return true;
      if (n.closest && n.closest("[id^='eui_popup_'],.eui_select_popup,.eui_popup_container,[class*=dropdown],[class*=PopUp]")) {
        if (/option|item/i.test(cn)) return true;
      }
      n = n.parentElement;
    }
    return false;
  }

  function onRecClick(ev) {
    if (!recording) return;
    var e = ev.target;
    if (!e || (e.closest && e.closest('[id^="cogagent-hud-host"]'))) return;
    var tag = (e.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    recFlushFill();
    if (recIsOption(e) && recLastClick) {
      var optText = hudText(e).slice(0, 20);
      var idx = recSteps.lastIndexOf(recLastClick);
      if (idx >= 0 && optText) {
        if (recSteps[idx + 1] && recSteps[idx + 1].action === "sleep") recSteps.splice(idx, 2);
        else recSteps.splice(idx, 1);
        recSteps.push({ action: "choose", target: recLastClick.target, option: optText });
        recSteps.push({ action: "sleep", ms: 300 });
        recLastClick = null;
        renderRecCount();
        return;
      }
    }
    var clickStep = { action: "click", target: recTarget(e) };
    recPush(clickStep);
    recLastClick = clickStep;
    recSteps.push({ action: "sleep", ms: 350 });
    renderRecCount();
  }

  function recDirty(el) {
    for (var i = 0; i < pendingFill.length; i++) if (pendingFill[i].el === el) return i;
    return -1;
  }

  function onRecInput(ev) {
    if (!recording) return;
    var e = ev.target;
    if (!e || !e.tagName) return;
    var tag = e.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea") return;
    var i = recDirty(e);
    var item = { el: e, target: recFieldTarget(e), value: e.value };
    if (i >= 0) pendingFill[i] = item; else pendingFill.push(item);
    renderRecCount();
  }

  function onRecChange(ev) {
    if (!recording) return;
    var e = ev.target;
    if (!e || !e.tagName) return;
    if (e.tagName.toLowerCase() !== "select") return;
    recFlushFill();
    recPush({ action: "select", target: recFieldTarget(e), value: e.value });
    recSteps.push({ action: "sleep", ms: 250 });
    renderRecCount();
  }

  function onRecKey(ev) {   // PRESS_V1
    if (!recording) return;
    var k = ev.key;
    if (!/^(Enter|Tab|Escape|ArrowDown|ArrowUp)$/.test(k)) return;
    var node = ev.target && ev.target.tagName ? ev.target : document.activeElement;
    if (node && node.closest && node.closest('[id^="cogagent-hud-host"]')) return;
    recFlushFill();
    recPush({ action: "press", key: k, target: recFieldTarget(node) });
    recSteps.push({ action: "sleep", ms: 300 });
    renderRecCount();
  }

  function renderRecCount() {
    recBtn.textContent = recording ? ("■ 停止(" + recSteps.length + ")") : "● 录制";
  }

  var recHandlers = null;

  function startRecord() {
    recSteps = []; pendingFill = []; recording = true; renderRecCount();
    recHandlers = { click: onRecClick, input: onRecInput, change: onRecChange };
    document.addEventListener("click", onRecClick, true);
    document.addEventListener("input", onRecInput, true);
    document.addEventListener("change", onRecChange, true);
    document.addEventListener("keydown", onRecKey, true);
    showToast("录制中：正常操作，完成后点「■ 停止」", "ok");
  }

  function stopRecord() {
    recording = false;
    recFlushFill();
    document.removeEventListener("click", onRecClick, true);
    document.removeEventListener("input", onRecInput, true);
    document.removeEventListener("change", onRecChange, true);
    document.removeEventListener("keydown", onRecKey, true);
    recSteps = recSteps.filter(function (x, i, arr) {
      return !(x.action === "sleep" && i === arr.length - 1);
    });
    renderRecCount();
    if (!recSteps.length) { showToast("没有录到任何操作"); return; }
    recSteps = recSteps.map(function (x) {   // NAME_TS_V4：按 field=project_name/site_name 或 label 判定
      if (x.action !== "fill" || !x.value) return x;
      var sig = JSON.stringify(x.target || {});
      var isNameField = /field=(project_name|site_name)([|"}]|$)/.test(sig) || /项目名称|站点名称/.test(sig);
      if (!isNameField) return x;
      var raw = String(x.value);
      if (raw.indexOf("{{") >= 0) return x;
      var suffix = "_{{shortstamp}}";        // 展开后是 _ + yyMMddHHmm（11 字符）
      var maxBase = 32 - 11;                  // 保证总长 ≤ 32
      x.value = raw.slice(0, maxBase) + suffix;
      return x;
    });

    var preview = recSteps.map(function (x, i) {
      return (i + 1) + ". " + x.action + " " + JSON.stringify(x.target || {}) + (x.value ? " = " + x.value : "");
    }).join("\n");
    console.log("[录制结果]\n" + preview);
    var name = window.prompt("动作名称（可在工具栏一键回放；\n录制步骤已打印到 Console）", "录制动作 " + new Date().toLocaleTimeString());
    if (!name) { showToast("已取消保存"); return; }
    var id = "rec-" + Date.now().toString(36);
    api("/macro/save", { method: "POST", body: { mode: "upsert", macro: { id: id, name: name, description: "录制于 " + location.href, steps: recSteps } } })
      .then(function () { showToast("已保存：" + name, "ok"); loadMacros(); })
      .catch(function (e) { showToast("保存失败：" + String(e.message || e)); });
  }
  // ===== /MACRO_RECORD_V2 =====



  var macroPinCache = {};   // PIN_CLIENT_V1
  var macroPins = {};

  function macroPinFor(t) {
    var base = (t && (t.testId || t.text || t.label || t.selector)) || "";
    return macroPins[String(base).slice(0, 120)] || null;
  }

  function macroSig(t, extra) {
    var base = (t && (t.testId || t.text || t.label || t.selector)) || "";
    return String(base).slice(0, 120) + (extra ? "::" + extra : "");
  }

  function macroPinGet(sig) {
    if (macroPinCache[sig] !== undefined) return Promise.resolve(macroPinCache[sig]);
    return api("/macro/pin?sig=" + encodeURIComponent(sig)).then(function (d) {
      macroPinCache[sig] = (d && d.pin) || null;
      return macroPinCache[sig];
    }).catch(function () { return null; });
  }

  function macroPinSet(sig, pin) {
    macroPinCache[sig] = pin;
    return api("/macro/pin/set", { method: "POST", body: { sig: sig, pin: pin } }).catch(function () {});
  }

  function macroReport(cmd, step, ok, extra) {
    var b = { sessionID: state.active, id: cmd.runId, runId: cmd.runId, step: step, ok: ok };
    if (extra) { for (var k in extra) b[k] = extra[k]; }
    return api("/macro/result", { method: "POST", body: b }).catch(function () {});
  }

  function macroVisible(e) {
    if (!e) return false;
    var r = e.getBoundingClientRect();
    var st = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  }

  function macroNorm(t) { return (t || "").replace(/\s+/g, " ").trim(); }

  function macroByText(text, cls) {   // TEXT_SPLIT_V1
    var norm = macroNorm(text);
    var candidates = [norm];
    if (norm.indexOf(" ") > 0) {
      var parts = norm.split(" ").filter(function (x) { return x.length >= 2; });
      parts.sort(function (a, b) { return b.length - a.length; });
      for (var pi = 0; pi < parts.length; pi++) candidates.push(parts[pi]);
    }
    for (var ci = 0; ci < candidates.length; ci++) {
      var roots = [];
      var scoped = cls ? document.querySelector(cls) : null;
      if (scoped) roots.push(scoped);
      roots.push(document);
      for (var ri = 0; ri < roots.length; ri++) {
        var hit = macroByTextIn(candidates[ci], roots[ri]);
        if (hit) return hit;
      }
    }
    return null;
  }

  function macroByTextIn(text, root) {
    if (!root) return null;
    var nodes = root.querySelectorAll("button,a,span,div,li,td,label,[role=button],[role=option],[role=menuitem]");
    var best = null, bestScore = -1, bestArea = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!macroVisible(n)) continue;
      var t = macroNorm(n.innerText || n.textContent || "");
      if (t !== text && t.indexOf(text) < 0) {
        var aria = macroNorm((n.getAttribute && (n.getAttribute("aria-label") || n.getAttribute("title"))) || "");
        if (!aria || (aria !== text && aria.indexOf(text) < 0)) continue;
      }
      var r = n.getBoundingClientRect();
      var area = r.width * r.height;
      if (!(area > 0)) continue;
      var score = 0;
      var tag = (n.tagName || "").toLowerCase();
      if (tag === "button" || tag === "a") score += 50;
      if (n.getAttribute && n.getAttribute("role") === "button") score += 40;
      var cn = (n.className && n.className.toString ? n.className.toString() : "");
      if (/btn|Button/.test(cn)) score += 30;
      if (t === text) score += 10;
      if (score > bestScore || (score === bestScore && area < bestArea)) {
        best = n; bestScore = score; bestArea = area;
      }
    }
    return best;
  }

  function macroVisibleInputs(root) {   // FIELD_RESOLVE_V1
    var scope = root || document;
    var nodes = scope.querySelectorAll("input,textarea,select");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!macroVisible(el)) continue;
      if (el.type === "hidden") continue;
      out.push(el);
    }
    return out;
  }

  function macroResolve(t) {
    if (!t) return null;
    if (t.testId) {   // ANNOTATE_V1
      var rawId = String(t.testId);
      var esc = rawId.replace(/"/g, '\\"');
      var node = document.querySelector('[data-hud-id="' + esc + '"]');
      if (node) return node;
      var m = rawId.match(/^(.*)\|i=(\d+)$/);
      if (m) {
        var pre = m[1].replace(/"/g, '\\"');
        var list = document.querySelectorAll('[data-hud-id^="' + pre + '|i="]');
        var k = parseInt(m[2], 10) - 1;
        if (list[k]) return list[k];
      }
      // TESTID_PREFIX_V1：field=project_name|input 命中 field=project_name|input|cls=xxx
      var pref = rawId.replace(/"/g, '\\"');
      var prefHits = [];
      var prefAll = document.querySelectorAll("[data-hud-id]");
      for (var pi2 = 0; pi2 < prefAll.length; pi2++) {
        var pv = prefAll[pi2].getAttribute("data-hud-id") || "";
        if (pv.indexOf(rawId + "|") === 0 && macroVisible(prefAll[pi2])) prefHits.push(prefAll[pi2]);
      }
      if (prefHits.length === 1) return prefHits[0];

      // TESTID_SUFFIX_V1：去掉动态上下文，用尾部语义段模糊匹配
      var segs = rawId.split("|").filter(function (x) { return x.indexOf("in=") !== 0 && !/^\w+=\d+/.test(x); });
      var suffix = segs.slice(-2).join("|");
      if (suffix) {
        var all = document.querySelectorAll("[data-hud-id]");
        var hits = [];
        for (var hi = 0; hi < all.length; hi++) {
          if ((all[hi].getAttribute("data-hud-id") || "").slice(-suffix.length) === suffix && macroVisible(all[hi])) hits.push(all[hi]);
        }
        if (hits.length === 1) return hits[0];
      }
    }
    if (t.class) { var c = document.querySelector("." + t.class); if (c) return c; }
    if (t.selector && !/^#eui_(popup|row|tree_node_id\w*)_?\d+$/.test(t.selector)) {   // SKIP_DYNAMIC_ID_V1
      var q = document.querySelector(t.selector); if (q) return q;
    }
    if (t.label) {
      var labels = document.querySelectorAll("label,.el-form-item__label,.ant-form-item-label,.eui-form-label-required,[class*=form-label]");
      for (var i = 0; i < labels.length; i++) {
        var lt = (labels[i].innerText || "").trim();
        if (lt.indexOf(t.label) < 0) continue;
        var f = labels[i].getAttribute("for");
        if (f) { var el2 = document.getElementById(f); if (el2) return el2; }
        var node = labels[i];
        for (var up = 0; up < 5 && node; up++) {          // 逐级向上找输入框
          var inp = node.querySelector && node.querySelector("input,textarea,select");
          if (inp && macroVisible(inp)) return inp;
          var cands = macroVisibleInputs(node);
          if (cands.length === 1) return cands[0];
          node = node.parentElement;
        }
      }
      var dialog = document.querySelector(".eui-dialog-box,[class*=dialog],[class*=modal]");
      if (dialog) {
        var only = macroVisibleInputs(dialog);
        if (only.length === 1) return only[0];
      }
      var all = macroVisibleInputs(document);
      if (all.length === 1) return all[0];
    }
    if (t.placeholder) { var ph = document.querySelector('[placeholder="' + t.placeholder + '"]'); if (ph) return ph; }
    if (t.text) return macroByText(t.text, t.scope);
    return null;
  }

  function macroResolveRecover(t, timeout) {   // RECOVER_V1：找不到时先按 Esc 解遮挡再重试
    return macroResolveWait(t, timeout || 4000).then(function (el) {
      if (el) return el;
      try { macroPress(document.body, "Escape"); } catch (err) {}
      return new Promise(function (res) { setTimeout(res, 400); })
        .then(function () { return macroResolveWait(t, 2000); });
    });
  }

  function macroCandidates(t) {   // SELF_TRY_V1：精确失败后按语义收集候选
    var out = [];
    function add(el) {
      if (!el || el.nodeType !== 1) return;
      if (out.indexOf(el) >= 0) return;
      if (!macroVisible(el)) return;
      out.push(el);
    }
    if (t.testId) {
      var raw = String(t.testId);
      var all = document.querySelectorAll("[data-hud-id]");
      for (var i = 0; i < all.length; i++) {
        var v = all[i].getAttribute("data-hud-id") || "";
        if (v === raw || v.indexOf(raw + "|") === 0 || (raw.indexOf("|i=") > 0 && v.indexOf(raw.split("|i=")[0] + "|i=") === 0)) add(all[i]);
      }
    }
    if (t.class) {
      var byClass = document.querySelectorAll("." + t.class);
      for (var c = 0; c < byClass.length && c < 8; c++) add(byClass[c]);
    }
    if (t.label) {
      var labs = document.querySelectorAll("label,[class*=form-label],[class*=formLabel]");
      for (var l = 0; l < labs.length; l++) {
        if ((labs[l].innerText || "").trim().indexOf(t.label) < 0) continue;
        var box = labs[l].closest("[class*=form],[class*=item],div");
        if (!box) continue;
        var ins = box.querySelectorAll("input,textarea,select");
        for (var k = 0; k < ins.length; k++) add(ins[k]);
      }
    }
    if (t.placeholder) {
      var byPh = document.querySelectorAll('[placeholder="' + t.placeholder + '"]');
      for (var ph = 0; ph < byPh.length; ph++) add(byPh[ph]);
    }
    if (t.text) {
      var txt = macroNorm(t.text);
      var nodes = document.querySelectorAll("button,a,span,div,li,[role=button],[role=option],[role=menuitem]");
      for (var n = 0; n < nodes.length; n++) {
        var nt = macroNorm(nodes[n].innerText || nodes[n].textContent || "");
        if (nt === txt) add(nodes[n]);
      }
      if (!out.length && txt.indexOf(" ") > 0) {
        var parts = txt.split(" ");
        for (var q = 0; q < nodes.length && out.length < 6; q++) {
          var qt = macroNorm(nodes[q].innerText || "");
          if (qt && parts.some(function (pp) { return qt === pp; })) add(nodes[q]);
        }
      }
    }
    return out.slice(0, 8);
  }

  function macroResolveWait(t, timeout) {   // MACRO_RESOLVE_WAIT_V1
    var until = Date.now() + (timeout || 3000);
    return new Promise(function (resolve) {
      (function tick() {
        if (typeof annotateSoon === "function") annotateSoon();   // ANNOTATE_V1
        var pinHit = macroPinFor(t);
        if (pinHit && pinHit.testId) {
          var pe = document.querySelector('[data-hud-id="' + String(pinHit.testId).replace(/"/g, '\\"') + '"]');
          if (pe && macroVisible(pe)) { resolve(pe); return; }
        }
        var el = macroResolve(t);
        if (el) { resolve(el); return; }
        if (Date.now() > until) {
          var cands = macroCandidates(t);   // SELF_TRY_V1：自动试探
          if (cands.length) { resolve(cands[0]); return; }
          resolve(null); return;
        }
        setTimeout(tick, 150);
      })();
    });
  }

  function macroHighlight(e) {
    try {
      e.style.outline = "2px solid #2F6BFF";
      e.style.outlineOffset = "2px";
      setTimeout(function () { e.style.outline = ""; e.style.outlineOffset = ""; }, 500);
    } catch (err) {}
  }

  function macroClick(e) {
    e.scrollIntoView({ block: "center" });
    macroHighlight(e);
    var r = e.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (type) {
      var Ev = type.indexOf("pointer") === 0 ? PointerEvent : MouseEvent;
      try { e.dispatchEvent(new Ev(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window })); } catch (err) {}
    });
  }

  function macroFill(e, val) {
    e.scrollIntoView({ block: "center" });
    macroHighlight(e);
    try { e.focus(); } catch (err) {}
    var proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(e, val);
    e.dispatchEvent(new Event("input", { bubbles: true }));
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }

  var MACRO_KEYCODES = { Enter: 13, Tab: 9, Escape: 27, ArrowDown: 40, ArrowUp: 38, " ": 32 };   // PRESS_V1

  function macroPress(el, key) {
    var node = el || document.activeElement || document.body;
    var code = MACRO_KEYCODES[key] || 0;
    try { if (node.focus) node.focus(); } catch (err) {}
    var opts = { key: key, code: key, keyCode: code, which: code, bubbles: true, cancelable: true };
    ["keydown", "keypress", "keyup"].forEach(function (type) {
      if (type === "keypress" && key !== "Enter") return;
      try { node.dispatchEvent(new KeyboardEvent(type, opts)); } catch (err) {}
    });
  }

  function macroWait(cond, timeout) {
    var until = Date.now() + (timeout || 10000);
    return new Promise(function (resolve, reject) {
      (function tick() {
        if (Date.now() > until) { reject(new Error("等待超时")); return; }
        var ok = false;
        if (cond.text) ok = !!macroByText(cond.text, cond.scope);
        else if (cond.class) ok = !!document.querySelector("." + cond.class);
        else if (cond.selector) ok = !!document.querySelector(cond.selector);
        else if (cond.urlPattern) ok = new RegExp(cond.urlPattern).test(location.href);
        if (ok) { resolve(true); return; }
        setTimeout(tick, 300);
      })();
    });
  }

  function macroExpand(v, params) {
    if (typeof v !== "string") return v;
    var d = new Date();
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var date = "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    var time = "" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    var out = v
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{time\}\}/g, time)
      .replace(/\{\{datetime\}\}/g, date + "-" + time)
      .replace(/\{\{stamp\}\}/g, date + time)
      .replace(/\{\{shortstamp\}\}/g, date.slice(2) + time.slice(0, 4))
      .replace(/\{\{seq:(\d+)\}\}/g, function (_, n) { return String(params.__seq || 1).padStart(parseInt(n, 10), "0"); })
      .replace(/\{\{rand:(\d+)\}\}/g, function (_, n) { return Math.random().toString(16).slice(2, 2 + parseInt(n, 10)); });
    Object.keys(params || {}).forEach(function (k) {
      out = out.split("{{" + k + "}}").join(String(params[k]));
    });
    return out;
  }

  function macroApiCall(step, params) {
    var headers = { "Content-Type": "application/json" };
    if (window.common && window.common.csrfToken) headers["roarand"] = window.common.csrfToken;
    return fetch(step.endpoint, {
      method: "POST", credentials: "same-origin", headers: headers,
      body: JSON.stringify(step.payload || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error("API " + r.status + ": " + t.slice(0, 200));
        return t ? JSON.parse(t) : {};
      });
    });
  }

  function execMacro(cmd) {   // EXEC_V2：目标重试 + 失败带描述
    if (macroRunning) return Promise.resolve();
    macroRunning = true;
    var macro = cmd.macro || {};
    var params = cmd.params || {};
    var steps = macro.steps || [];
    var outputs = {};

    macroToast("开始执行：" + (macro.name || macro.id) + "（" + steps.length + " 步）", true);
    api("/macro/pin").then(function (d) { macroPins = (d && d.pins) || {}; }).catch(function () {});   // PIN_CLIENT_V1

    function finish(ok, cur, step, ms, extra) {
      macroRunning = false;
      var body = { action: step ? step.action : "done", ms: ms, final: true, result: ok ? "ok" : "failed" };
      if (extra) { for (var k in extra) body[k] = extra[k]; }
      if (!ok) body.failedStep = cur;
      macroReport(cmd, cur, ok, body);
      if (ok) macroToast("动作完成：" + (macro.name || macro.id), true);
      else macroToast("第 " + cur + " 步失败：" + extra.error);
    }

    function stepAt(i) {
      if (i >= steps.length) { finish(true, i, null, 0, { outputs: outputs, via: "ui" }); return; }
      var cur = i + 1;
      var step = steps[i];
      var t0 = Date.now();
      var desc = JSON.stringify(step.target || {});
      var timer = null;

      function done(extra) {
        macroReport(cmd, cur, true, extra || { action: step.action, ms: Date.now() - t0 });
        setTimeout(function () { stepAt(i + 1); }, step.action === "sleep" ? 0 : 120);
      }
      function bad(msg) {
        if (step.optional) { done({ action: step.action, skipped: true, ms: Date.now() - t0 }); return; }
        finish(false, cur, step, Date.now() - t0, { error: String(msg) });
      }
      function guard(promise) {
        promise.then(function () {}, function (e) { bad((e && e.message) || e); });
      }

      if (step.action === "click") {
        guard(macroResolveRecover(step.target, 4000).then(function (el) {
          if (!el) throw new Error("找不到元素 " + desc);
          macroClick(el); done();
        }));
        return;
      }
      if (step.action === "fill") {   // SELF_TRY_FILL_V1：多个候选逐个写入并校验
        guard(macroResolveRecover(step.target, 4000).then(function () {
          var want = macroExpand(step.value, params);
          var list = macroCandidates(step.target);
          var direct = macroResolve(step.target);
          if (direct) list.unshift(direct);
          var written = null;
          for (var fi = 0; fi < list.length; fi++) {
            var cand = list[fi];
            if (!cand || cand.nodeType !== 1) continue;
            var tag = (cand.tagName || "").toLowerCase();
            if (tag !== "input" && tag !== "textarea" && tag !== "select") continue;
            try { macroFill(cand, want); } catch (e) { continue; }
            if (String(cand.value) === String(want)) { written = cand; break; }
          }
          if (!written) throw new Error("找不到可写入的输入框 " + desc + "（候选 " + list.length + "）");
          var wtid = written.getAttribute && written.getAttribute("data-hud-id");
          if (wtid) macroPinSet(macroSig(step.target), { testId: wtid });   // PIN_CLIENT_V1
          done();
        }));
        return;
      }
      if (step.action === "choose") {   // CHOOSE_V2：候选逐个试探 + 选项校验
        guard(macroResolveRecover(step.target, 3000).then(function (el) {
          var triggers = macroCandidates(step.target);
          if (el) triggers.unshift(el);
          var uniq = [];
          for (var ti = 0; ti < triggers.length; ti++) {
            if (triggers[ti] && uniq.indexOf(triggers[ti]) < 0) uniq.push(triggers[ti]);
          }
          if (!uniq.length) {
            if (step.optional) { done({ action: "choose", skipped: true, ms: Date.now() - t0 }); return; }
            throw new Error("找不到下拉框 " + JSON.stringify(step.target || {}) + "（候选 0）");
          }
          function tryOne(i) {
            if (i >= uniq.length) return Promise.reject(new Error("下拉选项未出现：" + step.option + "（试过 " + uniq.length + " 个触发器）"));
            var trig = uniq[i];
            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (err) {}
            macroClick(trig);
            return macroWait({ text: step.option }, 2500).then(function () {
              var opt = macroByText(step.option, ".eui-dialog-box,[class*=popup],[class*=dropdown],[class*=select]")
                     || macroByText(step.option);
              if (!opt) { macroPress(document.body, "Escape"); return tryOne(i + 1); }
              macroClick(opt);
              var ttid = trig.getAttribute && trig.getAttribute("data-hud-id");
              if (ttid) macroPinSet(macroSig(step.target), { testId: ttid, option: step.option });   // PIN_CLIENT_V1
              done({ action: "choose", option: step.option, trigger: i, ms: Date.now() - t0 });
            });
          }
          return tryOne(0);
        }));
        return;
      }
      if (step.action === "press") {   // PRESS_V1
        guard(macroResolveWait(step.target, 4000).then(function (el) {
          macroPress(el, step.key || "Enter");
          done({ action: "press", ms: Date.now() - t0 });
        }));
        return;
      }
      if (step.action === "select") {
        guard(macroResolveWait(step.target, 4000).then(function (el) {
          if (!el) throw new Error("找不到下拉框 " + desc);
          var v = macroExpand(step.value, params);
          el.value = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          done();
        }));
        return;
      }
      if (step.action === "read") {
        guard(macroResolveWait(step.target, 4000).then(function (el) {
          if (!el) throw new Error("找不到读取目标 " + desc);
          outputs[step.as || ("out" + cur)] = (el.innerText || el.value || "").trim().slice(0, 2000);
          done();
        }));
        return;
      }
      if (step.action === "verify") {
        guard(macroResolveWait(step.target, 4000).then(function (el) {
          if (!el) throw new Error("校验失败：未找到 " + desc);
          done();
        }));
        return;
      }
      if (step.action === "wait") {
        guard(macroWait(step.for || {}, step.timeout).then(function () {
          done({ action: "wait", ms: Date.now() - t0 });
        }));
        return;
      }
      if (step.action === "api") {
        guard(macroApiCall(step, params).then(function (res) {
          if (step.as) outputs[step.as] = res;
          done({ action: "api", ms: Date.now() - t0, via: "api" });
        }));
        return;
      }
      if (step.action === "refresh") {
        guard(macroWait(step.wait || {}, step.wait && step.wait.timeout).then(function () {
          done({ action: "refresh", ms: Date.now() - t0 });
        }));
        return;
      }
      if (step.action === "sleep") {
        setTimeout(function () { done({ action: "sleep", ms: step.ms || 0 }); }, step.ms || 300);
        return;
      }
      bad("暂不支持的 action: " + step.action);
    }

    stepAt(0);
    return Promise.resolve();
  }

  function macroPoll() {
    if (!state.handle || macroRunning) return;
    api("/macro/pending").then(function (d) {
      var cmds = (d && d.commands) || [];
      cmds.forEach(function (cmd) { execMacro(cmd); });
    }).catch(function () {});
  }

  function macroStart() {
    if (macroPollTimer) return;
    if (typeof startAnnotator === "function") startAnnotator();   // ANNOTATE_V1
    loadMacros();
    macroPollTimer = setInterval(macroPoll, 1500);
  }

  function macroRefreshIfEmpty() {   // MACRO_BOOT_V2
    if (!macroBar.children.length) loadMacros();
  }

  window.__hudMacro = {
    run: runMacroById,
    exec: function (macroJson, params) { return execMacro({ runId: "debug-" + Date.now(), macro: macroJson, params: params || {} }); },
    list: function () { return api("/macro/list"); }
  };
  // ===== /MACRO_V1 =====

  var saved = load();
  state.handle = saved.handle || null;
  state.account = saved.account || "";
  state.active = saved.active || null;
  if (state.handle) {
    setStatus("wait", "连接中…");
    api("/sessions").then(function () {
      setStatus("ok", state.account ? state.account + " 已连接" : "已连接");
      loadSessions(); connectSSE(); macroStart();
    }).catch(function () { resetLogin(); });
  } else {
    setStatus("", "未连接");
    renderConnect();
  }
})();
