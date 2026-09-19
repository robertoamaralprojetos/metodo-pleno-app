// Monitoramento de carga — lógica pura (sem tela): platô, sinais de sobrecarga, decisão de
// deload e geração do plano de deload. Tudo por regras simples e transparentes, com limites
// editáveis em Configurações. O app sugere; quem decide é o profissional.
//
// Definições (todas com o mesmo critério de "melhor" exposição, na ordem da hierarquia do app:
// mais carga; com a mesma carga, mais repetições; com ambas iguais, mais séries):
//  • Platô: nenhum novo recorde do exercício há N semanas, com pelo menos M exposições no período.
//      – com esforço (PSE/Borg) caindo ≥ X pontos: "adaptando" → hora de PROGREDIR (não é platô);
//      – com esforço subindo: "platô com fadiga" → candidato a deload;
//      – caso contrário: platô simples → mudar o estímulo (próximo passo da hierarquia).
//  • Sobrecarga (sinais somados): (a) esforço subindo com a mesma carga em vários exercícios;
//      (b) check-ins recentes amarelos/vermelhos ou prontidão em queda; (c) salto do volume semanal.
//      1 sinal = atenção; 2 ou mais = alto. (A razão aguda:crônica é discutida na literatura;
//      por isso o app usa só a variação semana a semana, mais simples e auditável.)
//  • Deload: por sobrecarga alta, por platô com fadiga somado a sinal de atenção, ou por calendário
//      (a cada N semanas; 4 na faixa de 51 a 60 anos, conforme o roteiro).

const MONITOR_DEFAULTS = {
  plateauWeeks: 4,
  plateauMinExposures: 3,
  pseDrop: 1,
  pseRise: 2,
  volumeJumpPct: 20,
  readinessDrop: 20,
  deloadEveryWeeks: 6,
  deloadVolumeCutPct: 30,
  deloadDays: 7,
};

// Lê os limites de AppState.settings (chaves monitorX) e completa com os padrões.
function monitorCfg(settings) {
  const s = settings || {};
  const pick = (key, def) => (typeof s['monitor' + key[0].toUpperCase() + key.slice(1)] === 'number' ? s['monitor' + key[0].toUpperCase() + key.slice(1)] : def);
  const cfg = {};
  Object.keys(MONITOR_DEFAULTS).forEach((k) => { cfg[k] = pick(k, MONITOR_DEFAULTS[k]); });
  return cfg;
}

function daysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00') - new Date(aISO + 'T00:00:00')) / 86400000);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function normName(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

// Volume-carga de uma exposição (séries × reps × carga; sem carga, séries × reps).
function volumeOf(e) { return e.load > 0 ? e.series * e.reps * e.load : e.series * e.reps; }

// Exposição B é "melhor" que A: mais carga; mesma carga e mais reps; mesmas ambas e mais séries.
function isBetter(a, b) {
  if (b.load !== a.load) return b.load > a.load;
  if (b.reps !== a.reps) return b.reps > a.reps;
  return b.series > a.series;
}

// Uma exposição por dia (a última do dia) para um exercício de força, em ordem cronológica.
function exposuresFor(sessions, exerciseName) {
  const key = normName(exerciseName);
  const byDate = {};
  sessions
    .filter((s) => s.type !== 'aerobico' && normName(s.exerciseName) === key)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0))
    .forEach((s) => { byDate[s.date] = s; });
  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ date: s.date, series: Number(s.series) || 0, reps: Number(s.reps) || 0, load: Number(s.load) || 0, borg: s.borg != null ? Number(s.borg) : null, unit: s.unit }));
}

