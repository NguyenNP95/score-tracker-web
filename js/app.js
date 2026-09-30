import * as M from './model.js';
import * as S from './storage.js';
import { ScoreGrid } from './grid.js';
import { shareXlsx } from './xlsx.js';
import {
  choiceDialog, confirmDialog, formatDate, formatTime, h, isDialogOpen, promptDialog, toast,
} from './ui.js';

const $ = (sel) => document.querySelector(sel);
const root = document.documentElement;

/* ====================== Bảng đang chơi ====================== */

let table = S.loadTable() ?? M.createTable();

/** Mọi thay đổi bảng đi qua đây: vẽ lại và lưu ngay (dữ liệu rất nhỏ). */
function update(next) {
  if (next === table) return;
  table = next;
  S.saveTable(table);
  renderGame();
}

const gameGrid = new ScoreGrid($('#game-table'), { onCellTap: tapCell, onNameTap: renamePlayer });

function renderGame() {
  gameGrid.bind(table);
  gameGrid.setSelected(sel);
  $('#col-count').textContent = table.columns.length;
  $('#row-count').textContent = table.rows.length;
  $('#btn-col-remove').disabled = table.columns.length <= M.MIN_COLUMNS;
  $('#btn-row-remove').disabled = table.rows.length <= M.MIN_ROWS;
  renderKeypad();
}

$('#btn-col-add').addEventListener('click', () => {
  update(M.addColumn(table));
  const col = table.columns.length - 1;
  requestAnimationFrame(() => gameGrid.scrollToCell(0, col));
});

$('#btn-col-remove').addEventListener('click', async () => {
  const name = table.columns.at(-1);
  const ok = await confirmDialog({
    message: `Xóa người chơi cuối cùng (${name})? Toàn bộ điểm của người này sẽ bị xóa.`,
  });
  if (!ok) return;
  if (sel && sel.col >= table.columns.length - 1) closeKeypad();
  update(M.removeLastColumn(table));
});

$('#btn-row-add').addEventListener('click', () => update(M.addRows(table)));

