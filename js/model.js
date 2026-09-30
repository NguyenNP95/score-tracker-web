// Bảng điểm. Chuyển từ bản Android (ScoreTable.kt), giữ nguyên luật.
// Mọi hàm đều trả về object mới, không sửa object cũ.
//
// row   = { cells: (number|null)[], auto: number|null }
// table = { columns: string[], rows: row[] }

export const DEFAULT_ROWS = 50;
export const DEFAULT_COLUMNS = 5;
export const ROWS_PER_ADD = 10;
export const MIN_ROWS = 1;
export const MIN_COLUMNS = 1;
export const MAX_DIGITS = 7;

export const defaultColumnName = (col) => `Người ${col + 1}`;

/* ---------- Một ván (hàng) ---------- */

export const emptyRow = (columns) => ({ cells: Array(columns).fill(null), auto: null });

export const isRowEmpty = (row) => row.cells.every((v) => v === null);
export const isRowComplete = (row) => row.cells.every((v) => v !== null);
export const rowSum = (row) => row.cells.reduce((s, v) => s + (v ?? 0), 0);

/** Ván đã nhập đủ nhưng tổng khác 0, thường do sửa tay ô tự điền. */
export const isRowUnbalanced = (row) => row.cells.length > 1 && isRowComplete(row) && rowSum(row) !== 0;

/**
 * Luật: tổng mỗi ván bằng 0. Khi chỉ còn một ô trống, ô đó được tự điền (row.auto)
 * và luôn bằng số đối của tổng các ô còn lại.
 */
export function rowWithCell(row, col, value) {
  if (row.cells[col] === value) return row;
  const cells = row.cells.slice();
  cells[col] = value;

  // Sửa tay chính ô tự điền: giữ giá trị người dùng nhập, ô trở thành ô thường.
  if (col === row.auto) return { cells, auto: null };

  if (row.auto !== null) {
    const others = cells.map((_, i) => i).filter((i) => i !== row.auto);
    if (others.every((i) => cells[i] === null)) {
      // Không còn ô nào để bù thì bỏ luôn ô tự điền.
      cells[row.auto] = null;
      return { cells, auto: null };
    }
    cells[row.auto] = -others.reduce((s, i) => s + (cells[i] ?? 0), 0) || 0;
    return { cells, auto: row.auto };
  }

  if (value !== null) {
    const empty = cells.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
    if (empty.length === 1) {
      const target = empty[0];
      cells[target] = -cells.reduce((s, v) => s + (v ?? 0), 0) || 0;
      return { cells, auto: target };
    }
  }
  return { cells, auto: null };
}

/* ---------- Cả bảng ---------- */

export function createTable(rows = DEFAULT_ROWS, columns = DEFAULT_COLUMNS) {
  return {
    columns: Array.from({ length: columns }, (_, i) => defaultColumnName(i)),
    rows: Array.from({ length: rows }, () => emptyRow(columns)),
  };
}

export const columnSums = (table) =>
  table.columns.map((_, c) => table.rows.reduce((s, r) => s + (r.cells[c] ?? 0), 0));

/** Số ván đã nhập (hàng có ít nhất một ô). */
export const playedRowCount = (table) => table.rows.filter((r) => !isRowEmpty(r)).length;

export function setCell(table, row, col, value) {
  const updated = rowWithCell(table.rows[row], col, value);
  if (updated === table.rows[row]) return table;
  const rows = table.rows.slice();
  rows[row] = updated;
  return { ...table, rows };
}

export function renameColumn(table, col, name) {
  const newName = name.trim() || defaultColumnName(col);
  if (table.columns[col] === newName) return table;
  const columns = table.columns.slice();
  columns[col] = newName;
  return { ...table, columns };
}

export const addRows = (table, count = ROWS_PER_ADD) => ({
  ...table,
  rows: [...table.rows, ...Array.from({ length: count }, () => emptyRow(table.columns.length))],
});

export const removeLastRow = (table) =>
  table.rows.length <= MIN_ROWS ? table : { ...table, rows: table.rows.slice(0, -1) };

/** Cột mới toàn ô trống (tính là 0) nên không làm lệch các ô tự điền đang có. */
export const addColumn = (table) => ({
  columns: [...table.columns, defaultColumnName(table.columns.length)],
  rows: table.rows.map((r) => ({ ...r, cells: [...r.cells, null] })),
});

/**
 * Xóa cột cuối. Giá trị các ván cũ được giữ nguyên (không tự tính lại điểm của người khác),
 * nên ván nào mất cân bằng sẽ được cảnh báo.
 */
export function removeLastColumn(table) {
  if (table.columns.length <= MIN_COLUMNS) return table;
  return {
    columns: table.columns.slice(0, -1),
    rows: table.rows.map((r) => ({ cells: r.cells.slice(0, -1), auto: null })),
  };
}

/** Bỏ các hàng trống ở cuối, để bảng lưu vào lịch sử gọn gàng. */
export function withoutTrailingEmptyRows(table) {
  let end = table.rows.length;
  while (end > 0 && isRowEmpty(table.rows[end - 1])) end--;
  return { ...table, rows: end > 0 ? table.rows.slice(0, end) : table.rows.slice(0, MIN_ROWS) };
}

/** Bảng mới để chơi lại nhưng giữ nguyên người chơi. */
export const clearScores = (table) => ({
  columns: table.columns.slice(),
  rows: createTable(DEFAULT_ROWS, table.columns.length).rows,
});

/* ---------- Chuỗi nhập vào ô ---------- */

/** Chỉ chữ số và một dấu trừ ở đầu, tối đa MAX_DIGITS chữ số. */
export function sanitizeInput(text) {
  let out = '';
  let digits = 0;
  for (const ch of text) {
    if (ch === '-' && out === '') out = '-';
    else if (ch >= '0' && ch <= '9' && digits < MAX_DIGITS) {
      out += ch;
      digits++;
    }
  }
  return out;
}

/** "" và "-" (đang nhập dở) đều là ô trống. */
export function parseInput(text) {
  const clean = sanitizeInput(text);
  if (clean === '' || clean === '-') return null;
  return Number.parseInt(clean, 10) || 0;
}

export const formatValue = (value) => (value === null ? '' : String(value));

/** Hiển thị điểm có dấu: +5, -3, 0. */
export const formatSigned = (value) => (value > 0 ? `+${value}` : String(value));
