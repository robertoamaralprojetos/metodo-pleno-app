// Aba: Anamnese — triagem de saúde (registro único por aluno, atualizável).
// Dado sensível (LGPD): fica salvo apenas no IndexedDB local do dispositivo,
// nunca é enviado a nenhum servidor — o app não faz nenhuma chamada de rede.

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
      <button type="button" class="mp-btn mp-btn-gold" id="r-anam-save" style="background:var(--verde-principal);color:#fff;">Salvar anamnese</button>
    </div>
  </div>
  `;
}

function anamBindEvents(container) {
  const student = currentStudent();
  if (!student) return;

  const state = { ...(student.anamnesis?.answers || {}) };

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
    });
  });

  container.querySelector('#r-anam-save').addEventListener('click', async () => {
    const missing = ANAMNESE_QUESTIONS.some((q) => state[q.key] === undefined);
    if (missing) {
      Utils.toast('Responda todas as perguntas Sim/Não antes de salvar.', 'error');
      return;
    }
    const anamnesis = {
      filledAt: Utils.todayISO(),
      answers: { ...state },
      medicationsList: container.querySelector('#r-medications')?.value.trim() || '',
      sedentaryTime: container.querySelector('#r-sedentary-time').value.trim(),
      entryProfile: entry.profile,
      pauseMonths: entry.profile === 'destreinado' ? (parseInt(container.querySelector('#r-pause-months').value, 10) || null) : null,
      entryNote: container.querySelector('#r-entry-note').value.trim(),
    };
    await updateCurrentStudent({ anamnesis });
    Utils.toast('Anamnese salva ✓', 'success');
    render();
  });
}

window.AnamnesisView = { renderHtml: anamRenderHtml, bindEvents: anamBindEvents };
