// Shell do app, cabeçalho, abas e orquestração de render — Método Pleno

const APP_VERSION = 'v1.4.0';

const HELP_TOPICS = [
  { title: '📊 Administrativo', text: 'Visão de todos os alunos ao mesmo tempo: situação de pagamento (em dia/atrasado) e faturamento do mês.' },
  { title: 'Cadastro do Aluno', text: 'Dados pessoais, contato de emergência, atividade, plano de aulas/cobrança e atestado médico do aluno selecionado.' },
  { title: 'Controle de Pagamento', text: 'Registro de pagamentos, ciclo de cobrança (aulas dadas/contratadas) e desmarcações/reposições/férias.' },
  { title: 'Anamnese', text: 'Triagem de saúde do aluno (perguntas sim/não), atualizável a qualquer momento.' },
  { title: 'Planejar Aula', text: 'Monte a sequência de exercícios (séries, reps, carga, descanso) antes da aula.' },
  { title: 'Registro de Treino', text: 'Execute o plano do dia, ajuste valores reais, registre o esforço percebido (Borg CR-10) e exercícios avulsos.' },
  { title: 'Dashboard de Evolução', text: 'Gráficos de evolução de carga, esforço percebido, aulas dadas e consistência de treino.' },
  { title: 'Avaliação Funcional', text: 'Senior Fitness Test — 5 testes físicos com tabelas normativas por idade/sexo e Índice de Aptidão Funcional.' },
  { title: 'Avaliação Física', text: 'Peso, altura, IMC, composição corporal (bioimpedância) e circunferências, com histórico e gráficos.' },
];

