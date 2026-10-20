/* =====================================================================
   СЕРВЕР КІМНАТ для сайту «Інформатика — Володимирська гімназія №3»

   Як встановити (один раз):
   1. Створіть нову Google Таблицю (наприклад, «Кімнати — результати»).
   2. Меню Розширення → Apps Script. Видаліть усе у файлі Code.gs
      і вставте весь цей код.
   3. Змініть ADMIN_KEY нижче на свій «майстер-ключ». Звичайно він не потрібен:
      сторінка вчителя сама створює ключ для вашого комп'ютера. Майстер-ключ
      знадобиться, лише якщо ключ комп'ютера загубиться — вставте його
      в поле «Ключ цього комп'ютера», і побачите всі кімнати.
   4. Натисніть «Зберегти» (дискета).
   5. Натисніть «Розгорнути» → «Нове розгортання» → тип «Веб-застосунок».
        Виконувати як: Я (ваш акаунт)
        Хто має доступ: Усі
      Натисніть «Розгорнути» та дозвольте доступ (Advanced → Go to … → Allow).
   6. Скопіюйте «URL-адресу веб-застосунку» (закінчується на /exec)
      і вставте її у файл kimnata.js на GitHub у рядок KIMNATA_API = "...".

   Якщо згодом зміните цей код: Розгорнути → Керувати розгортаннями →
   олівець → Версія: «Нова версія» → Розгорнути (адреса лишиться та сама).
   ===================================================================== */

const ADMIN_KEY = "1234";   // ← ЗМІНІТЬ на свій майстер-ключ (довгий, щоб не вгадали)

const ROOMS = "Кімнати";
const RESULTS = "Результати";
const ROOM_HEAD = ["code", "name", "game", "settings", "open", "created", "owner"];
const RES_HEAD  = ["time", "code", "name", "game", "data"];

function doGet(e)  { return respond(e && e.parameter ? e.parameter : {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return respond(p);
}

function respond(p) {
  let out;
  try { out = route(p); } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  else if (sh.getLastColumn() < head.length) sh.getRange(1, 1, 1, head.length).setValues([head]);
  return sh;
}
function rows(sh) {
  const n = sh.getLastRow();
  return n < 2 ? [] : sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
}
function toRoom(r) {
  let s = {}; try { s = JSON.parse(r[3] || "{}"); } catch (e) {}
  return { code: String(r[0]), name: String(r[1]), game: String(r[2]), settings: s, open: r[4] === true || r[4] === "TRUE", created: Number(r[5]) };
}
function clean(s, n) { return String(s || "").trim().replace(/\s+/g, " ").slice(0, n || 40); }
function isMaster(p) { return String(p.owner || "") === String(ADMIN_KEY); }
function ownerOk(p) { const o = String(p.owner || ""); if (o.length < 4) throw new Error("Немає ключа вчителя"); return o; }
function canManage(f, p) { return isMaster(p) || (f.owner && String(f.owner) === String(p.owner || "")); }

function findRoom(code) {
  const sh = sheet(ROOMS, ROOM_HEAD), all = rows(sh);
  for (let i = 0; i < all.length; i++) if (String(all[i][0]) === String(code)) return { sh, row: i + 2, room: toRoom(all[i]), owner: String(all[i][6] || "") };
  return null;
}

function route(p) {
  const a = p.action;
  const cache = CacheService.getScriptCache();

  if (a === "check") { return { ok: true, master: isMaster(p) }; }

  // лише кімнати власника (або всі — з майстер-ключем)
  if (a === "rooms") {
    const o = ownerOk(p), master = isMaster(p);
    const list = rows(sheet(ROOMS, ROOM_HEAD))
      .filter(r => master || String(r[6] || "") === o)
      .map(toRoom)
      .sort((x, y) => y.created - x.created);
    return { ok: true, rooms: list, master };
  }

  if (a === "room") {
    const f = findRoom(p.code);
    return f ? { ok: true, room: f.room } : { ok: false, error: "Кімнату з таким кодом не знайдено" };
  }

  if (a === "board") {
    const hit = cache.get("board-" + p.code);
    if (hit) return JSON.parse(hit);
    const f = findRoom(p.code);
    if (!f) return { ok: false, error: "Кімнату не знайдено" };
    const results = rows(sheet(RESULTS, RES_HEAD))
      .filter(r => String(r[1]) === String(p.code))
      .map(r => { let d = {}; try { d = JSON.parse(r[4] || "{}"); } catch (e) {} return { t: Number(r[0]), code: String(r[1]), name: String(r[2]), data: d }; });
    const out = { ok: true, room: f.room, results };
    try { cache.put("board-" + p.code, JSON.stringify(out), 20); } catch (e) {}
    return out;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (a === "submit") {
      const f = findRoom(p.code);
      if (!f) return { ok: false, error: "Кімнату не знайдено" };
      if (!f.room.open) return { ok: false, error: "Кімнату закрито" };
      const name = clean(p.name, 40);
      if (name.length < 2) return { ok: false, error: "Вкажи ім'я" };
      const data = JSON.stringify(p.data || {}).slice(0, 1000);
      sheet(RESULTS, RES_HEAD).appendRow([Date.now(), String(f.room.code), name, f.room.game, data]);
      cache.remove("board-" + f.room.code);
      return { ok: true };
    }

    if (a === "create") {
      const owner = ownerOk(p);
      const sh = sheet(ROOMS, ROOM_HEAD);
      const used = {}; rows(sh).forEach(r => used[String(r[0])] = true);
      let code, guard = 0;
      do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (used[code] && ++guard < 500);
      const room = { code, name: clean(p.name, 60) || "Кімната " + code, game: clean(p.game, 20), settings: p.settings || {}, open: true, created: Date.now() };
      sh.appendRow([room.code, room.name, room.game, JSON.stringify(room.settings), true, room.created, owner]);
      sh.getRange(sh.getLastRow(), 1).setNumberFormat("@").setValue(room.code);
      return { ok: true, room };
    }

    const f = findRoom(p.code);
    if (!f) return { ok: false, error: "Кімнату не знайдено" };
    if (!canManage(f, p)) return { ok: false, error: "Цією кімнатою керує інший комп'ютер" };
    cache.remove("board-" + f.room.code);

    if (a === "setOpen") { f.sh.getRange(f.row, 5).setValue(!!p.open); f.room.open = !!p.open; return { ok: true, room: f.room }; }
    if (a === "clear" || a === "delete") {
      const rs = sheet(RESULTS, RES_HEAD), all = rows(rs);
      const keep = all.filter(r => String(r[1]) !== String(f.room.code));
      if (keep.length !== all.length) {
        rs.getRange(2, 1, all.length, RES_HEAD.length).clearContent();
        if (keep.length) rs.getRange(2, 1, keep.length, RES_HEAD.length).setValues(keep);
      }
      if (a === "delete") f.sh.deleteRow(f.row);
      return { ok: true };
    }
    return { ok: false, error: "Невідома дія" };
  } finally {
    lock.releaseLock();
  }
}
