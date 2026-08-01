// Aba: Controle de Pagamento — ciclo de aulas/pagamentos + desmarcações/reposições/férias.

function payRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const payments = [...AppState.data.payments].sort((a, b) => b.date.localeCompare(a.date));
  const cycles = PaymentLogic.buildCycles(student, payments);
  const cycle = cycles.length ? cycles[cycles.length - 1] : null;
  const contratadas = Number(student.monthlySessionsCount) || 0;
  const dadas = cycle ? PaymentLogic.countClassDaysInRange(AppState.data.sessions, cycle.start, cycle.end) : 0;
  const faltam = Math.max(0, contratadas - dadas);
  const proximoPagamento = cycle ? Utils.addDaysISO(cycle.end, 1) : null;

  const paymentRows = payments.map((p) => `
    <tr>
      <td>${Utils.formatDateBR(p.date)}</td>
      <td>${Utils.formatBRL(p.amount)}</td>
      <td><button class="mp-btn-danger" data-del-payment="${p.id}" type="button">Excluir</button></td>
    </tr>`).join('');

  const cancellations = [...AppState.data.cancellations].sort((a, b) => (b.classDate || b.vacationStart || '').localeCompare(a.classDate || a.vacationStart || ''));
  const rights = PaymentLogic.computeCancellationRights(cancellations, cycles);

  const cancelRows = cancellations.map((c) => {
    if (c.isVacation) {
      const v = PaymentLogic.vacationCharge(student, c.vacationStart, c.vacationEnd);
      return `
        <tr>
          <td><span class="mp-pill mp-pill-moderado">Férias</span></td>
          <td>${Utils.formatDateBR(c.vacationStart)} – ${Utils.formatDateBR(c.vacationEnd)}</td>
          <td>—</td>
          <td>${c.keepSlot ? `Reservado — ${v.classesCount} aula(s) · cobrança 60%: <strong>${Utils.formatBRL(v.charge)}</strong>` : 'Não reservado — sujeito à disponibilidade no retorno'}</td>
          <td><button class="mp-btn-danger" data-del-cancel="${c.id}" type="button">Excluir</button></td>
        </tr>`;
    }
    const r = rights[c.id];
    const status = PaymentLogic.makeupDisplayStatus(c, r);
    const canAct = r?.hasRight && c.makeupStatus !== 'reposta';
    return `
      <tr>
        <td><span class="mp-pill ${c.cancelledBy === 'professor' ? 'mp-pill-moderado' : 'mp-pill-leve'}">${c.cancelledBy === 'professor' ? 'Professor' : 'Aluno'}</span></td>
        <td>${Utils.formatDateBR(c.classDate)}</td>
        <td>${c.cancelledBy === 'aluno' ? (c.noticeGiven ? 'Com antecedência' : 'Sem aviso / <1h') : '—'}</td>
        <td><span class="mp-pill mp-pill-${status.level}">${Utils.escapeHtml(status.label)}</span></td>
        <td>
          ${canAct ? `
            <button class="mp-btn mp-btn-ghost mp-btn-sm" data-makeup-status="reposta" data-cancel-id="${c.id}" type="button">Marcar reposta</button>
            ${c.cancelledBy === 'aluno' && c.makeupStatus !== 'transferida' ? `<button class="mp-btn mp-btn-ghost mp-btn-sm" data-makeup-status="transferida" data-cancel-id="${c.id}" type="button">Transferir p/ próx. ciclo</button>` : ''}
          ` : ''}
          <button class="mp-btn-danger" data-del-cancel="${c.id}" type="button">Excluir</button>
        </td>
      </tr>`;
  }).join('');

  return `
  <div class="mp-card">
    <h3>Ciclo atual</h3>
    <div class="mp-sub" style="margin-top:10px;">${cycle ? `Ciclo de ${Utils.formatDateBR(cycle.start)} a ${Utils.formatDateBR(cycle.end)}${cycle.provisional ? ' (provisório — ainda sem pagamento registrado, baseado na data de preenchimento do cadastro)' : ''}` : 'Cadastre a Data de Preenchimento (aba Cadastro do Aluno) ou registre o 1º pagamento para calcular o ciclo.'}</div>
    ${cycle ? `
    <div class="mp-kpis">
      <div class="mp-kpi"><div class="mp-kpi-label">Aulas dadas no ciclo</div><div class="mp-kpi-value">${dadas} / ${contratadas || '—'}</div></div>
      <div class="mp-kpi"><div class="mp-kpi-label">Aulas faltando</div><div class="mp-kpi-value">${faltam}</div></div>
      <div class="mp-kpi"><div class="mp-kpi-label">Próximo pagamento previsto</div><div class="mp-kpi-value" style="font-size:19px;">${Utils.formatDateBR(proximoPagamento)}</div></div>
    </div>` : ''}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Pagamentos</h3>
    <form id="mp-payment-form">
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Data do pagamento</label><input type="date" id="mp-pay-date" value="${Utils.todayISO()}"></div>
        <div class="mp-field"><label>Valor pago (R$)</label><input type="number" min="0" step="0.01" id="mp-pay-amount" value="${(Number(student.hourlyRate) || 0) * (Number(student.monthlySessionsCount) || 0) || ''}"></div>
      </div>
      <div class="mp-form-actions">
        <button type="button" id="mp-pay-submit" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Registrar pagamento</button>
      </div>
    </form>
    ${payments.length ? `
    <div style="overflow-x:auto;margin-top:10px;">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Valor</th><th></th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
    </div>` : '<div class="mp-sub" style="margin:10px 0 0;">Nenhum pagamento registrado ainda.</div>'}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Desmarcações, reposições e férias</h3>
    <div class="mp-sub" style="margin-top:10px;">Registre cada desmarcação — o app calcula automaticamente o direito a reposição, o prazo, e a cobrança de férias.</div>
    <form id="mp-cancel-form">
      <div class="mp-field" style="margin-bottom:12px;">
        <label class="mp-schedule-check" style="display:inline-flex;">
          <input type="checkbox" id="mp-c-vacation"> É período de férias / ausência?
        </label>
      </div>

      <div id="mp-c-normal-fields">
        <div class="mp-form-row mp-row2">
          <div class="mp-field"><label>Quem desmarcou?</label>
            <select id="mp-c-who">
              <option value="aluno">Aluno</option>
              <option value="professor">Professor</option>
            </select>
          </div>
          <div class="mp-field"><label>Data da aula desmarcada</label><input type="date" id="mp-c-date" value="${Utils.todayISO()}"></div>
        </div>
        <div class="mp-field" id="mp-c-notice-wrap">
          <label class="mp-schedule-check" style="display:inline-flex;">
            <input type="checkbox" id="mp-c-notice" checked> Avisou com pelo menos 1h de antecedência?
          </label>
        </div>
      </div>

      <div id="mp-c-vacation-fields" style="display:none;">
        <div class="mp-form-row mp-row2">
          <div class="mp-field"><label>Início das férias</label><input type="date" id="mp-c-vac-start"></div>
          <div class="mp-field"><label>Fim das férias</label><input type="date" id="mp-c-vac-end"></div>
        </div>
        <div class="mp-field">
          <label class="mp-schedule-check" style="display:inline-flex;">
            <input type="checkbox" id="mp-c-keepslot"> Manter horário reservado (cobra 60%)?
          </label>
        </div>
      </div>

      <div class="mp-form-actions">
        <button type="button" id="mp-cancel-submit" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Registrar desmarcação</button>
      </div>
    </form>
    ${cancellations.length ? `
    <div style="overflow-x:auto;margin-top:14px;">
    <table class="mp-table">
      <thead><tr><th>Tipo</th><th>Data(s)</th><th>Aviso</th><th>Status</th><th></th></tr></thead>
      <tbody>${cancelRows}</tbody>
    </table>
    </div>` : '<div class="mp-sub" style="margin:10px 0 0;">Nenhuma desmarcação registrada ainda.</div>'}
  </div>
  `;
}