// ---------- Platô por exercício ----------
function analyzeExercise(name, exposures, cfg, today) {
  const out = { name, exposures: exposures.length, status: 'poucos', pseRise: false };
  if (!exposures.length) return out;
  const first = exposures[0];
  const last = exposures[exposures.length - 1];
  Object.assign(out, { first, last });

  if (daysBetween(last.date, today) > cfg.plateauWeeks * 7 * 3) { out.status = 'inativo'; return out; }

  // último recorde
  let best = first;
  let record = first;
  exposures.forEach((e) => { if (isBetter(best, e)) { best = e; record = e; } });
  out.record = record;
  const windowDays = cfg.plateauWeeks * 7 - 3;
  const sinceRecord = exposures.filter((e) => e.date >= record.date);
  const daysSinceRecord = daysBetween(record.date, last.date);
  out.daysSinceRecord = daysSinceRecord;

  // PSE: dos últimos 4 registros com Borg — subida com a mesma carga (sinal de sobrecarga)
  const withBorg = exposures.filter((e) => e.borg != null);
  if (withBorg.length >= 4) {
    const l4 = withBorg.slice(-4);
    const prevM = mean([l4[0].borg, l4[1].borg]);
    const recM = mean([l4[2].borg, l4[3].borg]);
    const loadPrev = Math.max(l4[0].load, l4[1].load);
    const loadRec = Math.max(l4[2].load, l4[3].load);
    if (loadRec <= loadPrev && recM - prevM >= cfg.pseRise) out.pseRise = { from: prevM, to: recM };
  }

  if (exposures.length < cfg.plateauMinExposures) return out;

  if (daysSinceRecord < windowDays) {
    // recorde recente: só é "progredindo" se houve melhora real (record não é a primeira exposição)
    out.status = record.date > first.date ? 'progredindo' : 'poucos';
    return out;
  }
  if (sinceRecord.length < cfg.plateauMinExposures) return out;   // poucas exposições no período parado

  const borgs = sinceRecord.filter((e) => e.borg != null);
  const delta = borgs.length >= 2 ? borgs[borgs.length - 1].borg - borgs[0].borg : null;
  out.pseDelta = delta;
  out.weeksStalled = Math.floor(daysSinceRecord / 7);
  if (delta != null && delta <= -cfg.pseDrop) out.status = 'adaptando';
  else if (delta != null && delta >= 1) out.status = 'platoFadiga';
  else out.status = 'plato';
  return out;
}

// ---------- Sinais globais de sobrecarga ----------
function weekVolume(sessions, endISO) {
  const startISO = addDays(endISO, -6);
  return sessions.filter((s) => s.type !== 'aerobico' && s.date >= startISO && s.date <= endISO)
    .reduce((sum, s) => sum + volumeOf({ series: Number(s.series) || 0, reps: Number(s.reps) || 0, load: Number(s.load) || 0 }), 0);
}

function overloadSignals({ exercises, sessions, checkins, cfg, today, evalCheckin }) {
  const signals = [];

  const analyzed = exercises.filter((e) => e.status !== 'inativo' && e.exposures >= 4);
  const rising = analyzed.filter((e) => e.pseRise);
  if (rising.length >= Math.min(2, Math.max(1, analyzed.length)) && rising.length > 0) {
    signals.push({ key: 'pse', text: `Esforço (Borg) subindo ≥ ${cfg.pseRise} pontos com a mesma carga em ${rising.length} exercício(s): ${rising.slice(0, 4).map((e) => `${e.name} (${e.pseRise.from.toFixed(1)}→${e.pseRise.to.toFixed(1)})`).join(', ')}.` });
  }

  const recent = [...checkins].filter((c) => daysBetween(c.date, today) <= 21).sort((a, b) => b.date.localeCompare(a.date));
  if (recent.length >= 2) {
    const [c1, c2] = recent;
    const ev = evalCheckin || ((c) => ({ level: c.level, readiness: c.readiness }));
    const r1 = ev(c1); const r2 = ev(c2);
    const older = recent.slice(2, 5).map((c) => ev(c).readiness);
    if (r1.level !== 'verde' && r2.level !== 'verde') {
      signals.push({ key: 'checkin', text: `Os 2 últimos check-ins ficaram fora do verde (${r2.level} em ${Utils.formatDateBR(c2.date)} e ${r1.level} em ${Utils.formatDateBR(c1.date)}).` });
    } else if (older.length >= 2 && mean(older) - mean([r1.readiness, r2.readiness]) >= cfg.readinessDrop) {
      signals.push({ key: 'checkin', text: `A prontidão nos 2 últimos check-ins (${Math.round(mean([r1.readiness, r2.readiness]))}) caiu ${Math.round(mean(older) - mean([r1.readiness, r2.readiness]))} pontos em relação aos anteriores (${Math.round(mean(older))}).` });
    }
  }

  const w0 = weekVolume(sessions, today);
  const w1 = weekVolume(sessions, addDays(today, -7));
  if (w0 > 0 && w1 > 0 && w0 >= w1 * (1 + cfg.volumeJumpPct / 100)) {
    signals.push({ key: 'volume', text: `O volume-carga dos últimos 7 dias subiu ${Math.round((w0 / w1 - 1) * 100)}% em relação à semana anterior (limite: ${cfg.volumeJumpPct}%).` });
  }
  return signals;
}

