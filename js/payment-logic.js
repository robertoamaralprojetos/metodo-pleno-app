// Lógica de ciclo de pagamento, desmarcações/reposições e férias — Método Pleno
// Funções puras (sem acesso a DOM/IndexedDB), para serem testáveis e reaproveitadas
// pela aba "Controle de Pagamento".

const DOW_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

// Retorna a data ISO da n-ésima ocorrência (1-indexada) de qualquer um dos dias da semana
// em `weekDays` (chaves de DOW_KEYS), contando a partir de `startISO` (inclusive).
function nthWeekdayOccurrence(startISO, weekDays, n) {
  const set = new Set(weekDays);
  let date = startISO;
  let count = 0;
  let guard = 0;
  while (guard < 3660) { // ~10 anos de proteção contra loop infinito
    const dow = DOW_KEYS[new Date(date + 'T00:00:00').getDay()];
    if (set.has(dow)) {
      count += 1;
      if (count === n) return date;
    }
    date = Utils.addDaysISO(date, 1);
    guard += 1;
  }
  return null; // não deveria acontecer com weekDays válido
}

// Fim previsto de um ciclo a partir da data de início: em vez de "+1 mês corrido" (que quase
// nunca bate com a cadência real das aulas — ex: seg/qua/sex raramente fecha em 30 dias
// exatos), conta as ocorrências dos dias de aula cadastrados até completar as aulas
// contratadas por mês, e usa a véspera da aula seguinte (a 1ª do próximo ciclo) como fim.
// Sem dias da semana cadastrados (dado legado) ou sem aulas contratadas, mantém o
// comportamento antigo (+1 mês) para não quebrar cadastros já existentes.
function projectedCycleEnd(startISO, weekDays, contractedCount) {
  if (!weekDays || !weekDays.length || !contractedCount) {
    return Utils.addDaysISO(Utils.addMonthsISO(startISO, 1), -1);
  }
  const nextCycleStart = nthWeekdayOccurrence(startISO, weekDays, contractedCount + 1);
  if (!nextCycleStart) return Utils.addDaysISO(Utils.addMonthsISO(startISO, 1), -1);
  return Utils.addDaysISO(nextCycleStart, -1);
}

// Reconstrói o histórico de ciclos do aluno a partir dos pagamentos registrados.
// Ciclo = [data do pagamento, véspera da aula seguinte à última aula contratada do ciclo,
// contando pelos dias da semana cadastrados] (ou até o próximo pagamento, se já existir um
// posterior — nesse caso o fim real do ciclo já é conhecido e não precisa ser projetado).
// Antes do 1º pagamento, usa a Data de Preenchimento do Cadastro como início do primeiro
// ciclo (provisório).
function buildCycles(student, payments) {
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  const cycles = [];
  const weekDays = student?.weekDays || [];
  const contractedCount = Number(student?.monthlySessionsCount) || 0;

  if (!sorted.length) {
    if (!student?.fillDate) return [];
    cycles.push({ start: student.fillDate, end: projectedCycleEnd(student.fillDate, weekDays, contractedCount), provisional: true });
    return cycles;
  }

  if (student?.fillDate && student.fillDate < sorted[0].date) {
    cycles.push({ start: student.fillDate, end: Utils.addDaysISO(sorted[0].date, -1), provisional: true });
  }

  sorted.forEach((p, i) => {
    const end = i + 1 < sorted.length
      ? Utils.addDaysISO(sorted[i + 1].date, -1)
      : projectedCycleEnd(p.date, weekDays, contractedCount);
    cycles.push({ start: p.date, end, paymentId: p.id });
  });

  return cycles;
}

function findCycleForDate(cycles, dateISO) {
  if (!cycles.length) return null;
  return cycles.find((c) => dateISO >= c.start && dateISO <= c.end) || cycles[cycles.length - 1];
}

function currentCycle(student, payments) {
  const cycles = buildCycles(student, payments);
  return cycles.length ? cycles[cycles.length - 1] : null;
}

// Quantos dias distintos tiveram ao menos 1 sessão registrada dentro do intervalo.
function countClassDaysInRange(sessions, startISO, endISO) {
  const dates = new Set(sessions.filter((s) => s.date >= startISO && s.date <= endISO).map((s) => s.date));
  return dates.size;
}

