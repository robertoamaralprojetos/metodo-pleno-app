// Lógica de ciclo de pagamento, desmarcações/reposições e férias — Método Pleno
// Funções puras (sem acesso a DOM/IndexedDB), para serem testáveis e reaproveitadas
// pela aba "Controle de Pagamento".

// Reconstrói o histórico de ciclos do aluno a partir dos pagamentos registrados.
// Ciclo = [data do pagamento, dia anterior ao mesmo dia do mês seguinte] (ou até o
// próximo pagamento, se já existir um posterior). Antes do 1º pagamento, usa a
// Data de Preenchimento do Cadastro como início do primeiro ciclo (provisório).
function buildCycles(student, payments) {
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  const cycles = [];

  if (!sorted.length) {
    if (!student?.fillDate) return [];
    cycles.push({ start: student.fillDate, end: Utils.addDaysISO(Utils.addMonthsISO(student.fillDate, 1), -1), provisional: true });
    return cycles;
  }

  if (student?.fillDate && student.fillDate < sorted[0].date) {
    cycles.push({ start: student.fillDate, end: Utils.addDaysISO(sorted[0].date, -1), provisional: true });
  }

  sorted.forEach((p, i) => {
    const end = i + 1 < sorted.length
      ? Utils.addDaysISO(sorted[i + 1].date, -1)
      : Utils.addDaysISO(Utils.addMonthsISO(p.date, 1), -1);
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
// aplicando: limite de 2 desmarcações-com-direito por ciclo (a 3ª+ no mesmo ciclo perde o
// direito mesmo com aviso prévio), prazo = fim do ciclo (ou do ciclo seguinte, se transferida)
// para desmarcação pelo aluno, e classDate+2 meses para desmarcação pelo professor.
function computeCancellationRights(cancellations, cycles) {
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
    const withinLimit = countPerCycleStart[key] <= 2;

    let deadline = cycle ? cycle.end : null;
    if (withinLimit && c.makeupStatus === 'transferida' && cycle) {
      const idx = cycles.findIndex((cy) => cy.start === cycle.start);
      const nextCycle = cycles[idx + 1];
      deadline = nextCycle ? nextCycle.end : Utils.addDaysISO(Utils.addMonthsISO(cycle.end, 1), 0);
    }

    results[c.id] = {
      hasRight: withinLimit,
      reasonNoRight: withinLimit ? null : 'Limite de 2 desmarcações com direito a reposição já atingido neste ciclo.',
      deadline,
      cycle,
    };
  });

  cancellations.forEach((c) => {
    if (results[c.id] || c.isVacation) return;
    if (c.cancelledBy === 'professor') {
      results[c.id] = { hasRight: true, reasonNoRight: null, deadline: Utils.addMonthsISO(c.classDate, 2), cycle: null };
      return;
    }
    results[c.id] = { hasRight: false, reasonNoRight: 'Desmarcado com menos de 1h de antecedência (ou sem aviso).', deadline: null, cycle: null };
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
  if (cancellation.makeupStatus === 'transferida') {
    if (expired) return { label: 'Expirada (transferida, prazo perdido)', level: 'alto', detail: '' };
    return { label: `Transferida — repor até ${Utils.formatDateBR(rights.deadline)}`, level: 'moderado', detail: '' };
  }
  if (expired) return { label: 'Expirada (prazo perdido)', level: 'alto', detail: '' };
  return { label: `Pendente — repor até ${Utils.formatDateBR(rights.deadline)}`, level: 'moderado', detail: '' };
}

// Conta quantas aulas (pelos dias da semana cadastrados) caem no intervalo de férias,
// e calcula a cobrança de 60% quando o horário é mantido reservado.
function vacationCharge(student, startISO, endISO) {
  const weekDays = student?.weekDays || [];
  const dowKeys = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  let classesCount = 0;
  if (weekDays.length && startISO && endISO) {
    let d = new Date(startISO + 'T00:00:00');
    const end = new Date(endISO + 'T00:00:00');
    while (d <= end) {
      if (weekDays.includes(dowKeys[d.getDay()])) classesCount += 1;
      d.setDate(d.getDate() + 1);
    }
  }
  const rate = Number(student?.hourlyRate) || 0;
  return { classesCount, fullValue: classesCount * rate, charge: classesCount * rate * 0.6 };
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