// ---------- Deload ----------
function deloadEveryFor(cfg, band) {
  return band && band.key === '51-60' ? Math.min(cfg.deloadEveryWeeks, 4) : cfg.deloadEveryWeeks;
}

const ADJ_FIELD = { reps: 'reps', series: 'series', descanso: 'restSeconds', carga: 'load' };
const ADJ_LABEL = { reps: 'repetições', series: 'séries', descanso: 'descanso', carga: 'carga' };

// Plano de deload por exercício de força de cada Ficha.
//  modo 'volume': corta ~X% das séries, mantém carga e repetições;
//  modo 'espelhado': desfaz o último ajuste da hierarquia (ordem inversa: carga → descanso → séries → reps),
//    e, se `severe` ou se não houver ajuste a desfazer, também corta o volume.
// Nunca aumenta carga, repetições ou séries; o descanso só pode aumentar.
function buildDeloadPlan(templates, adjustments, mode, cfg, severe) {
  const changes = [];
  (templates || []).forEach((t) => (t.items || []).forEach((it) => {
    if (it.type === 'aerobico') return;
    const before = { series: it.series, reps: it.reps, load: it.load, restSeconds: it.restSeconds };
    const after = { ...before };
    const how = [];

    if (mode === 'espelhado') {
      const hist = (adjustments || [])
        .filter((a) => a.ficha === t.ficha && normName(a.exerciseName) === normName(it.exerciseName))
        .sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const last = hist[0];
      const field = last && ADJ_FIELD[last.tipoAjuste];
      if (last && field && after[field] === last.valorNovo) {
        const reduces = last.tipoAjuste === 'descanso' ? last.valorAnterior > last.valorNovo : last.valorAnterior < last.valorNovo;
        if (reduces) {
          after[field] = last.valorAnterior;
          how.push(`desfaz o último ajuste (${ADJ_LABEL[last.tipoAjuste]}: ${last.valorNovo} → ${last.valorAnterior})`);
        }
      }
    }
    const cut = mode === 'volume' || severe || how.length === 0;
    if (cut && after.series >= 2) {
      const s = Math.max(1, Math.round(after.series * (1 - cfg.deloadVolumeCutPct / 100)));
      if (s < after.series) { how.push(`séries ${after.series} → ${s} (−${cfg.deloadVolumeCutPct}% de volume)`); after.series = s; }
    }
    const changed = Object.keys(before).some((k) => before[k] !== after[k]);
    if (changed) changes.push({ ficha: t.ficha, itemId: it.id, exerciseName: it.exerciseName, unit: it.unit, unitDetail: it.unitDetail, before, after, how });
  }));
  return changes;
}

