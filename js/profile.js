// Perfil do Profissional + Assistente de primeiro acesso — Método Pleno (v1.16.0)
// Permite que cada profissional que usa o app tenha o próprio nome, CREF, contatos, logo e
// cor principal — no cabeçalho, na tela de PIN e nos relatórios/documentos impressos.
// Tudo fica no registro único de Configurações (appSettings 'global'), então entra
// automaticamente no Backup (JSON). Nada sai do aparelho.

const DEFAULT_LOGO_SRC = 'assets/imagens/logo_metodo_pleno_transparente.png';
const DEFAULT_THEME_COLOR = '#1F3D30';

// Azul metálico: além dos tons derivados, ganha um degradê com brilho (classe mp-theme-metal).
const METAL_BLUE = '#1E3A5A';
const THEME_PRESETS = [
  { name: 'Verde Método Pleno', color: '#1F3D30' },
  { name: 'Azul metálico', color: METAL_BLUE },
  { name: 'Azul petróleo', color: '#1D3B4F' },
  { name: 'Azul marinho', color: '#1E2F5C' },
  { name: 'Grafite', color: '#2E3338' },
  { name: 'Vinho', color: '#5A1F2E' },
  { name: 'Terracota', color: '#7A3B22' },
  { name: 'Roxo', color: '#3E2A5C' },
];

// ---------- Cores ----------
function hexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
}

// Aplica a cor principal do profissional, derivando os tons (profundo, suave, pálido) que o
// app já usa. Cores muito claras são escurecidas: o verde-principal também é cor de texto.
function applyTheme(color) {
  const root = document.documentElement;
  const vars = ['--verde-profundo', '--verde-principal', '--verde-suave', '--verde-pallido'];
  const hsl = hexToHsl(color);
  let principal = DEFAULT_THEME_COLOR;
  if (!hsl || (color || '').toUpperCase() === DEFAULT_THEME_COLOR) {
    vars.forEach((v) => root.style.removeProperty(v)); // padrão original do CSS
  } else {
    const l = Math.min(hsl.l, 32);
    principal = hslToHex(hsl.h, hsl.s, l);
    root.style.setProperty('--verde-principal', principal);
    root.style.setProperty('--verde-profundo', hslToHex(hsl.h, hsl.s * 0.75, l * 0.6));
    root.style.setProperty('--verde-suave', hslToHex(hsl.h, hsl.s * 0.65, Math.min(l + 13, 45)));
    root.style.setProperty('--verde-pallido', hslToHex(hsl.h, Math.min(hsl.s * 0.5, 25), 88));
  }
  root.classList.toggle('mp-theme-metal', (color || '').toUpperCase() === METAL_BLUE);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', principal);
}

// ---------- Dados do perfil ----------
function prof() { return AppState.settings || {}; }
function profName() { return (window.License && License.lockedName()) || (prof().headerProfessionalName || '').trim(); }
function profTitle() { const t = prof().profTitle; return (t == null ? 'Personal Trainer' : t).trim(); }
function profCrefLabel() { const c = ((window.License && License.lockedCref()) || prof().profCref || '').trim(); return c ? `CREF ${c.replace(/^CREF\s*/i, '')}` : ''; }
function profLogoSrc() { return prof().profLogo || DEFAULT_LOGO_SRC; }
function profHasCustomLogo() { return !!prof().profLogo; }

// "Prof. Fulano · CREF 000000-G/RJ"
function profSignatureLine() {
  return [profName(), profCrefLabel()].filter(Boolean).join(' · ');
}

// "WhatsApp (22) 9... · email · @instagram"
function profContactLine() {
  const s = prof();
  const insta = (s.profInstagram || '').trim();
  return [
    s.profPhone ? `WhatsApp ${s.profPhone.trim()}` : '',
    (s.profEmail || '').trim(),
    insta ? (insta.startsWith('@') ? insta : '@' + insta) : '',
  ].filter(Boolean).join(' · ');
}

// Linha de marca: nome do estúdio (se houver) ou a marca do app.
function profBrandLine() {
  const b = (prof().profBusinessName || '').trim();
  return b || 'Método Pleno · Movimento e Longevidade';
}

