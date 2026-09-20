// Aba: Anamnese — triagem de saúde (registro único por aluno, atualizável).
// Dado sensível (LGPD): fica salvo apenas no IndexedDB local do dispositivo,
// nunca é enviado a nenhum servidor — o app não faz nenhuma chamada de rede.

// Triagem de prontidão (PAR-Q) — as 7 perguntas do formulário impresso do Método Pleno,
// baseadas no PAR-Q (Physical Activity Readiness Questionnaire), concebido para 15 a 69 anos.
// O termo assinado em papel continua sendo o documento legal; aqui ficam o registro,
// o resultado e a validade (12 meses). Dado sensível: só no IndexedDB local (LGPD).
const PARQ_QUESTIONS = [
  { key: 'q1', text: 'Algum médico já lhe disse que você possui um problema cardíaco e que você só deveria realizar atividade física sob recomendação médica?' },
  { key: 'q2', text: 'Você sente dor no peito quando realiza atividade física?' },
  { key: 'q3', text: 'No último mês, você sentiu dor no peito mesmo sem estar praticando atividade física?' },
  { key: 'q4', text: 'Você perde o equilíbrio por causa de tontura, ou já perdeu a consciência alguma vez?' },
  { key: 'q5', text: 'Você possui algum problema ósseo ou articular (coluna, joelho, quadril, ombro, etc.) que poderia piorar com uma mudança no seu nível de atividade física?' },
  { key: 'q6', text: 'Algum médico está atualmente prescrevendo medicamentos para pressão arterial ou para o coração?' },
  { key: 'q7', text: 'Existe algum outro motivo, do conhecimento do seu médico, pelo qual você não deveria realizar atividade física?' },
];
const PARQ_RESULT_OPTIONS = [
  { value: 'liberado', label: 'Liberado(a) para atividade física sem restrições' },
  { value: 'restricoes', label: 'Liberado(a) com restrições (especificar nas observações)' },
  { value: 'pendente', label: 'Pendente de atestado médico antes do início dos treinos' },
];
const PARQ_PREFIX = 'parq_';

// Pontos de atenção para o treino, a partir das perguntas complementares (respostas "Sim").
// Não impedem o início: servem para adaptar o programa.
const ANAM_ATTENTION_LABELS = {
  quedas: 'Queda nos últimos 12 meses',
  osteoporose: 'Osteoporose / osteopenia',
  diabetes: 'Diabetes',
  cirurgia: 'Cirurgia nos últimos 12 meses',
  mobilidade: 'Dificuldade de mobilidade',
  dispositivoApoio: 'Usa dispositivo de apoio',
  acompanhamentoMedico: 'Acompanhamento médico (condição crônica)',
  medicamentoContinuo: 'Medicação de uso contínuo',
};

function anamAttentionPoints(anamnesis) {
  const answers = anamnesis?.answers || {};
  return Object.keys(ANAM_ATTENTION_LABELS).filter((k) => answers[k] === true).map((k) => ANAM_ATTENTION_LABELS[k]);
}

// Situação da triagem PAR-Q: ausente, vencida, vencendo (até 30 dias) ou válida (12 meses).
function parqStatus(anamnesis) {
  const parq = anamnesis?.parq;
  if (!parq || !parq.date) return { code: 'ausente', level: 'alto', text: 'Triagem PAR-Q pendente: ainda não aplicada' };
  const validUntil = Utils.addYearsISO(parq.date, 1);
  const days = Utils.daysUntil(validUntil);
  if (days < 0) return { code: 'vencida', level: 'alto', validUntil, text: `Triagem PAR-Q vencida em ${Utils.formatDateBR(validUntil)}` };
  if (days <= 30) return { code: 'vencendo', level: 'moderado', validUntil, text: `Triagem PAR-Q vence em ${Utils.formatDateBR(validUntil)} (${days} dia(s))` };
  return { code: 'valida', level: 'leve', validUntil, text: `Triagem PAR-Q válida até ${Utils.formatDateBR(validUntil)}` };
}

function parqResultLabel(value) {
  return PARQ_RESULT_OPTIONS.find((o) => o.value === value)?.label || '—';
}