// ---------- Análise completa ----------
// args: { student, sessions, checkins, adjustments, templates, settings, today, band, evalCheckin }
function analyzeLoad(args) {
  const { student, sessions, checkins, adjustments, templates, settings, today, band, evalCheckin } = args;
  const cfg = monitorCfg(settings);
  const forceSessions = sessions.filter((s) => s.type !== 'aerobico');

  // exercícios: os das sessões recentes (12 semanas) e os das Fichas
  const names = new Map();
  forceSessions.forEach((s) => { if (daysBetween(s.date, today) <= 84) names.set(normName(s.exerciseName), s.exerciseName); });
  (templates || []).forEach((t) => (t.items || []).forEach((it) => { if (it.type !== 'aerobico' && !names.has(normName(it.exerciseName))) names.set(normName(it.exerciseName), it.exerciseName); }));
  const exercises = Array.from(names.values())
    .map((n) => analyzeExercise(n, exposuresFor(forceSessions, n), cfg, today))
    .filter((e) => e.exposures > 0);
  const order = { platoFadiga: 0, plato: 1, adaptando: 2, progredindo: 3, poucos: 4, inativo: 5 };
  exercises.sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name, 'pt-BR'));

  const signals = overloadSignals({ exercises, sessions: forceSessions, checkins: checkins || [], cfg, today, evalCheckin });
  const overload = signals.length >= 2 ? 'alto' : (signals.length === 1 ? 'atencao' : 'nenhum');

  const eligible = exercises.filter((e) => ['plato', 'platoFadiga', 'adaptando', 'progredindo'].includes(e.status));
  const platoCount = exercises.filter((e) => e.status === 'plato' || e.status === 'platoFadiga').length;
  const fatigueCount = exercises.filter((e) => e.status === 'platoFadiga').length;
  const platoFlag = platoCount > 0 && platoCount >= Math.min(2, eligible.length);

  // calendário
  const log = (student && student.deloadLog) || [];
  const lastDeload = [...log].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] || null;
  const firstSession = forceSessions.length ? forceSessions.map((s) => s.date).sort()[0] : null;
  const anchor = lastDeload ? lastDeload.startDate : firstSession;
  const every = deloadEveryFor(cfg, band);
  const weeksSince = anchor ? Math.floor(daysBetween(anchor, today) / 7) : null;
  const calendarDue = weeksSince != null && weeksSince >= every;
  const nextDueDate = anchor ? addDays(anchor, every * 7) : null;

  const reasons = [];
  if (overload === 'alto') reasons.push('Sobrecarga alta: 2 ou mais sinais ao mesmo tempo.');
  if (overload === 'atencao' && fatigueCount > 0) reasons.push('Sinal de sobrecarga somado a platô com esforço subindo.');
  if (calendarDue) reasons.push(`Já se passaram ${weeksSince} semanas desde ${lastDeload ? 'o último deload' : 'o primeiro treino registrado'} (intervalo configurado: ${every} semanas).`);
  const suggested = reasons.length > 0;
  const urgency = overload === 'alto' ? 'alta' : 'normal';
  const mode = overload === 'alto' ? 'espelhado' : 'volume';

  const active = log.find((d) => d.status === 'ativo') || null;
  const dismissed = !!(student && student.deloadDismissedUntil && today <= student.deloadDismissedUntil && urgency !== 'alta');

  return { cfg, exercises, signals, overload, platoCount, fatigueCount, platoFlag, calendar: { every, weeksSince, calendarDue, nextDueDate, lastDeload },
    deload: { suggested, urgency, mode, reasons, active, dismissed } };
}

window.MonitorLogic = {
  MONITOR_DEFAULTS, monitorCfg, daysBetween, addDays, isBetter, exposuresFor, analyzeExercise, weekVolume,
  overloadSignals, buildDeloadPlan, deloadEveryFor, analyzeLoad, volumeOf,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['monitor-logic.js'] = 'v1.13.1';