function payBindEvents(container) {
  container.querySelector('#mp-pay-submit')?.addEventListener('click', async () => {
    const date = container.querySelector('#mp-pay-date').value;
    const amount = Number(container.querySelector('#mp-pay-amount').value) || 0;
    if (!date || amount <= 0) { Utils.toast('Preencha data e valor do pagamento.', 'error'); return; }
    const payment = { id: dbUuid(), studentId: AppState.currentId, date, amount, createdAt: new Date().toISOString() };
    AppState.data.payments.push(payment);
    render();
    Utils.toast('Pagamento registrado ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.payments, payment);
    if (!ok) render();
  });

  container.querySelectorAll('[data-del-payment]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir este pagamento? O ciclo será recalculado.');
      if (!ok) return;
      AppState.data.payments = AppState.data.payments.filter((p) => p.id !== btn.dataset.delPayment);
      render();
      await DB.delete(DB.STORES.payments, btn.dataset.delPayment);
    });
  });

  const vacationChk = container.querySelector('#mp-c-vacation');
  const normalFields = container.querySelector('#mp-c-normal-fields');
  const vacationFields = container.querySelector('#mp-c-vacation-fields');
  vacationChk?.addEventListener('change', () => {
    normalFields.style.display = vacationChk.checked ? 'none' : '';
    vacationFields.style.display = vacationChk.checked ? '' : 'none';
  });

  const whoSelect = container.querySelector('#mp-c-who');
  const noticeWrap = container.querySelector('#mp-c-notice-wrap');
  whoSelect?.addEventListener('change', () => {
    noticeWrap.style.display = whoSelect.value === 'aluno' ? '' : 'none';
  });

  container.querySelector('#mp-cancel-submit')?.addEventListener('click', async () => {
    const isVacation = container.querySelector('#mp-c-vacation').checked;
    let record;
    if (isVacation) {
      const start = container.querySelector('#mp-c-vac-start').value;
      const end = container.querySelector('#mp-c-vac-end').value;
      if (!start || !end || end < start) { Utils.toast('Informe um período de férias válido.', 'error'); return; }
      record = {
        id: dbUuid(), studentId: AppState.currentId, isVacation: true,
        vacationStart: start, vacationEnd: end,
        keepSlot: container.querySelector('#mp-c-keepslot').checked,
        createdAt: new Date().toISOString(),
      };
    } else {
      const classDate = container.querySelector('#mp-c-date').value;
      if (!classDate) { Utils.toast('Informe a data da aula desmarcada.', 'error'); return; }
      const who = container.querySelector('#mp-c-who').value;
      record = {
        id: dbUuid(), studentId: AppState.currentId, isVacation: false,
        classDate,
        cancelledBy: who,
        noticeGiven: who === 'aluno' ? container.querySelector('#mp-c-notice').checked : null,
        makeupStatus: 'pendente',
        createdAt: new Date().toISOString(),
      };
    }
    AppState.data.cancellations.push(record);
    render();
    Utils.toast('Desmarcação registrada ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-makeup-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const record = AppState.data.cancellations.find((c) => c.id === btn.dataset.cancelId);
      if (!record) return;
      record.makeupStatus = btn.dataset.makeupStatus;
      render();
      const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
      if (!ok) render();
    });
  });

  container.querySelectorAll('[data-del-cancel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir esta desmarcação?');
      if (!ok) return;
      AppState.data.cancellations = AppState.data.cancellations.filter((c) => c.id !== btn.dataset.delCancel);
      render();
      await DB.delete(DB.STORES.cancellations, btn.dataset.delCancel);
    });
  });
}

window.PaymentsView = { renderHtml: payRenderHtml, bindEvents: payBindEvents };