$('#btn-row-remove').addEventListener('click', async () => {
  if (!(await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa hàng cuối cùng không?' }))) return;
  if (sel && sel.row >= table.rows.length - 1) closeKeypad();
  update(M.removeLastRow(table));
});

async function renamePlayer(col) {
  closeKeypad();
  const name = await promptDialog({
    title: 'Tên người chơi',
    value: table.columns[col],
    placeholder: M.defaultColumnName(col),
  });
  if (name !== null) update(M.renameColumn(table, col, name));
}

$('#btn-export').addEventListener('click', () => exportTable(table));

async function exportTable(t) {
  try {
    const result = await shareXlsx(t);
    if (result === 'downloaded') toast('Đã tải file Excel');
  } catch (e) {
    console.error(e);
    toast('Không xuất được file Excel');
  }
}

$('#btn-reset').addEventListener('click', async () => {
  const choice = await choiceDialog({
    title: 'Chơi lại từ đầu',
    message: 'Bảng hiện tại sẽ được lưu vào Lịch sử, sau đó xóa hết điểm để chơi lại. Bạn có muốn giữ lại tên người chơi không?',
    buttons: [
      { label: 'Giữ tên người chơi', value: 'keep', kind: 'primary' },
      { label: 'Xóa cả tên', value: 'all', kind: 'danger' },
      { label: 'Hủy', value: null, kind: 'ghost' },
    ],
  });
  if (!choice) return;

  const hasScores = M.playedRowCount(table) > 0;
  if (hasScores && !S.addHistory(M.withoutTrailingEmptyRows(table))) {
    toast('Không lưu được vào Lịch sử, bảng chưa bị xóa');
    return;
  }
  closeKeypad();
  update(choice === 'keep' ? M.clearScores(table) : M.createTable());
  gameGrid.scrollToTop();
  toast(hasScores ? 'Đã lưu vào Lịch sử · Bắt đầu lượt mới' : 'Đã bắt đầu lượt mới');
});

$('#btn-history').addEventListener('click', () => navigate('#/history'));

/* ====================== Bàn phím số ====================== */

// Ô đang nhập và chữ đang gõ. "fresh" = vừa chọn ô: phím số đầu tiên sẽ thay giá trị cũ.
let sel = null;
let entry = { text: '', fresh: true };

const keypad = $('#keypad');
const kpPlayer = $('#kp-player');
const kpRound = $('#kp-round');
const kpDisplay = $('#kp-display');
const kpValue = $('#kp-value');

function selectCell(row, col) {
  sel = { row, col };
  entry = { text: M.formatValue(table.rows[row].cells[col]), fresh: true };
  openKeypad();
  renderGame();
  requestAnimationFrame(() => gameGrid.scrollToCell(row, col));
}

/** Chạm lại đúng ô đang nhập thì ẩn bàn phím. */
function tapCell(row, col) {
  if (sel && sel.row === row && sel.col === col) closeKeypad();
  else selectCell(row, col);
}

function openKeypad() {
  if (keypad.classList.contains('open')) return;
  keypad.classList.add('open');
  keypad.setAttribute('aria-hidden', 'false');
  syncKeypadHeight();
}

function closeKeypad() {
  if (!sel) return;
  sel = null;
  keypad.classList.remove('open');
  keypad.setAttribute('aria-hidden', 'true');
  root.style.setProperty('--kp-h', '0px');
  renderGame();
}

/** Chừa chỗ dưới bảng để bàn phím không che mất các hàng cuối. */
function syncKeypadHeight() {
  if (keypad.classList.contains('open')) root.style.setProperty('--kp-h', `${keypad.offsetHeight}px`);
}
new ResizeObserver(syncKeypadHeight).observe(keypad);

function renderKeypad() {
  if (!sel) return;
  const row = table.rows[sel.row];
  kpPlayer.textContent = table.columns[sel.col];
  kpRound.textContent = `Ván ${sel.row + 1}`;
  kpValue.textContent = entry.text;
  kpDisplay.classList.toggle('is-empty', entry.text === '');
  kpDisplay.classList.toggle('fresh', entry.fresh && entry.text !== '');
  kpDisplay.classList.toggle('auto', entry.fresh && sel.col === row.auto);
}

function press(key) {
  if (!sel) return;
  if (key === 'next') return moveNext();
  if (key === 'done') return closeKeypad();

  const { text, fresh } = entry;
  let next;
  if (key === 'minus') {
    // Vừa chọn ô: bắt đầu số âm mới. Đang gõ: đổi dấu số đang gõ.
    if (fresh || text === '') next = '-';
    else next = text.startsWith('-') ? text.slice(1) : `-${text}`;
  } else if (key === 'back') {
    next = text.slice(0, -1);
  } else if (key === 'clear') {
    next = '';
  } else {
    const base = fresh ? '' : text;
    if (base === '0') next = key;
    else if (base === '-0') next = `-${key}`;
    else next = base + key;
  }
  entry = { text: M.sanitizeInput(next), fresh: false };
  commit();
}

/** Ghi giá trị đang gõ vào bảng ngay, để ô tự điền và hàng Tổng cập nhật theo từng phím. */
function commit() {
  const value = M.parseInput(entry.text);
  let next = M.setCell(table, sel.row, sel.col, value);
  // Nhập vào hàng cuối thì tự thêm hàng để luôn còn chỗ cho ván tiếp theo.
  if (value !== null && sel.row === next.rows.length - 1) next = M.addRows(next);
  update(next);
  renderKeypad();
}

/** Sang ô trống tiếp theo trong ván; hết thì sang ván sau. */
function moveNext() {
  const { row, col } = sel;
  const cells = table.rows[row].cells;
  for (let c = col + 1; c < cells.length; c++) {
    if (cells[c] === null) return selectCell(row, c);
  }
  if (row + 1 >= table.rows.length) update(M.addRows(table));
  const firstEmpty = table.rows[row + 1].cells.indexOf(null);
  selectCell(row + 1, Math.max(firstEmpty, 0));
}

function moveBy(dRow, dCol) {
  const row = Math.min(Math.max(sel.row + dRow, 0), table.rows.length - 1);
  const col = Math.min(Math.max(sel.col + dCol, 0), table.columns.length - 1);
  if (row !== sel.row || col !== sel.col) selectCell(row, col);
}

// Dùng pointerdown để phím phản hồi ngay, không chờ click; chặn luôn việc mất focus.
keypad.addEventListener('pointerdown', (e) => {
  const key = e.target.closest('[data-key]');
  if (!key) return;
  e.preventDefault();
  key.classList.add('pressed');
  // "Xong" đợi tới click: đóng ngay ở đây thì bàn phím trượt đi trước khi click tới,
  // click rơi xuống ô bên dưới và mở lại bàn phím.
  if (key.dataset.key !== 'done') press(key.dataset.key);
  navigator.vibrate?.(6);
});
const release = (e) => e.target.closest?.('[data-key]')?.classList.remove('pressed');
keypad.addEventListener('pointerup', release);
keypad.addEventListener('pointercancel', release);
keypad.addEventListener('pointerout', release);
// Bàn phím/trình đọc màn hình (Enter/Space trên nút) không đi qua pointerdown; nút Xong luôn chạy ở đây.
keypad.addEventListener('click', (e) => {
  const key = e.target.closest('[data-key]');
  if (key && (e.detail === 0 || key.dataset.key === 'done')) press(key.dataset.key);
});

// Chạm ra ngoài bàn phím và ngoài các ô điểm thì ẩn bàn phím.
document.addEventListener('click', (e) => {
  if (!sel || isDialogOpen()) return;
  if (e.target.closest('#keypad, .g-cell, dialog')) return;
  closeKeypad();
});

// Bàn phím thật (máy tính, iPad có bàn phím).
document.addEventListener('keydown', (e) => {
  if (!sel || isDialogOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  const keys = {
    Backspace: 'back', Delete: 'clear', Enter: 'next', Tab: 'next', Escape: 'done', '-': 'minus', '−': 'minus',
  };
  const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (/^[0-9]$/.test(e.key)) press(e.key);
  else if (keys[e.key]) press(keys[e.key]);
  else if (arrows[e.key]) moveBy(...arrows[e.key]);
  else return;
  e.preventDefault();
});

/* ====================== Lịch sử ====================== */

const historyList = $('#history-list');
const historyEmpty = $('#history-empty');

function playerChips(t) {
  const sums = M.columnSums(t);
  const players = t.columns.map((name, i) => ({ name, sum: sums[i] })).sort((a, b) => b.sum - a.sum);
  const best = players[0]?.sum ?? 0;
  const wrap = h('div', 'chips');
  for (const p of players) {
    const chip = h('span', 'chip');
    chip.classList.toggle('pos', p.sum > 0);
    chip.classList.toggle('neg', p.sum < 0);
    chip.classList.toggle('leader', best > 0 && p.sum === best);
    chip.append(h('span', 'chip-name', p.name), h('span', 'chip-score', M.formatSigned(p.sum)));
    wrap.append(chip);
  }
  return wrap;
}

function renderHistory() {
  const entries = S.loadHistory();
  historyList.replaceChildren(
    ...entries.map((entry) => {
      const card = h('article', 'h-card');
      card.dataset.id = entry.savedAt;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');

      const head = h('div', 'h-head');
      const info = h('div', 'h-info');
      info.append(
        h('div', 'h-date', formatDate(entry.savedAt)),
        h('div', 'h-sub', `${formatTime(entry.savedAt)} · ${M.playedRowCount(entry.table)} ván`),
      );
      const del = h('button', 'icon-btn danger h-del');
      del.type = 'button';
      del.setAttribute('aria-label', 'Xóa khỏi lịch sử');
      del.innerHTML = '<svg class="icon"><use href="#i-delete"/></svg>';
      head.append(info, del);
      card.append(head, playerChips(entry.table));
      return card;
    }),
  );
  historyEmpty.hidden = entries.length > 0;
  $('#btn-history-clear').disabled = entries.length === 0;
}

historyList.addEventListener('click', async (e) => {
  const card = e.target.closest('.h-card');
  if (!card) return;
  const id = Number(card.dataset.id);
  if (e.target.closest('.h-del')) {
    const ok = await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa lần chơi này khỏi lịch sử không?' });
    if (ok) {
      S.deleteHistory(id);
      renderHistory();
    }
    return;
  }
  navigate(`#/history/${id}`);
});

historyList.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('h-card')) {
    e.preventDefault();
    navigate(`#/history/${e.target.dataset.id}`);
  }
});

