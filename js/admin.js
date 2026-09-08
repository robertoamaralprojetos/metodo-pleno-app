// Aba: Administrativo — visão geral de TODOS os alunos (não depende do aluno selecionado).
// Carrega dados sob demanda (assíncrono) e mantém um cache simples em AppState.adminData,
// invalidado sempre que um pagamento é registrado/excluído em qualquer aluno.

let adminLoading = false;

function monthKeyOf(dateISO) { return dateISO.slice(0, 7); }

async function ensureAdminData() {
  if (AppState.adminData || adminLoading) return;
  adminLoading = true;
  try {
    const rows = [];
    for (const s of AppState.students) {
      const payments = await DB.getAllByIndex(DB.STORES.payments, 'byStudent', s.id);
      const cycle = PaymentLogic.currentCycle(s, payments);
      const overdue = cycle ? Utils.daysUntil(cycle.end) < 0 : null;
      const templates = await DB.getAllByIndex(DB.STORES.workoutTemplates, 'byStudent', s.id);
      rows.push({ student: s, payments, cycle, overdue, templates });
    }
    const allPayments = rows.flatMap((r) => r.payments);
    AppState.adminData = { rows, allPayments };
  } finally {
    adminLoading = false;
  }
  render();
}

function invalidateAdminData() { AppState.adminData = null; }

function adminRenderHtml() {
  if (!AppState.students.length) {
    return '<div class="mp-empty"><h3>Nenhum aluno cadastrado</h3><p>Cadastre ao menos um aluno para ver a visão administrativa.</p></div>';
  }
  if (!AppState.adminData) {
    return '<div class="mp-loading">Carregando visão geral…</div>';
  }
  const { rows, allPayments } = AppState.adminData;

  const statusRows = [...rows].sort((a, b) => a.student.name.localeCompare(b.student.name, 'pt-BR')).map(({ student, cycle, overdue }) => {
    const statusHtml = overdue === null
      ? '<span class="mp-pill" style="background:var(--borda);color:var(--texto-suave);">Sem dados</span>'
      : overdue
        ? '<span class="mp-pill mp-pill-alto">Atenção — atrasado</span>'
        : '<span class="mp-pill mp-pill-leve">Ativo — em dia</span>';
    return `
      <tr>
        <td>${Utils.escapeHtml(student.name)}</td>
        <td>${statusHtml}</td>
        <td>${cycle ? Utils.formatDateBR(cycle.start) : '—'}</td>
        <td>${cycle ? Utils.formatDateBR(Utils.addDaysISO(cycle.end, 1)) : '—'}</td>
      </tr>`;
  }).join('');

  const today = Utils.todayISO();
  const currentMonthKey = monthKeyOf(today);
  const monthTotal = allPayments.filter((p) => monthKeyOf(p.date) === currentMonthKey).reduce((a, p) => a + (Number(p.amount) || 0), 0);

  // Revisões de treino vencidas ou vencendo hoje, cruzando todos os alunos e todas as Fichas A-E.
  const reviewsDue = rows.flatMap(({ student, templates }) =>
    (templates || [])
      .filter((t) => t.reviewDate && t.reviewDate <= today)
      .map((t) => ({ studentName: student.name, ficha: t.ficha, reviewDate: t.reviewDate }))
  ).sort((a, b) => a.reviewDate.localeCompare(b.reviewDate));

  const reviewsDueRows = reviewsDue.map((r) => `
    <tr>
      <td>${Utils.escapeHtml(r.studentName)}</td>
      <td>Ficha ${r.ficha}</td>
      <td>${r.reviewDate === today ? '<span class="mp-pill mp-pill-alto">Hoje</span>' : `<span class="mp-pill mp-pill-alto">Vencida — ${Utils.formatDateBR(r.reviewDate)}</span>`}</td>
    </tr>`).join('');

  return `
  <div class="mp-card">
    <h3>Faturamento</h3>
    <div class="mp-kpis" style="margin-bottom:0;">
      <div class="mp-kpi"><div class="mp-kpi-label">Faturamento do mês corrente</div><div class="mp-kpi-value">${Utils.formatBRL(monthTotal)}</div></div>
    </div>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:18px 0 8px;color:var(--verde-principal);">Últimos 6 meses</h4>
    <div class="mp-chart-box" id="mp-admin-revenue-chart"></div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>⚠ Revisão de treino vencendo</h3>
    <div class="mp-sub" style="margin-top:10px;">Fichas (A-E) cuja data de revisão já passou ou é hoje, de todos os alunos.</div>
    ${reviewsDue.length ? `
    <div class="mp-table-scroll" style="margin-top:14px;">
    <table class="mp-table">
      <thead><tr><th>Aluno</th><th>Ficha</th><th>Situação</th></tr></thead>
      <tbody>${reviewsDueRows}</tbody>
    </table>
    </div>` : `<div class="mp-sub" style="margin:14px 0 0;">Nenhuma revisão vencida ou vencendo hoje. ✓</div>`}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Situação dos alunos</h3>
    <div class="mp-sub" style="margin-top:10px;">Status calculado a partir do ciclo de pagamento de cada aluno (aba Controle de Pagamento — compara a data prevista do próximo pagamento com hoje).</div>
    <div class="mp-table-scroll">
    <table class="mp-table">
      <thead><tr><th>Aluno</th><th>Status</th><th>Ciclo atual desde</th><th>Próximo pagamento previsto</th></tr></thead>
      <tbody>${statusRows}</tbody>
    </table>
    </div>
  </div>
  `;
}

function adminAfterRender(container) {
  if (!AppState.adminData) return;
  const target = container.querySelector('#mp-admin-revenue-chart');
  if (!target) return;

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  const bars = months.map(({ year, month }) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const total = AppState.adminData.allPayments
      .filter((p) => monthKeyOf(p.date) === key)
      .reduce((a, p) => a + (Number(p.amount) || 0), 0);
    return { label: `${Charts.MONTHS_PT[month]}/${String(year).slice(2)}`, value: Math.round(total * 100) / 100 };
  });

  target.innerHTML = '';
  if (bars.every((b) => b.value === 0)) {
    target.innerHTML = '<div class="mp-sub" style="margin:0;padding:20px 0;text-align:center;">Nenhum pagamento registrado nos últimos 6 meses.</div>';
    return;
  }
  target.appendChild(Charts.barChart(bars, { formatY: (v) => Utils.formatBRL(v) }));
}

function adminBindEvents(container) {
  ensureAdminData();
}

window.AdminView = { renderHtml: adminRenderHtml, bindEvents: adminBindEvents, afterRender: adminAfterRender };
window.invalidateAdminData = invalidateAdminData;
