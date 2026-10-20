/* ==========================================================================
   КІМНАТИ ДЛЯ ЗМАГАНЬ
   ------------------------------------------------------------------------
   Адреса Google Apps Script зберігається в окремому файлі nalashtuvannia.js,
   тож цей файл можна оновлювати, не боячись її стерти.
   Поки адреса порожня, працює ДЕМО-РЕЖИМ (дані лише в цьому браузері).
   ========================================================================== */
const KIMNATA_API = String(window.KIMNATA_API_URL || "").trim();

(function () {
  "use strict";

  const GAMES = {
    typing:    { title: "Клавіатурний тренажер",        file: "klaviaturnyi-trenazher.html", icon: "⌨️" },
    sorting:   { title: "Наведи лад на робочому столі", file: "sortuvannia-failiv.html",     icon: "🗂️" },
    detective: { title: "Юний кібердетектив",           file: "kiberdetektyv.html",          icon: "🕵️" },
    assembly:  { title: "Збери комп'ютер",              file: "zbery-kompiuter.html",        icon: "🖥️" }
  };
  const demo = !KIMNATA_API.trim();
  let K_diagnose = async () => "";

  /* ---------------- демо-сервер у localStorage ---------------- */
  const LS = "kimnata-demo-db";
  function db() {
    try { const d = JSON.parse(localStorage.getItem(LS)); if (d && d.rooms) return d; } catch (e) {}
    return { rooms: [], results: [] };
  }
  function save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }
  function cleanName(s) { return String(s || "").trim().replace(/\s+/g, " ").slice(0, 40); }

  function pub(r) { const o = Object.assign({}, r); delete o.owner; return o; }
  function localCall(p) {
    const d = db(), now = Date.now();
    const find = c => d.rooms.find(r => r.code === String(c));
    const r = p.code ? find(p.code) : null;
    switch (p.action) {
      case "check": return { ok: true, master: false };
      case "rooms": return { ok: true, rooms: d.rooms.filter(x => x.owner === p.owner).map(pub) };
      case "room":  return r ? { ok: true, room: pub(r) } : { ok: false, error: "Кімнату з таким кодом не знайдено" };
      case "board": return r ? { ok: true, room: pub(r), results: d.results.filter(x => x.code === r.code) } : { ok: false, error: "Кімнату не знайдено" };
      case "create": {
        let code; do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (find(code));
        if (!p.owner) return { ok: false, error: "Немає ключа вчителя" };
        const room = { code, name: cleanName(p.name) || "Кімната " + code, game: p.game, settings: p.settings || {}, open: true, created: now, owner: p.owner };
        d.rooms.unshift(room); save(d); return { ok: true, room: pub(room) };
      }
      case "setOpen": case "clear": case "delete":
        if (!r) return { ok: false, error: "Кімнату не знайдено" };
        if (r.owner !== p.owner) return { ok: false, error: "Цією кімнатою керує інший комп'ютер" };
    }
    switch (p.action) {
      case "setOpen": if (!r) return { ok: false, error: "Кімнату не знайдено" }; r.open = !!p.open; save(d); return { ok: true, room: pub(r) };
      case "clear":   d.results = d.results.filter(x => x.code !== String(p.code)); save(d); return { ok: true };
      case "delete":  d.rooms = d.rooms.filter(x => x.code !== String(p.code)); d.results = d.results.filter(x => x.code !== String(p.code)); save(d); return { ok: true };
      case "submit": {
        if (!r) return { ok: false, error: "Кімнату не знайдено" };
        if (!r.open) return { ok: false, error: "Кімнату закрито" };
        d.results.push({ code: r.code, name: cleanName(p.name), data: p.data || {}, t: now }); save(d); return { ok: true };
      }
    }
    return { ok: false, error: "Невідома дія" };
  }

  /* ---------------- виклик сервера ---------------- */
  const READS = ["rooms", "room", "board"];
  async function call(p) {
    if (demo) return localCall(JSON.parse(JSON.stringify(p)));
    let res;
    if (READS.includes(p.action) && !p.owner) {
      const q = new URLSearchParams(Object.assign({}, p, { _: Date.now() }));
      res = await fetch(KIMNATA_API.trim() + "?" + q.toString());
    } else {
      // text/plain — без зайвих перевірок CORS, Apps Script це приймає
      res = await fetch(KIMNATA_API.trim(), { method: "POST", body: JSON.stringify(p) });
    }
    if (!res.ok) throw new Error("Сервер не відповідає (" + res.status + ")");
    return res.json();
  }

  /* діагностика: що не так з адресою чи розгортанням */
  K_diagnose = async function () {
    const u = KIMNATA_API.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(u)) {
      if (/\/dev$/.test(u)) return "Адреса закінчується на /dev — це тестова адреса. Потрібна адреса з «Розгорнути → Керувати розгортаннями», що закінчується на /exec.";
      if (/script\.google\.com\/(home|d\/)/.test(u)) return "Це адреса редактора скрипта, а не веб-застосунку. Потрібна «URL-адреса веб-застосунку», що закінчується на /exec.";
      return "Адреса в kimnata.js має вигляд https://script.google.com/macros/s/…/exec. Перевірте, чи скопійовано її повністю, без пробілів.";
    }
    try {
      const r = await fetch(u + "?action=rooms&_=" + Date.now());
      const t = await r.text();
      try { JSON.parse(t); } catch (e) { return "Google повертає не дані, а сторінку. Найімовірніше, у розгортанні вибрано доступ не «Усі». Розгорнути → Керувати розгортаннями → олівець → «Хто має доступ: Усі» → Нова версія → Розгорнути."; }
      return "Зв'язок із таблицею є. Спробуйте ще раз або оновіть сторінку (Ctrl+F5).";
    } catch (e) {
      return "Google не пускає сторінку до скрипта. Перевірте: 1) «Хто має доступ: Усі» (не «Усі, хто має акаунт Google»); 2) ви дозволили доступ під час першого розгортання; 3) після змін коду створено «Нову версію». Відкрийте в новій вкладці " + u + "?action=rooms — має з'явитися {\"ok\":true,…}.";
    }
  };

  /* секретний ключ цього комп'ютера: кімнатами керує лише той, хто їх створив */
  const OK = "kimnata-owner";
  function ownerKey() {
    let k = "";
    try { k = localStorage.getItem(OK) || ""; } catch (e) {}
    if (!k) {
      const b = new Uint8Array(12); crypto.getRandomValues(b);
      k = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem(OK, k); } catch (e) {}
    }
    return k;
  }
  function setOwnerKey(k) { try { localStorage.setItem(OK, String(k).trim()); } catch (e) {} }

  function link(room) {
    const g = GAMES[room.game];
    return new URL((g ? g.file : "") + "?k=" + room.code, location.href).href;
  }
  function settingsText(room) {
    const s = room.settings || {};
    if (room.game === "typing") {
      const L = { 1: "основний ряд", 2: "слова", 3: "речення", 4: "текст" };
      return (s.lang === "en" ? "English" : "Українська") + " · рівень " + s.level + " (" + (L[s.level] || "") + ")";
    }
    if (room.game === "assembly") return s.hard ? "без підписів на схемі" : "з підписами на схемі";
    if (room.game === "sorting") return (s.count * 6) + " файлів" + (s.hard ? " · без підказок-іконок" : "");
    return "";
  }

  /* ---------------- віджет для учня ---------------- */
  const CSS = `
  .km-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;background:#1F1A5E;color:#fff;border-radius:16px;
    padding:10px 14px;font-family:"Nunito","Segoe UI",Arial,sans-serif;font-weight:700;font-size:15px;line-height:1.3;box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .km-bar b{font-weight:900}
  .km-bar .km-grow{flex:1;min-width:200px}
  .km-bar code{font-family:"JetBrains Mono",Consolas,monospace;background:rgba(255,255,255,.16);padding:1px 7px;border-radius:6px;font-weight:700}
  .km-btn{font:inherit;font-weight:800;border:0;border-radius:10px;padding:7px 14px;cursor:pointer;background:#FFC233;color:#1A1B4B}
  .km-btn.km-ghost{background:rgba(255,255,255,.14);color:#fff}
  .km-st{font-size:14px;opacity:.95}
  .km-st.ok{color:#7CF0A6}.km-st.bad{color:#FF9EA2}
  .km-demo{font-size:12px;background:#FFC233;color:#1A1B4B;border-radius:6px;padding:1px 6px;font-weight:900}
  dialog.km-dlg{border:0;border-radius:22px;padding:24px;width:min(460px,92vw);font-family:"Nunito","Segoe UI",Arial,sans-serif;color:#1A1B4B;background:#fff}
  dialog.km-dlg::backdrop{background:rgba(26,27,75,.55)}
  .km-dlg h2{margin:0 0 4px;font-size:24px;font-weight:900}
  .km-dlg p{margin:0 0 14px;color:#585C8C;font-weight:700}
  .km-dlg label{display:block;font-weight:900;font-size:14px;margin:12px 0 6px}
  .km-dlg input{width:100%;box-sizing:border-box;font:inherit;font-size:18px;font-weight:800;padding:10px 12px;border:2px solid #D6DBF5;border-radius:12px;color:#1A1B4B;background:#fff}
  .km-dlg input:focus{outline:none;border-color:#2F6BFF}
  .km-dlg input.km-code{font-family:"JetBrains Mono",Consolas,monospace;letter-spacing:6px;font-size:24px;text-align:center}
  .km-rooms{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:180px;overflow:auto}
  .km-room{font:inherit;text-align:left;border:2px solid #D6DBF5;background:#F4F6FF;border-radius:12px;padding:8px 12px;cursor:pointer;font-weight:800;color:#1A1B4B}
  .km-room[aria-pressed="true"]{border-color:#2F6BFF;background:#E6EEFF}
  .km-room small{display:block;color:#585C8C;font-weight:700}
  .km-err{color:#E5484D;font-weight:800;min-height:22px;margin-top:10px}
  .km-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
  .km-actions .km-btn{padding:10px 18px;font-size:16px}
  .km-actions .km-ghost{background:#EEF1FF;color:#1A1B4B}
  .km-muted{color:#585C8C;font-weight:700;font-size:14px}
  `;
  let styled = false;
  function addStyle() { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  const K = {
    games: GAMES, demo, call, link, settingsText, cleanName,
    join: null,   // {code, name, room}
    ownerKey, setOwnerKey,
    diagnose: () => K_diagnose(),
    attach
  };
  window.Kimnata = K;

  let gameId = null, hooks = {}, bar = null, dlg = null, statusEl = null;
  const key = () => "kimnata-join-" + gameId;

  function attach(id, h) {
    gameId = id; hooks = h || {};
    addStyle();
    bar = document.getElementById("kimnata-bar");
    if (!bar) { bar = document.createElement("div"); bar.id = "kimnata-bar"; document.body.prepend(bar); }
    renderBar();
    const urlCode = new URLSearchParams(location.search).get("k");
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(key())); } catch (e) {}
    if (saved && (!urlCode || urlCode === saved.code)) {
      call({ action: "room", code: saved.code }).then(r => {
        if (r.ok && r.room.open && r.room.game === gameId) setJoin(saved.name, r.room);
        else { try { sessionStorage.removeItem(key()); } catch (e) {} if (urlCode) openDialog(urlCode); }
      }).catch(() => setJoin(saved.name, saved.room));
    } else if (urlCode) openDialog(urlCode);
  }

  function setJoin(name, room) {
    K.join = { code: room.code, name, room };
    try { sessionStorage.setItem(key(), JSON.stringify(K.join)); } catch (e) {}
    renderBar();
    if (hooks.onJoin) hooks.onJoin(room, name);
  }
  function leave() {
    K.join = null;
    try { sessionStorage.removeItem(key()); } catch (e) {}
    renderBar();
    if (hooks.onLeave) hooks.onLeave();
  }

  function renderBar() {
    if (!bar) return;
    const d = demo ? ` <span class="km-demo" title="Результати бачить лише цей браузер">ДЕМО</span>` : "";
    if (!K.join) {
      bar.className = "km-bar";
      bar.innerHTML = `<span class="km-grow">🏆 Хочеш змагатися з класом?${d}</span><button class="km-btn" data-km="open">Приєднатися до кімнати</button>`;
    } else {
      bar.className = "km-bar";
      bar.innerHTML = `<span class="km-grow">🏆 Кімната <b>«${esc(K.join.room.name)}»</b> · код <code>${esc(K.join.code)}</code> · <b>${esc(K.join.name)}</b>${d}<br><span class="km-st" id="kmSt">Результати потраплять на екран учителя.</span></span><button class="km-btn km-ghost" data-km="leave">Вийти з кімнати</button>`;
    }
    statusEl = bar.querySelector("#kmSt");
    bar.querySelector("[data-km=open]")?.addEventListener("click", () => openDialog(""));
    bar.querySelector("[data-km=leave]")?.addEventListener("click", leave);
  }
  function status(text, cls) { if (statusEl) { statusEl.textContent = text; statusEl.className = "km-st " + (cls || ""); } }

  function openDialog(code) {
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "km-dlg";
      dlg.innerHTML = `
        <h2>🏆 Приєднатися до кімнати</h2>
        <p>Учитель покаже код кімнати на екрані.</p>
        <label for="kmCode">Код кімнати</label>
        <input id="kmCode" class="km-code" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="0000">
        <label for="kmName">Твоє ім'я та прізвище</label>
        <input id="kmName" maxlength="40" autocomplete="off" placeholder="Наприклад, Олена Коваль">
        <div class="km-err" id="kmErr"></div>
        <div class="km-actions"><button class="km-btn km-ghost" data-km="cancel">Скасувати</button><button class="km-btn" data-km="go">Приєднатися</button></div>`;
      document.body.appendChild(dlg);
      dlg.querySelector("[data-km=cancel]").onclick = () => dlg.close();
      dlg.querySelector("[data-km=go]").onclick = submitJoin;
      dlg.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitJoin(); } e.stopPropagation(); });
      dlg.querySelector("#kmCode").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, ""); });
    }
    dlg.querySelector("#kmCode").value = code || "";
    dlg.querySelector("#kmErr").textContent = "";
    if (!dlg.open) dlg.showModal();
    (code ? dlg.querySelector("#kmName") : dlg.querySelector("#kmCode")).focus();
  }
  async function submitJoin() {
    const code = dlg.querySelector("#kmCode").value.trim(), name = cleanName(dlg.querySelector("#kmName").value);
    const err = dlg.querySelector("#kmErr");
    if (code.length !== 4) { err.textContent = "Введи чотири цифри коду."; return; }
    if (name.length < 2) { err.textContent = "Впиши своє ім'я та прізвище."; dlg.querySelector("#kmName").focus(); return; }
    err.textContent = "Перевіряю…";
    try {
      const r = await call({ action: "room", code });
      if (!r.ok) { err.textContent = r.error || "Кімнату не знайдено."; return; }
      if (!r.room.open) { err.textContent = "Ця кімната вже закрита."; return; }
      if (r.room.game !== gameId) {
        const g = GAMES[r.room.game];
        err.innerHTML = g ? `Ця кімната для гри «${esc(g.title)}». <a href="${esc(link(r.room))}">Перейти туди</a>` : "Ця кімната для іншої гри.";
        return;
      }
      dlg.close(); setJoin(name, r.room);
    } catch (e) { err.textContent = "Немає зв'язку із сервером. Спробуй ще раз."; }
  }

  /* ---------------- надсилання результату ---------------- */
  K.report = function (data, _try) {
    if (!K.join) return;
    const j = K.join, n = _try || 1;
    status(n > 1 ? "Повторюю надсилання…" : "Надсилаю результат…");
    call({ action: "submit", code: j.code, name: j.name, game: gameId, data })
      .then(r => {
        if (r.ok) status("✓ Результат надіслано на екран учителя", "ok");
        else status("✗ " + (r.error || "Не вдалося надіслати"), "bad");
      })
      .catch(() => {
        if (n < 4) { status("Немає зв'язку, пробую ще раз…", "bad"); setTimeout(() => K.report(data, n + 1), 3000 * n); }
        else status("✗ Не вдалося надіслати. Перевір Інтернет.", "bad");
      });
  };

  /* детермінований генератор (однакові тексти для всіх у кімнаті) */
  K.seeded = function (str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
})();
