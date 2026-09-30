// Hộp thoại và thông báo nhỏ (toast) tự vẽ, đẹp hơn confirm()/prompt() của trình duyệt.

export function h(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

let openDialogs = 0;
export const isDialogOpen = () => openDialogs > 0;

/**
 * buttons: [{ label, value, kind: 'primary' | 'danger' | 'ghost' }]
 * Trả về value của nút được bấm, null nếu đóng (bấm ra ngoài / Esc).
 */
function openDialog({ title, message, buttons, input }) {
  return new Promise((resolve) => {
    const backdrop = h('div', 'modal-backdrop');
    const card = h('div', 'modal');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.append(h('h2', 'modal-title', title));
    if (message) card.append(h('p', 'modal-message', message));

    let field = null;
    if (input) {
      field = h('input', 'modal-input');
      field.type = 'text';
      field.value = input.value ?? '';
      field.placeholder = input.placeholder ?? '';
      field.maxLength = 40;
      field.enterKeyHint = 'done';
      field.autocomplete = 'off';
      card.append(field);
    }

    const actions = h('div', `modal-actions${buttons.length > 2 ? ' stacked' : ''}`);
    for (const b of buttons) {
      const btn = h('button', `btn btn-${b.kind ?? 'ghost'}`, b.label);
      btn.type = 'button';
      btn.addEventListener('click', () => close(field && b.value === true ? field.value : b.value));
      actions.append(btn);
    }
    card.append(actions);
    backdrop.append(card);

    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      openDialogs--;
      document.removeEventListener('keydown', onKey, true);
      field?.blur();
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 220);
      resolve(value ?? null);
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(null);
      } else if (e.key === 'Enter' && field) {
        e.preventDefault();
        close(field.value);
      }
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(null);
    });
    document.addEventListener('keydown', onKey, true);
    openDialogs++;
    document.body.append(backdrop);
    // Phải focus ngay trong lượt bấm của người dùng thì iOS mới mở bàn phím.
    if (field) {
      field.focus();
      field.select();
    }
    requestAnimationFrame(() => backdrop.classList.add('show'));
  });
}

export async function confirmDialog({ title = 'Xác nhận xóa', message, confirmLabel = 'Xóa', danger = true }) {
  const result = await openDialog({
    title,
    message,
    buttons: [
      { label: 'Hủy', value: false, kind: 'ghost' },
      { label: confirmLabel, value: true, kind: danger ? 'danger' : 'primary' },
    ],
  });
  return result === true;
}

export const choiceDialog = ({ title, message, buttons }) => openDialog({ title, message, buttons });

/** Trả về chuỗi đã nhập, null nếu hủy. */
export const promptDialog = ({ title, value, placeholder, confirmLabel = 'Lưu' }) =>
  openDialog({
    title,
    input: { value, placeholder },
    buttons: [
      { label: 'Hủy', value: null, kind: 'ghost' },
      { label: confirmLabel, value: true, kind: 'primary' },
    ],
  });

let toastTimer = 0;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', 'toast');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Ngày giờ ---------- */

const pad = (n) => String(n).padStart(2, '0');
const weekday = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' });

export function formatDate(ms) {
  const d = new Date(ms);
  const day = weekday.format(d);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatTime(ms) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
