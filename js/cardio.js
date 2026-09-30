// Frequência cardíaca — Método Pleno (v1.19.0)
//
// • FC máxima: valor medido em teste (Cadastro do Aluno) ou, na falta dele, Tanaka
//   (208 − 0,7 × idade), mais adequada para adultos e idosos que "220 − idade".
// • FC de treino e zonas: Karvonen (FC de reserva) quando a FC de repouso está preenchida;
//   sem ela, % da FC máxima.
// • Recuperação da FC: queda entre a FC ao final do treino e 1 e 2 minutos depois. Quanto
//   maior a queda, melhor a recuperação — é um bom marcador de evolução do condicionamento.
// • Tudo local, sem sensores: o profissional anota os valores (relógio, oxímetro ou palpação).

const CARDIO_ZONES = [
  { key: 'z1', pct: [40, 50], name: 'Muito leve / recuperação' },
  { key: 'z2', pct: [50, 60], name: 'Leve' },
  { key: 'z3', pct: [60, 70], name: 'Moderado · base aeróbica' },
  { key: 'z4', pct: [70, 80], name: 'Vigoroso · condicionamento' },
  { key: 'z5', pct: [80, 90], name: 'Intenso · limiar' },
  { key: 'z6', pct: [90, 100], name: 'Máximo' },
];
// Referências de recuperação da FC (queda em bpm) usadas só como orientação.
const CARDIO_REC_REF = { rec1: 12, rec2: 22 };

function cdAge(student) {
  if (!student?.birthDate) return null;
  return Utils.calcAgeFromBirthDate(student.birthDate, Utils.todayISO());
}
function cdNum(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }

function cdMax(student) {
  const measured = cdNum(student?.hrMaxMeasured);
  if (measured) return { value: Math.round(measured), source: 'medida em teste' };
  const age = cdAge(student);
  if (age == null) return null;
  return { value: Math.round(208 - 0.7 * age), source: `Tanaka (208 − 0,7 × ${age} anos)` };
}
function cdRest(student) { return cdNum(student?.hrRest); }

function cdBpm(student, pct) {
  const max = cdMax(student);
  if (!max) return null;
  const rest = cdRest(student);
  return Math.round(rest ? rest + (pct / 100) * (max.value - rest) : (pct / 100) * max.value);
}
function cdZone(key) { return CARDIO_ZONES.find((z) => z.key === key) || null; }
function cdZoneRange(student, key) {
  const z = cdZone(key);
  if (!z) return null;
  const lo = cdBpm(student, z.pct[0]);
  const hi = cdBpm(student, z.pct[1]);
  return lo == null ? null : [lo, hi];
}
function cdZoneShort(key, student) {
  const z = cdZone(key);
  if (!z) return '';
  const r = student ? cdZoneRange(student, key) : null;
  return `zona ${key.toUpperCase()}${r ? ` (${r[0]}–${r[1]} bpm)` : ` (${z.pct[0]}–${z.pct[1]}%)`}`;
}