// Cabeçalho padrão dos documentos impressos / PDF (relatórios, avaliações, plano de aula).
function docHeaderHtml(title, subtitleHtml) {
  const esc = Utils.escapeHtml;
  const sig = profSignatureLine();
  const contact = profContactLine();
  return `
  <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #B8924A;padding-bottom:10px;margin-bottom:16px;">
    <img src="${esc(profLogoSrc())}" alt="" style="height:56px;width:auto;max-width:170px;object-fit:contain;flex-shrink:0;">
    <div style="flex:1;min-width:0;">
      <div style="font-size:10.5px;letter-spacing:.14em;color:#8a6d2b;font-weight:700;text-transform:uppercase;">${esc(profBrandLine())}</div>
      <h2 style="font-family:Georgia,serif;margin:3px 0 4px;">${esc(title)}</h2>
      ${subtitleHtml ? `<div style="color:#555;">${subtitleHtml}</div>` : ''}
      ${sig || contact ? `<div style="color:#777;font-size:12px;margin-top:2px;">${esc([sig, contact].filter(Boolean).join(' · '))}</div>` : ''}
    </div>
  </div>`;
}

// ---------- Logo: lê o arquivo e reduz para no máx. 400 px (mantém transparência) ----------
function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Escolha um arquivo de imagem (PNG ou JPG).')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let data = canvas.toDataURL('image/png');
        if (data.length > 350000) data = canvas.toDataURL('image/jpeg', 0.85); // logo sem transparência muito grande
        resolve(data);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ---------- Campos do perfil (usados em Configurações e no assistente) ----------
// prefix: 'cfg' (Configurações) ou 'onb' (assistente). O estado de logo/cor em edição fica
// em data-atributos do contêiner até o profissional salvar.
function profileFieldsHtml(prefix, s, parts = { data: true, visual: true }) {
  const esc = Utils.escapeHtml;
  const color = (s.themeColor || DEFAULT_THEME_COLOR).toUpperCase();
  const lockName = window.License ? License.lockedName() : '';
  const lockCref = window.License ? License.lockedCref() : '';
  const lockNote = ' <span style="text-transform:none;letter-spacing:0;font-weight:400;">(definido pela licença)</span>';
  const dataHtml = `
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Seu nome (como aparece no app e nos documentos) *${lockName ? lockNote : ''}</label><input type="text" id="${prefix}-prof-name" value="${esc(lockName || s.headerProfessionalName || '')}" placeholder="Ex: Prof. Ana Souza" ${lockName ? 'disabled' : ''}></div>
      <div class="mp-field"><label>CREF${lockCref ? lockNote : ''}</label><input type="text" id="${prefix}-prof-cref" value="${esc(lockCref || s.profCref || '')}" placeholder="Ex: 012345-G/RJ" ${lockCref ? 'disabled' : ''}></div>
    </div>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Profissão (1ª linha do cabeçalho)</label><input type="text" id="${prefix}-prof-title" value="${esc(s.profTitle == null ? 'Personal Trainer' : s.profTitle)}" placeholder="Ex: Personal Trainer"></div>
      <div class="mp-field"><label>Nome do estúdio ou da sua marca (opcional)</label><input type="text" id="${prefix}-prof-business" value="${esc(s.profBusinessName || '')}" placeholder="Em branco: Método Pleno · Movimento e Longevidade"></div>
    </div>
    <div class="mp-form-row mp-row3">
      <div class="mp-field"><label>WhatsApp</label><input type="tel" id="${prefix}-prof-phone" value="${esc(s.profPhone || '')}" placeholder="(22) 99999-9999"></div>
      <div class="mp-field"><label>E-mail</label><input type="email" id="${prefix}-prof-email" value="${esc(s.profEmail || '')}" placeholder="voce@email.com"></div>
      <div class="mp-field"><label>Instagram</label><input type="text" id="${prefix}-prof-insta" value="${esc(s.profInstagram || '')}" placeholder="@seuperfil"></div>
    </div>`;
  const visualHtml = `
    <div class="mp-field">
      <label>Logo (aparece no topo do app, na tela de PIN e nos relatórios)</label>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div style="width:120px;height:72px;border:1px dashed var(--borda);border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--verde-principal);" id="${prefix}-logo-box">
          <img id="${prefix}-logo-preview" src="${esc(s.profLogo || DEFAULT_LOGO_SRC)}" alt="Logo" style="max-width:108px;max-height:60px;object-fit:contain;">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="${prefix}-logo-pick" style="border-color:var(--verde-suave);color:var(--verde-principal);">Escolher imagem</button>
          <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="${prefix}-logo-remove" style="${s.profLogo ? '' : 'display:none;'}">Usar logo padrão</button>
          <input type="file" id="${prefix}-logo-file" accept="image/png,image/jpeg,image/webp" style="display:none;">
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--texto-suave);margin-top:6px;">Dica: PNG com fundo transparente e desenho claro fica melhor sobre o fundo escuro do cabeçalho.</div>
    </div>
    <div class="mp-field">
      <label>Cor principal do app</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;" id="${prefix}-color-swatches">
        ${THEME_PRESETS.map((p) => `<button type="button" title="${esc(p.name)}" data-color="${p.color}" class="${prefix}-swatch" style="width:34px;height:34px;border-radius:50%;background:${p.color};border:3px solid ${p.color.toUpperCase() === color ? '#B8924A' : 'transparent'};box-shadow:0 0 0 1px var(--borda);cursor:pointer;padding:0;"></button>`).join('')}
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--texto-suave);margin:0 0 0 6px;">Outra: <input type="color" id="${prefix}-color-custom" value="${color}" style="width:40px;height:32px;padding:0;border:none;background:none;"></label>
      </div>
      <div style="font-size:11.5px;color:var(--texto-suave);margin-top:6px;">Prefira cores escuras — elas também são usadas em textos e botões. Cores claras são escurecidas automaticamente.</div>
    </div>`;
  return `<div id="${prefix}-profile" data-logo="${s.profLogo ? 'keep' : 'none'}" data-color="${color}">
    ${parts.data ? dataHtml : ''}${parts.visual ? visualHtml : ''}</div>`;
}