$('#btn-history-clear').addEventListener('click', async () => {
  const ok = await confirmDialog({
    message: 'Bạn có chắc chắn muốn xóa toàn bộ lịch sử không? Dữ liệu đã xóa không thể khôi phục.',
    confirmLabel: 'Xóa tất cả',
  });
  if (!ok) return;
  S.clearHistory();
  renderHistory();
});

/* ---------- Xem lại một lần chơi (chỉ xem) ---------- */

const detailGrid = new ScoreGrid($('#detail-table'));
let detailEntry = null;

function renderDetail(id) {
  detailEntry = S.loadHistory().find((e) => e.savedAt === id) ?? null;
  if (!detailEntry) return false;
  const t = detailEntry.table;
  $('#detail-title').textContent = formatDate(id);
  $('#detail-sub').textContent = `${formatTime(id)} · ${M.playedRowCount(t)} ván · ${t.columns.length} người chơi`;
  detailGrid.bind(t);
  detailGrid.scrollToTop();
  return true;
}

$('#btn-detail-export').addEventListener('click', () => detailEntry && exportTable(detailEntry.table));

$('#btn-detail-delete').addEventListener('click', async () => {
  if (!detailEntry) return;
  if (!(await confirmDialog({ message: 'Bạn có chắc chắn muốn xóa lần chơi này khỏi lịch sử không?' }))) return;
  S.deleteHistory(detailEntry.savedAt);
  goBack('#/history');
});

