// Tạo file .xlsx không cần thư viện ngoài (chạy được offline).
// File .xlsx là một file zip chứa vài file XML; ở đây zip dạng "store" (không nén) cho đơn giản.

import { columnSums } from './model.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_NAME = 'Table Data';

/* ---------- Zip ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

/** files: [{ name, data: string }] → Uint8Array của file zip. */
function zip(files) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // tên file UTF-8
    local.setUint16(8, 0, true); // store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    locals.push(new Uint8Array(local.buffer), name, data);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true); // version made by
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    // extra, comment, disk, internal attr, external attr = 0
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, b) => s + b.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/* ---------- Bảng tính ---------- */

const escapeXml = (s) =>
  String(s)
    // Bỏ ký tự điều khiển không hợp lệ trong XML.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function columnLetter(index) {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** rows: mảng các hàng, mỗi ô là { v: string|number|null, bold?: boolean }. */
function buildWorkbook(rows) {
  const strings = [];
  const stringIndex = new Map();
  const sharedString = (s) => {
    if (!stringIndex.has(s)) {
      stringIndex.set(s, strings.length);
      strings.push(s);
    }
    return stringIndex.get(s);
  };

  const sheetRows = rows
    .map((cells, r) => {
      const xml = cells
        .map((cell, c) => {
          if (cell.v === null || cell.v === undefined) return '';
          const ref = `${columnLetter(c)}${r + 1}`;
          const style = cell.bold ? ' s="1"' : '';
          if (typeof cell.v === 'number') return `<c r="${ref}"${style}><v>${cell.v}</v></c>`;
          return `<c r="${ref}"${style} t="s"><v>${sharedString(cell.v)}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join('');

  return [
    {
      name: '[Content_Types].xml',
      data: `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
        + '</Types>',
    },
    {
      name: '_rels/.rels',
      data: `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">`
        + `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>`
        + '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      data: `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">`
        + `<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">`
        + `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>`
        + `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>`
        + `<Relationship Id="rId3" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>`
        + '</Relationships>',
    },
    {
      name: 'xl/styles.xml',
      data: `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}">`
        + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
        + '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
        + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
        + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
        + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        + '</styleSheet>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: `${XML_HEAD}<worksheet xmlns="${NS_MAIN}"><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
    {
      name: 'xl/sharedStrings.xml',
      data: `${XML_HEAD}<sst xmlns="${NS_MAIN}" count="${strings.length}" uniqueCount="${strings.length}">`
        + strings.map((s) => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join('')
        + '</sst>',
    },
  ];
}

/* ---------- Xuất bảng điểm ---------- */

const pad = (n) => String(n).padStart(2, '0');

function fileName(date = new Date()) {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `score_tracker_${d}_${t}.xlsx`;
}

/** Giống bản Android: STT + tên cột, hàng Tổng (in đậm) ngay dưới, rồi các ván. */
export function tableToXlsx(table) {
  const rows = [
    [{ v: 'STT' }, ...table.columns.map((name) => ({ v: name }))],
    [{ v: 'Tổng', bold: true }, ...columnSums(table).map((sum) => ({ v: sum, bold: true }))],
    ...table.rows.map((row, r) => [{ v: r + 1 }, ...row.cells.map((v) => ({ v }))]),
  ];
  const bytes = zip(buildWorkbook(rows));
  return new File([bytes], fileName(), { type: XLSX_MIME });
}

/**
 * Mở menu chia sẻ của máy (iOS/Android) nếu có, không thì tải file về.
 * Trả về 'shared' | 'downloaded' | 'cancelled'.
 */
export async function shareXlsx(table) {
  const file = tableToXlsx(table);
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      // Chia sẻ lỗi (VD: trình duyệt chặn) thì tải về.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
