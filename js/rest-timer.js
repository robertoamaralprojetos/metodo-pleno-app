// Cronômetro regressivo de descanso — usado no checklist da aba "Registro de Treino".
// O estado vive fora do DOM (num Map em memória) para sobreviver a re-renders da tela
// (o app re-renderiza a tela inteira a cada ação, o que destruiria um <div> de timer comum).

const timers = new Map(); // itemId -> { remaining, total, running, intervalId, finished }

function getTimer(itemId, defaultSeconds) {
  let t = timers.get(itemId);
  if (!t) {
    t = { remaining: defaultSeconds, total: defaultSeconds, running: false, intervalId: null, finished: false };
    timers.set(itemId, t);
  }
  return t;
}

function updateDisplay(itemId) {
  const t = timers.get(itemId);
  if (!t) return;
  const displayEl = document.getElementById('mp-timer-display-' + itemId);
  const cardEl = document.querySelector(`.mp-timer[data-item-id="${itemId}"]`);
  const startBtn = document.querySelector(`[data-timer-start="${itemId}"]`);
  if (displayEl) displayEl.textContent = Utils.formatMMSS(t.remaining);
  if (cardEl) cardEl.classList.toggle('mp-timer--done', t.finished);
  if (startBtn) startBtn.textContent = t.running ? '⏸ Pausar' : (t.finished ? '↺ Iniciar de novo' : '▶ Iniciar descanso');
}

function tick(itemId) {
  const t = timers.get(itemId);
  if (!t) return;
  t.remaining -= 1;
  if (t.remaining <= 0) {
    t.remaining = 0;
    clearInterval(t.intervalId);
    t.intervalId = null;
    t.running = false;
    t.finished = true;
    Utils.playBeep();
  }
  updateDisplay(itemId);
}

function start(itemId, defaultSeconds) {
  const t = getTimer(itemId, defaultSeconds);
  if (t.running) return;
  if (t.remaining <= 0) { t.remaining = t.total; t.finished = false; }
  t.running = true;
  t.finished = false;
  t.intervalId = setInterval(() => tick(itemId), 1000);
  updateDisplay(itemId);
}

function pause(itemId) {
  const t = timers.get(itemId);
  if (!t || !t.running) return;
  clearInterval(t.intervalId);
  t.intervalId = null;
  t.running = false;
  updateDisplay(itemId);
}

function toggle(itemId, defaultSeconds) {
  const t = getTimer(itemId, defaultSeconds);
  if (t.running) pause(itemId);
  else start(itemId, defaultSeconds);
}

function reset(itemId, defaultSeconds) {
  const t = getTimer(itemId, defaultSeconds);
  if (t.intervalId) clearInterval(t.intervalId);
  t.remaining = defaultSeconds;
  t.total = defaultSeconds;
  t.running = false;
  t.finished = false;
  t.intervalId = null;
  updateDisplay(itemId);
}

function discard(itemId) {
  const t = timers.get(itemId);
  if (t && t.intervalId) clearInterval(t.intervalId);
  timers.delete(itemId);
}

// Chamado depois de cada re-render para sincronizar o mostrador com o estado real
// (evita "piscar" de volta ao valor padrão enquanto um timer já está em andamento).
function rehydrate(itemId, defaultSeconds) {
  if (!timers.has(itemId)) return;
  getTimer(itemId, defaultSeconds);
  updateDisplay(itemId);
}

window.RestTimer = { getTimer, start, pause, toggle, reset, discard, rehydrate };
