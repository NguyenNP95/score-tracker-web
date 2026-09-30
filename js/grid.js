// Vẽ bảng điểm. Tạo DOM một lần rồi chỉ cập nhật phần thay đổi, để nhập liệu luôn mượt.
// Tên người chơi và hàng Tổng dính trên đầu, cột số thứ tự dính bên trái khi cuộn.

import { columnSums, formatValue, isRowUnbalanced } from './model.js';
import { h } from './ui.js';

const MAX_VISIBLE_COLUMNS = 6;
const INDEX_WIDTH = 44;
const MIN_COLUMN_WIDTH = 68;

function setText(el, text) {
  const s = String(text);
  if (el.textContent !== s) el.textContent = s;
}

export class ScoreGrid {
  /**
   * Không có onCellTap thì bảng chỉ để xem (dùng cho lịch sử).
   * onCellTap(row, col), onNameTap(col)
   */
  constructor(wrap, { onCellTap, onNameTap } = {}) {
    this.wrap = wrap;
    this.editable = Boolean(onCellTap);
    this.columnCount = 0;
    this.selected = null;

    this.el = h('div', `grid${this.editable ? ' editable' : ''}`);
    this.el.style.setProperty('--idx-w', `${INDEX_WIDTH}px`);
    this.nameRow = h('div', 'g-row g-names');
    this.sumRow = h('div', 'g-row g-sums');
    this.nameRow.append(h('div', 'g-idx g-corner', '#'));
    this.sumRow.append(h('div', 'g-idx g-corner g-total-label', 'Tổng'));
    const head = h('div', 'g-head');
    head.append(this.nameRow, this.sumRow);
    this.body = h('div', 'g-body');
    this.el.append(head, this.body, h('div', 'g-spacer'));
    wrap.append(this.el);

    this.names = []; // { el, label }
    this.sums = []; // { el, value }
    this.rows = []; // { el, idx, cells[] }

    if (this.editable) {
      wrap.addEventListener('click', (e) => {
        const cell = e.target.closest('.g-cell');
        if (cell) return onCellTap(Number(cell.dataset.row), Number(cell.dataset.col));
        const name = e.target.closest('.g-name');
        if (name) onNameTap?.(Number(name.dataset.col));
      });
    }

    new ResizeObserver(() => this.fit()).observe(wrap);
  }

  bind(table) {
    const n = table.columns.length;
    this.columnCount = n;
    this.syncColumns(n);
    this.syncRows(table.rows.length, n);

    const sums = columnSums(table);
    const best = Math.max(...sums);
    // Người dẫn đầu: tổng cao nhất và phải dương (hòa thì cùng dẫn đầu).
    const leaderSum = best > 0 ? best : null;
    this.names.forEach((name, c) => {
      setText(name.label, table.columns[c]);
      name.el.title = table.columns[c];
    });
    this.sums.forEach((sum, c) => {
      const v = sums[c];
      setText(sum.value, v);
      sum.el.classList.toggle('pos', v > 0);
      sum.el.classList.toggle('neg', v < 0);
      sum.el.classList.toggle('leader', v === leaderSum);
    });

    table.rows.forEach((row, r) => {
      const views = this.rows[r];
      views.el.classList.toggle('warn', isRowUnbalanced(row));
      views.cells.forEach((cell, c) => {
        setText(cell, formatValue(row.cells[c]));
        cell.classList.toggle('auto', c === row.auto);
      });
    });

    this.setSelected(this.selected);
    this.fit();
  }

  /** sel = { row, col } hoặc null. Đánh dấu ô đang nhập cùng hàng và cột của nó. */
  setSelected(sel) {
    const prev = this.selected;
    if (prev) {
      this.rows[prev.row]?.el.classList.remove('current');
      this.rows[prev.row]?.cells[prev.col]?.classList.remove('selected');
      this.names[prev.col]?.el.classList.remove('current');
    }
    this.selected = sel;
    if (sel) {
      this.rows[sel.row]?.el.classList.add('current');
      this.rows[sel.row]?.cells[sel.col]?.classList.add('selected');
      this.names[sel.col]?.el.classList.add('current');
    }
  }

  scrollToCell(row, col) {
    this.rows[row]?.cells[col]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  scrollToTop() {
    this.wrap.scrollTo({ top: 0, left: 0 });
  }

  /** Chia đều bề ngang cho tối đa MAX_VISIBLE_COLUMNS cột, không hẹp hơn MIN_COLUMN_WIDTH. */
  fit() {
    const available = this.wrap.clientWidth - INDEX_WIDTH;
    if (available <= 0 || this.columnCount === 0) return;
    const visible = Math.min(this.columnCount, MAX_VISIBLE_COLUMNS);
    const width = Math.max(Math.floor(available / visible), MIN_COLUMN_WIDTH);
    this.el.style.setProperty('--col-w', `${width}px`);
  }

  /* ---------- Thêm/bớt DOM theo số hàng/cột (chỉ ở cuối) ---------- */

  syncColumns(n) {
    while (this.names.length < n) {
      const c = this.names.length;
      const el = h(this.editable ? 'button' : 'div', 'g-name');
      if (this.editable) el.type = 'button';
      el.dataset.col = c;
      const label = h('span', 'g-name-text');
      el.append(label);
      this.nameRow.append(el);
      this.names.push({ el, label });

      const sumEl = h('div', 'g-sum');
      const value = h('span', 'g-sum-value');
      sumEl.append(value);
      this.sumRow.append(sumEl);
      this.sums.push({ el: sumEl, value });
    }
    while (this.names.length > n) {
      this.names.pop().el.remove();
      this.sums.pop().el.remove();
    }
    this.rows.forEach((row, r) => this.syncCells(row, r, n));
  }

  syncRows(count, n) {
    while (this.rows.length < count) {
      const r = this.rows.length;
      const el = h('div', 'g-row');
      const idx = h('div', 'g-idx', r + 1);
      el.append(idx);
      const row = { el, idx, cells: [] };
      this.syncCells(row, r, n);
      this.body.append(el);
      this.rows.push(row);
    }
    while (this.rows.length > count) this.rows.pop().el.remove();
  }

  syncCells(row, r, n) {
    while (row.cells.length < n) {
      const cell = h('div', 'g-cell');
      cell.dataset.row = r;
      cell.dataset.col = row.cells.length;
      row.el.append(cell);
      row.cells.push(cell);
    }
    while (row.cells.length > n) row.cells.pop().remove();
  }
}
