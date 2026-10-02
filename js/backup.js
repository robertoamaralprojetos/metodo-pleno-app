// Backup completo (todos os alunos e dados) em JSON — para não perder tudo
// se o aparelho for trocado ou perdido. Local, sem servidor.
// DB.exportAll() já percorre TODAS as stores (incluindo "students"), então o arquivo gerado
// sempre inclui todos os alunos cadastrados de uma vez — não só o aluno selecionado no momento.

// Pergunta se as fotos posturais entram no backup (aumentam bastante o arquivo).
// Devolve 'com', 'sem' ou null (cancelou).
function askBackupPhotoChoice() {
  return new Promise((resolve) => {
    const overlay = Utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <p class="modal__message">Há fotos posturais salvas. Incluí-las no backup deixa o arquivo bem maior. Sem elas, as fotos <strong>não voltam</strong> se você restaurar este backup em outro aparelho.</p>
          <div class="modal__actions">
            <button class="mp-btn mp-btn-ghost" data-choice="cancel" type="button">Cancelar</button>
            <button class="mp-btn mp-btn-outline" data-choice="sem" type="button">Sem as fotos</button>
            <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-choice="com" type="button">Incluir fotos</button>
          </div>
        </div>
      </div>`);
    overlay.addEventListener('click', (e) => {
      const c = e.target.dataset.choice;
      if (c) { overlay.remove(); resolve(c === 'cancel' ? null : c); }
      else if (e.target === overlay) { overlay.remove(); resolve(null); }
    });
    document.body.appendChild(overlay);
  });
}

async function exportBackup() {
  try {
    const data = await DB.exportAll();
    const withPhotos = (data.posturalEvaluations || []).some((ev) => ev.photos && Object.values(ev.photos).some(Boolean));
    if (withPhotos) {
      const choice = await askBackupPhotoChoice();
      if (choice === null) return;
      if (choice === 'sem') {
        data.posturalEvaluations = data.posturalEvaluations.map((ev) => ({ ...ev, photos: {}, photosOmitted: true }));
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = Utils.todayISO();
    a.href = url;
    a.download = `metodo-pleno-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await saveSettingsPatch({ lastBackupAt: Utils.todayISO() });
    render();
    Utils.toast('Backup exportado ✓ — guarde este arquivo em local seguro.', 'success');
  } catch (e) {
    Utils.toast('Não foi possível gerar o backup: ' + (e.message || 'erro desconhecido'), 'error');
  }
}

// Dias desde o último backup (null se nunca foi feito).
function daysSinceBackup(lastBackupAt) {
  if (!lastBackupAt) return null;
  return -Utils.daysUntil(lastBackupAt);
}

// Verdadeiro se nunca houve backup, ou se já se passaram mais de 7 dias desde o último.
function needsBackupReminder(settings) {
  if (!settings) return false;
  if (!settings.lastBackupAt) return true;
  return daysSinceBackup(settings.lastBackupAt) > 7;
}

async function importBackup(file) {
  const ok = await Utils.confirmDialog('Restaurar este backup substitui TODOS os dados atuais do painel (alunos, planos, sessões e avaliações). Deseja continuar?');
  if (!ok) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    // Recarrega as Configurações (perfil, logo, cor, regras) vindas do backup. Quem acabou de
    // restaurar já está usando o app, então não pede o PIN agora (vale na próxima abertura).
    await restoreFromData(data);
    Utils.toast('Backup restaurado ✓', 'success');
  } catch (e) {
    Utils.toast('Arquivo de backup inválido: ' + (e.message || 'erro ao ler o arquivo'), 'error');
  }
}

// ---------- Proteção dos dados (armazenamento persistente) — v1.19.1 ----------
// Por padrão o navegador pode apagar sozinho os dados de um site quando o aparelho fica
// com pouco espaço. Pedir "armazenamento persistente" evita isso. No Chrome não aparece
// pergunta: o navegador concede automaticamente (mais fácil com o app instalado na tela
// inicial). Não protege contra limpezas feitas pelo usuário — por isso o backup continua.
const StorageGuard = { persisted: null, usage: null, quota: null, supported: !!(navigator.storage && navigator.storage.persist) };

