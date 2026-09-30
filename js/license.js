// Licença de uso — Método Pleno (v1.18.0)
//
// Cada profissional recebe uma CHAVE gerada pelo autor do app (ferramenta "Gerador de
// Licenças", que fica só com o autor). A chave traz nome, CREF e validade, assinados com
// criptografia (ECDSA P-256). O app confere a assinatura com a chave PÚBLICA abaixo — sem
// servidor, 100% offline. Sem a chave privada, não é possível criar nem alterar uma chave.
//
// • Nome e CREF do perfil ficam travados conforme a licença (aparecem no app e em todos os
//   documentos), o que desestimula repassar a chave para outra pessoa.
// • Licença vencida: 7 dias de tolerância com aviso; depois o app bloqueia, mas SEMPRE
//   permite exportar o backup — os dados nunca ficam presos.

const LICENSE_PUBLIC_KEY = { kty: 'EC', crv: 'P-256', x: 'Gvgw5mSMOQ5Lza-9XXZ4OCigr686d4dpIsD_cKHkKtQ', y: 'P27xOEduzR53bkyev321_4Yy4JeSd5bPXRA0VA3hlQs' };
const LICENSE_PREFIX = 'MP1-';
const LICENSE_GRACE_DAYS = 7;
const LICENSE_WARN_DAYS = 15;
// Contato exibido na tela de licença (para comprar/renovar).
const LICENSE_SELLER = { name: 'Professor Roberto Amaral', whatsapp: '(22) 98169-0277' };

const License = {
  ready: false,
  info: null,     // { name, cref, expires, issued, id } quando a chave é válida
  status: 'none', // none | invalid | valid | warning | grace | expired
  daysLeft: null,
};

function licB64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function licVerifyKey(key) {
  try {
    const clean = String(key || '').replace(/\s+/g, '');
    if (!clean.startsWith(LICENSE_PREFIX)) return null;
    const [payloadPart, sigPart] = clean.slice(LICENSE_PREFIX.length).split('.');
    if (!payloadPart || !sigPart) return null;
    const payloadBytes = licB64urlToBytes(payloadPart);
    const pub = await crypto.subtle.importKey('jwk', LICENSE_PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, licB64urlToBytes(sigPart), payloadBytes);
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!p || p.v !== 1 || !p.n || !p.e) return null;
    return { name: p.n, cref: p.c || '', expires: p.e, issued: p.i || null, id: p.id || '' };
  } catch (e) {
    return null;
  }
}

// "Hoje" para fins de licença: nunca volta no tempo (evita burlar atrasando o relógio).
function licToday() {
  const today = Utils.todayISO();
  const last = AppState.settings?.licenseLastSeen || '';
  return last > today ? last : today;
}

// Cópia de segurança da chave neste navegador (v1.19.0). Se a chave sumir das Configurações
// (ex.: sobrescrita por uma janela antiga do app), ela é recuperada sem pedir de novo.
const LICENSE_LS_KEY = 'mp-license-key';
function licBackupRead() { try { return localStorage.getItem(LICENSE_LS_KEY) || ''; } catch (e) { return ''; } }
function licBackupWrite(key) { try { if (key) localStorage.setItem(LICENSE_LS_KEY, key); } catch (e) { /* sem armazenamento: segue */ } }

// Lista de bloqueio (v1.19.0): arquivo licencas-bloqueadas.json na raiz do site, com os
// códigos das licenças suspensas (ex.: cliente mensal que parou de pagar). O app confere a
// lista sempre que há internet (no máximo a cada 6 h, ou ao voltar para o app) e guarda o
// resultado — então o bloqueio continua valendo mesmo offline. Tirar o código da lista
// libera a licença de novo na próxima conferência.
const LICENSE_BLOCKLIST_URL = 'licencas-bloqueadas.json';
const LICENSE_BLOCKLIST_EVERY_MS = 6 * 60 * 60 * 1000;
function licBlockedIds() {
  const ids = AppState.settings?.licenseBlocklist?.ids;
  return Array.isArray(ids) ? ids.map((x) => String(x).trim().toUpperCase()) : [];
}
function licIsBlocked(info) { return !!(info && info.id && licBlockedIds().includes(String(info.id).toUpperCase())); }