// ---------- Card "Frequência cardíaca de treino" (Planejar Aula e Registro de Treino) ----------
function cdCardHtml(student, idp = 'cd') {
  const esc = Utils.escapeHtml;
  const max = cdMax(student);
  const rest = cdRest(student);
  if (!max) {
    return `
    <div class="mp-card" style="margin-top:20px;">
      <h3>❤️ Frequência cardíaca de treino</h3>
      <div class="mp-sub" style="margin:10px 0 0;">Preencha a <strong>data de nascimento</strong> do aluno no Cadastro para calcular a FC máxima e as zonas de treino. Se tiver, informe também a FC de repouso (método de Karvonen).</div>
    </div>`;
  }
  const rows = CARDIO_ZONES.map((z) => {
    const r = cdZoneRange(student, z.key);
    return `<tr><td><strong>${z.key.toUpperCase()}</strong></td><td>${z.pct[0]}–${z.pct[1]}%</td><td><strong>${r[0]}–${r[1]} bpm</strong></td><td>${esc(z.name)}</td></tr>`;
  }).join('');
  return `
  <div class="mp-card" style="margin-top:20px;">
    <details class="mp-cardio-details" ${idp === 'cd-plan' ? 'open' : ''}>
      <summary><h3 style="display:inline;">❤️ Frequência cardíaca de treino</h3></summary>
      <div class="mp-kpis" style="margin:14px 0 10px;">
        <div class="mp-kpi"><div class="mp-kpi-label">FC máxima</div><div class="mp-kpi-value">${max.value}</div><div class="mp-kpi-note">bpm · ${esc(max.source)}</div></div>
        <div class="mp-kpi"><div class="mp-kpi-label">FC de repouso</div><div class="mp-kpi-value">${rest || '—'}</div><div class="mp-kpi-note">${rest ? 'bpm · informada no Cadastro' : 'não informada'}</div></div>
        <div class="mp-kpi"><div class="mp-kpi-label">Método</div><div class="mp-kpi-value" style="font-size:18px;">${rest ? 'Karvonen' : '% FC máx.'}</div><div class="mp-kpi-note">${rest ? 'FC de reserva (máx − repouso)' : 'informe a FC de repouso para usar Karvonen'}</div></div>
      </div>
      <div class="mp-table-scroll">
      <table class="mp-table">
        <thead><tr><th>Zona</th><th>Intensidade</th><th>FC de treino</th><th>Uso</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      </div>
      <div class="mp-form-row mp-row2" style="margin-top:12px;align-items:end;">
        <div class="mp-field" style="margin:0;"><label>Calcular outra intensidade (%)</label><input type="number" min="1" max="100" step="1" id="${idp}-pct" placeholder="Ex: 75"></div>
        <div class="mp-sub" id="${idp}-pct-out" style="margin:0 0 10px;font-size:15px;color:var(--texto);"></div>
      </div>
      <div class="mp-sub" style="margin:8px 0 0;">FC de repouso e FC máxima medida (se houver teste) ficam em <strong>Cadastro do Aluno → Saúde e treino</strong>.</div>
    </details>
  </div>`;
}
function cdCardBind(container, student, idp = 'cd') {
  const inp = container.querySelector(`#${idp}-pct`);
  const out = container.querySelector(`#${idp}-pct-out`);
  if (!inp || !out) return;
  inp.addEventListener('input', () => {
    const pct = Number(inp.value);
    const bpm = pct > 0 && pct <= 100 ? cdBpm(student, pct) : null;
    out.innerHTML = bpm ? `${pct}% → <strong>${bpm} bpm</strong>` : '';
  });
}

// ---------- Campos de FC no Registro de Treino ----------
function cdRecovery(s) {
  const end = cdNum(s?.hrEnd);
  const r1 = cdNum(s?.hrRec1);
  const r2 = cdNum(s?.hrRec2);
  return { drop1: end && r1 ? end - r1 : null, drop2: end && r2 ? end - r2 : null };
}
function cdRecoveryText(rec) {
  const parts = [];
  if (rec.drop1 != null) parts.push(`1 min: <strong>−${rec.drop1} bpm</strong> ${rec.drop1 >= CARDIO_REC_REF.rec1 ? '<span class="mp-pill mp-pill-leve">boa</span>' : '<span class="mp-pill mp-pill-moderado">atenção</span>'}`);
  if (rec.drop2 != null) parts.push(`2 min: <strong>−${rec.drop2} bpm</strong> ${rec.drop2 >= CARDIO_REC_REF.rec2 ? '<span class="mp-pill mp-pill-leve">boa</span>' : '<span class="mp-pill mp-pill-moderado">atenção</span>'}`);
  return parts.length ? `Recuperação da FC — ${parts.join(' · ')}` : '';
}

function cdHrBlockHtml(idp, values = {}) {
  const v = (k) => (values[k] ?? '');
  return `
  <div class="mp-hr-block">
    <div class="mp-hr-title">❤️ Frequência cardíaca (bpm) — opcional</div>
    <div class="mp-hr-grid">
      <div class="mp-field"><label>Antes do treino</label><input type="number" min="30" max="230" step="1" inputmode="numeric" id="${idp}-hr-before" value="${v('hrBefore')}"></div>
      <div class="mp-field"><label>Média no treino</label><input type="number" min="30" max="230" step="1" inputmode="numeric" id="${idp}-hr-avg" value="${v('hrAvg')}"></div>
      <div class="mp-field"><label>Ao final</label><input type="number" min="30" max="230" step="1" inputmode="numeric" id="${idp}-hr-end" value="${v('hrEnd')}"></div>
      <div class="mp-field"><label>1 min depois</label><input type="number" min="30" max="230" step="1" inputmode="numeric" id="${idp}-hr-rec1" value="${v('hrRec1')}"></div>
      <div class="mp-field"><label>2 min depois</label><input type="number" min="30" max="230" step="1" inputmode="numeric" id="${idp}-hr-rec2" value="${v('hrRec2')}"></div>
    </div>
    <div class="mp-hr-timer">
      <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-hr-timer="${idp}">⏱ Cronômetro de recuperação (2 min)</button>
      <span class="mp-hr-timer-out" id="${idp}-hr-timer-out">Anote a FC ao final e toque no cronômetro: ele avisa com um bipe em 1:00 e 2:00.</span>
    </div>
    <div class="mp-hr-rec" id="${idp}-hr-rec"></div>
  </div>`;
}