function openHelpModal() {
  const overlay = Utils.el(`
    <div class="modal-overlay">
      <div class="modal" style="max-width:480px;max-height:80vh;overflow-y:auto;">
        <h3 style="font-family:'Fraunces',serif;margin-bottom:12px;">Como usar o Método Pleno</h3>
        ${HELP_TOPICS.map((t) => `<p style="margin-bottom:10px;"><strong>${Utils.escapeHtml(t.title)}</strong><br><span style="font-size:13px;color:var(--texto-suave);">${Utils.escapeHtml(t.text)}</span></p>`).join('')}
        <div class="modal__actions">
          <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-action="close" type="button">Entendi</button>
        </div>
      </div>
    </div>
  `);
  overlay.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close' || e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

let storageWarning = null;
let deferredInstallPrompt = null;

function setStorageWarning(msg) {
  storageWarning = msg;
}

async function guardedPut(storeName, value, friendlyMsg) {
  try {
    await DB.put(storeName, value);
    storageWarning = null;
    return true;
  } catch (e) {
    storageWarning = friendlyMsg || `Não foi possível salvar o último registro (${e.message || 'erro desconhecido'}). Exporte um backup para não perder os dados.`;
    return false;
  }
}

function render() {
  const root = document.getElementById('mp-root');
  if (AppState.loading) {
    root.innerHTML = '<div class="mp-loading">Preparando o painel do Método Pleno…</div>';
    return;
  }
  try {
    root.innerHTML = renderHeader() + '<div class="mp-wrap mp-content" id="mp-tabcontent">' + renderTabContent() + '</div>' + renderFooter();
    bindHeaderEvents();
    const helpBtn = document.getElementById('mp-help-btn');
    if (helpBtn) helpBtn.addEventListener('click', openHelpModal);
    const contentEl = document.getElementById('mp-tabcontent');
    if (AppState.currentId) {
      if (AppState.activeTab === 'administrativo') { AdminView.bindEvents(contentEl); AdminView.afterRender(contentEl); }
      if (AppState.activeTab === 'cadastro') { RegistrationView.bindEvents(contentEl); }
      if (AppState.activeTab === 'pagamento') { PaymentsView.bindEvents(contentEl); }
      if (AppState.activeTab === 'anamnese') { AnamnesisView.bindEvents(contentEl); }
      if (AppState.activeTab === 'plano') { PlanningView.bindEvents(contentEl); }
      if (AppState.activeTab === 'registro') { ExecutionView.bindEvents(contentEl); }
      if (AppState.activeTab === 'dashboard') { DashboardView.bindEvents(contentEl); DashboardView.afterRender(contentEl); }
      if (AppState.activeTab === 'avaliacao') { EvaluationView.bindEvents(contentEl); EvaluationView.afterRender(contentEl); }
      if (AppState.activeTab === 'fisica') { PhysicalEvaluationView.bindEvents(contentEl); PhysicalEvaluationView.afterRender(contentEl); }
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `
      <div class="mp-wrap" style="padding-top:40px;">
        <div class="mp-empty" style="border-color:var(--alerta);">
          <h3 style="color:var(--alerta);">Algo deu errado ao atualizar a tela</h3>
          <p>Nada foi perdido — mas essa ação específica não completou. Tire um print desta mensagem técnica:</p>
          <p style="font-family:monospace;font-size:12px;background:#fff;padding:10px;border-radius:8px;text-align:left;overflow-wrap:break-word;">${Utils.escapeHtml(err.message || String(err))}</p>
          <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;margin-top:10px;" onclick="location.reload()">Recarregar o painel</button>
        </div>
      </div>`;
  }
}

function renderHeader() {
  const options = AppState.students.map((s) =>
    `<option value="${s.id}" ${s.id === AppState.currentId ? 'selected' : ''}>${Utils.escapeHtml(s.name)}</option>`
  ).join('');

  return `
  <div class="mp-header">
    <div class="mp-wrap">
      <div class="mp-brand-row">
        <img src="assets/imagens/logo_metodo_pleno_transparente.png" alt="Método Pleno" class="mp-logo">
        <div>
          <div class="mp-eyebrow">Método Pleno · Movimento e Longevidade</div>
          <h1 class="mp-title">Acompanhamento Individualizado</h1>
          <div class="mp-tagline">Movimento e Longevidade</div>
        </div>
      </div>
      ${storageWarning ? `<div class="mp-warning-banner">⚠ ${Utils.escapeHtml(storageWarning)}</div>` : ''}
      <div class="mp-student-bar">
        ${AppState.students.length ? `<select id="mp-select-student">${options}</select>` : '<span style="color:rgba(251,250,246,.7);font-size:13.5px;">Nenhum aluno cadastrado ainda —</span>'}
        <input id="mp-new-student" type="text" placeholder="Nome do novo aluno" style="min-width:180px;">
        <button class="mp-btn mp-btn-gold" id="mp-add-student" type="button">+ Adicionar aluno</button>
        ${AppState.students.length ? '<button class="mp-btn mp-btn-outline" id="mp-export-csv" type="button">Exportar sessões (CSV)</button>' : ''}
        <button class="mp-btn mp-btn-outline" id="mp-export-backup" type="button">💾 Backup (JSON)</button>
        <button class="mp-btn mp-btn-outline" id="mp-import-backup" type="button">Restaurar backup</button>
        <input type="file" id="mp-import-file" accept="application/json" style="display:none;">
        <button class="mp-btn mp-btn-gold" id="mp-install-btn" type="button" hidden>⬇ Instalar app</button>
        <span id="mp-conn-status" style="margin-left:auto;font-size:11px;padding:3px 9px;border-radius:20px;background:rgba(255,255,255,.12);color:var(--dourado-claro);"></span>
      </div>
      ${AppState.currentId ? `
      <div style="margin-top:20px;position:relative;z-index:1;">
        <select id="mp-tab-select" class="mp-tab-select">
          <optgroup label="Visão geral (todos os alunos)">
            <option value="administrativo" ${AppState.activeTab === 'administrativo' ? 'selected' : ''}>📊 Administrativo</option>
          </optgroup>
          <optgroup label="Aluno selecionado">
            <option value="cadastro" ${AppState.activeTab === 'cadastro' ? 'selected' : ''}>Cadastro do Aluno</option>
            <option value="pagamento" ${AppState.activeTab === 'pagamento' ? 'selected' : ''}>Controle de Pagamento</option>
            <option value="anamnese" ${AppState.activeTab === 'anamnese' ? 'selected' : ''}>Anamnese</option>
            <option value="plano" ${AppState.activeTab === 'plano' ? 'selected' : ''}>Planejar Aula</option>
            <option value="registro" ${AppState.activeTab === 'registro' ? 'selected' : ''}>Registro de Treino (${AppState.data.sessions.length})</option>
            <option value="dashboard" ${AppState.activeTab === 'dashboard' ? 'selected' : ''}>Dashboard de Evolução</option>
            <option value="avaliacao" ${AppState.activeTab === 'avaliacao' ? 'selected' : ''}>Avaliação Funcional (${AppState.data.evaluations.length})</option>
            <option value="fisica" ${AppState.activeTab === 'fisica' ? 'selected' : ''}>Avaliação Física (${AppState.data.physicalEvaluations.length})</option>
          </optgroup>
        </select>
      </div>` : ''}
    </div>
  </div>`;
}

function renderFooter() {
  return `
  <footer class="mp-footer">
    <div class="mp-wrap" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <span>🔒 Seus dados ficam salvos apenas neste aparelho — nunca são enviados a nenhum servidor.</span>
      <span style="display:flex;align-items:center;gap:10px;">
        <button type="button" id="mp-help-btn" class="mp-btn mp-btn-ghost mp-btn-sm">❓ Ajuda</button>
        <span class="mp-footer-version">Método Pleno ${APP_VERSION}</span>
      </span>
    </div>
  </footer>`;
}

function renderTabContent() {
  if (!AppState.currentId) {
    return `<div class="mp-empty">
      <h3>Comece cadastrando um aluno</h3>
      <p>Digite o nome do aluno acima e clique em "+ Adicionar aluno" para abrir a ficha individual de acompanhamento.</p>
    </div>`;
  }
  if (AppState.activeTab === 'administrativo') return AdminView.renderHtml();
  if (AppState.activeTab === 'cadastro') return RegistrationView.renderHtml();
  if (AppState.activeTab === 'pagamento') return PaymentsView.renderHtml();
  if (AppState.activeTab === 'anamnese') return AnamnesisView.renderHtml();
  if (AppState.activeTab === 'plano') return PlanningView.renderHtml();
  if (AppState.activeTab === 'registro') return ExecutionView.renderHtml();
  if (AppState.activeTab === 'dashboard') return DashboardView.renderHtml();
  if (AppState.activeTab === 'avaliacao') return EvaluationView.renderHtml();
  if (AppState.activeTab === 'fisica') return PhysicalEvaluationView.renderHtml();
  return '';
}

function exportSessionsCsv() {
  const sessions = AppState.data.sessions;
  if (!sessions.length) { Utils.toast('Nenhum registro para exportar ainda.', 'error'); return; }
  const header = 'Data;Exercicio;Series;Repeticoes;Carga;Unidade;Borg;Observacoes\n';
  const lines = sessions.map((s) => [s.date, s.exerciseName, s.series, s.reps, s.load, s.unit, s.borg, (s.notes || '').replace(/;/g, ',')].join(';'));
  const csv = header + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const student = currentStudent();
  a.href = url;
  a.download = `registro_treino_${(student?.name || 'aluno').toLowerCase().replace(/\s+/g, '-')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bindHeaderEvents() {
  const selStudent = document.getElementById('mp-select-student');
  if (selStudent) selStudent.addEventListener('change', (e) => switchStudent(e.target.value));

  const addBtn = document.getElementById('mp-add-student');
  const newInput = document.getElementById('mp-new-student');
  if (addBtn) addBtn.addEventListener('click', () => addStudentQuick(newInput.value));
  if (newInput) newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStudentQuick(newInput.value); } });

  const exportBtn = document.getElementById('mp-export-csv');
  if (exportBtn) exportBtn.addEventListener('click', exportSessionsCsv);

  const exportBackupBtn = document.getElementById('mp-export-backup');
  if (exportBackupBtn) exportBackupBtn.addEventListener('click', () => BackupModule.exportBackup());

  const importBtn = document.getElementById('mp-import-backup');
  const importFile = document.getElementById('mp-import-file');
  if (importBtn) importBtn.addEventListener('click', () => importFile.click());
  if (importFile) importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) BackupModule.importBackup(file);
  });

  const tabSelect = document.getElementById('mp-tab-select');
  if (tabSelect) tabSelect.addEventListener('change', () => { AppState.activeTab = tabSelect.value; render(); });

  const installBtn = document.getElementById('mp-install-btn');
  if (installBtn) {
    installBtn.hidden = !deferredInstallPrompt;
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.hidden = true;
    });
  }
  updateConnectionBadge();
}

function updateConnectionBadge() {
  const badge = document.getElementById('mp-conn-status');
  if (!badge) return;
  const isOnline = navigator.onLine;
  badge.textContent = isOnline ? '● Online' : '● Offline — funcionando normalmente';
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((err) => {
        console.warn('Falha ao registrar service worker:', err);
      });
    });
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('mp-install-btn');
  if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const btn = document.getElementById('mp-install-btn');
  if (btn) btn.hidden = true;
});
window.addEventListener('online', updateConnectionBadge);
window.addEventListener('offline', updateConnectionBadge);

window.AppShell = { render, guardedPut, setStorageWarning, exportSessionsCsv };

document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  stateInit();
});