let licRemoteBusy = false;
async function licRefreshBlocklist(force) {
  if (licRemoteBusy || !navigator.onLine) return;
  const last = AppState.settings?.licenseBlocklist?.at || 0;
  // Licença suspensa: confere sempre (para liberar logo após o pagamento).
  if (!force && License.status !== 'blocked' && Date.now() - last < LICENSE_BLOCKLIST_EVERY_MS) return;
  licRemoteBusy = true;
  try {
    const res = await fetch(`${LICENSE_BLOCKLIST_URL}?t=${Date.now()}`, { cache: 'no-store' });
    let ids = [];
    if (res.ok) {
      const data = await res.json();
      ids = Array.isArray(data) ? data : (data.bloqueadas || []);
    } else if (res.status !== 404) {
      return; // erro temporário: mantém o que já sabia
    }
    const before = License.status;
    await saveSettingsPatch({ licenseBlocklist: { at: Date.now(), ids: ids.map((x) => String(x).trim().toUpperCase()).filter(Boolean) } });
    await licEvaluate(true);
    if (License.status !== before && typeof render === 'function') render();
  } catch (e) {
    /* sem conexão ou arquivo inválido: tenta de novo depois */
  } finally {
    licRemoteBusy = false;
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && License.ready) licRefreshBlocklist(false); });
window.addEventListener('online', () => { if (License.ready) licRefreshBlocklist(false); });

async function licEvaluate(skipRemote) {
  let s = AppState.settings || {};
  // Escolhe, entre a chave salva e a cópia de segurança, a válida com validade mais longa.
  const candidates = Array.from(new Set([s.licenseKey, licBackupRead()].filter(Boolean)));
  let best = null;
  for (const k of candidates) {
    const inf = await licVerifyKey(k);
    if (!inf) continue;
    const blocked = licIsBlocked(inf);
    // Preferência: não bloqueada > bloqueada; depois, a de validade mais longa.
    if (!best || (best.blocked && !blocked) || (best.blocked === blocked && inf.expires > best.info.expires)) best = { key: k, info: inf, blocked };
  }
  if (best && best.key !== s.licenseKey) {
    try { await saveSettingsPatch({ licenseKey: best.key }); } catch (e) { AppState.settings = { ...s, licenseKey: best.key }; }
    s = AppState.settings;
  }
  if (best) licBackupWrite(best.key);
  const info = best ? best.info : (s.licenseKey ? await licVerifyKey(s.licenseKey) : null);
  License.info = info;
  if (!s.licenseKey) { License.status = 'none'; License.daysLeft = null; }
  else if (!info) { License.status = 'invalid'; License.daysLeft = null; }
  else if (licIsBlocked(info)) { License.status = 'blocked'; License.daysLeft = null; }
  else {
    const today = licToday();
    const days = Utils.daysUntil(info.expires) + (today === Utils.todayISO() ? 0 : -((new Date(today) - new Date(Utils.todayISO())) / 86400000));
    License.daysLeft = Math.round(days);
    if (License.daysLeft >= 0) License.status = License.daysLeft <= LICENSE_WARN_DAYS ? 'warning' : 'valid';
    else if (License.daysLeft >= -LICENSE_GRACE_DAYS) License.status = 'grace';
    else License.status = 'expired';
  }
  // Guarda o maior "hoje" já visto.
  const today = Utils.todayISO();
  if (!s.licenseLastSeen || s.licenseLastSeen < today) {
    try { await saveSettingsPatch({ licenseLastSeen: today }); } catch (e) { /* não bloqueia */ }
  }
  License.ready = true;
  if (!skipRemote && License.info) licRefreshBlocklist(false);
}

