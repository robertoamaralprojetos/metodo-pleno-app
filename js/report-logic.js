// Relatório de evolução — lógica pura (sem tela). Calcula, para um período, os números que
// o relatório para aluno e família mostra: frequência, evolução de carga, avaliação funcional
// (SFT), avaliação física, bem-estar e conquistas. Nada aqui inventa dado: se não há registro
// suficiente para uma seção, ela volta vazia e o relatório a omite.

const REPORT_MILESTONES = [10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000];
const REPORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rAddDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function rDiff(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000);
}
function rDdMm(iso) { return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`; }
function r1(n) { return Math.round(n * 10) / 10; }

// Período a partir da escolha da tela. 'all' = do primeiro treino registrado até hoje.
function reportPeriod(rangeKey, today, firstSessionDate, customFrom, customTo) {
  if (rangeKey === 'custom') {
    const from = customFrom || rAddDays(today, -89);
    const to = customTo || today;
    return from <= to ? { from, to } : { from: to, to: from };
  }
  if (rangeKey === 'all') return { from: firstSessionDate || rAddDays(today, -89), to: today };
  const days = { 30: 30, 90: 90, 180: 180, 365: 365 }[rangeKey] || 90;
  return { from: rAddDays(today, -(days - 1)), to: today };
}

// ---------- Frequência ----------
function reportFrequency(sessions, from, to) {
  const dates = Array.from(new Set(sessions.map((s) => s.date))).sort();
  const inRange = dates.filter((d) => d >= from && d <= to);
  const days = rDiff(from, to) + 1;
  const weeksFloat = days / 7;

  // barras: semanais até 20 semanas; acima disso, mensais
  const nWeeks = Math.ceil(days / 7);
  const buckets = [];
  if (nWeeks <= 20) {
    for (let i = 0; i < nWeeks; i++) {
      const start = rAddDays(from, i * 7);
      const end = rAddDays(start, 6) > to ? to : rAddDays(start, 6);
      buckets.push({ start, end, label: rDdMm(start) });
    }
  } else {
    let cursor = from;
    while (cursor <= to) {
      const y = Number(cursor.slice(0, 4));
      const m = Number(cursor.slice(5, 7));
      const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
      const end = monthEnd > to ? to : monthEnd;
      buckets.push({ start: cursor, end, label: `${REPORT_MONTHS[m - 1]}/${String(y).slice(2)}` });
      cursor = rAddDays(end, 1);
    }
  }
  buckets.forEach((b) => { b.count = inRange.filter((d) => d >= b.start && d <= b.end).length; });

  let weeksWithTraining = 0;
  for (let i = 0; i < nWeeks; i++) {
    const start = rAddDays(from, i * 7);
    const end = rAddDays(start, 6);
    if (inRange.some((d) => d >= start && d <= end)) weeksWithTraining += 1;
  }

  // semanas seguidas (janelas de 7 dias terminando em `to`, para trás, sem limite ao período)
  let streak = 0;
  for (let i = 0; i < 260; i++) {
    const end = rAddDays(to, -7 * i);
    const start = rAddDays(end, -6);
    if (dates.some((d) => d >= start && d <= end)) streak += 1; else break;
  }

  const prevFrom = rAddDays(from, -days);
  const prevTo = rAddDays(from, -1);
  const prevCount = dates.filter((d) => d >= prevFrom && d <= prevTo).length;

  const totalBefore = dates.filter((d) => d < from).length;
  const totalUpTo = dates.filter((d) => d <= to).length;
  const crossed = REPORT_MILESTONES.filter((m) => totalBefore < m && m <= totalUpTo);

  return {
    count: inRange.length, days, avgPerWeek: r1(inRange.length / weeksFloat), weeksWithTraining, totalWeeks: nWeeks,
    buckets, monthly: nWeeks > 20, streak, prevCount, totalUpTo, crossedMilestones: crossed,
    reachedMilestone: REPORT_MILESTONES.filter((m) => m <= totalUpTo).pop() || null,
  };
}

// ---------- Evolução de carga ----------
function reportStrength(sessions, from, to) {
  const ML = window.MonitorLogic;
  const force = sessions.filter((s) => s.type !== 'aerobico');
  const names = new Map();
  force.forEach((s) => { if (s.date >= from && s.date <= to) names.set(s.exerciseName.trim().toLowerCase(), s.exerciseName); });
  let evaluated = 0;
  const improved = [];
  names.forEach((name) => {
    const exps = ML.exposuresFor(force, name).filter((e) => e.date >= from && e.date <= to);
    if (exps.length < 2) return;
    evaluated += 1;
    const first = exps[0];
    const last = exps[exps.length - 1];
    if (!ML.isBetter(first, last)) return;
    let type = 'series';
    let pct = null;
    if (last.load > first.load) { type = 'carga'; pct = first.load > 0 ? Math.round(((last.load - first.load) / first.load) * 100) : null; }
    else if (last.reps > first.reps) type = 'reps';
    improved.push({ name, type, pct, first, last });
  });
  const rank = (x) => (x.type === 'carga' ? 3 : (x.type === 'reps' ? 2 : 1));
  improved.sort((a, b) => rank(b) - rank(a) || (b.pct || 0) - (a.pct || 0) || a.name.localeCompare(b.name, 'pt-BR'));
  return { evaluated, improved };
}

// ---------- Avaliação funcional (SFT) ----------
function reportFunctional(evaluations, to) {
  const SFT = window.SFT;
  const list = [...evaluations].filter((e) => e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return null;
  const assess = (rec) => ({ date: rec.date, ...SFT.computeFunctionalAssessment(rec.results, rec.age, rec.sex) });
  const cur = assess(list[list.length - 1]);
  const prev = list.length > 1 ? assess(list[list.length - 2]) : null;
  const value = (a, key) => {
    const t = a && a.perTest ? a.perTest[key] : null;
    if (!t) return null;
    return key === 'unipodalStance' ? Math.min(t.right.value, t.left.value) : t.value;
  };
  const tests = SFT.TEST_ORDER.filter((k) => cur.perTest[k]).map((k) => {
    const c = value(cur, k);
    const p = value(prev, k);
    const lowerBetter = k === 'tug';
    const label = k === 'unipodalStance' ? 'Apoio em uma perna (pior lado)' : SFT.TABLES[k].label;
    return {
      key: k, label, unit: cur.perTest[k].unit, prev: p, cur: c,
      improved: p != null ? (lowerBetter ? c < p : c > p) : null,
      worse: p != null ? (lowerBetter ? c > p : c < p) : null,
      classification: cur.perTest[k].label,
    };
  });
  return { current: cur, previous: prev, tests };
}

// ---------- Avaliação física ----------
function reportPhysical(physicalEvaluations, to) {
  const list = [...physicalEvaluations].filter((e) => e.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return null;
  const cur = list[list.length - 1];
  const prev = list.length > 1 ? list[list.length - 2] : null;
  const imc = (r) => (r && r.weight && r.height ? r1(r.weight / ((r.height / 100) ** 2)) : null);
  const rows = [
    { label: 'Peso', unit: 'kg', prev: prev ? prev.weight : null, cur: cur.weight },
    { label: 'IMC', unit: '', prev: imc(prev), cur: imc(cur) },
    { label: 'Gordura corporal', unit: '%', prev: prev ? prev.bodyFatPercent : null, cur: cur.bodyFatPercent },
    { label: 'Abdômen', unit: 'cm', prev: prev && prev.circumferences ? prev.circumferences.abdomen : null, cur: cur.circumferences ? cur.circumferences.abdomen : null },
  ].filter((r) => r.cur != null);
  return { currentDate: cur.date, previousDate: prev ? prev.date : null, rows };
}

// ---------- Bem-estar (check-ins) ----------
function reportWellbeing(checkins, from, to) {
  const list = checkins.filter((c) => c.date >= from && c.date <= to);
  if (!list.length) return null;
  const avg = (key) => r1(list.reduce((s, c) => s + c[key], 0) / list.length);
  const green = list.filter((c) => window.CheckinLogic.evaluate(c).level === 'verde').length;
  return { count: list.length, avgSono: avg('sono'), avgDisp: avg('disposicao'), greenPct: Math.round((green / list.length) * 100) };
}

// ---------- Percepção de esforço (Borg) por treino ----------
// Média do Borg de cada treino (modo "por exercício" ou "treino geral", como no Dashboard),
// com média móvel de 3 treinos. Precisa de pelo menos 6 treinos com Borg no período; abaixo
// disso devolve { ok: false, count } e o relatório omite a seção.
function reportEffort(sessions, dailyMeta, from, to, strength) {
  const dates = Array.from(new Set(sessions.filter((s) => s.date >= from && s.date <= to).map((s) => s.date))).sort();
  const points = dates
    .map((date) => ({ date, value: window.computeDailyBorg(sessions, dailyMeta || [], date) }))
    .filter((p) => p.value != null)
    .map((p) => ({ date: p.date, value: r1(p.value) }));
  if (points.length < 6) return { ok: false, count: points.length };
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  points.forEach((p, i) => { p.avg = r1(mean(points.slice(Math.max(0, i - 2), i + 1).map((q) => q.value))); });
  const firstAvg = r1(mean(points.slice(0, 3).map((p) => p.value)));
  const lastAvg = r1(mean(points.slice(-3).map((p) => p.value)));
  const top = strength && strength.improved ? strength.improved.find((e) => e.type === 'carga' && e.pct != null) : null;
  return {
    ok: true, count: points.length, points, firstAvg, lastAvg, delta: r1(lastAvg - firstAvg),
    overallAvg: r1(mean(points.map((p) => p.value))),
    topLoad: top ? { name: top.name, pct: top.pct } : null,
  };
}

// ---------- Conquistas ----------
function reportAchievements(model) {
  const out = [];
  const f = model.freq;
  f.crossedMilestones.forEach((m) => out.push({ icon: '🏅', text: `Alcançou a marca de ${m} treinos no total.` }));
  if (f.streak >= 4) out.push({ icon: '🔥', text: `${f.streak} semanas seguidas treinando.` });
  if (f.avgPerWeek >= 2) out.push({ icon: '📅', text: `Média de ${String(f.avgPerWeek).replace('.', ',')} treinos por semana.` });
  if (f.prevCount > 0 && f.count > f.prevCount) out.push({ icon: '⬆️', text: `Mais treinos do que no período anterior (${f.count} contra ${f.prevCount}).` });
  if (model.strength.improved.length) out.push({ icon: '💪', text: `${model.strength.improved.length} exercício(s) com mais carga ou repetições.` });
  const fn = model.functional;
  if (fn && fn.previous && fn.current.complete && fn.previous.complete && fn.current.index > fn.previous.index) {
    out.push({ icon: '📈', text: `Aptidão funcional subiu de ${fn.previous.index} para ${fn.current.index} pontos (+${fn.current.index - fn.previous.index}).` });
  }
  if (fn) {
    const better = fn.tests.filter((t) => t.improved === true).length;
    const compared = fn.tests.filter((t) => t.improved !== null).length;
    if (better > 0) out.push({ icon: '✅', text: `Melhora em ${better} de ${compared} testes de aptidão funcional.` });
  }
  return out;
}

// input: { student, sessions, evaluations, physicalEvaluations, checkins, from, to, today }
function computeReport(input) {
  const { sessions, evaluations, physicalEvaluations, checkins, dailyMeta, from, to } = input;
  const model = {
    from, to, days: rDiff(from, to) + 1,
    freq: reportFrequency(sessions, from, to),
    strength: reportStrength(sessions, from, to),
    functional: reportFunctional(evaluations || [], to),
    physical: reportPhysical(physicalEvaluations || [], to),
    wellbeing: reportWellbeing(checkins || [], from, to),
  };
  model.effort = reportEffort(sessions, dailyMeta, from, to, model.strength);
  model.achievements = reportAchievements(model);
  return model;
}

window.ReportLogic = { REPORT_MILESTONES, reportPeriod, reportFrequency, reportStrength, reportFunctional, reportPhysical, reportWellbeing, reportEffort, reportAchievements, computeReport, rAddDays, rDiff };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['report-logic.js'] = 'v1.14.1';
