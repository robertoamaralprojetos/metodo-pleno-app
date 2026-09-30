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
    await DB.importAll(data);
    Utils.toast('Backup restaurado ✓', 'success');
    // Recarrega as Configurações (perfil, logo, cor, regras) vindas do backup — antes só
    // valiam depois de recarregar a página. Quem acabou de restaurar já está usando o app,
    // então não pede o PIN agora (vale a partir da próxima abertura).
    AppState.settings = await loadSettings();
    AppState.pinUnlocked = true;
    if (window.License) License.ready = false; // reavalia a licença que veio no backup
    if (!AppState.settings.onboardingDone) await saveSettingsPatch({ onboardingDone: true });
    AppState.students = await StudentsData.listStudents();
    await switchStudent(AppState.students[0]?.id || null);
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

window.StorageGuard = Object.assign(StorageGuard, { refresh: sgRefresh, request: sgRequest, cardHtml: sgCardHtml, bind: sgBind });
window.BackupModule = { exportBackup, importBackup, daysSinceBackup, needsBackupReminder };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['backup.js'] = 'v1.19.1';
