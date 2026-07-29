// Aba: Avaliação Funcional — Senior Fitness Test (Rikli & Jones) adaptado 55+.
// Calculadora completa dos 5 testes com tabelas normativas (evaluation-data.js),
// com o visual (af-band, tabela, gráfico) no padrão do protótipo do Método Pleno.

const TEST_FIELDS = [
  { key: 'sitToStand', label: 'Levantar e Sentar na Cadeira', unit: 'repetições / 30s' },
  { key: 'armCurl', label: 'Flexão de Antebraço', unit: 'repetições / 30s' },
  { key: 'chairSitReach', label: 'Sentar e Alcançar o Pé na Cadeira', unit: 'cm (pode ser negativo)' },
  { key: 'tug', label: 'TUG — Timed Up and Go', unit: 'segundos (menor é melhor)' },
  { key: 'unipodalStance', label: 'Apoio Unipodal', unit: 'segundos' },
];

function classificacaoIndice(idx) {
  return SFT.INDEX_CLASSIFICATION.find((c) => idx <= c.max).label;
}

function resultRowHtml(field, testResult) {
  if (!testResult) {
    return `<tr><td>${Utils.escapeHtml(field.label)}</td><td colspan="5" style="color:var(--texto-suave);">— preencha o valor —</td></tr>`;
  }
  const pillClass = testResult.score >= 3 ? 'mp-pill-leve' : testResult.score === 2 ? 'mp-pill-moderado' : 'mp-pill-alto';
  return `
    <tr>
      <td>${Utils.escapeHtml(field.label)}</td>
      <td>${testResult.value}</td>
      <td>${testResult.p25 ?? '—'}</td>
      <td>${testResult.p50 ?? '—'}</td>
      <td>${testResult.p75 ?? '—'}</td>
      <td>${Utils.escapeHtml(testResult.label)}</td>
      <td><span class="mp-pill ${pillClass}">${testResult.score}</span></td>
    </tr>`;
}

function evalRenderHtml() {
  const student = currentStudent();
  const today = Utils.todayISO();
  const defaultAge = student?.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : '';
  const list = [...AppState.data.evaluations].sort((a, b) => b.date.localeCompare(a.date));

  const rows = list.map((rec) => {
    const assessment = SFT.computeFunctionalAssessment(rec.results, rec.age, rec.sex);
    return `
      <tr>
        <td>${Utils.formatDateBR(rec.date)}</td>
        <td style="font-weight:700;">${assessment.complete ? assessment.index : '—'}</td>
        <td>${Utils.escapeHtml(assessment.complete ? assessment.classification : 'incompleta')}</td>
        <td><button class="mp-btn-danger" data-del-assess="${rec.id}" type="button">Excluir</button></td>
      </tr>`;
  }).join('');

  return `
  <div class="mp-card">
    <h3>Nova avaliação funcional</h3>
    <div class="mp-sub">Senior Fitness Test (Rikli &amp; Jones) — preencha os 5 testes para gerar o Índice de Aptidão Funcional (0–100) automaticamente.</div>
    <div class="mp-af-band">
      <div style="background:var(--alerta);"></div><div style="background:var(--dourado-claro);"></div>
      <div style="background:var(--verde-pallido);"></div><div style="background:var(--verde-suave);"></div>
    </div>
    <div class="mp-af-labels"><span>0 · Frágil</span><span>25</span><span>50 · Adequado</span><span>75</span><span>100 · Ótimo</span></div>

    <form id="mp-assess-form">
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Data da avaliação</label><input type="date" id="mp-a-data" value="${today}"></div>
        <div class="mp-field"><label>Idade (anos)</label><input type="number" min="40" max="110" id="mp-a-idade" value="${defaultAge}"></div>
      </div>
      <div class="mp-field"><label>Sexo</label>
        <select id="mp-a-sexo">
          <option value="F" ${student?.sex === 'F' ? 'selected' : ''}>Feminino</option>
          <option value="M" ${student?.sex === 'M' ? 'selected' : ''}>Masculino</option>
        </select>
      </div>
      <div class="mp-form-row" style="grid-template-columns:repeat(5,1fr);">
        ${TEST_FIELDS.map((f) => `
          <div class="mp-field">
            <label>${Utils.escapeHtml(f.label)}</label>
            <input type="number" step="0.1" id="mp-a-${f.key}">
            <div class="mp-tag-input-hint">${f.unit}</div>
          </div>
        `).join('')}
      </div>
      <div id="mp-af-preview" style="margin-top:10px;"></div>
      <div class="mp-form-actions">
        <button type="button" id="mp-assess-submit" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar avaliação</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Evolução do Índice de Aptidão Funcional</h3>
    <div class="mp-chart-box" id="mp-chart-indice">${list.length < 2 ? '<div class="mp-sub" style="margin:0;padding:30px 0;text-align:center;">Registre pelo menos 2 avaliações completas para ver a evolução do índice.</div>' : ''}</div>
  </div>

  ${list.length ? `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de avaliações</h3>
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Índice</th><th>Classificação</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>` : ''}`;
}

