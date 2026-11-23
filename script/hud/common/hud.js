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

  var macroRunning = false;
  var macroPollTimer = null;

  function macroToast(msg, ok) {
    if (ok) showToast(msg, "ok"); else showToast(msg);
  }

  function loadMacros() {
    api("/macro/list").then(function (d) {
      var list = (d && d.macros) || [];
      macroBar.innerHTML = "";
      if (!list.length) return;
      list.slice(0, 12).forEach(function (m) {
        var b = el("button", "btn", m.name || m.id);
        b.title = (m.description || "") + "（v" + m.version + (m.owner ? " · " + m.owner : "") + "）";
        b.style.cssText = "flex:0 0 auto;font-size:11px;padding:2px 8px";
        b.onclick = function () { runMacroById(m.id); };
        macroBar.appendChild(b);
      });
      if (list.length > 12) {
        var more = el("button", "btn", "⋯ " + (list.length - 12));
        more.style.cssText = "flex:0 0 auto;font-size:11px;padding:2px 8px";
        more.onclick = function () { showToast("还有 " + (list.length - 12) + " 个动作（列表功能开发中）"); };
        macroBar.appendChild(more);
      }
    }).catch(function () {});
  }

  function runMacroById(id) {
    if (macroRunning) { macroToast("已有动作在执行"); return; }
    api("/macro/run", { method: "POST", body: { id: id, trigger: "user", sessionID: state.active } })
      .then(function (d) { macroToast("已开始执行：" + id + "（" + (d.runId || "") + "）", true); })
      .catch(function (e) { macroToast("执行失败：" + String(e.message || e)); });
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

  function macroByText(text, cls) {
    var root = cls ? document.querySelector(cls) : document;
    if (!root) return null;
    var nodes = root.querySelectorAll("button,a,span,div,li,td,label,[role=button]");
    var best = null, bestScore = -1, bestArea = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!macroVisible(n)) continue;
      var t = (n.innerText || n.textContent || "").trim();
      if (t !== text && t.indexOf(text) < 0) continue;
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

  function macroResolve(t) {
    if (!t) return null;
    if (t.class) { var c = document.querySelector("." + t.class); if (c) return c; }
    if (t.selector) { var q = document.querySelector(t.selector); if (q) return q; }
    if (t.label) {
      var labels = document.querySelectorAll("label,.el-form-item__label,.ant-form-item-label");
      for (var i = 0; i < labels.length; i++) {
        if ((labels[i].innerText || "").trim().indexOf(t.label) >= 0) {
          var f = labels[i].getAttribute("for");
          if (f) { var el2 = document.getElementById(f); if (el2) return el2; }
          var p = labels[i].parentElement;
          if (p) { var inp = p.querySelector("input,textarea,select"); if (inp) return inp; }
        }
      }
    }
    if (t.placeholder) { var ph = document.querySelector('[placeholder="' + t.placeholder + '"]'); if (ph) return ph; }
    if (t.text) return macroByText(t.text, t.scope);
    return null;
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

  function execMacro(cmd) {
    if (macroRunning) return Promise.resolve();
    macroRunning = true;
    var macro = cmd.macro || {};
    var params = cmd.params || {};
    var steps = macro.steps || [];
    var outputs = {};
    var i = 0;
    macroToast("开始执行：" + (macro.name || macro.id) + "（" + steps.length + " 步）", true);

    function next() {
      if (i >= steps.length) {
        macroRunning = false;
        macroReport(cmd, i, true, { final: true, result: "ok", outputs: outputs, via: "ui" });
        macroToast("动作完成：" + (macro.name || macro.id), true);
        return;
      }
      var idx = i + 1, step = steps[i++];
      var t0 = Date.now();
      var el = (step.action === "click" || step.action === "fill" || step.action === "select" ||
                step.action === "read" || step.action === "verify") ? macroResolve(step.target) : null;

      var fail = function (msg) {
        macroRunning = false;
        macroReport(cmd, idx, false, { action: step.action, ms: Date.now() - t0, error: String(msg), final: true, result: "failed", failedStep: idx });
        macroToast("第 " + idx + " 步失败：" + msg);
      };

      try {
        if (step.action === "click") {
          if (!el) return fail("找不到元素");
          macroClick(el);
        } else if (step.action === "fill") {
          if (!el) return fail("找不到输入框");
          macroFill(el, macroExpand(step.value, params));
        } else if (step.action === "select") {
          if (!el) return fail("找不到下拉框");
          var v = macroExpand(step.value, params);
          el.value = v;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (step.action === "read") {
          if (!el) return fail("找不到读取目标");
          outputs[step.as || ("out" + idx)] = (el.innerText || el.value || "").trim().slice(0, 2000);
        } else if (step.action === "verify") {
          if (!el) return fail("校验失败：未找到 " + JSON.stringify(step.target));
        } else if (step.action === "wait") {
          return macroWait(step.for || {}, step.timeout).then(function () {
            macroReport(cmd, idx, true, { action: "wait", ms: Date.now() - t0 });
            setTimeout(next, 300);
          }).catch(fail);
        } else if (step.action === "api") {
          return macroApiCall(step, params).then(function (res) {
            if (step.as) outputs[step.as] = res;
            macroReport(cmd, idx, true, { action: "api", ms: Date.now() - t0, via: "api" });
            setTimeout(next, 300);
          }).catch(fail);
        } else if (step.action === "sleep") {
          return setTimeout(next, step.ms || 300);
        } else if (step.action === "refresh") {
          return macroWait(step.wait || {}, step.wait && step.wait.timeout).then(function () {
            macroReport(cmd, idx, true, { action: "refresh", ms: Date.now() - t0 });
            setTimeout(next, 300);
          }).catch(fail);
        } else {
          return fail("暂不支持的 action: " + step.action);
        }
      } catch (err) {
        return fail(err && err.message ? err.message : err);
      }

      macroReport(cmd, idx, true, { action: step.action, ms: Date.now() - t0 });
      setTimeout(next, 300);
    }
    next();
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
    loadMacros();
    macroPollTimer = setInterval(macroPoll, 1500);
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
