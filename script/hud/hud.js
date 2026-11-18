/* cogagent HUD v1 — 单文件浮窗（Shadow DOM，无外部依赖）
 * 用法：在已登录的 OSSDesign 页面控制台注入本文件内容（或写成静态文件后 script 引入）。
 * 依赖后端：/rest/ossdesign/v1/designer/hud/{status,login/*,sessions,session,messages,prompt,reply,interrupt,events}
 */
(function () {
  if (window.__COGAGENT_HUD__) return;
  window.__COGAGENT_HUD__ = true;

  var API = "/rest/ossdesign/v1/designer/hud";
  var LS_KEY = "ossdesign.hud.v1";
  var CSS = [
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
    ".item .t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".item .s{color:#7a828e;font-size:11px}",
    ".chat{flex:1;display:flex;flex-direction:column;min-width:0}",
    ".msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}",
    ".m{max-width:82%;padding:8px 10px;border-radius:10px;white-space:pre-wrap;word-break:break-word}",
    ".m.user{align-self:flex-end;background:#e8f0ff}",
    ".m.assistant{align-self:flex-start;background:#f4f6f9}",
    ".m.sys{align-self:center;background:#fff6e5;color:#8a6d3b;font-size:12px}",
    ".m.assistant p{margin:0 0 6px}.m.assistant p:last-child{margin-bottom:0}", // MD_CSS_V9
    ".m.assistant pre{background:#0f172a;color:#e2e8f0;padding:8px;border-radius:6px;overflow:auto;font-size:12px}",
    ".m.assistant code{background:#eef2f7;padding:1px 4px;border-radius:4px;font-size:12px}",
    ".m.assistant pre code{background:none;padding:0;color:inherit}",
    ".m.assistant ul,.m.assistant ol{margin:4px 0 6px 18px;padding:0}",
    ".m.assistant a{color:#2F6BFF}",
    ".m.assistant table{border-collapse:collapse;margin:6px 0;font-size:12px;display:block;overflow:auto}", // MD_TABLE_V37
    ".m.assistant th,.m.assistant td{border:1px solid #d8dde5;padding:4px 8px;text-align:left}",
    ".m.assistant th{background:#eef2f7;font-weight:600}",
    ".m.assistant h3,.m.assistant h4,.m.assistant h5{margin:6px 0 4px}",
    ".codewrap{position:relative}", // COPY_V10
    ".copybtn{position:absolute;top:4px;right:4px;font-size:11px;padding:1px 6px;border-radius:4px;",
    "border:1px solid #334155;background:#1e293b;color:#cbd5e1;cursor:pointer;opacity:.85}",
    ".copybtn:hover{opacity:1}",
    ".toolcard{align-self:flex-start;max-width:82%;border:1px solid #dbe2ea;background:#f8fafc;",
    "border-radius:8px;padding:6px 8px;font-size:12px;color:#334155}", // TOOLCARD_V14
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
    "background:#fff;color:#334155;text-overflow:ellipsis}",
    ".composer textarea{flex:1;resize:none;min-height:34px;max-height:120px;padding:8px;border:1px solid #d8dde5;",
    "border-radius:8px;font:inherit;outline:none}",
    ".empty{padding:16px;color:#7a828e;font-size:12px}",
    ".toast{position:absolute;left:12px;right:12px;bottom:64px;background:#ffeaea;color:#a12626;",
    "border:1px solid #f3c2c2;border-radius:8px;padding:6px 10px;font-size:12px;display:none}",
    ".toast.ok{background:#e8f0ff;color:#1e40af;border-color:#bfdbfe}", // TOAST_V26
    ".connect{padding:22px;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center;",
    "height:100%;text-align:center;color:#4b5563}"
  ].join("");

  var state = { handle: null, account: "", sessions: [], active: null, msgs: {}, msgsSig: {}, conn: "idle", ticket: null, models: [] };
  if (!state.models) state.models = []; // MODELS_GUARD_V21

  var host = document.createElement("div");
  host.id = "cogagent-hud-host";
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483000";
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  var style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  var ball = el("div", "ball", "COG");
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
  var title = el("b", "", "cog助手");
  var statusText = el("span", "s", "");
  statusText.style.color = "#7a828e";
  statusText.style.fontSize = "11px";
  var spacer = el("span", "sp");
  var minBtn = el("button", "btn", "—");
  hd.appendChild(dot); hd.appendChild(title); hd.appendChild(statusText); hd.appendChild(spacer); hd.appendChild(minBtn);
  var spinEl = el("span", "spin");
  spinEl.style.display = "none";
  hd.insertBefore(spinEl, statusText);
  panel.appendChild(hd);

  var body = el("div", "body");
  panel.appendChild(body);

  var listBox = el("div", "list");
  var listTop = el("div", "top");
  var newBtn = el("button", "btn primary", "+ 新建");
  listTop.appendChild(newBtn);
  var items = el("div", "items");
  listBox.appendChild(listTop); listBox.appendChild(items);
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
  var crow = el("div", "crow");
  crow.appendChild(input); crow.appendChild(sendBtn);
  composer.appendChild(modelSel); composer.appendChild(crow);
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

  function startLogin() {
    setStatus("wait", "正在发起登录…");
    api("/login/start", { method: "POST" }).then(function (d) {
      state.ticket = d.ticket;
      if (d.url) window.open(d.url, "_blank");
      showToast("已在新标签页打开登录页，完成授权后会自动连接", "ok");
      pollLogin(0);
    }).catch(function (e) { setStatus("bad", String(e.message || e)); showToast(String(e.message || e)); });
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
        return { id: s.id, title: s.title || s.id, time: (s.time && s.time.updated) || 0, model: s.model || null };
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

  function renderList() {
    items.innerHTML = "";
    state.sessions.forEach(function (s) {
      var it = el("div", "item" + (state.active === s.id ? " on" : ""));
      it.appendChild(el("div", "t", s.title || s.id));
      var sub = el("div", "s", s.id.slice(0, 12) + "…");
      it.appendChild(sub);
      it.onclick = function () { selectSession(s.id); };
      items.appendChild(it);
    });
  }

  function selectSession(id) {
    state.active = id;
    renderList();
    syncModelSelect();
    refreshMessages();
    save();
  }

  function refreshMessages() {
    if (!state.active) return;
    api("/messages?sessionID=" + encodeURIComponent(state.active)).then(function (d) {
      var arr = (d && d.data) || [];
      state.msgs[state.active] = arr;
      renderMessages();
    }).catch(function (e) { showToast(String(e.message || e)); });
  }

  function textOf(m) { // TEXTOF_V2
    if (typeof m.text === "string" && m.text) return m.text;
    var parts = m.content || (m.payload && m.payload.parts) || [];
    var out = [];
    if (Array.isArray(parts)) {
      parts.forEach(function (p) {
        if (!p) return;
        if (p.type === "text" && p.text) { out.push(p.text); return; }
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

  function addTextBubble(txt) { // TOOLCARD_V14
    if (!txt) return;
    var b = el("div", "m assistant");
    b.innerHTML = mdToHtml(txt);
    enhanceCode(b);
    msgs.appendChild(b);
  }

  function addToolCard(p) {
    var card = el("div", "toolcard");
    var st = (p.state && p.state.status) || "";
    var hd2 = el("div", "toolhd", "🔧 " + (p.name || "tool") + (st ? " · " + st : ""));
    card.appendChild(hd2);
    var input = p.state && p.state.input;
    if (input) {
      var det = document.createElement("details");
      var sum = document.createElement("summary");
      sum.textContent = "参数";
      det.appendChild(sum);
      var pre = document.createElement("pre");
      var txt = "";
      try { txt = JSON.stringify(input, null, 2); } catch (e) { txt = String(input); }
      pre.textContent = txt.length > 2000 ? txt.slice(0, 2000) + "…" : txt;
      det.appendChild(pre);
      card.appendChild(det);
    }
    msgs.appendChild(card);
  }

  function renderAssistant(m) {
    var parts = m.content || [];
    if (!Array.isArray(parts) || !parts.length) {
      addTextBubble(textOf(m));
      return;
    }
    var buf = [];
    function flush() {
      if (buf.length) { addTextBubble(buf.join("\n")); buf = []; }
    }
    parts.forEach(function (p) {
      if (!p) return;
      if (p.type === "text" && p.text) { buf.push(p.text); return; }
      if (p.type === "tool") { flush(); addToolCard(p); return; }
    });
    flush();
  }

  function renderMessages() { // ORDER_V3
    msgs.innerHTML = "";
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
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) {
      msgs.scrollTop = msgs.scrollHeight;   // NOFLICKER_V30：仅贴底时自动滚动
    }
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
    if (!forms.length) return;
    forms.forEach(function (f) {
      if (document.getElementById("hud-form-" + f.id)) return;
      var card = el("div", "card");
      card.id = "hud-form-" + f.id;
      card.appendChild(el("div", "", "需要你回答：" + (f.title || "问题")));
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
        row.style.marginTop = "6px";
        if (fd.title) row.appendChild(el("div", "", fd.title));
        var ctrl = null;
        if (fd.options && fd.options.length && fd.type === "string") {
          ctrl = document.createElement("select");
          fd.options.forEach(function (op) {
            var o = document.createElement("option");
            o.value = op.value; o.textContent = op.label;
            ctrl.appendChild(o);
          });
          row.appendChild(ctrl);
          inputs[fd.key] = function () { return ctrl.value; };
        } else if (fd.type === "multiselect") {
          var box = el("div", "");
          var sel = [];
          (fd.options || []).forEach(function (op) {
            var lab = el("label", "");
            lab.style.display = "block";
            var cb = document.createElement("input");
            cb.type = "checkbox"; cb.value = op.value;
            cb.onchange = function () {
              var i = sel.indexOf(op.value);
              if (cb.checked && i < 0) sel.push(op.value);
              if (!cb.checked && i >= 0) sel.splice(i, 1);
            };
            lab.appendChild(cb); lab.appendChild(document.createTextNode(" " + op.label));
            box.appendChild(lab);
          });
          row.appendChild(box);
          inputs[fd.key] = function () { return sel; };
        } else if (fd.type === "boolean") {
          var cb2 = document.createElement("input");
          cb2.type = "checkbox";
          row.appendChild(cb2);
          inputs[fd.key] = function () { return cb2.checked; };
        } else {
          var inp = document.createElement("input");
          inp.type = (fd.type === "number" || fd.type === "integer") ? "number" : "text";
          inp.style.width = "100%";
          if (fd.placeholder) inp.placeholder = fd.placeholder;
          if (fd["default"] !== undefined) inp.value = fd["default"];
          row.appendChild(inp);
          inputs[fd.key] = function () {
            if (fd.type === "number" || fd.type === "integer") return Number(inp.value);
            return inp.value;
          };
        }
        card.appendChild(row);
      });
      var btns = el("div", "row");
      var ok = el("button", "btn primary", "提交回答");
      ok.onclick = function () {
        var answer = {};
        Object.keys(inputs).forEach(function (k) { answer[k] = inputs[k](); });
        api("/form/reply", { method: "POST", body: { sessionID: state.active, formID: f.id, answer: answer } })
          .then(function () { card.remove(); forms = []; setTimeout(refreshMessages, 800); pollTick(0); })
          .catch(function (e) { showToast("提交失败：" + String(e.message || e)); });
      };
      btns.appendChild(ok);
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

  function newSession() { // DEFAULT_MODEL_V28
    api("/session", { method: "POST", body: { title: "" } }).then(function (d) {
      var id = d && d.data && d.data.id;
      var def = defaultModelRef();
      if (id && def) {
        api("/model", { method: "POST", body: { sessionID: id, model: def } })
          .then(function () {
            if (state.models.length > 1) showToast("新会话默认模型：" + def.id, "ok");
          })
          .catch(function () {});
      }
      loadSessions();
      if (id) setTimeout(function () { selectSession(id); }, 300);
    }).catch(function (e) { showToast(String(e.message || e)); });
  }

  var streamEl = null;
  var streamState = { messageID: null, text: "" }; // STREAM_V8

  var streamRaf = 0;
  function onDelta(d) {
    if (!d || d.sessionID !== state.active) return;
    if (streamState.messageID !== d.assistantMessageID) {
      streamState.messageID = d.assistantMessageID;
      streamState.text = "";
    }
    streamState.text += d.delta || "";
    if (!streamRaf) streamRaf = requestAnimationFrame(function () { streamRaf = 0; renderStream(); });
  }

  function renderStream() {
    if (!streamState.text) return;
    if (!streamEl || !streamEl.parentNode) {
      streamEl = el("div", "m assistant");
      streamEl.id = "hud-stream";
      streamEl.style.opacity = "0.92";
      msgs.appendChild(streamEl);
    }
    streamEl.textContent = streamState.text + "▍";
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) msgs.scrollTop = msgs.scrollHeight;
  }

  var finalEl = null;
  var streamEnded = false;

  function finalizeStream() {
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
    if (msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80) msgs.scrollTop = msgs.scrollHeight;
  }

  function clearStream() {
    if (finalEl) { finalEl.remove(); finalEl = null; }
    streamState.messageID = null;
    streamState.text = "";
    if (streamEl) { streamEl.remove(); streamEl = null; }
  }

  var pollTimer = null;
  function pollTick(n) { // POLL_V4
    if (n > 10) return;
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
    if (!state.models || !state.models.length) {
      var o0 = document.createElement("option");
      o0.textContent = "默认模型";
      o0.value = "";
      modelSel.appendChild(o0);
      return;
    }
    state.models.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.providerID + "/" + m.id;
      o.textContent = m.id;                 // 显示 id（name 太长，放 title）
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
    if (!state.models || !state.models.length) { loadModels(); return; }
    renderModels();
    var cur = currentModelRef();
    if (cur) modelSel.value = cur;
  }

  function switchModel() {
    var v = modelSel.value;
    if (!v) return;
    var parts = v.split("/");
    var providerID = parts.shift();
    var id = parts.join("/");
    if (!state.active) { showToast("先选择一个会话"); return; }
    api("/model", { method: "POST", body: { sessionID: state.active, model: { providerID: providerID, id: id } } })
      .then(function () {
        for (var i = 0; i < state.sessions.length; i++) {
          if (state.sessions[i].id === state.active) {
            state.sessions[i].model = { providerID: providerID, id: id };
          }
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

  function renderThinking() {
    if (!busy) return;
    if (typeof streamState !== "undefined" && streamState.text) { hideThinking(); return; }
    if (!thinkEl || !thinkEl.parentNode) {
      thinkEl = el("div", "m assistant thinking");
      msgs.appendChild(thinkEl);
      msgs.scrollTop = msgs.scrollHeight;
    }
    thinkEl.textContent = thinkingText();
    statusText.textContent = busyLabel + ["", ".", "..", "..."][dotN % 4];
  }

  function showThinking() { renderThinking(); } // BUSY_FIX_V16b

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

  var es = null;
  function connectSSE() {
    if (!state.handle) return;
    if (es) { try { es.close(); } catch (e) {} }
    es = new EventSource(API + "/events?handle=" + encodeURIComponent(state.handle));
    es.onmessage = function (ev) {
      var obj = null;
      try { obj = JSON.parse(ev.data); } catch (e) { return; }
      var t = obj.type || "";
      var sid = obj.data && (obj.data.sessionID || (obj.data.request && obj.data.request.sessionID));
      if (t === "server.connected") { setStatus("ok", state.account + " 已连接"); return; }
      if (t === "permission.asked") { loadPermissions(); return; } // PERM_V7
      if (t.indexOf("form.") === 0) { loadForms(); return; }
      if (t.indexOf("form.") === 0) { loadForms(); return; }
      if (t === "session.text.delta") { hideThinking(); onDelta(obj.data); return; }
      if (t === "session.execution.started") { setBusy(true, "运行中…"); }
      if (t === "session.step.started") { setBusy(true, "思考中…"); }
      if (t.indexOf("session.tool.called") === 0) { setBusy(true, "调用工具中…"); }
      if (t === "session.retry.scheduled") { setBusy(true, "限流重试中…"); }
      if (t === "provider.rate-limit") { setBusy(true, "被限流，等待中…"); } // BUSY_V15
      if (t === "session.execution.succeeded" || t === "session.execution.failed") { setBusy(false); }
      if (t === "session.text.ended") { clearStream(); }
      if (t === "session.idle") { clearStream(); setBusy(false); }
      if (sid && sid === state.active) {
        if (t.indexOf("session.execution") === 0) setStatus("wait", "运行中…");
        if (t === "session.idle") setStatus("ok", state.account + " 已连接");
        if (!(typeof streamState !== "undefined" && streamState.text)) {
          clearTimeout(connectSSE._t);
          connectSSE._t = setTimeout(refreshMessages, 800);
        }
      }
    };
    es.onerror = function () { setStatus("bad", "事件流断开，重连中…"); };
  }

  function showApproval(req) {
    if (!req) return;
    var id = req.id || (req.request && req.request.id) || "";
    var sid = req.sessionID || (req.request && req.request.sessionID) || state.active;
    var card = el("div", "card");
    card.appendChild(el("div", "", "需要确认：" + (req.action || req.permission || "操作")));
    var row = el("div", "row");
    [["once", "允许一次"], ["always", "始终允许"], ["reject", "拒绝"]].forEach(function (p) {
      var b = el("button", "btn" + (p[0] === "once" ? " primary" : ""), p[1]);
      b.onclick = function () {
        api("/reply", { method: "POST", body: { sessionID: sid, requestID: id, decision: p[0] } })
          .then(function () { card.remove(); })
          .catch(function (e) { showToast(String(e.message || e)); });
      };
      row.appendChild(b);
    });
    card.appendChild(row);
    msgs.appendChild(card);
    msgs.scrollTop = msgs.scrollHeight;
  }

  modelSel.onchange = switchModel;
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

  // 简单拖动
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

  // 启动
  var saved = load();
  state.handle = saved.handle || null;
  state.account = saved.account || "";
  state.active = saved.active || null;
  if (state.handle) {
    setStatus("wait", "连接中…");
    api("/sessions").then(function () {
      setStatus("ok", state.account ? state.account + " 已连接" : "已连接");
      loadSessions(); connectSSE();
    }).catch(function () { resetLogin(); });
  } else {
    setStatus("", "未连接");
    renderConnect();
  }
})();