async function sgRefresh() {
  if (!StorageGuard.supported) return StorageGuard;
  try { StorageGuard.persisted = await navigator.storage.persisted(); } catch (e) { StorageGuard.persisted = null; }
  try {
    const est = await navigator.storage.estimate();
    StorageGuard.usage = est.usage ?? null;
    StorageGuard.quota = est.quota ?? null;
  } catch (e) { /* sem estimativa */ }
  return StorageGuard;
}

async function sgRequest() {
  if (!StorageGuard.supported) return false;
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (e) { /* segue */ }
  await sgRefresh();
  return StorageGuard.persisted;
}

function sgFmtMB(bytes) {
  if (bytes == null) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1).replace('.', ',')} GB` : `${Math.max(0.1, mb).toFixed(1).replace('.', ',')} MB`;
}

function sgCardHtml(settings) {
  const g = StorageGuard;
  const status = !g.supported
    ? '<span class="mp-pill mp-pill-moderado">Proteção não disponível neste navegador</span>'
    : g.persisted === null
      ? '<span class="mp-pill mp-pill-moderado">Verificando…</span>'
      : g.persisted
      ? '<span class="mp-pill mp-pill-leve">🔒 Armazenamento protegido</span>'
      : '<span class="mp-pill mp-pill-alto">Armazenamento sem proteção</span>';
  const last = settings?.lastBackupAt ? Utils.formatDateBR(settings.lastBackupAt) : 'nunca';
  return `
  <div class="mp-card" style="margin-top:20px;" id="sg-card">
    <h3>🔒 Proteção dos dados</h3>
    <div class="mp-sub" style="margin-top:10px;">Os dados ficam só neste aparelho. Com a proteção ativa, o navegador não apaga os dados do app sozinho quando o aparelho fica com pouco espaço.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">${status}<span class="mp-pill mp-pill-neutro" style="background:var(--borda);color:var(--texto);">Último backup: ${last}</span></div>
    ${(() => { const m = autoLsGet(AUTO.markKey); const w = autoWipeLog(); return (m && m.students ? `<div class="mp-sub" style="margin:0 0 10px;">🛟 Cópia automática interna: <strong>${autoFmt(m.at)}</strong> (${m.students} aluno(s)${m.lite ? ', sem imagens grandes' : ''}).</div>` : '') + (w.length ? `<div class="mp-sub" style="margin:0 0 10px;color:var(--texto);">⚠ Apagamentos de dados detectados neste aparelho: <strong>${w.length}</strong> (último em ${autoFmt(w[w.length - 1].at)}).</div>` : ''); })()}
    ${g.usage != null ? `<div class="mp-sub" style="margin:0 0 10px;">Espaço usado pelo app: <strong>${sgFmtMB(g.usage)}</strong>${g.quota ? ` de ${sgFmtMB(g.quota)} disponíveis para ele` : ''}.</div>` : ''}
    ${g.supported && g.persisted === false ? `<div class="mp-sub" style="margin:0 0 10px;color:var(--texto);">Para ativar: <strong>instale o app na tela inicial</strong> (menu do Chrome → "Instalar app" ou "Adicionar à tela inicial"), abra-o por esse ícone e toque em "Pedir proteção". O Chrome decide sozinho, sem perguntar; às vezes ativa só depois de alguns dias de uso.</div>` : ''}
    <div class="mp-sub" style="margin:0 0 12px;">⚠ Nenhuma proteção impede uma limpeza feita por você (limpar dados do Chrome, apps de limpeza que apagam "dados do aplicativo" do Chrome). Por isso, mantenha o <strong>backup semanal</strong> guardado fora do aparelho.</div>
    <div class="mp-form-actions" style="justify-content:flex-start;gap:8px;flex-wrap:wrap;">
      ${g.supported && g.persisted === false ? '<button type="button" class="mp-btn mp-btn-gold" id="sg-request" style="background:var(--verde-principal);color:#fff;">Pedir proteção</button>' : ''}
      <button type="button" class="mp-btn mp-btn-ghost" id="sg-backup" style="border-color:var(--verde-suave);color:var(--verde-principal);">💾 Fazer backup agora</button>
    </div>
  </div>`;
}

function sgBind(container, skipRefresh) {
  if (!skipRefresh) {
    sgRefresh().then(() => {
      const card = container.querySelector('#sg-card');
      if (!card) return;
      card.outerHTML = sgCardHtml(AppState.settings);
      sgBind(container, true);
    });
  }
  container.querySelector('#sg-backup')?.addEventListener('click', () => exportBackup());
  container.querySelector('#sg-request')?.addEventListener('click', async () => {
    const ok = await sgRequest();
    Utils.toast(ok ? 'Proteção ativada ✓' : 'O navegador ainda não concedeu a proteção. Instale o app na tela inicial e tente de novo depois.', ok ? 'success' : 'info');
    render();
  });
}

// ---------- Cópia automática interna (v1.19.4) ----------
// Em alguns aparelhos, o banco de dados do app (IndexedDB) é apagado por limpezas do sistema
// ou de apps de limpeza, enquanto o restante (chave da licença) continua. Para não depender
// só do arquivo de backup, o app guarda sozinho uma cópia dos dados em DOIS outros lugares do
// navegador: o Cache Storage (cópia completa) e o localStorage (cópia compactada; sem fotos se
// ficar grande). Ao abrir, se o banco estiver vazio mas houver sinal de que havia alunos, o app
// oferece restaurar com um toque. Não substitui o backup em arquivo: se o navegador inteiro
// for limpo, essas cópias também somem.
const AUTO = { cache: 'mp-autobackup', url: 'mp-autobackup.json', lsKey: 'mp-autobackup', markKey: 'mp-data-mark', logKey: 'mp-wipe-log', lsMax: 2400000 };
let autoDirty = false, autoBusy = false;

function autoLsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function autoLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

function autoB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function autoPack(str) {
  if (typeof CompressionStream === 'undefined') return { z: false, s: str };
  const buf = await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  return { z: true, s: autoB64(new Uint8Array(buf)) };
}
async function autoUnpack(o) {
  if (!o.z) return o.s;
  const bin = atob(o.s); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
// Remove imagens grandes (fotos posturais, logo, assinaturas) para caber no localStorage.
function autoStripBig(v) {
  if (typeof v === 'string') return v.length > 20000 && v.startsWith('data:') ? null : v;
  if (Array.isArray(v)) return v.map(autoStripBig);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = autoStripBig(v[k]); return o; }
  return v;
}

function autoHookDB() {
  ['put', 'delete', 'clear', 'importAll'].forEach((fn) => {
    const orig = DB[fn];
    if (typeof orig !== 'function' || orig.__mpAuto) return;
    const w = function (...a) { autoDirty = true; return orig.apply(this, a); };
    w.__mpAuto = true;
    DB[fn] = w;
  });
}

async function autoSnapshot(force) {
  if (autoBusy || AppState.recovery) return false;
  if (!force && !autoDirty) return false;
  autoBusy = true;
  try {
    const data = await DB.exportAll();
    const n = (data.students || []).length;
    autoDirty = false;
    const at = new Date().toISOString();
    if (!n) {
      // Sem alunos (ex.: o profissional excluiu todos): só registra; mantém a última cópia guardada.
      const mark = autoLsGet(AUTO.markKey);
      if (mark && mark.students) autoLsSet(AUTO.markKey, { ...mark, students: 0, at });
      return false;
    }
    data.autoSnapshotAt = at;
    const json = JSON.stringify(data);
    let cacheOk = false, lsOk = false, lite = false;
    if ('caches' in window) {
      try {
        const c = await caches.open(AUTO.cache);
        await c.put(AUTO.url, new Response(json, { headers: { 'Content-Type': 'application/json' } }));
        cacheOk = true;
      } catch (e) { /* sem espaço: segue para o localStorage */ }
    }
    try {
      let pk = await autoPack(json);
      if (pk.s.length > AUTO.lsMax) { pk = await autoPack(JSON.stringify(autoStripBig(data))); lite = true; }
      if (pk.s.length <= AUTO.lsMax) lsOk = autoLsSet(AUTO.lsKey, { at, n, lite, z: pk.z, s: pk.s });
    } catch (e) { /* mantém a cópia anterior */ }
    autoLsSet(AUTO.markKey, { students: n, at, cache: cacheOk, ls: lsOk, lite, v: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') });
    return cacheOk || lsOk;
  } catch (e) {
    return false;
  } finally {
    autoBusy = false;
  }
}

// Procura a cópia automática mais recente (Cache Storage ou localStorage).
async function autoFind() {
  const found = [];
  if ('caches' in window) {
    try {
      const c = await caches.open(AUTO.cache);
      const r = await c.match(AUTO.url);
      if (r) { const data = JSON.parse(await r.text()); found.push({ source: 'cache', data, at: data.autoSnapshotAt || '', n: (data.students || []).length, lite: false }); }
    } catch (e) { /* ignora */ }
  }
  const ls = autoLsGet(AUTO.lsKey);
  if (ls && ls.s) {
    try { const data = JSON.parse(await autoUnpack(ls)); found.push({ source: 'ls', data, at: ls.at || data.autoSnapshotAt || '', n: (data.students || []).length, lite: !!ls.lite }); } catch (e) { /* ignora */ }
  }
  const ok = found.filter((f) => f.n > 0);
  ok.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : (a.lite ? 1 : 0) - (b.lite ? 1 : 0)));
  return ok[0] || null;
}

function autoWipeLog() { const l = autoLsGet(AUTO.logKey); return Array.isArray(l) ? l : []; }

// Chamado ao abrir o app com o banco sem alunos. Devolve o estado de recuperação, ou null.
async function autoDetectWipe() {
  const mark = autoLsGet(AUTO.markKey);
  const snap = await autoFind();
  const wiped = (mark && mark.students > 0) || (!mark && snap);
  if (!wiped) return null;
  const log = autoWipeLog();
  log.push({ at: new Date().toISOString(), had: mark?.students || snap?.n || 0, v: (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') });
  autoLsSet(AUTO.logKey, log.slice(-20));
  return { mark, snap, count: Math.min(log.length, 20) };
}

async function restoreFromData(data) {
  await DB.importAll(data);
  AppState.recovery = null;
  AppState.settings = await loadSettings();
  AppState.pinUnlocked = true;
  if (window.License) License.ready = false;
  if (!AppState.settings.onboardingDone) await saveSettingsPatch({ onboardingDone: true });
  AppState.students = await StudentsData.listStudents();
  await switchStudent(AppState.students[0]?.id || null);
  setTimeout(() => autoSnapshot(true), 1500);
}

function autoFmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${Utils.formatDateBR(iso.slice(0, 10))} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function recoveryScreenHtml() {
  const r = AppState.recovery || {};
  const had = r.mark?.students || r.snap?.n || 0;
  const snap = r.snap;
  return `
  <div class="mp-wrap" style="padding:24px 16px;">
    <div class="mp-card" style="max-width:600px;margin:20px auto;">
      <h3>⚠ Os dados deste aparelho foram apagados</h3>
      <div class="mp-sub" style="margin:10px 0;color:var(--texto);">O app abriu com o banco de dados vazio, mas este aparelho tinha <strong>${had} aluno(s)</strong>${r.mark?.at ? ` (última atividade em ${autoFmt(r.mark.at)})` : ''}. Isso acontece quando o sistema, o navegador ou um app de limpeza apaga os dados do app. Não foi a atualização do Método Pleno que apagou.</div>
      ${snap ? `
        <div class="mp-sub" style="margin:10px 0;color:var(--texto);">✅ <strong>O app guardou uma cópia automática</strong> em ${autoFmt(snap.at)}, com ${snap.n} aluno(s).</div>
        ${snap.lite ? '<div class="mp-sub" style="margin:0 0 10px;">Esta cópia não tem as imagens grandes (fotos posturais, assinaturas e logo). Se precisar delas, restaure o seu arquivo de backup (JSON).</div>' : ''}
        <div class="mp-form-actions" style="justify-content:flex-start;gap:8px;flex-wrap:wrap;">
          <button type="button" class="mp-btn mp-btn-gold" id="rc-auto" style="background:var(--verde-principal);color:#fff;">Restaurar cópia automática</button>
        </div>` : `
        <div class="mp-sub" style="margin:10px 0;color:var(--texto);">Não foi encontrada uma cópia automática neste aparelho. Restaure o seu último arquivo de backup (JSON).</div>`}
      <div class="mp-form-actions" style="justify-content:flex-start;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <label class="mp-btn mp-btn-ghost" style="border-color:var(--verde-suave);color:var(--verde-principal);cursor:pointer;">📂 Restaurar de um arquivo de backup<input type="file" id="rc-file" accept=".json,application/json" style="display:none;"></label>
        <button type="button" class="mp-btn mp-btn-ghost" id="rc-skip">Começar do zero</button>
      </div>
      <div class="mp-sub" style="margin-top:14px;">Apagamentos detectados neste aparelho: <strong>${r.count || 1}</strong>. Se isso se repete, verifique se há app de limpeza (ex.: Avast, CCleaner, "Otimizar") apagando dados do navegador, e confira o espaço livre do aparelho.</div>
    </div>
  </div>`;
}

function recoveryScreenBind(root) {
  root.querySelector('#rc-auto')?.addEventListener('click', async (ev) => {
    ev.target.disabled = true; ev.target.textContent = 'Restaurando…';
    try { await restoreFromData(AppState.recovery.snap.data); Utils.toast('Dados restaurados ✓', 'success'); }
    catch (e) { ev.target.disabled = false; ev.target.textContent = 'Restaurar cópia automática'; Utils.toast('Não foi possível restaurar: ' + (e.message || e), 'error'); }
  });
  root.querySelector('#rc-file')?.addEventListener('change', async (ev) => {
    const f = ev.target.files?.[0]; if (!f) return;
    try { await restoreFromData(JSON.parse(await f.text())); Utils.toast('Backup restaurado ✓', 'success'); }
    catch (e) { Utils.toast('Arquivo de backup inválido: ' + (e.message || 'erro ao ler o arquivo'), 'error'); }
  });
  root.querySelector('#rc-skip')?.addEventListener('click', async () => {
    const ok = await Utils.confirmDialog('Começar do zero neste aparelho? A cópia automática continua guardada até o app salvar novos dados.');
    if (!ok) return;
    const mark = autoLsGet(AUTO.markKey);
    if (mark) autoLsSet(AUTO.markKey, { ...mark, students: 0 });
    AppState.recovery = null;
    render();
  });
}

function autoInit() {
  autoHookDB();
  setInterval(() => autoSnapshot(false), 2 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoSnapshot(false); });
  window.addEventListener('pagehide', () => autoSnapshot(false));
}

window.AutoBackup = { init: autoInit, snapshot: autoSnapshot, find: autoFind, detectWipe: autoDetectWipe, wipeLog: autoWipeLog, mark: () => autoLsGet(AUTO.markKey), fmt: autoFmt, screenHtml: recoveryScreenHtml, screenBind: recoveryScreenBind, restore: restoreFromData };

window.StorageGuard = Object.assign(StorageGuard, { refresh: sgRefresh, request: sgRequest, cardHtml: sgCardHtml, bind: sgBind });
window.BackupModule = { exportBackup, importBackup, daysSinceBackup, needsBackupReminder };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['backup.js'] = 'v1.19.4';