function licAllowsUse() { return ['valid', 'warning', 'grace'].includes(License.status); }
function licLockedName() { return licAllowsUse() || ['expired', 'blocked'].includes(License.status) ? (License.info?.name || '') : ''; }
function licLockedCref() { return licAllowsUse() || ['expired', 'blocked'].includes(License.status) ? (License.info?.cref || '') : ''; }

async function licActivate(key) {
  const info = await licVerifyKey(key);
  if (!info) return { ok: false, msg: 'Chave inválida. Confira se copiou a chave completa, começando por MP1-.' };
  const patch = { licenseKey: String(key).replace(/\s+/g, ''), headerProfessionalName: info.name };
  if (info.cref) patch.profCref = info.cref;
  await saveSettingsPatch(patch);
  licBackupWrite(patch.licenseKey);
  await licEvaluate();
  if (License.status === 'expired') return { ok: false, msg: `Esta chave venceu em ${Utils.formatDateBR(info.expires)}. Solicite a renovação.` };
  if (License.status === 'blocked') return { ok: false, msg: 'Esta licença está suspensa. Fale com o fornecedor do app para regularizar.' };
  return { ok: true, info };
}

function licValidityText(info) {
  if (!info) return '';
  return info.expires >= '2099-01-01' ? 'sem data de vencimento' : `válida até ${Utils.formatDateBR(info.expires)}`;
}

function licSellerHtml() {
  const esc = Utils.escapeHtml;
  const phone = (LICENSE_SELLER.whatsapp || '').replace(/\D/g, '');
  return `Para adquirir ou renovar a licença, fale com <strong>${esc(LICENSE_SELLER.name)}</strong>${phone ? ` pelo WhatsApp <a href="https://wa.me/${phone.length <= 11 ? '55' + phone : phone}" target="_blank" rel="noopener">${esc(LICENSE_SELLER.whatsapp)}</a>` : ''}.`;
}

// Tela cheia: sem licença, chave inválida ou licença vencida (após a tolerância).
function licScreenHtml() {
  const esc = Utils.escapeHtml;
  const st = License.status;
  const title = st === 'expired' ? 'Licença vencida' : st === 'blocked' ? 'Licença suspensa' : st === 'invalid' ? 'Chave de licença inválida' : 'Ativar o Método Pleno';
  const msg = st === 'blocked'
    ? `A licença de <strong>${esc(License.info.name)}</strong> está suspensa (código ${esc(License.info.id)}). Seus dados continuam salvos neste aparelho — regularize a assinatura para voltar a usar o app, ou insira uma nova chave.`
    : st === 'expired'
    ? `A licença de <strong>${esc(License.info.name)}</strong> venceu em ${Utils.formatDateBR(License.info.expires)}. Seus dados continuam salvos neste aparelho — insira a chave renovada para voltar a usar o app.`
    : st === 'invalid'
      ? 'A chave salva neste aparelho não é válida. Insira uma chave de licença válida.'
      : 'Para usar o app, insira a chave de licença que você recebeu.';
  return `
  <div class="mp-onb">
    <div class="mp-onb-card">
      <div class="mp-onb-top"><img src="${esc(Profile.logoSrc())}" alt="" class="mp-onb-logo"></div>
      <h2>${title}</h2>
      <p class="mp-sub">${msg}</p>
      <div class="mp-field"><label>Chave de licença</label>
        <textarea id="lic-key" rows="4" placeholder="MP1-..." style="font-family:monospace;font-size:12.5px;word-break:break-all;"></textarea>
      </div>
      <div id="lic-error" class="mp-pin-error" style="text-align:left;"></div>
      <div class="mp-onb-actions">
        ${AppState.students.length ? '<button type="button" class="mp-btn mp-btn-ghost" id="lic-backup">💾 Exportar backup dos dados</button>' : '<span></span>'}
        <button type="button" class="mp-btn mp-btn-gold" id="lic-activate" style="background:var(--verde-principal);color:#fff;">Ativar licença</button>
      </div>
      <div class="mp-onb-note" style="margin:18px 0 0;">${licSellerHtml()}</div>
    </div>
  </div>`;
}

