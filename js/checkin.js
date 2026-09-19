// Check-in pré-aula — 3 perguntas rápidas (sono, dor, disposição) + "sinal de alerta".
// Objetivo: o personal enxergar em 10 segundos como o aluno chega hoje e ajustar a sessão.
// Um registro por aluno+data (editável no mesmo dia). Tudo local, como o resto do app.
//
// As regras abaixo são um "motor de regras" simples e transparente: a sugestão sempre mostra
// o motivo, e quem decide é o profissional. Os limites são valores práticos de partida
// (heurísticas de monitoramento subjetivo), não diagnósticos.

const CHECKIN_QUESTIONS = [
  { key: 'sono', label: 'Como foi o sono esta noite?', options: ['Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'] },
  { key: 'dor', label: 'Sente alguma dor hoje?', options: ['Nenhuma', 'Leve', 'Moderada', 'Forte', 'Muito forte'] },
  { key: 'disposicao', label: 'Como está a disposição?', options: ['Exausto', 'Cansado', 'Normal', 'Bem', 'Muito bem'] },
];

const CHECKIN_LEVELS = {
  verde: { label: 'Verde', pill: 'mp-pill-leve' },
  amarelo: { label: 'Amarelo', pill: 'mp-pill-moderado' },
  vermelho: { label: 'Vermelho', pill: 'mp-pill-alto' },
};

// Métricas do gráfico do Dashboard.
const CHECKIN_METRICS = [
  { key: 'readiness', label: 'Índice de prontidão (0–100)', yMin: 0, yMax: 100 },
  { key: 'sono', label: 'Sono (1 péssimo … 5 ótimo)', yMin: 1, yMax: 5 },
  { key: 'dor', label: 'Dor (1 nenhuma … 5 muito forte)', yMin: 1, yMax: 5 },
  { key: 'disposicao', label: 'Disposição (1 exausto … 5 muito bem)', yMin: 1, yMax: 5 },
];

function ckOptionLabel(key, value) {
  const q = CHECKIN_QUESTIONS.find((x) => x.key === key);
  return q && value != null ? q.options[value - 1] : '—';
}

// Índice de prontidão 0–100: média de sono, disposição e "ausência de dor" (5 − dor).
// Devolve também o semáforo e a sugestão de ajuste da sessão.
function evaluateCheckin(c) {
  const readiness = Math.round((((c.sono - 1) + (c.disposicao - 1) + (5 - c.dor)) / 12) * 100);

  if (c.alertSign) {
    return { level: 'vermelho', readiness, advice: 'Sinal de alerta marcado (ex.: dor no peito, tontura, falta de ar incomum). Não inicie o treino; oriente avaliação médica antes de continuar.' };
  }
  if (c.dor >= 4) {
    return { level: 'vermelho', readiness, advice: 'Dor forte hoje. Faça sessão leve (mobilidade e equilíbrio, Borg até 4), poupe a região dolorida e evite esforço máximo. Se a dor for nova ou persistente, sugira avaliação de um profissional de saúde.' };
  }
  if (c.sono <= 2 && c.disposicao <= 2) {
    return { level: 'vermelho', readiness, advice: 'Sono ruim e pouca disposição juntos. Sessão leve (Borg até 4), sem esforço máximo e sem levar séries à falha.' };
  }
  if (readiness < 30) {
    return { level: 'vermelho', readiness, advice: 'Prontidão muito baixa hoje. Sessão leve (Borg até 4) e sem esforço máximo.' };
  }

  const parts = [];
  if (c.dor === 3) parts.push('dor moderada: poupe a região e observe a dor durante a execução');
  if (c.sono <= 2 || c.disposicao <= 2) parts.push('sono ou disposição baixos: reduza o volume (ex.: uma série a menos por exercício) e limite o Borg a 6');
  if (!parts.length && readiness < 50) parts.push('prontidão abaixo do habitual: reduza um pouco o volume e limite o Borg a 6');
  if (parts.length) {
    return { level: 'amarelo', readiness, advice: 'Atenção — ' + parts.join('; ') + '.' };
  }
  return { level: 'verde', readiness, advice: 'Tudo em ordem: sessão conforme o planejado.' };
}

