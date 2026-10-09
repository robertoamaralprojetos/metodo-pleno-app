// Aba: Controle de Pagamento — ciclo de aulas/pagamentos + desmarcações/reposições/férias.

function payRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const settings = AppState.settings || window.DEFAULT_SETTINGS;
  const payments = [...AppState.data.payments].sort((a, b) => b.date.localeCompare(a.date));
  const cycles = PaymentLogic.buildCycles(student, payments);
  const cycle = cycles.length ? cycles[cycles.length - 1] : null;
  const contratadas = Number(student.monthlySessionsCount) || 0;
  const dadas = cycle ? PaymentLogic.countClassDaysInRange(AppState.data.sessions, cycle.start, cycle.end) : 0;
  const faltam = Math.max(0, contratadas - dadas);
  const proximoPagamento = cycle ? Utils.addDaysISO(cycle.end, 1) : null;
  const allCancels = AppState.data.cancellations || [];
  const mkRights = PaymentLogic.computeCancellationRights(allCancels, cycles, settings);
  const mk = PaymentLogic.makeupSummary(allCancels, mkRights, cycle);

  const paymentRows = payments.map((p) => `
    <tr>
      <td>${Utils.formatDateBR(p.date)}</td>
      <td>${Utils.formatBRL(p.amount)}</td>
      <td><button class="mp-btn-danger" data-del-payment="${p.id}" type="button">Excluir</button></td>
    </tr>`).join('');

  const cancellations = [...AppState.data.cancellations].sort((a, b) => (b.classDate || b.vacationStart || '').localeCompare(a.classDate || a.vacationStart || ''));
  const rights = PaymentLogic.computeCancellationRights(cancellations, cycles, settings);

  const cancelRows = cancellations.map((c) => {
    if (c.isVacation) {
      const v = PaymentLogic.vacationCharge(student, c.vacationStart, c.vacationEnd, settings);
      return `
        <tr>
          <td><span class="mp-pill mp-pill-moderado">Férias</span></td>
          <td>${Utils.formatDateBR(c.vacationStart)} – ${Utils.formatDateBR(c.vacationEnd)}</td>
          <td>—</td>
          <td>${c.keepSlot ? `Reservado — ${v.classesCount} aula(s) · cobrança ${settings.vacationChargePercent}%: <strong>${Utils.formatBRL(v.charge)}</strong>` : 'Não reservado — sujeito à disponibilidade no retorno'}</td>
          <td><button class="mp-btn-danger" data-del-cancel="${c.id}" type="button">Excluir</button></td>
        </tr>`;
    }
    const r = rights[c.id];
    const status = PaymentLogic.makeupDisplayStatus(c, r);
    const canAct = r?.hasRight && c.makeupStatus !== 'reposta';
    const transferCount = c.transferCount || 0;
    const canTransfer = settings.allowTransfer && transferCount < settings.maxTransfers;
    return `
      <tr>
        <td><span class="mp-pill ${c.cancelledBy === 'professor' ? 'mp-pill-moderado' : 'mp-pill-leve'}">${c.cancelledBy === 'professor' ? 'Professor' : 'Aluno'}</span></td>
        <td>${Utils.formatDateBR(c.classDate)}</td>
        <td>${c.cancelledBy === 'aluno' ? (c.noticeGiven ? 'Com antecedência' : `Sem aviso / <${settings.noticeHours}h`) : '—'}</td>
        <td><span class="mp-pill mp-pill-${status.level}">${Utils.escapeHtml(status.label)}</span></td>
        <td>
          ${canAct ? `
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--texto-suave);margin:0 6px 6px 0;">${c.makeupDate ? 'Reagendar' : 'Agendar reposição'}
              <input type="date" data-makeup-date="${c.id}" value="${c.makeupDate || ''}" style="width:auto;padding:6px 8px;font-size:13px;">
            </label>
            <button class="mp-btn mp-btn-ghost mp-btn-sm" data-makeup-status="reposta" data-cancel-id="${c.id}" type="button">Marcar reposta</button>
            ${c.cancelledBy === 'aluno' && canTransfer ? `<button class="mp-btn mp-btn-ghost mp-btn-sm" data-transfer="1" data-cancel-id="${c.id}" type="button">Transferir p/ próx. ciclo</button>` : ''}
          ` : ''}
          ${c.makeupStatus === 'reposta' ? `<button class="mp-btn mp-btn-ghost mp-btn-sm" data-makeup-undo="${c.id}" type="button">Desfazer</button>` : ''}
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
      <div class="mp-kpi"><div class="mp-kpi-label">Aulas dadas no ciclo</div><div class="mp-kpi-value">${dadas} / ${contratadas || '—'}</div>${mk.doneInCycle ? `<div class="mp-sub" style="margin:4px 0 0;font-size:12px;">inclui ${mk.doneInCycle} reposição(ões)</div>` : ''}</div>
      <div class="mp-kpi"><div class="mp-kpi-label">Aulas faltando</div><div class="mp-kpi-value">${faltam}</div></div>
      <div class="mp-kpi"><div class="mp-kpi-label">Reposições</div><div class="mp-kpi-value" style="font-size:19px;">${mk.pending} pendente(s) · ${mk.scheduled} agendada(s)</div></div>
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
    <div class="mp-table-scroll" style="margin-top:10px;">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Valor</th><th></th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
    </div>` : '<div class="mp-sub" style="margin:10px 0 0;">Nenhum pagamento registrado ainda.</div>'}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Desmarcações, reposições e férias</h3>
    <div class="mp-sub" style="margin-top:10px;">Registre cada desmarcação — o app calcula automaticamente o direito a reposição, o prazo, e a cobrança de férias.</div>
    <div class="mp-sub" style="background:var(--fundo);padding:12px 14px;border-radius:10px;margin:10px 0 16px;">
      ${generatePolicyParagraphs(settings).map((p) => `<p style="margin-bottom:6px;">${p}</p>`).join('')}
      <p style="margin:6px 0 0;font-size:12px;">Para ajustar essas regras, acesse <strong>⚙️ Configurações</strong>.</p>
    </div>
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
            <input type="checkbox" id="mp-c-notice" checked> Avisou com pelo menos ${settings.noticeHours}h de antecedência?
          </label>
        </div>
        <div class="mp-field" style="max-width:260px;"><label>Data da reposição (opcional)</label><input type="date" id="mp-c-makeup-date"></div>
        <div class="mp-sub" style="margin:0 0 6px;font-size:12.5px;">Se já combinou o dia da reposição, informe aqui. Ao registrar treino nesse dia, o app dá baixa sozinho.</div>
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
    <div class="mp-table-scroll" style="margin-top:14px;">
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
    invalidateAdminData();
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
      invalidateAdminData();
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
        makeupDate: container.querySelector('#mp-c-makeup-date')?.value || null,
        makeupDoneDate: null,
        transferCount: 0,
        createdAt: new Date().toISOString(),
      };
    }
    AppState.data.cancellations.push(record);
    invalidateAdminData();
    render();
    Utils.toast('Desmarcação registrada ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-makeup-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const record = AppState.data.cancellations.find((c) => c.id === btn.dataset.cancelId);
      if (!record) return;
      const today = Utils.todayISO();
      const suggested = record.makeupDate && record.makeupDate <= today ? record.makeupDate : today;
      const date = await makeupDateDialog(`Em que dia foi feita a reposição da aula de ${Utils.formatDateBR(record.classDate)}?`, suggested);
      if (!date) return;
      await setMakeupDone(record, date);
    });
  });

  container.querySelectorAll('[data-makeup-date]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const record = AppState.data.cancellations.find((c) => c.id === inp.dataset.makeupDate);
      if (!record) return;
      record.makeupDate = inp.value || null;
      invalidateAdminData();
      render();
      Utils.toast(record.makeupDate ? `Reposição agendada para ${Utils.formatDateBR(record.makeupDate)} ✓` : 'Agendamento removido', 'success');
      const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
      if (!ok) render();
    });
  });

  container.querySelectorAll('[data-makeup-undo]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const record = AppState.data.cancellations.find((c) => c.id === btn.dataset.makeupUndo);
      if (!record) return;
      record.makeupStatus = 'pendente';
      record.makeupDoneDate = null;
      invalidateAdminData();
      render();
      const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
      if (!ok) render();
    });
  });

  container.querySelectorAll('[data-transfer]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const record = AppState.data.cancellations.find((c) => c.id === btn.dataset.cancelId);
      if (!record) return;
      record.transferCount = (record.transferCount || 0) + 1;
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
      invalidateAdminData();
      render();
      await DB.delete(DB.STORES.cancellations, btn.dataset.delCancel);
    });
  });
}

