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

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addYearsISO(iso, years) {
  const d = new Date(iso + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntil(iso) {
  const target = new Date(iso + 'T00:00:00');
  const today = new Date(todayISO() + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

function formatBRL(value) {
  const n = Number(value) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatRestLabel(restSeconds) {
  if (!restSeconds) return '—';
  return formatMMSS(restSeconds).replace(/^0/, '');
}

let sharedAudioCtx = null;
function playBeep() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    [0, 0.3, 0.6].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.26);
    });
  } catch (e) {
    console.warn('Não foi possível tocar o alerta sonoro:', e);
  }
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
  addDaysISO,
  addYearsISO,
  daysUntil,
  formatBRL,
  formatMMSS,
  formatRestLabel,
  playBeep,
};