// ---------- Cartão do Registro de Treino ----------

let ckDraft = null;     // rascunho do check-in em edição
let ckEditKey = null;   // aluno+data cujo check-in salvo está aberto para edição

function ckKey(date) { return `${AppState.currentId}__${date}`; }

function getCheckin(date) {
  return AppState.data.checkins.find((c) => c.date === date) || null;
}

function ckEnsureDraft(date) {
  const key = ckKey(date);
  if (!ckDraft || ckDraft.key !== key) {
    const saved = getCheckin(date);
    ckDraft = {
      key,
      sono: saved ? saved.sono : null,
      dor: saved ? saved.dor : null,
      disposicao: saved ? saved.disposicao : null,
      painLocation: saved ? (saved.painLocation || '') : '',
      alertSign: saved ? !!saved.alertSign : false,
    };
  }
  return ckDraft;
}

// Valor "ruim" da escala (fica vermelho quando selecionado): dor a partir de "Moderada",
// sono/disposição até "Ruim"/"Cansado".
function ckActiveClass(q, v) {
  const bad = q === 'dor' ? v >= 3 : v <= 2;
  return bad ? 'mp-yesno-btn--active-no' : 'mp-yesno-btn--active-yes';
}

function ckResultHtml(c) {
  const r = evaluateCheckin(c);
  const lv = CHECKIN_LEVELS[r.level];
  const box = r.level === 'vermelho'
    ? 'class="mp-inline-alert mp-inline-alert-alto"'
    : (r.level === 'amarelo'
      ? 'class="mp-inline-alert mp-inline-alert-moderado"'
      : 'class="mp-inline-alert" style="background:var(--verde-pallido);color:var(--verde-principal);border-color:rgba(31,61,48,.2);"');
  return `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0 8px;">
      <span class="mp-pill ${lv.pill}">Semáforo: ${lv.label}</span>
      <span class="mp-pill mp-pill-neutro">Prontidão ${r.readiness}/100</span>
    </div>
    <div ${box}>${Utils.escapeHtml(r.advice)}</div>
    <div class="mp-sub" style="margin:8px 0 0;font-size:11.5px;">Sugestão automática por regras simples — a decisão final é do profissional.</div>`;
}

function checkinCardHtml(date) {
  const saved = getCheckin(date);
  const editing = ckEditKey === ckKey(date);

  if (saved && !editing) {
    return `
    <div class="mp-card" style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <h3 style="margin-bottom:0;">Check-in de hoje</h3>
        <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="ck-edit">Editar check-in</button>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <span class="mp-pill mp-pill-neutro">Sono: ${Utils.escapeHtml(ckOptionLabel('sono', saved.sono))}</span>
        <span class="mp-pill mp-pill-neutro">Dor: ${Utils.escapeHtml(ckOptionLabel('dor', saved.dor))}${saved.painLocation ? ' — ' + Utils.escapeHtml(saved.painLocation) : ''}</span>
        <span class="mp-pill mp-pill-neutro">Disposição: ${Utils.escapeHtml(ckOptionLabel('disposicao', saved.disposicao))}</span>
        ${saved.alertSign ? '<span class="mp-pill mp-pill-alto">⚠ Sinal de alerta</span>' : ''}
      </div>
      ${ckResultHtml(saved)}
    </div>`;
  }

  const draft = ckEnsureDraft(date);
  const questionsHtml = CHECKIN_QUESTIONS.map((q) => `
    <div class="mp-field" style="margin-bottom:12px;">
      <label>${Utils.escapeHtml(q.label)}</label>
      <div class="mp-yesno">
        ${q.options.map((opt, i) => {
          const v = i + 1;
          const active = draft[q.key] === v ? ckActiveClass(q.key, v) : '';
          return `<button type="button" class="mp-yesno-btn ${active}" style="min-width:0;flex:1 1 90px;padding:7px 6px;" data-ck-q="${q.key}" data-ck-v="${v}">${Utils.escapeHtml(opt)}</button>`;
        }).join('')}
      </div>
    </div>`).join('');

  return `
    <div class="mp-card" style="margin-bottom:20px;">
      <h3>Check-in pré-aula</h3>
      <div class="mp-sub">Três perguntas rápidas antes de começar — o app sugere como ajustar a sessão de hoje (${Utils.formatDateBR(date)}).</div>
      ${questionsHtml}
      <div class="mp-field" id="ck-dor-local-wrap" style="${draft.dor != null && draft.dor >= 2 ? '' : 'display:none;'}margin-bottom:12px;">
        <label>Onde dói? (opcional)</label>
        <input type="text" id="ck-dor-local" placeholder="Ex: joelho direito, lombar…" value="${Utils.escapeHtml(draft.painLocation)}">
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600;color:var(--texto);cursor:pointer;">
        <input type="checkbox" id="ck-alert" style="margin-top:3px;width:auto;" ${draft.alertSign ? 'checked' : ''}>
        <span>⚠ Sinal de alerta hoje (dor no peito, tontura, falta de ar incomum ou mal-estar)</span>
      </label>
      <div class="mp-form-actions" style="margin-top:14px;">
        ${saved ? '<button type="button" class="mp-btn mp-btn-ghost" id="ck-cancel">Cancelar</button>' : ''}
        <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="ck-save">Salvar check-in</button>
      </div>
    </div>`;
}