// Calcula, para cada desmarcação não-férias do aluno, se há direito a reposição e o prazo,
// aplicando as regras configuráveis em Configurações (settings): limite de
// settings.maxMakeupsPerMonth desmarcações-com-direito por ciclo (a partir da próxima no
// mesmo ciclo perde o direito mesmo com aviso prévio), prazo = fim do ciclo (ou do ciclo
// N ciclos à frente, se transferida settings.maxTransfers vezes) para desmarcação pelo
// aluno, e classDate + settings.professorMonths meses para desmarcação pelo professor.
// `settings` é opcional — cai em DEFAULT_SETTINGS (valores atuais/originais) se omitido.
function computeCancellationRights(cancellations, cycles, settings) {
  const s = settings || window.DEFAULT_SETTINGS;
  const results = {};

  const alunoComAviso = cancellations
    .filter((c) => !c.isVacation && c.cancelledBy === 'aluno' && c.noticeGiven)
    .slice()
    .sort((a, b) => a.classDate.localeCompare(b.classDate));

  const countPerCycleStart = {};
  alunoComAviso.forEach((c) => {
    const cycle = findCycleForDate(cycles, c.classDate);
    const key = cycle ? cycle.start : 'sem-ciclo';
    countPerCycleStart[key] = (countPerCycleStart[key] || 0) + 1;
    const withinLimit = countPerCycleStart[key] <= s.maxMakeupsPerMonth;

    let deadline = cycle ? cycle.end : null;
    const transferCount = c.transferCount || 0;
    if (withinLimit && transferCount > 0 && cycle) {
      const idx = cycles.findIndex((cy) => cy.start === cycle.start);
      const targetCycle = cycles[idx + transferCount];
      deadline = targetCycle ? targetCycle.end : Utils.addMonthsISO(cycle.end, transferCount);
    }

    results[c.id] = {
      hasRight: withinLimit,
      reasonNoRight: withinLimit ? null : `Limite de ${s.maxMakeupsPerMonth} ${s.maxMakeupsPerMonth === 1 ? 'desmarcação' : 'desmarcações'} com direito a reposição já atingido neste ciclo.`,
      deadline,
      cycle,
    };
  });

  cancellations.forEach((c) => {
    if (results[c.id] || c.isVacation) return;
    if (c.cancelledBy === 'professor') {
      results[c.id] = { hasRight: true, reasonNoRight: null, deadline: Utils.addMonthsISO(c.classDate, s.professorMonths), cycle: null };
      return;
    }
    results[c.id] = { hasRight: false, reasonNoRight: `Desmarcado com menos de ${s.noticeHours}h de antecedência (ou sem aviso).`, deadline: null, cycle: null };
  });

  return results;
}

function makeupDisplayStatus(cancellation, rights) {
  if (cancellation.isVacation) return null;
  if (!rights || !rights.hasRight) {
    return { label: 'Sem direito a reposição', level: 'alto', detail: rights?.reasonNoRight || '' };
  }
  if (cancellation.makeupStatus === 'reposta') return { label: 'Reposta ✓', level: 'leve', detail: '' };

  const expired = rights.deadline && Utils.daysUntil(rights.deadline) < 0;
  const transferCount = cancellation.transferCount || 0;
  if (transferCount > 0) {
    const suffix = transferCount > 1 ? ` (${transferCount}x)` : '';
    if (expired) return { label: `Expirada (transferida${suffix}, prazo perdido)`, level: 'alto', detail: '' };
    return { label: `Transferida${suffix} — repor até ${Utils.formatDateBR(rights.deadline)}`, level: 'moderado', detail: '' };
  }
  if (expired) return { label: 'Expirada (prazo perdido)', level: 'alto', detail: '' };
  return { label: `Pendente — repor até ${Utils.formatDateBR(rights.deadline)}`, level: 'moderado', detail: '' };
}

// Conta quantas aulas (pelos dias da semana cadastrados) caem no intervalo de férias,
// e calcula a cobrança (settings.vacationChargePercent%) quando o horário é mantido reservado.
function vacationCharge(student, startISO, endISO, settings) {
  const s = settings || window.DEFAULT_SETTINGS;
  const weekDays = student?.weekDays || [];
  let classesCount = 0;
  if (weekDays.length && startISO && endISO) {
    let d = new Date(startISO + 'T00:00:00');
    const end = new Date(endISO + 'T00:00:00');
    while (d <= end) {
      if (weekDays.includes(DOW_KEYS[d.getDay()])) classesCount += 1;
      d.setDate(d.getDate() + 1);
    }
  }
  const rate = Number(student?.hourlyRate) || 0;
  const pct = (Number(s.vacationChargePercent) || 0) / 100;
  return { classesCount, fullValue: classesCount * rate, charge: classesCount * rate * pct };
}

window.PaymentLogic = {
  buildCycles,
  findCycleForDate,
  currentCycle,
  countClassDaysInRange,
  computeCancellationRights,
  makeupDisplayStatus,
  vacationCharge,
};
