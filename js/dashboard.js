// Aba: Dashboard de Evolução — KPIs, evolução de carga, Borg médio mensal e trilha de evolução.

function monthKey(iso) { return iso.slice(0, 7); }

function dashRenderHtml() {
  const sessions = AppState.data.sessions;
  if (!sessions.length) {
    return `<div class="mp-empty"><h3>Ainda não há dados de treino</h3><p>Assim que você lançar sessões na aba "Registro de Treino", os gráficos de evolução aparecem aqui.</p></div>`;
  }
  const ex = exerciseList();
  const totalSessoes = sessions.length;
  const ultimaData = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  const primeiraData = [...sessions].sort((a, b) => a.date.localeCompare(b.date))[0].date;
  const mediaBorgGeral = (sessions.reduce((a, s) => a + s.borg, 0) / sessions.length).toFixed(1);

  const exOptions = ex.map((e) => `<option value="${Utils.escapeHtml(e)}">${Utils.escapeHtml(e)}</option>`).join('');

  return `
  <div class="mp-kpis">
    <div class="mp-kpi"><div class="mp-kpi-label">Sessões registradas</div><div class="mp-kpi-value">${totalSessoes}</div><div class="mp-kpi-note">desde ${Utils.formatDateBR(primeiraData)}</div></div>
    <div class="mp-kpi"><div class="mp-kpi-label">Última sessão</div><div class="mp-kpi-value" style="font-size:19px;">${Utils.formatDateBR(ultimaData)}</div></div>
    <div class="mp-kpi"><div class="mp-kpi-label">Borg médio geral</div><div class="mp-kpi-value">${mediaBorgGeral}</div><div class="mp-kpi-note">escala CR-10</div></div>
    <div class="mp-kpi"><div class="mp-kpi-label">Exercícios distintos</div><div class="mp-kpi-value">${ex.length}</div></div>
  </div>

  <div class="mp-grid2">
    <div class="mp-card">
      <h3>Evolução de carga por exercício</h3>
      <select class="mp-select-inline" id="mp-ex-select" style="margin-bottom:14px;">${exOptions}</select>
      <div class="mp-chart-box" id="mp-chart-carga"></div>
    </div>
    <div class="mp-card">
      <h3>Borg médio por período</h3>
      <div class="mp-sub">Média mensal da percepção de esforço (CR-10)</div>
      <div class="mp-chart-box" id="mp-chart-borg"></div>
    </div>
  </div>

  <div class="mp-card mp-trilha-card">
    <h3>Trilha de evolução</h3>
    <div class="mp-sub">Consistência de treino mês a mês, com os pontos de avaliação funcional marcados em dourado.</div>
    <div id="mp-trilha-wrap"></div>
    <div class="mp-trilha-legend">
      <span><span class="mp-legend-dot"></span> Mês com sessões de treino</span>
      <span><span class="mp-legend-diamond"></span> Avaliação funcional registrada</span>
    </div>
  </div>`;
}

function drawLoadChart(container, exerciseName) {
  const target = container.querySelector('#mp-chart-carga');
  if (!target) return;
  target.innerHTML = '';
  const points = AppState.data.sessions
    .filter((s) => s.exerciseName === exerciseName)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0))
    .map((s) => ({ label: Utils.formatDateBR(s.date).slice(0, 5), value: s.load }));
  if (points.length < 2) {
    target.innerHTML = '<div class="mp-sub" style="margin:0;padding:30px 0;text-align:center;">Registre este exercício em pelo menos 2 sessões para ver a evolução.</div>';
    return;
  }
  target.appendChild(Charts.lineChart(points, { color: Charts.COLORS.verdePrincipal, pointColor: Charts.COLORS.dourado }));
}

function drawBorgChart(container) {
  const target = container.querySelector('#mp-chart-borg');
  if (!target) return;
  target.innerHTML = '';
  const byMonth = {};
  AppState.data.sessions.forEach((s) => {
    const k = monthKey(s.date);
    if (!byMonth[k]) byMonth[k] = [];
    byMonth[k].push(s.borg);
  });
  const months = Object.keys(byMonth).sort();
  const bars = months.map((k) => {
    const avg = byMonth[k].reduce((a, b) => a + b, 0) / byMonth[k].length;
    const color = avg <= 3 ? Charts.COLORS.verdeSuave : (avg <= 6 ? Charts.COLORS.dourado : Charts.COLORS.alerta);
    return { label: Charts.monthLabelFromKey(k), value: Math.round(avg * 10) / 10, color };
  });
  target.appendChild(Charts.barChart(bars, { maxValueOverride: 10 }));
  return byMonth;
}

function drawTrilha(container, byMonth) {
  const target = container.querySelector('#mp-trilha-wrap');
  if (!target) return;
  target.innerHTML = '';
  const assessByMonth = {};
  AppState.data.evaluations.forEach((rec) => {
    const assessment = SFT.computeFunctionalAssessment(rec.results, rec.age, rec.sex);
    if (assessment.complete) assessByMonth[monthKey(rec.date)] = assessment.index;
  });
  target.appendChild(Charts.trilha(Object.keys(byMonth), assessByMonth));
}

function afterRender(container) {
  if (!AppState.data.sessions.length) return;
  const exSelect = container.querySelector('#mp-ex-select');
  const exercicio = exSelect ? exSelect.value : exerciseList()[0];
  drawLoadChart(container, exercicio);
  const byMonth = drawBorgChart(container);
  drawTrilha(container, byMonth || {});
}

function bindEvents(container) {
  const exSelect = container.querySelector('#mp-ex-select');
  if (exSelect) exSelect.addEventListener('change', () => drawLoadChart(container, exSelect.value));
}

window.DashboardView = { renderHtml: dashRenderHtml, bindEvents, afterRender };
