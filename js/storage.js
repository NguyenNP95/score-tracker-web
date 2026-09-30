// Lưu dữ liệu trong trình duyệt. Cấu trúc JSON giống file table.json của bản Android.

import { MIN_COLUMNS } from './model.js';

const KEY_TABLE = 'score-tracker.table';
const KEY_HISTORY = 'score-tracker.history';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Không đọc được dữ liệu đã lưu', key, e);
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('Không lưu được dữ liệu', key, e);
    return false;
  }
}

const encode = (table) => ({
  version: 1,
  columns: table.columns,
  rows: table.rows.map((r) => ({ cells: r.cells, auto: r.auto ?? -1 })),
});

/** Trả về null nếu dữ liệu hỏng, để app bắt đầu bảng mới thay vì lỗi. */
function decode(json) {
  if (!json || !Array.isArray(json.columns) || !Array.isArray(json.rows)) return null;
  const columns = json.columns.map(String);
  if (columns.length < MIN_COLUMNS || json.rows.length === 0) return null;
  const rows = json.rows.map((r) => {
    const src = Array.isArray(r?.cells) ? r.cells : [];
    const cells = columns.map((_, c) => (Number.isInteger(src[c]) ? src[c] : null));
    const auto = Number.isInteger(r?.auto) && cells[r.auto] != null ? r.auto : null;
    return { cells, auto };
  });
  return { columns, rows };
}

export const loadTable = () => decode(read(KEY_TABLE));
export const saveTable = (table) => write(KEY_TABLE, encode(table));

/* ---------- Lịch sử: [{ savedAt, table }], mới nhất trước ---------- */

export function loadHistory() {
  const list = read(KEY_HISTORY);
  if (!Array.isArray(list)) return [];
  return list
    .map((e) => ({ savedAt: Number(e?.savedAt), table: decode(e?.table) }))
    .filter((e) => Number.isFinite(e.savedAt) && e.table)
    .sort((a, b) => b.savedAt - a.savedAt);
}

const saveHistory = (entries) =>
  write(KEY_HISTORY, entries.map((e) => ({ savedAt: e.savedAt, table: encode(e.table) })));

export function addHistory(table, savedAt = Date.now()) {
  return saveHistory([{ savedAt, table }, ...loadHistory()]);
}

export const deleteHistory = (savedAt) => saveHistory(loadHistory().filter((e) => e.savedAt !== savedAt));

export const clearHistory = () => saveHistory([]);

/** Xin trình duyệt không tự xóa dữ liệu khi thiếu dung lượng. */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