// Sugestão de resultado: qualquer "Sim" nas perguntas 1 a 7 sugere atestado médico antes de iniciar.
function parqSuggestion(state) {
  const answered = PARQ_QUESTIONS.filter((q) => state[PARQ_PREFIX + q.key] !== undefined && state[PARQ_PREFIX + q.key] !== null);
  if (answered.length < PARQ_QUESTIONS.length) return null;
  const anyYes = PARQ_QUESTIONS.some((q) => state[PARQ_PREFIX + q.key] === true);
  return anyYes ? 'pendente' : 'liberado';
}

function yesNoToggleHtml(key, value) {
  return `
    <div class="mp-yesno" data-key="${key}">
      <button type="button" class="mp-yesno-btn ${value === true ? 'mp-yesno-btn--active-yes' : ''}" data-key="${key}" data-value="yes">Sim</button>
      <button type="button" class="mp-yesno-btn ${value === false ? 'mp-yesno-btn--active-no' : ''}" data-key="${key}" data-value="no">Não</button>
    </div>
  `;
}

// Perfil de entrada no treino de musculação (Parte 2 do Roteiro Fisiológico de Progressão):
// define em que fase da sequência o aluno começa.
const ENTRY_PROFILES = [
  { key: 'sedentario', label: 'Sedentário, sem histórico de treino' },
  { key: 'destreinado', label: 'Já treinou, hoje destreinado' },
  { key: 'ativo', label: 'Já fisicamente ativo' },
];
window.ENTRY_PROFILES = ENTRY_PROFILES;

function anamRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const anamnesis = student.anamnesis || null;
  const answers = anamnesis?.answers || {};
  const parq = anamnesis?.parq || null;
  const parqAnswers = parq?.answers || {};
  const today = Utils.todayISO();
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;
  const status = parqStatus(anamnesis);
  const attention = anamAttentionPoints(anamnesis);

  const parqQuestionsHtml = PARQ_QUESTIONS.map((q, i) => `
    <div class="mp-anam-question">
      <div class="mp-anam-question__text">${i + 1}. ${Utils.escapeHtml(q.text)}</div>
      ${yesNoToggleHtml(PARQ_PREFIX + q.key, parqAnswers[q.key] === undefined ? null : parqAnswers[q.key])}
    </div>
  `).join('');

  const questionsHtml = ANAMNESE_QUESTIONS.map((q, i) => `
    <div class="mp-anam-question">
      <div class="mp-anam-question__text">${i + 1}. ${Utils.escapeHtml(q.text)}</div>
      ${yesNoToggleHtml(q.key, answers[q.key] === undefined ? null : answers[q.key])}
      ${q.hasFollowUp ? `
        <div class="mp-field mp-anam-followup" id="followup-${q.key}" style="${answers[q.key] === true ? '' : 'display:none;'}margin-top:8px;">
          <label>${Utils.escapeHtml(q.followUpLabel)}</label>
          <input type="text" id="r-medications" value="${Utils.escapeHtml(anamnesis?.medicationsList || '')}" placeholder="Ex: Losartana, Metformina...">
        </div>
      ` : ''}
    </div>
  `).join('');

  return `
  <div class="mp-card">
    <h3>Triagem de prontidão (PAR-Q)</h3>
    <div class="mp-sub" style="margin-top:10px;">Baseada no PAR-Q, concebido para pessoas de 15 a 69 anos. Aplique antes do início dos treinos e guarde o termo assinado em papel. Dado sensível: fica salvo apenas neste dispositivo.</div>
    <div style="margin:0 0 12px;"><span class="mp-pill mp-pill-${status.level}">${Utils.escapeHtml(status.text)}</span></div>
    ${parq?.result ? `<div class="mp-sub" style="margin-top:0;">Último resultado: <strong>${Utils.escapeHtml(parqResultLabel(parq.result))}</strong> (${Utils.formatDateBR(parq.date)})</div>` : ''}
    ${age != null && age >= 70 ? `<div class="mp-sub" style="margin-top:0;color:var(--texto);">Aluno com ${age} anos: recomenda-se orientação médica antes de iniciar o programa, mesmo que todas as respostas sejam Não.</div>` : ''}
    ${attention.length ? `<div style="margin:6px 0 12px;"><div class="mp-sub" style="margin:0 0 6px;font-weight:700;">Pontos de atenção para o treino</div>${attention.map((a) => `<span class="mp-pill mp-pill-moderado" style="margin:0 6px 6px 0;">${Utils.escapeHtml(a)}</span>`).join('')}</div>` : ''}

    ${parqQuestionsHtml}
    <div id="parq-suggestion" class="mp-sub" style="margin:10px 0 0;"></div>

    <div class="mp-form-row mp-row2" style="margin-top:12px;">
      <div class="mp-field">
        <label>Resultado da avaliação</label>
        <select id="parq-result">
          <option value="">Selecione</option>
          ${PARQ_RESULT_OPTIONS.map((o) => `<option value="${o.value}" ${parq?.result === o.value ? 'selected' : ''}>${Utils.escapeHtml(o.label)}</option>`).join('')}
        </select>
      </div>
      <div class="mp-field">
        <label>Observações (restrições, atestado, etc.)</label>
        <input type="text" id="parq-notes" value="${Utils.escapeHtml(parq?.notes || '')}" placeholder="Ex: atestado apresentado em 10/10; evitar impacto">
      </div>
    </div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Anamnese</h3>
    <div class="mp-sub" style="margin-top:10px;">Triagem de saúde do aluno. Dado sensível: fica salvo apenas neste dispositivo, nunca é enviado a servidores externos.</div>
    ${anamnesis?.filledAt ? `<div class="mp-sub" style="margin-top:0;">Última atualização: ${Utils.formatDateBR(anamnesis.filledAt)}</div>` : ''}

    ${questionsHtml}

    <div class="mp-field" style="margin-top:6px;">
      <label>9. Há quanto tempo você não pratica atividade física regularmente?</label>
      <input type="text" id="r-sedentary-time" value="${Utils.escapeHtml(anamnesis?.sedentaryTime || '')}" placeholder="Ex: 2 anos, nunca parei, etc.">
    </div>

    <div class="mp-anam-question" style="margin-top:14px;">
      <div class="mp-anam-question__text">10. Perfil de entrada no treino de musculação</div>
      <div class="mp-sub" style="margin:0 0 8px;">Define em que fase o treino começa (sugestão de periodização). Se o aluno já treinou e parou, informe há quantos meses.</div>
      <div class="mp-yesno" id="entry-profile">
        ${ENTRY_PROFILES.map((ep) => `<button type="button" class="mp-yesno-btn ${anamnesis?.entryProfile === ep.key ? 'mp-yesno-btn--active-yes' : ''}" style="min-width:0;flex:1 1 170px;" data-entry="${ep.key}">${Utils.escapeHtml(ep.label)}</button>`).join('')}
      </div>
      <div class="mp-field" id="entry-pause-wrap" style="${anamnesis?.entryProfile === 'destreinado' ? '' : 'display:none;'}margin-top:8px;max-width:260px;">
        <label>Tempo de pausa (meses)</label>
        <input type="number" min="0" step="1" id="r-pause-months" value="${anamnesis?.pauseMonths ?? ''}" placeholder="Ex: 8">
      </div>
      <div class="mp-field" style="margin-top:8px;">
        <label>Observação sobre o histórico (opcional)</label>
        <input type="text" id="r-entry-note" value="${Utils.escapeHtml(anamnesis?.entryNote || '')}" placeholder="Ex: corredor há 5 anos; treinou musculação até 2023…">
      </div>
    </div>

    <div class="mp-form-actions" style="margin-top:14px;">
      <button type="button" class="mp-btn mp-btn-gold" id="r-anam-save" style="background:var(--verde-principal);color:#fff;">Salvar triagem e anamnese</button>
    </div>
  </div>
  `;
}