/* ====================== Điều hướng ====================== */
// Dùng hash (#/history, #/history/<id>) để nút Back của máy và vuốt lùi trên iOS hoạt động đúng.

const views = { game: $('#view-game'), history: $('#view-history'), detail: $('#view-detail') };
let currentView = null;

function showView(name) {
  if (name === currentView) return;
  const deeper = ['game', 'history', 'detail'];
  const forward = currentView && deeper.indexOf(name) > deeper.indexOf(currentView);
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
    el.classList.remove('enter-forward', 'enter-back');
  }
  if (currentView) views[name].classList.add(forward ? 'enter-forward' : 'enter-back');
  currentView = name;
}

function route() {
  const hash = location.hash;
  const detail = hash.match(/^#\/history\/(\d+)$/);
  if (detail) {
    showView('detail');
    if (!renderDetail(Number(detail[1]))) {
      history.replaceState(null, '', '#/history');
      return route();
    }
  } else if (hash === '#/history') {
    showView('history');
    renderHistory();
  } else {
    showView('game');
    return;
  }
  closeKeypad();
}

function navigate(hash) {
  history.pushState({ inApp: true }, '', hash);
  route();
}

/** Lùi lại nếu đã đi vào từ trong app, không thì thay bằng trang cha. */
function goBack(fallback) {
  if (history.state?.inApp) history.back();
  else {
    history.replaceState(null, '', fallback);
    route();
  }
}

window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
document.querySelectorAll('[data-back]').forEach((btn) => {
  btn.addEventListener('click', () => goBack(btn.dataset.back));
});

/* ====================== Giữ màn hình sáng ====================== */

let wakeLock = null;
async function keepAwake() {
  if (wakeLock || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Máy không cho phép (VD: đang tiết kiệm pin) thì thôi.
  }
}
document.addEventListener('visibilitychange', keepAwake);
// Một số trình duyệt chỉ cho phép sau khi người dùng chạm vào trang.
document.addEventListener('pointerdown', keepAwake, { passive: true });

/* ====================== Khởi động ====================== */

renderGame();
route();
keepAwake();
S.requestPersistence();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Không đăng ký được service worker', e));
}