// Guarda a logo nova em memória (fora do DOM, pois pode ser grande) até salvar.
const pendingLogo = {};

function bindProfileFields(container, prefix) {
  const wrap = container.querySelector(`#${prefix}-profile`);
  if (!wrap) return;
  delete pendingLogo[prefix];
  const pick = container.querySelector(`#${prefix}-logo-pick`);
  const file = container.querySelector(`#${prefix}-logo-file`);
  const preview = container.querySelector(`#${prefix}-logo-preview`);
  const removeBtn = container.querySelector(`#${prefix}-logo-remove`);
  pick?.addEventListener('click', () => file.click());
  file?.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const data = await readLogoFile(f);
      pendingLogo[prefix] = data;
      wrap.dataset.logo = 'new';
      preview.src = data;
      removeBtn.style.display = '';
    } catch (e) {
      Utils.toast(e.message, 'error');
    }
    file.value = '';
  });
  removeBtn?.addEventListener('click', () => {
    delete pendingLogo[prefix];
    wrap.dataset.logo = 'none';
    preview.src = DEFAULT_LOGO_SRC;
    removeBtn.style.display = 'none';
  });

  function setColor(c) {
    wrap.dataset.color = c.toUpperCase();
    container.querySelectorAll(`.${prefix}-swatch`).forEach((b) => {
      b.style.borderColor = b.dataset.color.toUpperCase() === wrap.dataset.color ? '#B8924A' : 'transparent';
    });
    applyTheme(c); // pré-visualização ao vivo
  }
  container.querySelectorAll(`.${prefix}-swatch`).forEach((b) => b.addEventListener('click', () => {
    setColor(b.dataset.color);
    const custom = container.querySelector(`#${prefix}-color-custom`);
    if (custom) custom.value = b.dataset.color;
  }));
  container.querySelector(`#${prefix}-color-custom`)?.addEventListener('input', (e) => setColor(e.target.value));
}

// Lê só os campos presentes na tela (o assistente mostra o perfil em etapas).
function readProfileFields(container, prefix) {
  const patch = {};
  const val = (id) => container.querySelector(`#${prefix}-${id}`);
  if (val('prof-name')) {
    patch.headerProfessionalName = (window.License && License.lockedName()) || val('prof-name').value.trim();
    patch.profCref = (window.License && License.lockedCref()) || val('prof-cref').value.trim();
    patch.profTitle = val('prof-title').value.trim();
    patch.profBusinessName = val('prof-business').value.trim();
    patch.profPhone = val('prof-phone').value.trim();
    patch.profEmail = val('prof-email').value.trim();
    patch.profInstagram = val('prof-insta').value.trim();
  }
  const wrap = container.querySelector(`#${prefix}-profile`);
  if (wrap && val('logo-preview')) {
    if (wrap.dataset.logo === 'new' && pendingLogo[prefix]) patch.profLogo = pendingLogo[prefix];
    if (wrap.dataset.logo === 'none') patch.profLogo = null;
    patch.themeColor = wrap.dataset.color || DEFAULT_THEME_COLOR;
  }
  return patch;
}

