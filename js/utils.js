// Helpers compartilhados

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function calcAgeFromBirthDate(birthDateISO, onDateISO) {
  if (!birthDateISO) return null;
  const birth = new Date(birthDateISO + 'T00:00:00');
  const on = new Date((onDateISO || todayISO()) + 'T00:00:00');
  let age = on.getFullYear() - birth.getFullYear();
  const m = on.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < birth.getDate())) age--;
  return age;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function toast(message, type = 'info') {
  const node = el(`<div class="mp-toast ${type === 'error' ? 'mp-toast-error' : 'mp-toast-ok'}">${escapeHtml(message)}</div>`);
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('mp-toast-show'));
  setTimeout(() => {
    node.classList.remove('mp-toast-show');
    setTimeout(() => node.remove(), 300);
  }, 2600);
}

function confirmDialog(message) {
  return new Promise((resolve) => {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <p class="modal__message">${escapeHtml(message)}</p>
          <div class="modal__actions">
            <button class="mp-btn mp-btn-ghost" data-action="cancel" type="button">Cancelar</button>
            <button class="mp-btn mp-btn-danger" style="padding:10px 16px;font-size:13.5px;" data-action="confirm" type="button">Confirmar</button>
          </div>
        </div>
      </div>
    `);
    overlay.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      if (action === 'confirm') { overlay.remove(); resolve(true); }
      if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(false); }
    });
    document.body.appendChild(overlay);
  });
}

window.Utils = {
  todayISO,
  formatDateBR,
  calcAgeFromBirthDate,
  escapeHtml,
  debounce,
  el,
  toast,
  confirmDialog,
};