function getFormResults(container) {
  const results = {};
  TEST_FIELDS.forEach((f) => {
    const v = container.querySelector(`#mp-a-${f.key}`).value;
    results[f.key] = v === '' ? null : Number(v);
  });
  return results;
}

function recomputePreview(container) {
  const age = Number(container.querySelector('#mp-a-idade').value) || 0;
  const sex = container.querySelector('#mp-a-sexo').value;
  const results = getFormResults(container);
  const assessment = SFT.computeFunctionalAssessment(results, age, sex);
  const previewEl = container.querySelector('#mp-af-preview');
  const rowsHtml = TEST_FIELDS.map((f) => resultRowHtml(f, assessment.perTest[f.key])).join('');
  previewEl.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="mp-table">
        <thead><tr><th>Teste</th><th>Resultado</th><th>P25</th><th>P50</th><th>P75</th><th>Classificação</th><th>Pontos</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div style="display:flex;align-items:center;gap:16px;margin-top:10px;">
      <div style="font-family:'Fraunces',serif;font-weight:600;font-size:30px;color:var(--verde-principal);">${assessment.complete ? assessment.index : '—'}</div>
      <div>
        <div style="font-size:12px;color:var(--texto-suave);">Índice de Aptidão Funcional (0–100)</div>
        <span class="mp-pill ${assessment.complete ? 'mp-pill-leve' : ''}" style="${assessment.complete ? '' : 'background:var(--borda);color:var(--texto-suave);'}">${assessment.complete ? assessment.classification : 'Preencha todos os testes'}</span>
      </div>
    </div>
  `;
  return assessment;
}

function drawIndiceChart(container) {
  const target = container.querySelector('#mp-chart-indice');
  if (!target) return;
  const list = [...AppState.data.evaluations].sort((a, b) => a.date.localeCompare(b.date));
  const points = list.map((rec) => {
    const assessment = SFT.computeFunctionalAssessment(rec.results, rec.age, rec.sex);
    return { label: Utils.formatDateBR(rec.date).slice(0, 5), value: assessment.complete ? assessment.index : null };
  }).filter((p) => p.value !== null);
  if (points.length < 2) return;
  target.innerHTML = '';
  target.appendChild(Charts.lineChart(points, { color: Charts.COLORS.dourado, pointColor: Charts.COLORS.verdePrincipal, yMin: 0, yMax: 100 }));
}

function evalAfterRender(container) {
  drawIndiceChart(container);
}

function evalBindEvents(container) {
  container.querySelectorAll('#mp-assess-form input, #mp-assess-form select').forEach((inp) => {
    inp.addEventListener('input', () => recomputePreview(container));
  });
  recomputePreview(container);

  const form = container.querySelector('#mp-assess-form');
  form.addEventListener('submit', (e) => e.preventDefault());

  container.querySelector('#mp-assess-submit').addEventListener('click', async () => {
    const age = Number(container.querySelector('#mp-a-idade').value) || 0;
    const sex = container.querySelector('#mp-a-sexo').value;
    const results = getFormResults(container);
    const filledCount = Object.values(results).filter((v) => v !== null).length;
    if (filledCount < TEST_FIELDS.length) {
      Utils.toast('Preencha os 5 testes para salvar a avaliação.', 'error');
      return;
    }
    const record = {
      id: dbUuid(),
      studentId: AppState.currentId,
      date: container.querySelector('#mp-a-data').value || Utils.todayISO(),
      age,
      sex,
      results,
      createdAt: new Date().toISOString(),
    };
    AppState.data.evaluations.push(record);
    render();
    Utils.toast('Avaliação salva ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.functionalEvaluations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-del-assess]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir esta avaliação funcional?');
      if (!ok) return;
      AppState.data.evaluations = AppState.data.evaluations.filter((a) => a.id !== btn.dataset.delAssess);
      render();
      await DB.delete(DB.STORES.functionalEvaluations, btn.dataset.delAssess);
    });
  });
}

window.EvaluationView = { renderHtml: evalRenderHtml, bindEvents: evalBindEvents, afterRender: evalAfterRender };
