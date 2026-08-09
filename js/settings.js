// Configurações globais do app (não dependem do aluno selecionado): regras de
// desmarcação/reposição/férias e personalização do cabeçalho. Registro único no
// IndexedDB (id fixo 'global'). O texto explicativo da política é sempre GERADO a
// partir desses valores — nunca editado separadamente — para nunca ficar dessincronizado
// do cálculo real.

const DEFAULT_SETTINGS = {
  id: 'global',
  headerProfessionalName: 'Prof. Roberto Amaral',
  noticeHours: 1,
  maxMakeupsPerMonth: 2,
  allowTransfer: true,
  maxTransfers: 1,
  professorMonths: 2,
  vacationChargePercent: 60,
};

async function loadSettings() {
  const existing = await DB.get(DB.STORES.appSettings, 'global');
  return { ...DEFAULT_SETTINGS, ...(existing || {}) };
}

async function saveSettingsPatch(patch) {
  const merged = { ...DEFAULT_SETTINGS, ...AppState.settings, ...patch, id: 'global' };
  AppState.settings = merged;
  await DB.put(DB.STORES.appSettings, merged);
  return merged;
}

// Gera o texto da política de desmarcação a partir das configurações atuais (array
// de parágrafos HTML). Usado tanto na tela de Configurações (pré-visualização) quanto
// na aba Controle de Pagamento.
function generatePolicyParagraphs(s) {
  const paras = [];
  paras.push(`<strong>Desmarcação pelo aluno:</strong> aviso com pelo menos ${s.noticeHours}h de antecedência dá direito a reposição; sem aviso, ou com menos de ${s.noticeHours}h, não há direito a reposição.`);
  paras.push(`Limite de ${s.maxMakeupsPerMonth} ${s.maxMakeupsPerMonth === 1 ? 'desmarcação' : 'desmarcações'} com direito a reposição por ciclo — a partir da ${s.maxMakeupsPerMonth + 1}ª desmarcação com aviso no mesmo ciclo, essa desmarcação extra já nasce sem direito, mesmo com aviso prévio.`);
  if (s.allowTransfer && s.maxTransfers > 0) {
    paras.push(`Se não repor dentro do ciclo, é possível transferir a reposição para o ciclo seguinte (até ${s.maxTransfers}x), sem gerar desconto na mensalidade.`);
  } else {
    paras.push('Reposições não usadas dentro do ciclo são perdidas, sem gerar desconto na mensalidade.');
  }
  paras.push(`<strong>Desmarcação pelo professor:</strong> reposição sempre garantida, em até ${s.professorMonths} ${s.professorMonths === 1 ? 'mês' : 'meses'} a partir da data desmarcada.`);
  paras.push(`<strong>Férias/ausência:</strong> mantendo o horário reservado, é cobrado ${s.vacationChargePercent}% do valor das aulas do período de ausência; sem manter reservado, o horário fica sujeito à disponibilidade no retorno.`);
  return paras;
}

function readSettingsForm(container) {
  return {
    headerProfessionalName: container.querySelector('#cfg-header-name').value.trim(),
    noticeHours: Number(container.querySelector('#cfg-notice-hours').value) || 0,
    maxMakeupsPerMonth: Math.max(1, parseInt(container.querySelector('#cfg-max-makeups').value, 10) || 1),
    allowTransfer: container.querySelector('#cfg-allow-transfer').checked,
    maxTransfers: Math.max(1, parseInt(container.querySelector('#cfg-max-transfers').value, 10) || 1),
    professorMonths: Math.max(1, parseInt(container.querySelector('#cfg-professor-months').value, 10) || 1),
    vacationChargePercent: Math.min(100, Math.max(0, Number(container.querySelector('#cfg-vacation-percent').value) || 0)),
  };
}

