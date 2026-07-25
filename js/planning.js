// Aba: Planejar Aula com Antecedência

function fmtDate(iso) { return Utils.formatDateBR(iso); }

function planRenderHtml() {
  if (!AppState.planDate) AppState.planDate = Utils.todayISO();
  const planDate = AppState.planDate;
  const ex = exerciseList();
  const datalist = '<datalist id="mp-ex-list-plano">' + ex.map((e) => `<option value="${Utils.escapeHtml(e)}">`).join('') + '</datalist>';
  const plan = getPlanByDate(planDate);
  const itens = plan ? plan.items : [];

  const otherPlans = AppState.data.plans
    .filter((p) => p.date !== planDate && p.items.length)
    .sort((a, b) => b.date.localeCompare(a.date));
  const otherPlansOptions = otherPlans.map((p) =>
    `<option value="${p.id}">${fmtDate(p.date)} · ${p.items.length} exercícios</option>`
  ).join('');

  const itemRows = itens.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${Utils.escapeHtml(it.exerciseName)}</td>
      <td>${it.series}×${it.reps}</td>
      <td>${it.load}${it.unit ? ' ' + Utils.escapeHtml(it.unit) : ''}</td>
      <td>${it.completed ? '<span class="mp-pill mp-pill-leve">concluído</span>' : '<span class="mp-pill" style="background:var(--borda);color:var(--texto-suave);">pendente</span>'}</td>
      <td><button class="mp-btn-danger" data-del-planitem="${it.id}" type="button">Remover</button></td>
    </tr>`).join('');

  const printRows = itens.map((it, i) => `
    <tr>
      <td>${i + 1}. ${Utils.escapeHtml(it.exerciseName)}</td>
      <td>${it.series}×${it.reps} · ${it.load}${it.unit ? ' ' + Utils.escapeHtml(it.unit) : ''}</td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
    </tr>`).join('');

  return `
  <div class="mp-card">
    <h3>Planejar aula com antecedência</h3>
    <div class="mp-sub">Monte a sequência de exercícios antes da aula. Na hora de dar a aula, é só abrir "Registro de Treino" e marcar cada item conforme for executando — sem digitar tudo de novo.</div>
    <div class="mp-form-row mp-row2" style="margin-bottom:18px;">
      <div class="mp-field"><label>Data da aula</label><input type="date" id="mp-plan-date" value="${planDate}"></div>
      ${otherPlans.length ? `
      <div class="mp-field"><label>Reaproveitar plano anterior</label>
        <div style="display:flex;gap:8px;">
          <select id="mp-plan-base" class="mp-select-inline" style="flex:1;">${otherPlansOptions}</select>
          <button class="mp-btn mp-btn-ghost mp-btn-sm" id="mp-plan-duplicate" type="button">Usar como base</button>
        </div>
      </div>` : ''}
    </div>

    <form id="mp-planitem-form">
      <div class="mp-form-row">
        <div class="mp-field"><label>Exercício</label><input type="text" id="mp-p-exercicio" list="mp-ex-list-plano" placeholder="Ex: Remada sentada" required></div>
        <div class="mp-field"><label>Séries alvo</label><input type="number" id="mp-p-series" min="1" step="1" value="3" required></div>
        <div class="mp-field"><label>Reps alvo</label><input type="number" id="mp-p-reps" min="1" step="1" value="12" required></div>
        <div class="mp-field"><label>Carga alvo</label><input type="number" id="mp-p-carga" min="0" step="0.5" value="0" required></div>
      </div>
      ${datalist}
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Unidade</label>
          <select id="mp-p-unidade">
            <option value="kg">kg</option>
            <option value="nível">nível (elástico/máquina)</option>
            <option value="peso corporal">peso corporal</option>
            <option value="seg">segundos</option>
          </select>
        </div>
        <div></div>
      </div>
      <div class="mp-form-actions">
        <button type="button" id="mp-planitem-submit" class="mp-btn mp-btn-ghost" style="border-color:var(--verde-suave);color:var(--verde-principal);">+ Adicionar ao plano</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h3 style="margin-bottom:0;">Sequência da aula — ${fmtDate(planDate)}</h3>
      ${itens.length ? `<button class="mp-btn mp-btn-outline" style="color:var(--verde-principal);border-color:var(--verde-suave);" id="mp-plan-print" type="button">🖨 Imprimir plano (backup sem internet)</button>` : ''}
    </div>
    <div class="mp-sub" style="margin-top:10px;">${itens.length ? 'Leve este plano impresso para lugares sem internet — anote os valores reais à mão e transcreva no painel depois.' : 'Nenhum exercício adicionado ainda para esta data.'}</div>
    ${itens.length ? `
    <div style="overflow-x:auto;">
    <table class="mp-table">
      <thead><tr><th>#</th><th>Exercício</th><th>Séries×Rep</th><th>Carga</th><th>Status</th><th></th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    </div>` : ''}
  </div>

  <div id="mp-print-area" class="mp-print-only">
    <h2 style="font-family:Georgia,serif;">Método Pleno — Plano de Aula</h2>
    <div>Aluno: ${Utils.escapeHtml(currentStudent()?.name || '')} &nbsp;·&nbsp; Data: ${fmtDate(planDate)}</div>
    <table class="mp-print-table">
      <thead><tr><th>Exercício</th><th>Alvo (séries×rep · carga)</th><th>Séries real</th><th>Reps real</th><th>Carga real</th><th>Borg</th></tr></thead>
      <tbody>${printRows}</tbody>
    </table>
  </div>`;
}

function bindEvents(container) {
  const planDateInput = container.querySelector('#mp-plan-date');
  if (planDateInput) planDateInput.addEventListener('change', () => { AppState.planDate = planDateInput.value; render(); });

  const planDupBtn = container.querySelector('#mp-plan-duplicate');
  if (planDupBtn) planDupBtn.addEventListener('click', async () => {
    const baseSelect = container.querySelector('#mp-plan-base');
    const basePlan = AppState.data.plans.find((p) => p.id === baseSelect.value);
    if (!basePlan) return;
    const target = ensurePlan(AppState.planDate);
    basePlan.items.forEach((it) => {
      target.items.push({ ...it, id: dbUuid(), completed: false, sessionId: null });
    });
    render();
    await AppShell.guardedPut(DB.STORES.lessonPlans, target);
    Utils.toast('Plano copiado ✓', 'success');
  });

  const planItemBtn = container.querySelector('#mp-planitem-submit');
  if (planItemBtn) {
    planItemBtn.addEventListener('click', async () => {
      const exerciseName = container.querySelector('#mp-p-exercicio').value.trim();
      if (!exerciseName) { Utils.toast('Preencha o nome do exercício.', 'error'); return; }
      const item = {
        id: dbUuid(),
        exerciseName,
        series: parseInt(container.querySelector('#mp-p-series').value, 10) || 0,
        reps: parseInt(container.querySelector('#mp-p-reps').value, 10) || 0,
        load: parseFloat(container.querySelector('#mp-p-carga').value) || 0,
        unit: container.querySelector('#mp-p-unidade').value,
        completed: false,
        sessionId: null,
      };
      const plan = ensurePlan(AppState.planDate);
      plan.items.push(item);
      render();
      Utils.toast('Adicionado ao plano ✓', 'success');
      await AppShell.guardedPut(DB.STORES.lessonPlans, plan);
    });
  }

  container.querySelectorAll('[data-del-planitem]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plan = getPlanByDate(AppState.planDate);
      if (plan) plan.items = plan.items.filter((it) => it.id !== btn.dataset.delPlanitem);
      render();
      if (plan) await AppShell.guardedPut(DB.STORES.lessonPlans, plan);
    });
  });

  const printBtn = container.querySelector('#mp-plan-print');
  if (printBtn) printBtn.addEventListener('click', () => window.print());
}

window.PlanningView = { renderHtml: planRenderHtml, bindEvents };