function settingsCardHtml(s) {
  return `
  <div class="mp-card">
    <h3>👤 Perfil do Profissional</h3>
    <div class="mp-sub" style="margin-top:10px;">Seus dados aparecem no cabeçalho do app e em todos os relatórios e documentos entregues ao aluno.</div>
    ${profileFieldsHtml('cfg', s)}
    <div class="mp-form-actions" style="margin-top:16px;">
      <button type="button" id="cfg-profile-save" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar perfil</button>
    </div>
  </div>`;
}

// ---------- Assistente de primeiro acesso ----------
// Aparece só quando o app ainda não tem nenhum aluno e o assistente nunca foi concluído
// (aparelho novo / profissional novo). Quem já usa o app não é afetado.
const onb = { step: 1 };
const ONB_STEPS = 4;

function onboardingShouldShow() {
  const s = AppState.settings || {};
  return !s.onboardingDone && AppState.students.length === 0;
}

function onbStepHtml() {
  const s = AppState.settings || {};
  if (onb.step === 1) {
    return `
      <h2>Bem-vindo(a) ao Método Pleno</h2>
      <p class="mp-sub">Vamos deixar o app com a sua cara em 3 passos rápidos. Tudo pode ser alterado depois em <strong>⚙️ Configurações</strong>.</p>
      <div class="mp-onb-note">🔒 Os dados dos seus alunos ficam salvos <strong>somente neste aparelho</strong> — nada é enviado a servidores.</div>
      ${profileFieldsHtml('onb', s, { data: true, visual: false })}
      <p style="font-size:12.5px;color:var(--texto-suave);margin-top:6px;">Já usa o app em outro aparelho? <button type="button" id="onb-restore" class="mp-link-btn">Restaurar um backup</button> <input type="file" id="onb-restore-file" accept="application/json" style="display:none;"></p>`;
  }
  if (onb.step === 2) {
    return `
      <h2>Sua identidade visual</h2>
      <p class="mp-sub">Sua logo e sua cor aparecem no app e nos relatórios que você envia aos alunos e às famílias.</p>
      ${profileFieldsHtml('onb', s, { data: false, visual: true })}`;
  }
  if (onb.step === 3) {
    return `
      <h2>Segurança e backup</h2>
      <p class="mp-sub">Recomendado: proteja a abertura do app com um PIN (4 a 6 números). Você pode pular e definir depois.</p>
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>PIN (opcional)</label><input type="password" inputmode="numeric" maxlength="6" id="onb-pin" autocomplete="off"></div>
        <div class="mp-field"><label>Confirmar PIN</label><input type="password" inputmode="numeric" maxlength="6" id="onb-pin2" autocomplete="off"></div>
      </div>
      <div class="mp-onb-note mp-onb-warn">
        <strong>Importante:</strong> como os dados ficam só neste aparelho, se você limpar os dados do navegador, trocar ou perder o aparelho, eles só voltam pelo <strong>💾 Backup (JSON)</strong>. Faça backup toda semana e guarde o arquivo fora do aparelho (e-mail, Google Drive). Se esquecer o PIN, também só é possível voltar pelo backup.
      </div>
      <label class="mp-schedule-check" style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13.5px;">
        <input type="checkbox" id="onb-backup-ok" style="margin-top:3px;"> Entendi que o backup dos dados é minha responsabilidade.
      </label>`;
  }
  return `
      <h2>Tudo pronto${s.headerProfessionalName ? ', ' + Utils.escapeHtml(s.headerProfessionalName.split(' ').filter((w) => !/^prof/i.test(w))[0] || '') : ''}!</h2>
      <p class="mp-sub">Agora é só cadastrar o seu primeiro aluno. Depois, use o menu de abas para Cadastro, Anamnese, Planejar Aula e as demais funções. O botão <strong>❓ Ajuda</strong>, no rodapé, explica cada aba.</p>
      <div class="mp-field"><label>Nome do primeiro aluno (opcional)</label><input type="text" id="onb-first-student" placeholder="Ex: Maria da Silva"></div>`;
}