function anamBindEvents(container) {
  const student = currentStudent();
  if (!student) return;

  const state = { ...(student.anamnesis?.answers || {}) };
  Object.entries(student.anamnesis?.parq?.answers || {}).forEach(([k, v]) => { state[PARQ_PREFIX + k] = v; });

  function refreshParqSuggestion() {
    const box = container.querySelector('#parq-suggestion');
    if (!box) return;
    const suggestion = parqSuggestion(state);
    if (!suggestion) { box.innerHTML = ''; return; }
    box.innerHTML = suggestion === 'pendente'
      ? '<span class="mp-pill mp-pill-alto">Sugestão: pendente de atestado médico (houve resposta Sim nas perguntas 1 a 7)</span>'
      : '<span class="mp-pill mp-pill-leve">Sugestão: liberado (todas as respostas Não nas perguntas 1 a 7)</span>';
    const select = container.querySelector('#parq-result');
    if (select && !select.dataset.touched && !select.value) select.value = suggestion;
  }
  container.querySelector('#parq-result')?.addEventListener('change', (e) => { e.target.dataset.touched = '1'; });

  const entry = { profile: student.anamnesis?.entryProfile || null };
  container.querySelectorAll('[data-entry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      entry.profile = btn.dataset.entry;
      container.querySelectorAll('[data-entry]').forEach((b) => b.classList.toggle('mp-yesno-btn--active-yes', b === btn));
      const pauseWrap = container.querySelector('#entry-pause-wrap');
      if (pauseWrap) pauseWrap.style.display = entry.profile === 'destreinado' ? '' : 'none';
    });
  });

  container.querySelectorAll('.mp-yesno-btn[data-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const value = btn.dataset.value === 'yes';
      state[key] = value;
      const wrap = container.querySelector(`.mp-yesno[data-key="${key}"]`);
      wrap.querySelectorAll('.mp-yesno-btn').forEach((b) => {
        b.classList.remove('mp-yesno-btn--active-yes', 'mp-yesno-btn--active-no');
      });
      btn.classList.add(value ? 'mp-yesno-btn--active-yes' : 'mp-yesno-btn--active-no');

      const followup = container.querySelector(`#followup-${key}`);
      if (followup) followup.style.display = value ? '' : 'none';
      if (key.startsWith(PARQ_PREFIX)) refreshParqSuggestion();
    });
  });
  refreshParqSuggestion();

  container.querySelector('#r-anam-save').addEventListener('click', async () => {
    const missingParq = PARQ_QUESTIONS.some((q) => state[PARQ_PREFIX + q.key] === undefined);
    const missing = ANAMNESE_QUESTIONS.some((q) => state[q.key] === undefined);
    if (missingParq || missing) {
      Utils.toast('Responda todas as perguntas Sim/Não antes de salvar.', 'error');
      return;
    }
    const parqResult = container.querySelector('#parq-result')?.value || '';
    if (!parqResult) {
      Utils.toast('Selecione o resultado da triagem PAR-Q.', 'error');
      return;
    }
    const parqAnswers = {};
    const answers = {};
    Object.entries(state).forEach(([k, v]) => {
      if (k.startsWith(PARQ_PREFIX)) parqAnswers[k.slice(PARQ_PREFIX.length)] = v;
      else answers[k] = v;
    });
    const previousParq = student.anamnesis?.parq || null;
    const parqNotes = container.querySelector('#parq-notes')?.value.trim() || '';
    const parqChanged = !previousParq
      || JSON.stringify(previousParq.answers) !== JSON.stringify(parqAnswers)
      || previousParq.result !== parqResult
      || (previousParq.notes || '') !== parqNotes;
    const anamnesis = {
      filledAt: Utils.todayISO(),
      answers,
      medicationsList: container.querySelector('#r-medications')?.value.trim() || '',
      sedentaryTime: container.querySelector('#r-sedentary-time').value.trim(),
      entryProfile: entry.profile,
      pauseMonths: entry.profile === 'destreinado' ? (parseInt(container.querySelector('#r-pause-months').value, 10) || null) : null,
      entryNote: container.querySelector('#r-entry-note').value.trim(),
      // A data da triagem só muda quando algo da triagem muda (a validade de 12 meses conta dela).
      parq: {
        answers: parqAnswers,
        result: parqResult,
        notes: parqNotes,
        date: parqChanged ? Utils.todayISO() : previousParq.date,
      },
    };
    await updateCurrentStudent({ anamnesis });
    if (typeof invalidateAdminData === 'function') invalidateAdminData();
    Utils.toast('Triagem e anamnese salvas ✓', 'success');
    render();
  });
}

window.AnamnesisView = { renderHtml: anamRenderHtml, bindEvents: anamBindEvents };
window.ParqTriage = { status: parqStatus, resultLabel: parqResultLabel };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['anamnesis.js'] = 'v1.15.0';