function licScreenBind(root) {
  root.querySelector('#lic-backup')?.addEventListener('click', () => BackupModule.exportBackup());
  root.querySelector('#lic-activate')?.addEventListener('click', async () => {
    const res = await licActivate(root.querySelector('#lic-key').value);
    if (!res.ok) { root.querySelector('#lic-error').textContent = res.msg; return; }
    Utils.toast(`Licença ativada ✓ — ${res.info.name}`, 'success');
    render();
  });
}

// Faixa de aviso no topo (vencendo / em tolerância).
function licBannerHtml() {
  if (License.status === 'warning') {
    return `<div class="mp-warning-banner mp-warning-soft">🔑 Sua licença vence em ${License.daysLeft === 0 ? 'hoje' : `${License.daysLeft} dia(s)`} (${Utils.formatDateBR(License.info.expires)}). Solicite a renovação e insira a nova chave em ⚙️ Configurações → Licença.</div>`;
  }
  if (License.status === 'grace') {
    const left = LICENSE_GRACE_DAYS + License.daysLeft;
    return `<div class="mp-warning-banner">🔑 Licença vencida em ${Utils.formatDateBR(License.info.expires)}. O app será bloqueado em ${left} dia(s) — insira a chave renovada em ⚙️ Configurações → Licença.</div>`;
  }
  return '';
}

// Card em Configurações.
function licSettingsCardHtml() {
  const esc = Utils.escapeHtml;
  const i = License.info;
  const pill = {
    valid: '<span class="mp-pill mp-pill-leve">Licença ativa ✓</span>',
    warning: '<span class="mp-pill mp-pill-moderado">Vencendo</span>',
    grace: '<span class="mp-pill mp-pill-alto">Vencida — em tolerância</span>',
  }[License.status] || '';
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>🔑 Licença</h3>
    ${i ? `
    <div style="margin:10px 0 12px;">${pill}</div>
    <div class="mp-sub" style="margin:0 0 4px;color:var(--texto);">Licenciado para: <strong>${esc(i.name)}</strong>${i.cref ? ` · CREF ${esc(i.cref)}` : ''}</div>
    <div class="mp-sub" style="margin:0 0 12px;">Licença ${esc(licValidityText(i))}${i.id ? ` · código ${esc(i.id)}` : ''}. O nome${i.cref ? ' e o CREF' : ''} do perfil seguem a licença.</div>` : ''}
    <div class="mp-field"><label>Inserir nova chave (renovação)</label>
      <textarea id="cfg-lic-key" rows="3" placeholder="MP1-..." style="font-family:monospace;font-size:12.5px;word-break:break-all;"></textarea>
    </div>
    <div class="mp-form-actions"><button type="button" id="cfg-lic-save" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Ativar chave</button></div>
    <div class="mp-sub" style="margin:12px 0 0;">${licSellerHtml()}</div>
  </div>`;
}

function licSettingsBind(container) {
  container.querySelector('#cfg-lic-save')?.addEventListener('click', async () => {
    const key = container.querySelector('#cfg-lic-key').value;
    if (!key.trim()) { Utils.toast('Cole a chave de licença.', 'error'); return; }
    const res = await licActivate(key);
    if (!res.ok) { Utils.toast(res.msg, 'error'); return; }
    Utils.toast(`Licença ativada ✓ — ${licValidityText(res.info)}`, 'success');
    render();
  });
}

Object.assign(License, {
  evaluate: licEvaluate,
  verifyKey: licVerifyKey,
  allowsUse: licAllowsUse,
  lockedName: licLockedName,
  lockedCref: licLockedCref,
  screenHtml: licScreenHtml,
  screenBind: licScreenBind,
  bannerHtml: licBannerHtml,
  settingsCardHtml: licSettingsCardHtml,
  settingsBind: licSettingsBind,
});
window.License = License;

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['license.js'] = 'v1.19.0';