function checkinBindEvents(container, date) {
  const editBtn = container.querySelector('#ck-edit');
  if (editBtn) editBtn.addEventListener('click', () => { ckEditKey = ckKey(date); ckDraft = null; render(); });

  const cancelBtn = container.querySelector('#ck-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { ckEditKey = null; ckDraft = null; render(); });

  const saveBtn = container.querySelector('#ck-save');
  if (!saveBtn) return;
  const draft = ckEnsureDraft(date);
  const localWrap = container.querySelector('#ck-dor-local-wrap');

  container.querySelectorAll('[data-ck-q]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.ckQ;
      const v = parseInt(btn.dataset.ckV, 10);
      draft[q] = v;
      container.querySelectorAll(`[data-ck-q="${q}"]`).forEach((b) => {
        b.classList.remove('mp-yesno-btn--active-yes', 'mp-yesno-btn--active-no');
        if (parseInt(b.dataset.ckV, 10) === v) b.classList.add(ckActiveClass(q, v));
      });
      if (q === 'dor' && localWrap) localWrap.style.display = v >= 2 ? '' : 'none';
    });
  });

  const localInput = container.querySelector('#ck-dor-local');
  if (localInput) localInput.addEventListener('input', () => { draft.painLocation = localInput.value; });
  const alertInput = container.querySelector('#ck-alert');
  if (alertInput) alertInput.addEventListener('change', () => { draft.alertSign = alertInput.checked; });

  saveBtn.addEventListener('click', async () => {
    if (draft.sono == null || draft.dor == null || draft.disposicao == null) {
      Utils.toast('Responda as 3 perguntas para salvar o check-in.', 'error');
      return;
    }
    const record = {
      id: ckKey(date),
      studentId: AppState.currentId,
      date,
      sono: draft.sono,
      dor: draft.dor,
      disposicao: draft.disposicao,
      painLocation: draft.dor >= 2 ? (draft.painLocation || '').trim() : '',
      alertSign: !!draft.alertSign,
      ts: Date.now(),
    };
    const result = evaluateCheckin(record);
    record.readiness = result.readiness;
    record.level = result.level;

    AppState.data.checkins = AppState.data.checkins.filter((c) => c.date !== date);
    AppState.data.checkins.push(record);
    ckEditKey = null;
    ckDraft = null;
    render();
    Utils.toast('Check-in salvo ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.checkins, record);
    if (!ok) render();
  });
}

// ---------- Cartão do Dashboard ----------