function settingsRenderHtml() {
  const s = AppState.settings;
  return `
  <div class="mp-card">
    <h3>Cabeçalho</h3>
    <div class="mp-sub" style="margin-top:10px;">Aparece no topo do app, no lugar da tagline, embaixo do título.</div>
    <div class="mp-field">
      <label>Nome do profissional exibido no cabeçalho</label>
      <input type="text" id="cfg-header-name" value="${Utils.escapeHtml(s.headerProfessionalName || '')}" placeholder="Ex: Prof. Roberto Amaral">
    </div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Regras de desmarcação, reposição e férias</h3>
    <div class="mp-sub" style="margin-top:10px;">Esses valores definem o cálculo automático em "Controle de Pagamento" <strong>e</strong> o texto explicativo mostrado lá — sempre sincronizados.</div>

    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Horas mínimas de aviso p/ direito a reposição</label><input type="number" min="0" step="0.5" id="cfg-notice-hours" value="${s.noticeHours}"></div>
      <div class="mp-field"><label>Máx. reposições com direito por ciclo</label><input type="number" min="1" step="1" id="cfg-max-makeups" value="${s.maxMakeupsPerMonth}"></div>
    </div>

    <div class="mp-field">
      <label class="mp-schedule-check" style="display:inline-flex;">
        <input type="checkbox" id="cfg-allow-transfer" ${s.allowTransfer ? 'checked' : ''}> Permite transferir reposição não realizada para o ciclo seguinte?
      </label>
    </div>
    <div class="mp-field" id="cfg-max-transfers-wrap" style="${s.allowTransfer ? '' : 'display:none;'}max-width:220px;">
      <label>Quantas vezes pode transferir?</label>
      <input type="number" min="1" step="1" id="cfg-max-transfers" value="${s.maxTransfers}">
    </div>

    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Prazo (meses) p/ reposição quando o professor cancela</label><input type="number" min="1" step="1" id="cfg-professor-months" value="${s.professorMonths}"></div>
      <div class="mp-field"><label>% cobrado em férias mantendo horário reservado</label><input type="number" min="0" max="100" step="1" id="cfg-vacation-percent" value="${s.vacationChargePercent}"></div>
    </div>

    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:18px 0 8px;color:var(--verde-principal);">Pré-visualização do texto exibido em "Controle de Pagamento"</h4>
    <div id="cfg-policy-preview" class="mp-sub" style="background:var(--fundo);padding:14px 16px;border-radius:10px;margin-top:0;"></div>

    <div class="mp-form-actions" style="margin-top:16px;">
      <button type="button" id="cfg-save" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar configurações</button>
    </div>
  </div>
  `;
}

function settingsBindEvents(container) {
  function recomputePreview() {
    const draft = readSettingsForm(container);
    container.querySelector('#cfg-policy-preview').innerHTML = generatePolicyParagraphs(draft).map((p) => `<p style="margin-bottom:8px;">${p}</p>`).join('');
  }

  const allowTransferChk = container.querySelector('#cfg-allow-transfer');
  const maxTransfersWrap = container.querySelector('#cfg-max-transfers-wrap');
  allowTransferChk.addEventListener('change', () => {
    maxTransfersWrap.style.display = allowTransferChk.checked ? '' : 'none';
    recomputePreview();
  });

  container.querySelectorAll('#cfg-notice-hours, #cfg-max-makeups, #cfg-max-transfers, #cfg-professor-months, #cfg-vacation-percent').forEach((inp) => {
    inp.addEventListener('input', recomputePreview);
  });
  recomputePreview();

  container.querySelector('#cfg-save').addEventListener('click', async () => {
    const patch = readSettingsForm(container);
    await saveSettingsPatch(patch);
    Utils.toast('Configurações salvas ✓', 'success');
    render();
  });
}

window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.loadSettings = loadSettings;
window.saveSettingsPatch = saveSettingsPatch;
window.generatePolicyParagraphs = generatePolicyParagraphs;
window.SettingsView = { renderHtml: settingsRenderHtml, bindEvents: settingsBindEvents };
