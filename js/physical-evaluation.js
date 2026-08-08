// Aba: Avaliação Física — antropometria, IMC (Lipschitz/OMS) e bioimpedância.
// Múltiplos registros por aluno ao longo do tempo (mesmo padrão de Avaliação Funcional).

const BIOIMPEDANCE_FIELDS = [
  { key: 'bodyFatPercent', label: 'Percentual de gordura corporal', unit: '%' },
  { key: 'leanMassPercent', label: 'Percentual de massa magra', unit: '%' },
  { key: 'basalMetabolism', label: 'Metabolismo basal', unit: 'kcal' },
  { key: 'bodyAge', label: 'Idade corporal', unit: 'anos' },
  { key: 'visceralFat', label: 'Gordura visceral', unit: '' },
];

// Uma entrada por métrica com gráfico de evolução individual (peso + bioimpedância + circunferências).
const PE_METRICS = [
  { key: 'weight', label: 'Peso (kg)', getValue: (r) => r.weight },
  { key: 'bodyFatPercent', label: 'Gordura corporal (%)', getValue: (r) => r.bodyFatPercent },
  { key: 'leanMassPercent', label: 'Massa magra (%)', getValue: (r) => r.leanMassPercent },
  { key: 'basalMetabolism', label: 'Metabolismo basal (kcal)', getValue: (r) => r.basalMetabolism },
  { key: 'bodyAge', label: 'Idade corporal (anos)', getValue: (r) => r.bodyAge },
  { key: 'visceralFat', label: 'Gordura visceral', getValue: (r) => r.visceralFat },
  ...CIRCUMFERENCE_FIELDS.map((f) => ({ key: 'circ_' + f.key, label: f.label + ' (cm)', getValue: (r) => r.circumferences?.[f.key] })),
];

function computeImcResult(weight, height, age) {
  if (!weight || !height) return null;
  const heightM = height / 100;
  const imc = weight / (heightM * heightM);
  const classification = classifyImc(imc, age);
  return { imc: Math.round(imc * 10) / 10, ...classification };
}

function metricPoints(list, metric) {
  return list
    .filter((r) => metric.getValue(r) != null)
    .map((r) => ({ label: Utils.formatDateBR(r.date).slice(0, 5), value: metric.getValue(r) }));
}

function peRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const today = Utils.todayISO();
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;
  const list = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
  const listDesc = [...list].sort((a, b) => b.date.localeCompare(a.date));

  const rows = listDesc.map((rec) => {
    const imcResult = computeImcResult(rec.weight, rec.height, rec.age);
    return `
      <tr>
        <td>${Utils.formatDateBR(rec.date)}</td>
        <td>${rec.weight ?? '—'} kg</td>
        <td>${imcResult ? imcResult.imc : '—'}</td>
        <td>${imcResult ? Utils.escapeHtml(imcResult.label) : '—'}</td>
        <td>${rec.bodyFatPercent ?? '—'}${rec.bodyFatPercent != null ? '%' : ''}</td>
        <td>
          <button class="mp-btn mp-btn-ghost mp-btn-sm" data-print-eval="${rec.id}" type="button">🖨 Comparar c/ anterior</button>
          <button class="mp-btn-danger" data-del-eval="${rec.id}" type="button">Excluir</button>
        </td>
      </tr>`;
  }).join('');

  const availableMetrics = PE_METRICS.filter((m) => metricPoints(list, m).length >= 2);

  return `
  <div class="mp-card">
    <h3>Nova avaliação física</h3>
    <div class="mp-sub" style="margin-top:10px;">Antropometria e composição corporal — repita a cada ciclo (ex: 3 em 3 meses) para acompanhar a evolução.</div>
    <form id="mp-pe-form">
      <div class="mp-form-row" style="grid-template-columns:1fr 1.4fr 1fr 1fr;">
        <div class="mp-field"><label>Data da avaliação</label><input type="date" id="pe-date" value="${today}"></div>
        <div class="mp-field"><label>Nome do aluno</label><input value="${Utils.escapeHtml(student.name)}" disabled></div>
        <div class="mp-field"><label>Idade</label><input value="${age != null ? age + ' anos' : '—'}" disabled></div>
        <div class="mp-field"><label>Sexo</label><input value="${student.sex === 'F' ? 'Feminino' : 'Masculino'}" disabled></div>
      </div>
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Peso (kg)</label><input type="number" min="0" step="0.1" id="pe-weight"></div>
        <div class="mp-field"><label>Altura (cm)</label><input type="number" min="0" step="0.5" id="pe-height"></div>
      </div>
      <div id="pe-imc-preview"></div>

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Bioimpedância</h4>
      <div class="mp-form-row" style="grid-template-columns:repeat(5,1fr);">
        ${BIOIMPEDANCE_FIELDS.map((f) => `
          <div class="mp-field"><label>${Utils.escapeHtml(f.label)}</label><input type="number" step="0.1" id="pe-${f.key}"><small style="color:var(--texto-suave);">${f.unit}</small></div>
        `).join('')}
      </div>

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Circunferências (cm)</h4>
      <div class="mp-form-row" style="grid-template-columns:repeat(4,1fr);">
        ${CIRCUMFERENCE_FIELDS.map((f) => `
          <div class="mp-field"><label>${Utils.escapeHtml(f.label)}</label><input type="number" min="0" step="0.1" id="pe-circ-${f.key}"></div>
        `).join('')}
      </div>

      <div class="mp-form-actions" style="margin-top:14px;">
        <button type="button" id="pe-save" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar avaliação</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h3 style="margin-bottom:0;">Evolução por métrica</h3>
      <button type="button" id="pe-report-btn" class="mp-btn mp-btn-outline" style="color:var(--verde-principal);border-color:var(--verde-suave);">📄 Baixar relatório</button>
    </div>
    <div class="mp-sub" style="margin-top:10px;">${availableMetrics.length ? 'Um gráfico por métrica, com pelo menos 2 avaliações registradas.' : 'Registre pelo menos 2 avaliações para ver os gráficos de evolução.'}</div>
    ${availableMetrics.length ? `
    <div class="mp-metric-grid">
      ${availableMetrics.map((m) => `
        <div>
          <div class="mp-sub" style="margin:0 0 6px;font-weight:700;">${Utils.escapeHtml(m.label)}</div>
          <div class="mp-chart-box" id="pe-chart-${m.key}"></div>
        </div>
      `).join('')}
    </div>` : ''}
  </div>

  ${listDesc.length ? `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de avaliações</h3>
    <div style="overflow-x:auto;">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Peso</th><th>IMC</th><th>Classificação</th><th>% Gordura</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </div>` : ''}

  <div id="mp-print-area" class="mp-print-only"></div>
  `;
}