const cdTimers = {};
function cdHrBlockBind(container, idp) {
  const q = (k) => container.querySelector(`#${idp}-hr-${k}`);
  const recEl = container.querySelector(`#${idp}-hr-rec`);
  const update = () => {
    if (!recEl) return;
    recEl.innerHTML = cdRecoveryText(cdRecovery({ hrEnd: q('end')?.value, hrRec1: q('rec1')?.value, hrRec2: q('rec2')?.value }));
  };
  ['end', 'rec1', 'rec2'].forEach((k) => q(k)?.addEventListener('input', update));
  update();
  const btn = container.querySelector(`[data-hr-timer="${idp}"]`);
  const out = container.querySelector(`#${idp}-hr-timer-out`);
  btn?.addEventListener('click', () => {
    if (cdTimers[idp]) { clearInterval(cdTimers[idp]); delete cdTimers[idp]; btn.textContent = '⏱ Cronômetro de recuperação (2 min)'; out.textContent = 'Cronômetro parado.'; return; }
    const start = Date.now();
    btn.textContent = '■ Parar cronômetro';
    const tick = () => {
      const sec = Math.floor((Date.now() - start) / 1000);
      if (sec === 60) { Utils.playBeep(); }
      if (sec >= 120) {
        Utils.playBeep();
        clearInterval(cdTimers[idp]); delete cdTimers[idp];
        btn.textContent = '⏱ Cronômetro de recuperação (2 min)';
        out.innerHTML = '<strong>2:00</strong> — anote a FC de 2 minutos.';
        q('rec2')?.focus();
        return;
      }
      out.innerHTML = `<strong>${fmtMmSs(sec)}</strong> — ${sec < 60 ? 'anote a FC em 1:00' : 'anote a FC em 2:00'}`;
      if (sec === 60) q('rec1')?.focus();
    };
    tick();
    cdTimers[idp] = setInterval(tick, 250);
  });
}
function cdHrBlockRead(container, idp) {
  const n = (k) => { const el = container.querySelector(`#${idp}-hr-${k}`); const v = el ? parseInt(el.value, 10) : NaN; return v > 0 ? v : null; };
  if (cdTimers[idp]) { clearInterval(cdTimers[idp]); delete cdTimers[idp]; }
  return { hrBefore: n('before'), hrAvg: n('avg'), hrEnd: n('end'), hrRec1: n('rec1'), hrRec2: n('rec2') };
}
function cdHasHr(s) { return !!(s && (s.hrBefore || s.hrAvg || s.hrEnd || s.hrRec1 || s.hrRec2)); }
function cdHrSummary(s) {
  if (!cdHasHr(s)) return '';
  const rec = cdRecovery(s);
  const bits = [];
  if (s.hrBefore) bits.push(`antes ${s.hrBefore}`);
  if (s.hrAvg) bits.push(`média ${s.hrAvg}`);
  if (s.hrEnd) bits.push(`final ${s.hrEnd}`);
  if (rec.drop1 != null) bits.push(`−${rec.drop1} em 1 min`);
  if (rec.drop2 != null) bits.push(`−${rec.drop2} em 2 min`);
  return `FC ${bits.join(' · ')}`;
}

// ---------- Séries para gráficos (Dashboard e Relatório) ----------
const CARDIO_METRICS = [
  { key: 'rec1', label: 'Recuperação da FC em 1 min (queda, bpm)', get: (s) => cdRecovery(s).drop1, better: 'up' },
  { key: 'rec2', label: 'Recuperação da FC em 2 min (queda, bpm)', get: (s) => cdRecovery(s).drop2, better: 'up' },
  { key: 'before', label: 'FC antes do treino (bpm)', get: (s) => cdNum(s.hrBefore), better: 'down' },
  { key: 'avg', label: 'FC média no treino (bpm)', get: (s) => cdNum(s.hrAvg), better: null },
  { key: 'end', label: 'FC ao final do treino (bpm)', get: (s) => cdNum(s.hrEnd), better: null },
  { key: 'pace', label: 'Ritmo em corrida/caminhada (min/km)', get: (s) => (cdNum(s.distanceKm) && cdNum(s.durationMinutes) ? Math.round((s.durationMinutes / s.distanceKm) * 100) / 100 : null), better: 'down', fmt: (v) => fmtMmSs(v * 60) },
  { key: 'distance', label: 'Distância por treino (km)', get: (s) => cdNum(s.distanceKm), better: 'up' },
  { key: 'minutes', label: 'Tempo de aeróbico por treino (min)', get: (s) => (s.type === 'aerobico' ? cdNum(s.durationMinutes) : null), better: 'up' },
];
function cdMetric(key) { return CARDIO_METRICS.find((m) => m.key === key); }

