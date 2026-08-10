// Bloqueio por PIN — protege a abertura do app com um PIN numérico (4 a 6 dígitos), opcional
// (Configurações). Nunca sai do aparelho: o PIN em si nunca é salvo, apenas um hash SHA-256
// (com salt aleatório) via Web Crypto API do navegador, que funciona 100% offline.
// Se o usuário esquecer o PIN, não há como recuperar o acesso pelo app — só apagando os
// dados deste site pelo navegador e restaurando o último Backup (JSON). Isso é avisado tanto
// na tela de definir o PIN (Configurações) quanto na tela de bloqueio.

const PIN_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutos em segundo plano => pede o PIN de novo

function pinGenerateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pinHash(pin, saltHex) {
  const enc = new TextEncoder();
  const data = enc.encode(`${saltHex}:${pin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pinVerify(pin, settings) {
  if (!settings?.pinHash || !settings?.pinSalt) return true;
  const hash = await pinHash(pin, settings.pinSalt);
  return hash === settings.pinHash;
}

function pinIsValidFormat(pin) {
  return /^\d{4,6}$/.test(pin);
}

function pinLockRenderHtml() {
  return `
  <div class="mp-pin-lock">
    <div class="mp-pin-lock-card">
      <img src="assets/imagens/logo_metodo_pleno_transparente.png" alt="Método Pleno" class="mp-pin-lock-logo">
      <h2>Acesso protegido</h2>
      <p class="mp-sub" style="margin-bottom:0;">Digite o PIN para abrir o Método Pleno.</p>
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" id="mp-pin-input" class="mp-pin-input" placeholder="••••">
      <div id="mp-pin-error" class="mp-pin-error"></div>
      <button type="button" id="mp-pin-submit" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;width:100%;">Desbloquear</button>
      <p class="mp-pin-forgot">Esqueceu o PIN? Não há como recuperar o acesso pelo app — é preciso apagar os dados deste site pelo navegador (isso apaga TUDO, inclusive os alunos) e restaurar pelo último Backup (JSON).</p>
    </div>
  </div>`;
}

function pinLockBindEvents(root) {
  const input = root.querySelector('#mp-pin-input');
  const errorEl = root.querySelector('#mp-pin-error');
  const submitBtn = root.querySelector('#mp-pin-submit');
  if (input) setTimeout(() => input.focus(), 50);

  async function attemptUnlock() {
    const pin = (input.value || '').trim();
    if (!pin) return;
    const ok = await pinVerify(pin, AppState.settings);
    if (ok) {
      AppState.pinUnlocked = true;
      render();
    } else {
      errorEl.textContent = 'PIN incorreto. Tente novamente.';
      input.value = '';
      input.focus();
    }
  }

  submitBtn?.addEventListener('click', attemptUnlock);
  input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
}

// Re-bloqueia automaticamente se o app voltar de segundo plano depois de mais de
// PIN_AUTO_LOCK_MS — cobre troca de app, tela bloqueada, etc. Registrado uma única vez;
// AppState/render só precisam existir quando o evento realmente disparar (depois do load).
let mpPinHiddenAt = null;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    mpPinHiddenAt = Date.now();
    return;
  }
  if (mpPinHiddenAt && window.AppState?.settings?.pinHash) {
    const elapsed = Date.now() - mpPinHiddenAt;
    if (elapsed > PIN_AUTO_LOCK_MS) {
      AppState.pinUnlocked = false;
      if (typeof render === 'function') render();
    }
  }
  mpPinHiddenAt = null;
});

window.PinLock = {
  generateSalt: pinGenerateSalt,
  hashPin: pinHash,
  verifyPin: pinVerify,
  isValidFormat: pinIsValidFormat,
  renderLockScreen: pinLockRenderHtml,
  bindLockEvents: pinLockBindEvents,
};