function pePrintHtml(student, current, previous) {
  const curImc = computeImcResult(current.weight, current.height, current.age);
  const prevImc = previous ? computeImcResult(previous.weight, previous.height, previous.age) : null;

  const rowsData = [
    ['Peso (kg)', current.weight, previous?.weight],
    ['Altura (cm)', current.height, previous?.height],
    ['IMC', curImc?.imc, prevImc?.imc],
    ['Classificação IMC', curImc?.label, prevImc?.label],
    ...BIOIMPEDANCE_FIELDS.map((f) => [f.label, current[f.key], previous?.[f.key]]),
    ...CIRCUMFERENCE_FIELDS.map((f) => [f.label, current.circumferences?.[f.key], previous?.circumferences?.[f.key]]),
  ];

  const rowsHtml = rowsData.map(([label, cur, prev]) => {
    let delta = '';
    if (typeof cur === 'number' && typeof prev === 'number') {
      const diff = Math.round((cur - prev) * 100) / 100;
      delta = diff > 0 ? `+${diff}` : `${diff}`;
    }
    return `<tr><td>${Utils.escapeHtml(label)}</td><td>${prev ?? '—'}</td><td>${cur ?? '—'}</td><td>${delta}</td></tr>`;
  }).join('');

  return `
    <h2 style="font-family:Georgia,serif;">Método Pleno — Avaliação Física</h2>
    <div>Aluno: ${Utils.escapeHtml(student.name)} &nbsp;·&nbsp; Data: ${Utils.formatDateBR(current.date)}${previous ? ` &nbsp;·&nbsp; Anterior: ${Utils.formatDateBR(previous.date)}` : ''}</div>
    <table class="mp-print-table">
      <thead><tr><th>Medida</th><th>${previous ? 'Anterior' : ''}</th><th>Atual</th><th>${previous ? 'Diferença' : ''}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

// Monta o relatório visual completo (todas as métricas com gráfico de evolução) dentro
// de #mp-print-area e aciona a impressão/"Salvar como PDF" do navegador.
function peBuildAndPrintReport(printArea, student, list) {
  const availableMetrics = PE_METRICS.filter((m) => metricPoints(list, m).length >= 2);
  if (!availableMetrics.length) {
    Utils.toast('Registre pelo menos 2 avaliações para gerar o relatório.', 'error');
    return;
  }

  printArea.innerHTML = '';
  printArea.appendChild(Utils.el(`
    <div class="mp-report-header">
      <h2 style="font-family:Georgia,serif;margin-bottom:2px;">Método Pleno — Relatório de Evolução Física</h2>
      <div style="color:#555;">Aluno: ${Utils.escapeHtml(student.name)} &nbsp;·&nbsp; Gerado em ${Utils.formatDateBR(Utils.todayISO())} &nbsp;·&nbsp; ${list.length} avaliação(ões) registrada(s)</div>
    </div>
  `));

  availableMetrics.forEach((m) => {
    const section = Utils.el(`<div class="mp-report-section"><h3 style="font-family:Georgia,serif;font-size:15px;margin-bottom:6px;">${Utils.escapeHtml(m.label)}</h3></div>`);
    const points = metricPoints(list, m);
    const chart = Charts.lineChart(points, { color: Charts.COLORS.verdePrincipal, pointColor: Charts.COLORS.dourado, width: 680, height: 190 });
    if (chart) section.appendChild(chart);
    printArea.appendChild(section);
  });

  window.print();
}

function peBindEvents(container) {
  const student = currentStudent();
  if (!student) return;
  const today = Utils.todayISO();
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;

  function recomputePreview() {
    const weight = Number(container.querySelector('#pe-weight').value) || 0;
    const height = Number(container.querySelector('#pe-height').value) || 0;
    const result = computeImcResult(weight, height, age ?? 0);
    const el = container.querySelector('#pe-imc-preview');
    el.innerHTML = result ? `
      <div class="index-gauge" style="display:flex;align-items:center;gap:14px;margin:6px 0 4px;">
        <div style="font-family:'Fraunces',serif;font-weight:600;font-size:26px;color:var(--verde-principal);">${result.imc}</div>
        <div>
          <div style="font-size:12px;color:var(--texto-suave);">IMC (${result.reference})</div>
          <span class="mp-pill mp-pill-${result.label.includes('Normal') || result.label.includes('Eutrófico') ? 'leve' : (result.label.includes('Baixo') ? 'moderado' : 'alto')}">${Utils.escapeHtml(result.label)}</span>
        </div>
      </div>` : '';
  }
  container.querySelector('#pe-weight')?.addEventListener('input', recomputePreview);
  container.querySelector('#pe-height')?.addEventListener('input', recomputePreview);
  recomputePreview();

  container.querySelector('#pe-save')?.addEventListener('click', async () => {
    const weight = Number(container.querySelector('#pe-weight').value) || null;
    const height = Number(container.querySelector('#pe-height').value) || null;
    if (!weight || !height) { Utils.toast('Preencha peso e altura.', 'error'); return; }

    const circumferences = {};
    CIRCUMFERENCE_FIELDS.forEach((f) => {
      const v = container.querySelector(`#pe-circ-${f.key}`).value;
      circumferences[f.key] = v === '' ? null : Number(v);
    });

    const record = {
      id: dbUuid(),
      studentId: AppState.currentId,
      date: container.querySelector('#pe-date').value || today,
      age: age ?? null,
      sex: student.sex,
      weight,
      height,
      circumferences,
      createdAt: new Date().toISOString(),
    };
    BIOIMPEDANCE_FIELDS.forEach((f) => {
      const v = container.querySelector(`#pe-${f.key}`).value;
      record[f.key] = v === '' ? null : Number(v);
    });

    AppState.data.physicalEvaluations.push(record);
    render();
    Utils.toast('Avaliação física salva ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.physicalEvaluations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-del-eval]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir esta avaliação física?');
      if (!ok) return;
      AppState.data.physicalEvaluations = AppState.data.physicalEvaluations.filter((r) => r.id !== btn.dataset.delEval);
      render();
      await DB.delete(DB.STORES.physicalEvaluations, btn.dataset.delEval);
    });
  });

  container.querySelectorAll('[data-print-eval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sorted = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
      const idx = sorted.findIndex((r) => r.id === btn.dataset.printEval);
      const current = sorted[idx];
      const previous = idx > 0 ? sorted[idx - 1] : null;
      container.querySelector('#mp-print-area').innerHTML = pePrintHtml(student, current, previous);
      window.print();
    });
  });

  container.querySelector('#pe-report-btn')?.addEventListener('click', () => {
    const sorted = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
    peBuildAndPrintReport(container.querySelector('#mp-print-area'), student, sorted);
  });
}

function peAfterRender(container) {
  const list = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
  PE_METRICS.forEach((m) => {
    const target = container.querySelector(`#pe-chart-${m.key}`);
    if (!target) return; // métrica sem dados suficientes — nem renderizada no HTML
    const points = metricPoints(list, m);
    target.innerHTML = '';
    target.appendChild(Charts.lineChart(points, { color: Charts.COLORS.verdePrincipal, pointColor: Charts.COLORS.dourado, height: 170 }));
  });
}

window.PhysicalEvaluationView = { renderHtml: peRenderHtml, bindEvents: peBindEvents, afterRender: peAfterRender };