function checkinDashboardHtml() {
  const list = [...AppState.data.checkins].sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) {
    return `
  <div class="mp-card" style="margin-bottom:20px;">
    <h3>Check-in pré-aula</h3>
    <div class="mp-sub" style="margin:0;padding:24px 0;text-align:center;">Ainda não há check-ins. Registre o check-in no início da aula, na aba "Registro de Treino", para acompanhar sono, dor e disposição aqui.</div>
  </div>`;
  }

  const counts = { verde: 0, amarelo: 0, vermelho: 0 };
  list.forEach((c) => { counts[evaluateCheckin(c).level] += 1; });

  const metricOptions = CHECKIN_METRICS.map((m) => `<option value="${m.key}">${Utils.escapeHtml(m.label)}</option>`).join('');
  const rows = [...list].reverse().slice(0, 8).map((c) => {
    const r = evaluateCheckin(c);
    const borg = computeDailyBorg(AppState.data.sessions, AppState.data.dailyMeta, c.date);
    return `
      <tr>
        <td>${Utils.formatDateBR(c.date)}</td>
        <td>${Utils.escapeHtml(ckOptionLabel('sono', c.sono))} (${c.sono})</td>
        <td>${Utils.escapeHtml(ckOptionLabel('dor', c.dor))} (${c.dor})</td>
        <td>${Utils.escapeHtml(ckOptionLabel('disposicao', c.disposicao))} (${c.disposicao})</td>
        <td>${r.readiness}</td>
        <td><span class="mp-pill ${CHECKIN_LEVELS[r.level].pill}">${CHECKIN_LEVELS[r.level].label}</span></td>
        <td>${borg != null ? Math.round(borg * 10) / 10 : '—'}</td>
      </tr>`;
  }).join('');

  return `
  <div class="mp-card" style="margin-bottom:20px;">
    <h3>Check-in pré-aula</h3>
    <div class="mp-sub">Como o aluno chega às aulas: sono, dor e disposição (escala de 1 a 5) e o índice de prontidão (0–100).</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <span class="mp-pill mp-pill-neutro">${list.length} check-in(s)</span>
      <span class="mp-pill mp-pill-leve">${counts.verde} verde(s)</span>
      <span class="mp-pill mp-pill-moderado">${counts.amarelo} amarelo(s)</span>
      <span class="mp-pill mp-pill-alto">${counts.vermelho} vermelho(s)</span>
    </div>
    <select class="mp-select-inline" id="mp-ck-metric" style="margin-bottom:14px;">${metricOptions}</select>
    <div class="mp-chart-box" id="mp-chart-checkin"></div>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Últimos check-ins e Borg do dia</h4>
    <div class="mp-table-scroll">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Sono</th><th>Dor</th><th>Disposição</th><th>Prontidão</th><th>Semáforo</th><th>Borg do dia</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </div>`;
}

function checkinDashboardDraw(container) {
  const target = container.querySelector('#mp-chart-checkin');
  const select = container.querySelector('#mp-ck-metric');
  if (!target || !select) return;
  const metric = CHECKIN_METRICS.find((m) => m.key === select.value) || CHECKIN_METRICS[0];
  target.innerHTML = '';
  const points = [...AppState.data.checkins]
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((c) => c[metric.key] != null)
    .map((c) => ({ label: Utils.formatDateBR(c.date).slice(0, 5), value: c[metric.key] }));
  if (!points.length) {
    target.innerHTML = '<div class="mp-sub" style="margin:0;padding:30px 0;text-align:center;">Sem dados para esta métrica.</div>';
    return;
  }
  target.appendChild(Charts.lineChart(points, { color: Charts.COLORS.verdeSuave, pointColor: Charts.COLORS.dourado, yMin: metric.yMin, yMax: metric.yMax }));
}

function checkinDashboardBind(container) {
  const select = container.querySelector('#mp-ck-metric');
  if (select) select.addEventListener('change', () => checkinDashboardDraw(container));
}

window.CheckinLogic = { evaluate: evaluateCheckin, QUESTIONS: CHECKIN_QUESTIONS, LEVELS: CHECKIN_LEVELS, optionLabel: ckOptionLabel };
window.CheckinView = {
  cardHtml: checkinCardHtml,
  bindEvents: checkinBindEvents,
  dashboardHtml: checkinDashboardHtml,
  dashboardDraw: checkinDashboardDraw,
  dashboardBind: checkinDashboardBind,
};
window.getCheckin = getCheckin;
