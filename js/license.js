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

async function licEvaluate() {
  const s = AppState.settings || {};
  const info = s.licenseKey ? await licVerifyKey(s.licenseKey) : null;
  License.info = info;
  if (!s.licenseKey) { License.status = 'none'; License.daysLeft = null; }
  else if (!info) { License.status = 'invalid'; License.daysLeft = null; }
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
}

function licAllowsUse() { return ['valid', 'warning', 'grace'].includes(License.status); }
function licLockedName() { return licAllowsUse() || License.status === 'expired' ? (License.info?.name || '') : ''; }
function licLockedCref() { return licAllowsUse() || License.status === 'expired' ? (License.info?.cref || '') : ''; }

async function licActivate(key) {
  const info = await licVerifyKey(key);
  if (!info) return { ok: false, msg: 'Chave inválida. Confira se copiou a chave completa, começando por MP1-.' };
  const patch = { licenseKey: String(key).replace(/\s+/g, ''), headerProfessionalName: info.name };
  if (info.cref) patch.profCref = info.cref;
  await saveSettingsPatch(patch);
  await licEvaluate();
  if (License.status === 'expired') return { ok: false, msg: `Esta chave venceu em ${Utils.formatDateBR(info.expires)}. Solicite a renovação.` };
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
  const title = st === 'expired' ? 'Licença vencida' : st === 'invalid' ? 'Chave de licença inválida' : 'Ativar o Método Pleno';
  const msg = st === 'expired'
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
(window.MP_BUILD = window.MP_BUILD || {})['license.js'] = 'v1.18.1';