// Um ponto por dia (último registro do dia com valor).
function cdSeries(sessions, key, from, to) {
  const m = cdMetric(key);
  const byDate = new Map();
  [...sessions].sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0)).forEach((s) => {
    if ((from && s.date < from) || (to && s.date > to)) return;
    const v = m.get(s);
    if (v != null) byDate.set(s.date, v);
  });
  return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
}

function cdDashboardHtml(sessions) {
  const available = CARDIO_METRICS.filter((m) => cdSeries(sessions, m.key).length);
  const aer = sessions.filter((s) => s.type === 'aerobico');
  if (!available.length && !aer.length) return '';
  const rec1 = cdSeries(sessions, 'rec1');
  const before = cdSeries(sessions, 'before');
  const mean = (a) => Math.round((a.reduce((x, y) => x + y.value, 0) / a.length) * 10) / 10;
  const totalMin = Math.round(aer.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0));
  const totalKm = Math.round(aer.reduce((a, s) => a + (Number(s.distanceKm) || 0), 0) * 10) / 10;
  return `
  <div class="mp-card" style="margin-bottom:20px;">
    <h3>❤️ Condicionamento cardiovascular</h3>
    <div class="mp-sub">Frequência cardíaca anotada no Registro de Treino e volume dos treinos aeróbicos. Recuperação maior (queda mais rápida da FC depois do esforço) e FC de repouso menor indicam melhora do condicionamento.</div>
    <div class="mp-kpis" style="margin-bottom:14px;">
      <div class="mp-kpi"><div class="mp-kpi-label">Treinos aeróbicos</div><div class="mp-kpi-value">${new Set(aer.map((s) => s.date)).size}</div><div class="mp-kpi-note">${totalMin} min${totalKm ? ` · ${String(totalKm).replace('.', ',')} km` : ''} no total</div></div>
      <div class="mp-kpi"><div class="mp-kpi-label">Recuperação em 1 min</div><div class="mp-kpi-value">${rec1.length ? '−' + rec1[rec1.length - 1].value : '—'}</div><div class="mp-kpi-note">${rec1.length ? `bpm no último registro · média −${String(mean(rec1)).replace('.', ',')}` : 'anote a FC final e a de 1 min'}</div></div>
      <div class="mp-kpi"><div class="mp-kpi-label">FC antes do treino</div><div class="mp-kpi-value">${before.length ? before[before.length - 1].value : '—'}</div><div class="mp-kpi-note">${before.length ? `bpm no último registro · média ${String(mean(before)).replace('.', ',')}` : 'anote a FC em repouso antes de começar'}</div></div>
    </div>
    ${available.length ? `
    <select class="mp-select-inline" id="mp-cardio-metric" style="margin-bottom:14px;">${available.map((m) => `<option value="${m.key}">${Utils.escapeHtml(m.label)}</option>`).join('')}</select>
    <div class="mp-chart-box" id="mp-chart-cardio"></div>
    <div class="mp-sub" id="mp-cardio-note" style="margin:10px 0 0;"></div>` : '<div class="mp-sub" style="margin:0;padding:20px 0;text-align:center;">Anote a frequência cardíaca ao concluir os treinos para ver os gráficos de evolução aqui.</div>'}
  </div>`;
}
function cdDashboardDraw(container, sessions) {
  const sel = container.querySelector('#mp-cardio-metric');
  const target = container.querySelector('#mp-chart-cardio');
  if (!sel || !target) return;
  const draw = () => {
    const m = cdMetric(sel.value);
    const pts = cdSeries(sessions, m.key);
    target.innerHTML = '';
    const chart = Charts.lineChart(pts.map((p) => ({ label: Utils.formatDateBR(p.date).slice(0, 5), value: p.value })), { color: '#A24E33', pointColor: Charts.COLORS.dourado, formatY: m.fmt || ((v) => v) });
    if (chart) target.appendChild(chart);
    const note = container.querySelector('#mp-cardio-note');
    if (note) {
      const tips = { rec1: `Referência: queda de ${CARDIO_REC_REF.rec1} bpm ou mais no 1º minuto indica boa recuperação.`, rec2: `Referência: queda de ${CARDIO_REC_REF.rec2} bpm ou mais em 2 minutos indica boa recuperação.`, before: 'Com o treino regular, a FC de repouso tende a diminuir.', pace: 'Ritmo menor = mais rápido para a mesma distância.' };
      note.textContent = tips[m.key] || '';
    }
  };
  sel.addEventListener('change', draw);
  draw();
}