// ---------- Reposições (v1.19.7) ----------
// Janela simples para escolher uma data (padrão: hoje). Devolve 'AAAA-MM-DD' ou null.
function makeupDateDialog(message, defaultISO) {
  return new Promise((resolve) => {
    const overlay = Utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <p class="modal__message">${Utils.escapeHtml(message)}</p>
          <input type="date" id="mp-mk-dlg-date" value="${defaultISO || Utils.todayISO()}" style="margin:6px 0 14px;">
          <div class="modal__actions">
            <button class="mp-btn mp-btn-ghost" data-action="cancel" type="button">Cancelar</button>
            <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;padding:10px 16px;font-size:13.5px;" data-action="confirm" type="button">Confirmar</button>
          </div>
        </div>
      </div>`);
    overlay.addEventListener('click', (e) => {
      const action = e.target.getAttribute('data-action');
      if (action === 'confirm') { const v = overlay.querySelector('#mp-mk-dlg-date').value; overlay.remove(); resolve(v || null); }
      if (action === 'cancel' || e.target === overlay) { overlay.remove(); resolve(null); }
    });
    document.body.appendChild(overlay);
  });
}

async function setMakeupDone(record, dateISO) {
  record.makeupStatus = 'reposta';
  record.makeupDoneDate = dateISO;
  invalidateAdminData();
  render();
  Utils.toast(`Reposição da aula de ${Utils.formatDateBR(record.classDate)} registrada em ${Utils.formatDateBR(dateISO)} ✓`, 'success');
  const ok = await AppShell.guardedPut(DB.STORES.cancellations, record);
  if (!ok) render();
}

// Chamado ao concluir o 1º exercício de um dia no Registro de Treino. Dá baixa sozinho na
// reposição agendada para esse dia; se o dia está fora da agenda fixa do aluno e há
// reposição em aberto, pergunta se o treino foi reposição.
async function makeupOnSession(dateISO) {
  const student = currentStudent();
  if (!student) return;
  const cancels = AppState.data.cancellations || [];
  if (cancels.some((c) => c.makeupStatus === 'reposta' && c.makeupDoneDate === dateISO)) return;
  const settings = AppState.settings || window.DEFAULT_SETTINGS;
  const cycles = PaymentLogic.buildCycles(student, AppState.data.payments || []);
  const rights = PaymentLogic.computeCancellationRights(cancels, cycles, settings);
  const open = PaymentLogic.openMakeups(cancels, rights).filter((c) => !c.classDate || c.classDate !== dateISO);
  if (!open.length) return;
  const scheduled = open.find((c) => c.makeupDate === dateISO);
  if (scheduled) { await setMakeupDone(scheduled, dateISO); return; }
  const weekDays = student.weekDays || [];
  const dow = DOW_KEYS[new Date(dateISO + 'T00:00:00').getDay()];
  if (!weekDays.length || weekDays.includes(dow)) return;
  const target = open.find((c) => !c.makeupDate) || open[0];
  const ok = await Utils.confirmDialog(`Este treino (${Utils.formatDateBR(dateISO)}) está fora dos dias fixos de ${student.name}. Ele foi a reposição da aula desmarcada em ${Utils.formatDateBR(target.classDate)}?`);
  if (ok) await setMakeupDone(target, dateISO);
}

window.MakeupLink = { onSession: makeupOnSession, dateDialog: makeupDateDialog };

window.PaymentsView = { renderHtml: payRenderHtml, bindEvents: payBindEvents };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['payments.js'] = 'v1.19.7';