function onboardingRenderHtml() {
  const dots = Array.from({ length: ONB_STEPS }, (_, i) => `<span class="mp-onb-dot ${i + 1 <= onb.step ? 'on' : ''}"></span>`).join('');
  return `
  <div class="mp-onb">
    <div class="mp-onb-card">
      <div class="mp-onb-top">
        <img src="${Utils.escapeHtml(profLogoSrc())}" alt="" class="mp-onb-logo">
        <div class="mp-onb-dots">${dots}<span class="mp-onb-count">Passo ${onb.step} de ${ONB_STEPS}</span></div>
      </div>
      <div id="onb-body">${onbStepHtml()}</div>
      <div class="mp-onb-actions">
        ${onb.step > 1 ? '<button type="button" class="mp-btn mp-btn-ghost" id="onb-back">Voltar</button>' : '<button type="button" class="mp-btn mp-btn-ghost" id="onb-skip">Pular configuração</button>'}
        <button type="button" class="mp-btn mp-btn-gold" id="onb-next" style="background:var(--verde-principal);color:#fff;">${onb.step === ONB_STEPS ? 'Começar a usar' : 'Continuar'}</button>
      </div>
    </div>
  </div>`;
}

async function onbFinish(firstStudentName) {
  await saveSettingsPatch({ onboardingDone: true });
  onb.step = 1;
  if (firstStudentName) {
    AppState.activeTab = 'cadastro';
    await addStudentQuick(firstStudentName);
  } else {
    render();
  }
  Utils.toast('Configuração concluída ✓', 'success');
}

function onboardingBindEvents(root) {
  bindProfileFields(root, 'onb');

  root.querySelector('#onb-skip')?.addEventListener('click', async () => {
    const ok = await Utils.confirmDialog('Pular a configuração inicial? Você pode preencher o seu perfil depois em ⚙️ Configurações.');
    if (ok) onbFinish('');
  });
  root.querySelector('#onb-back')?.addEventListener('click', () => { onb.step -= 1; render(); });

  const restoreBtn = root.querySelector('#onb-restore');
  const restoreFile = root.querySelector('#onb-restore-file');
  restoreBtn?.addEventListener('click', () => restoreFile.click());
  restoreFile?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) BackupModule.importBackup(f);
  });

  root.querySelector('#onb-next')?.addEventListener('click', async () => {
    if (onb.step === 1) {
      const patch = readProfileFields(root, 'onb');
      if (!patch.headerProfessionalName) { Utils.toast('Informe o seu nome para continuar.', 'error'); return; }
      await saveSettingsPatch(patch);
    } else if (onb.step === 2) {
      await saveSettingsPatch(readProfileFields(root, 'onb'));
    } else if (onb.step === 3) {
      const pin = root.querySelector('#onb-pin').value;
      const pin2 = root.querySelector('#onb-pin2').value;
      if (!root.querySelector('#onb-backup-ok').checked) { Utils.toast('Marque a confirmação sobre o backup para continuar.', 'error'); return; }
      if (pin || pin2) {
        if (!PinLock.isValidFormat(pin)) { Utils.toast('O PIN deve ter de 4 a 6 dígitos numéricos.', 'error'); return; }
        if (pin !== pin2) { Utils.toast('Os PINs não coincidem.', 'error'); return; }
        const salt = PinLock.generateSalt();
        const hash = await PinLock.hashPin(pin, salt);
        await saveSettingsPatch({ pinHash: hash, pinSalt: salt });
        AppState.pinUnlocked = true; // já está usando o app agora
      }
    } else {
      await onbFinish(root.querySelector('#onb-first-student').value.trim());
      return;
    }
    onb.step += 1;
    render();
  });
}

window.Profile = {
  applyTheme,
  name: profName,
  title: profTitle,
  signatureLine: profSignatureLine,
  contactLine: profContactLine,
  brandLine: profBrandLine,
  logoSrc: profLogoSrc,
  hasCustomLogo: profHasCustomLogo,
  docHeaderHtml,
  settingsCardHtml,
  bindProfileFields,
  readProfileFields,
};
window.Onboarding = {
  shouldShow: onboardingShouldShow,
  renderHtml: onboardingRenderHtml,
  bindEvents: onboardingBindEvents,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['profile.js'] = 'v1.18.0';