// ---------- Relatório de evolução ----------
function cdReportModel(sessions, from, to) {
  const inPeriod = sessions.filter((s) => s.date >= from && s.date <= to);
  const aer = inPeriod.filter((s) => s.type === 'aerobico');
  const rec1 = cdSeries(sessions, 'rec1', from, to);
  const rec2 = cdSeries(sessions, 'rec2', from, to);
  const before = cdSeries(sessions, 'before', from, to);
  const pace = cdSeries(sessions, 'pace', from, to);
  if (!aer.length && !rec1.length && !before.length) return null;
  const avg3 = (a, first) => { const part = first ? a.slice(0, 3) : a.slice(-3); return part.length ? Math.round((part.reduce((x, y) => x + y.value, 0) / part.length) * 10) / 10 : null; };
  const trend = (a) => (a.length >= 2 ? { first: avg3(a, true), last: avg3(a, false) } : null);
  return {
    aerobicDays: new Set(aer.map((s) => s.date)).size,
    totalMin: Math.round(aer.reduce((a, s) => a + (Number(s.durationMinutes) || 0), 0)),
    totalKm: Math.round(aer.reduce((a, s) => a + (Number(s.distanceKm) || 0), 0) * 10) / 10,
    rec1, rec2, before, pace,
    rec1Trend: trend(rec1), beforeTrend: trend(before), paceTrend: trend(pace),
  };
}

// Gráfico de linha simples em SVG (funciona na tela e na impressão).
function cdLineSvg(points, { color = '#A24E33', fmt = (v) => v, label = '' } = {}) {
  if (!points.length) return '';
  const W = 640; const H = 190; const padL = 40; const padR = 20; const padT = 22; const padB = 28;
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals); let max = Math.max(...vals);
  if (min === max) { min -= 2; max += 2; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (points.length - 1));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const grid = [0, 1, 2, 3].map((k) => { const v = min + ((max - min) * k) / 3; return `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="#e6e6e6"/><text x="${padL - 6}" y="${(y(v) + 3).toFixed(1)}" font-size="10" text-anchor="end" fill="#777" font-family="sans-serif">${fmt(Math.round(v * 10) / 10)}</text>`; }).join('');
  const step = Math.ceil(points.length / 8);
  const xl = points.map((p, i) => (i % step === 0 || i === points.length - 1 ? `<text x="${x(i).toFixed(1)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#666" font-family="sans-serif">${p.date.slice(8, 10)}/${p.date.slice(5, 7)}</text>` : '')).join('');
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.4" fill="${color}"/><text x="${x(i).toFixed(1)}" y="${(y(p.value) - 7).toFixed(1)}" font-size="9.5" text-anchor="middle" fill="#444" font-family="sans-serif">${fmt(p.value)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;" role="img" aria-label="${Utils.escapeHtml(label)}">${grid}${xl}${points.length > 1 ? `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/>` : ''}${dots}</svg>`;
}

window.Cardio = {
  ZONES: CARDIO_ZONES,
  REC_REF: CARDIO_REC_REF,
  METRICS: CARDIO_METRICS,
  age: cdAge,
  max: cdMax,
  rest: cdRest,
  bpm: cdBpm,
  zoneRange: cdZoneRange,
  zoneShort: cdZoneShort,
  cardHtml: cdCardHtml,
  cardBind: cdCardBind,
  hrBlockHtml: cdHrBlockHtml,
  hrBlockBind: cdHrBlockBind,
  hrBlockRead: cdHrBlockRead,
  hasHr: cdHasHr,
  hrSummary: cdHrSummary,
  recovery: cdRecovery,
  series: cdSeries,
  dashboardHtml: cdDashboardHtml,
  dashboardDraw: cdDashboardDraw,
  reportModel: cdReportModel,
  lineSvg: cdLineSvg,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['cardio.js'] = 'v1.19.0';
