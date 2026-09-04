// Aba: Planejar Aula com Antecedência

function fmtDate(iso) { return Utils.formatDateBR(iso); }

const restLabel = Utils.formatRestLabel;

// Colunas "Séries×Rep" e "Carga" de um item de plano/ficha — resumo diferente conforme o
// tipo (força usa séries/reps/carga; aeróbico usa tempo/velocidade/inclinação/carga).
function planItemDetailCells(it) {
  if (it.type === 'aerobico') {
    return `<td>—</td><td>${Utils.escapeHtml(formatAerobicSummary(it))}</td>`;
  }
  return `<td>${it.series}×${it.reps}</td><td>${it.load} ${Utils.escapeHtml(formatUnitLabel(it.unit, it.unitDetail))}</td>`;
}

function planItemNameCell(it) {
  return `${Utils.escapeHtml(it.exerciseName)}${it.type === 'aerobico' ? ' <span class="mp-pill mp-pill-moderado" style="margin-left:4px;">aeróbico</span>' : ''}`;
}

// Bloco de formulário reutilizável (Planejar Aula do dia + Fichas de treino): toggle
// Força/Aeróbico, com os campos correspondentes. idPrefix distingue os ids na página
// (ex: "mp-p" para o plano do dia, "mp-t" para a ficha-modelo).
function exerciseItemFormHtml(idPrefix, editingItem, elasticColors, datalistId) {
  const type = editingItem?.type === 'aerobico' ? 'aerobico' : 'forca';
  const forcaItem = type === 'forca' ? editingItem : null;
  const aerobicoItem = type === 'aerobico' ? editingItem : null;
  return `
    <div class="mp-field" style="max-width:260px;">
      <label>Tipo de treino</label>
      <select id="${idPrefix}-tipo">
        <option value="forca" ${type === 'forca' ? 'selected' : ''}>Força (musculação)</option>
        <option value="aerobico" ${type === 'aerobico' ? 'selected' : ''}>Aeróbico</option>
      </select>
    </div>
    <div id="${idPrefix}-forca-fields" style="${type === 'forca' ? '' : 'display:none;'}">
      <div class="mp-form-row">
        <div class="mp-field"><label>Exercício</label><input type="text" id="${idPrefix}-exercicio" list="${datalistId}" placeholder="Ex: Remada sentada" value="${forcaItem ? Utils.escapeHtml(forcaItem.exerciseName) : ''}"></div>
        <div class="mp-field"><label>Séries alvo</label><input type="number" id="${idPrefix}-series" min="1" step="1" value="${forcaItem ? forcaItem.series : 3}"></div>
        <div class="mp-field"><label>Reps alvo</label><input type="number" id="${idPrefix}-reps" min="1" step="1" value="${forcaItem ? forcaItem.reps : 12}"></div>
        <div class="mp-field"><label>Carga alvo</label><input type="number" id="${idPrefix}-carga" min="0" step="0.5" value="${forcaItem ? forcaItem.load : 0}"></div>
      </div>
      <div class="mp-form-row mp-row2">
        ${unitFieldHtml(idPrefix, forcaItem?.unit || '', forcaItem?.unitDetail || '', elasticColors)}
        <div class="mp-field">
          <label>Tempo de descanso</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input type="number" id="${idPrefix}-rest-min" min="0" step="1" value="${forcaItem ? Math.floor(forcaItem.restSeconds / 60) : 1}" style="width:70px;" aria-label="Minutos">
            <span style="font-size:12.5px;color:var(--texto-suave);">min</span>
            <input type="number" id="${idPrefix}-rest-sec" min="0" max="59" step="5" value="${forcaItem ? forcaItem.restSeconds % 60 : 0}" style="width:70px;" aria-label="Segundos">
            <span style="font-size:12.5px;color:var(--texto-suave);">seg</span>
          </div>
        </div>
      </div>
    </div>
    <div id="${idPrefix}-aerobico-fields" style="${type === 'aerobico' ? '' : 'display:none;'}">
      <div class="mp-form-row mp-row4">
        ${aerobicFieldHtml(idPrefix, aerobicoItem)}
      </div>
    </div>
  `;
}

function bindExerciseItemFormEvents(container, idPrefix) {
  const typeSelect = container.querySelector(`#${idPrefix}-tipo`);
  const forcaWrap = container.querySelector(`#${idPrefix}-forca-fields`);
  const aerobicoWrap = container.querySelector(`#${idPrefix}-aerobico-fields`);
  typeSelect?.addEventListener('change', () => {
    if (forcaWrap) forcaWrap.style.display = typeSelect.value === 'forca' ? '' : 'none';
    if (aerobicoWrap) aerobicoWrap.style.display = typeSelect.value === 'aerobico' ? '' : 'none';
  });
  bindUnitFieldEvents(container, idPrefix);
  bindAerobicFieldEvents(container, idPrefix);
}

// Lê o formulário (força ou aeróbico, conforme o toggle) e devolve o item pronto para salvar,
// ou { error } se faltar algo obrigatório.
function readExerciseItemForm(container, idPrefix) {
  const type = container.querySelector(`#${idPrefix}-tipo`).value;
  if (type === 'aerobico') {
    const aerobic = readAerobicFieldValues(container, idPrefix);
    if (!aerobic.aerobicType) return { error: 'Selecione o tipo de treino aeróbico.' };
    return {
      type: 'aerobico',
      exerciseName: aerobicTypeLabel(aerobic.aerobicType, aerobic.aerobicTypeCustom),
      aerobicType: aerobic.aerobicType,
      aerobicTypeCustom: aerobic.aerobicTypeCustom,
      durationMinutes: aerobic.durationMinutes,
      speed: aerobic.speed,
      incline: aerobic.incline,
      load: aerobic.load,
      restSeconds: 0,
    };
  }
  const exerciseName = container.querySelector(`#${idPrefix}-exercicio`).value.trim();
  if (!exerciseName) return { error: 'Preencha o nome do exercício.' };
  const restMin = parseInt(container.querySelector(`#${idPrefix}-rest-min`).value, 10) || 0;
  const restSec = parseInt(container.querySelector(`#${idPrefix}-rest-sec`).value, 10) || 0;
  const { unit, unitDetail } = readUnitFieldValues(container, idPrefix);
  return {
    type: 'forca',
    exerciseName,
    series: parseInt(container.querySelector(`#${idPrefix}-series`).value, 10) || 0,
    reps: parseInt(container.querySelector(`#${idPrefix}-reps`).value, 10) || 0,
    load: parseFloat(container.querySelector(`#${idPrefix}-carga`).value) || 0,
    unit,
    unitDetail,
    restSeconds: restMin * 60 + restSec,
  };
}

function planRenderHtml() {
  if (!AppState.planDate) AppState.planDate = Utils.todayISO();
  const planDate = AppState.planDate;
  const student = currentStudent();
  const ex = exerciseList();
  const datalist = '<datalist id="mp-ex-list-plano">' + ex.map((e) => `<option value="${Utils.escapeHtml(e)}">`).join('') + '</datalist>';
  const plan = getPlanByDate(planDate);
  const itens = plan ? plan.items : [];
  const elasticColors = elasticColorList();

  const otherPlans = AppState.data.plans
    .filter((p) => p.date !== planDate && p.items.length)
    .sort((a, b) => b.date.localeCompare(a.date));
  const otherPlansOptions = otherPlans.map((p) =>
    `<option value="${p.id}">${fmtDate(p.date)} · ${p.items.length} exercícios</option>`
  ).join('');

  const editingId = AppState.planEditItemId;
  const editingItem = editingId ? itens.find((it) => it.id === editingId) || null : null;

  const itemRows = itens.map((it, i) => `
    <tr${it.id === editingId ? ' style="background:var(--verde-pallido);"' : ''}>
      <td>${i + 1}</td>
      <td>${planItemNameCell(it)}</td>
      ${planItemDetailCells(it)}
      <td>${it.type === 'aerobico' ? '—' : restLabel(it.restSeconds)}</td>
      <td>${it.completed ? '<span class="mp-pill mp-pill-leve">concluído</span>' : '<span class="mp-pill" style="background:var(--borda);color:var(--texto-suave);">pendente</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="mp-btn mp-btn-ghost mp-btn-sm" data-edit-planitem="${it.id}" type="button">${it.id === editingId ? 'Editando…' : 'Editar'}</button>
        <button class="mp-btn-danger" data-del-planitem="${it.id}" type="button">Remover</button>
      </td>
    </tr>`).join('');

  const printRows = itens.map((it, i) => `
    <tr>
      <td>${i + 1}. ${Utils.escapeHtml(it.exerciseName)}</td>
      <td>${it.type === 'aerobico' ? Utils.escapeHtml(formatAerobicSummary(it)) : `${it.series}×${it.reps} · ${it.load} ${Utils.escapeHtml(formatUnitLabel(it.unit, it.unitDetail))} · desc: ${restLabel(it.restSeconds)}`}</td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
      <td class="mp-print-blank"></td>
    </tr>`).join('');

  // ---------- Fichas de treino (modelos reutilizáveis A–E) ----------
  const fichaLetter = AppState.planFicha || 'A';
  const template = getTemplate(fichaLetter);
  const templateItems = template ? template.items : [];
  const fichaEditingId = AppState.planFichaEditItemId;
  const fichaEditingItem = fichaEditingId ? templateItems.find((it) => it.id === fichaEditingId) || null : null;

  const fichaItemRows = templateItems.map((it, i) => `
    <tr${it.id === fichaEditingId ? ' style="background:var(--verde-pallido);"' : ''}>
      <td>${i + 1}</td>
      <td>${planItemNameCell(it)}</td>
      ${planItemDetailCells(it)}
      <td>${it.type === 'aerobico' ? '—' : restLabel(it.restSeconds)}</td>
      <td style="white-space:nowrap;">
        <button class="mp-btn mp-btn-ghost mp-btn-sm" data-edit-fichaitem="${it.id}" type="button">${it.id === fichaEditingId ? 'Editando…' : 'Editar'}</button>
        <button class="mp-btn-danger" data-del-fichaitem="${it.id}" type="button">Remover</button>
      </td>
    </tr>`).join('');

  return `
  <div class="mp-card">
    <h3>Planejar aula com antecedência</h3>
    <div class="mp-sub">Monte a sequência de exercícios antes da aula. Na hora de dar a aula, é só abrir "Registro de Treino" e marcar cada item conforme for executando — sem digitar tudo de novo.</div>
    <div style="margin:-4px 0 14px;"><span class="mp-pill mp-pill-moderado">Atividade: ${Utils.escapeHtml(activityTypeLabel(student))}</span></div>
    <div class="mp-form-row mp-row3" style="margin-bottom:10px;">
      <div class="mp-field"><label>Data da aula</label><input type="date" id="mp-plan-date" value="${planDate}"></div>
      <div class="mp-field"><label>Estágio de treino do aluno</label>
        <select id="mp-plan-stage">
          <option value="">Não definido</option>
          ${STAGE_OPTIONS.map((s) => `<option value="${s.value}" ${student?.stage === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      <div class="mp-field"><label>Ficha aplicada hoje</label>
        <select id="mp-plan-ficha">
          <option value="">Nenhuma</option>
          ${FICHA_OPTIONS.map((f) => `<option value="${f}" ${plan?.ficha === f ? 'selected' : ''}>Ficha ${f}</option>`).join('')}
        </select>
      </div>
    </div>
    ${plan?.ficha ? `
    <div class="mp-form-actions" style="justify-content:flex-start;margin:0 0 18px;">
      <button class="mp-btn mp-btn-ghost mp-btn-sm" id="mp-plan-load-ficha" type="button">📋 Carregar exercícios da Ficha ${plan.ficha} no plano de hoje</button>
    </div>` : '<div style="margin-bottom:18px;"></div>'}
    ${otherPlans.length ? `
    <div class="mp-form-row mp-row2" style="margin-bottom:18px;">
      <div class="mp-field"><label>Reaproveitar plano anterior</label>
        <div style="display:flex;gap:8px;">
          <select id="mp-plan-base" class="mp-select-inline" style="flex:1;">${otherPlansOptions}</select>
          <button class="mp-btn mp-btn-ghost mp-btn-sm" id="mp-plan-duplicate" type="button">Usar como base</button>
        </div>
      </div>
      <div></div>
    </div>` : ''}

    <form id="mp-planitem-form">
      ${editingItem ? `<div class="mp-sub" style="margin-top:0;color:var(--verde-principal);font-weight:700;">✏️ Editando "${Utils.escapeHtml(editingItem.exerciseName)}" — ajuste os valores e salve.</div>` : ''}
      ${exerciseItemFormHtml('mp-p', editingItem, elasticColors, 'mp-ex-list-plano')}
      ${datalist}
      <div class="mp-form-actions" style="${editingItem ? 'justify-content:space-between;' : ''}">
        ${editingItem ? '<button type="button" id="mp-planitem-cancel-edit" class="mp-btn mp-btn-outline" style="color:var(--texto-suave);border-color:var(--borda);">Cancelar edição</button>' : ''}
        <button type="button" id="mp-planitem-submit" class="mp-btn ${editingItem ? 'mp-btn-gold' : 'mp-btn-ghost'}" style="${editingItem ? 'background:var(--verde-principal);color:#fff;' : 'border-color:var(--verde-suave);color:var(--verde-principal);'}">${editingItem ? '💾 Salvar alterações' : '+ Adicionar ao plano'}</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h3 style="margin-bottom:0;">Sequência da aula — ${fmtDate(planDate)}${plan?.ficha ? ` <span class="mp-pill mp-pill-moderado">Ficha ${plan.ficha}</span>` : ''}</h3>
      ${itens.length ? `<button class="mp-btn mp-btn-outline" style="color:var(--verde-principal);border-color:var(--verde-suave);" id="mp-plan-print" type="button">🖨 Imprimir plano (backup sem internet)</button>` : ''}
    </div>
    <div class="mp-sub" style="margin-top:10px;">${itens.length ? 'Leve este plano impresso para lugares sem internet — anote os valores reais à mão e transcreva no painel depois.' : 'Nenhum exercício adicionado ainda para esta data.'}</div>
    ${itens.length ? `
    <div class="mp-table-scroll">
    <table class="mp-table">
      <thead><tr><th>#</th><th>Exercício</th><th>Séries×Rep</th><th>Carga</th><th>Descanso</th><th>Status</th><th></th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    </div>` : ''}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>🗂️ Fichas de treino (modelos reutilizáveis)</h3>
    <div class="mp-sub" style="margin-top:10px;">Monte cada ficha uma vez; ajuste os exercícios sempre que a fase de treino do aluno evoluir (adaptação → intermediário → avançado). Aplicar uma ficha em "Planejar aula" copia os exercícios dela para aquele dia — editar a ficha depois não muda dias já registrados.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;">
      ${FICHA_OPTIONS.map((f) => {
        const count = getTemplate(f)?.items.length || 0;
        const active = fichaLetter === f;
        return `<button type="button" class="mp-btn ${active ? 'mp-btn-gold' : 'mp-btn-ghost'}" style="${active ? 'background:var(--verde-principal);color:#fff;' : 'border-color:var(--verde-suave);color:var(--verde-principal);'}" data-ficha-tab="${f}">Ficha ${f}${count ? ` (${count})` : ''}</button>`;
      }).join('')}
    </div>

    <form id="mp-ficha-form">
      ${fichaEditingItem ? `<div class="mp-sub" style="margin-top:0;color:var(--verde-principal);font-weight:700;">✏️ Editando "${Utils.escapeHtml(fichaEditingItem.exerciseName)}" da Ficha ${fichaLetter}</div>` : ''}
      ${exerciseItemFormHtml('mp-t', fichaEditingItem, elasticColors, 'mp-ex-list-plano')}
      <div class="mp-form-actions" style="${fichaEditingItem ? 'justify-content:space-between;' : ''}">
        ${fichaEditingItem ? '<button type="button" id="mp-ficha-cancel-edit" class="mp-btn mp-btn-outline" style="color:var(--texto-suave);border-color:var(--borda);">Cancelar edição</button>' : ''}
        <button type="button" id="mp-ficha-item-submit" class="mp-btn ${fichaEditingItem ? 'mp-btn-gold' : 'mp-btn-ghost'}" style="${fichaEditingItem ? 'background:var(--verde-principal);color:#fff;' : 'border-color:var(--verde-suave);color:var(--verde-principal);'}">${fichaEditingItem ? '💾 Salvar alterações' : `+ Adicionar à Ficha ${fichaLetter}`}</button>
      </div>
    </form>

    ${templateItems.length ? `
    <div class="mp-table-scroll" style="margin-top:14px;">
    <table class="mp-table">
      <thead><tr><th>#</th><th>Exercício</th><th>Séries×Rep</th><th>Carga</th><th>Descanso</th><th></th></tr></thead>
      <tbody>${fichaItemRows}</tbody>
    </table>
    </div>` : `<div class="mp-sub" style="margin:14px 0 0;">Nenhum exercício na Ficha ${fichaLetter} ainda.</div>`}
  </div>

  <div id="mp-print-area" class="mp-print-only">
    <h2 style="font-family:Georgia,serif;">Método Pleno — Plano de Aula</h2>
    <div>Aluno: ${Utils.escapeHtml(currentStudent()?.name || '')} &nbsp;·&nbsp; Data: ${fmtDate(planDate)}${plan?.ficha ? ` &nbsp;·&nbsp; Ficha ${plan.ficha}` : ''}</div>
    <table class="mp-print-table">
      <thead><tr><th>Exercício</th><th>Alvo (séries×rep · carga)</th><th>Séries real</th><th>Reps real</th><th>Carga real</th><th>Borg</th></tr></thead>
      <tbody>${printRows}</tbody>
    </table>
  </div>`;
}

function planBindEvents(container) {
  const planDateInput = container.querySelector('#mp-plan-date');
  if (planDateInput) planDateInput.addEventListener('change', () => { AppState.planDate = planDateInput.value; AppState.planEditItemId = null; render(); });

  const stageSelect = container.querySelector('#mp-plan-stage');
  if (stageSelect) stageSelect.addEventListener('change', async () => {
    await updateCurrentStudent({ stage: stageSelect.value });
    AppState.students = await StudentsData.listStudents();
    Utils.toast('Estágio de treino atualizado ✓', 'success');
  });

  const fichaSelect = container.querySelector('#mp-plan-ficha');
  if (fichaSelect) fichaSelect.addEventListener('change', async () => {
    const target = ensurePlan(AppState.planDate);
    target.ficha = fichaSelect.value || null;
    render();
    await AppShell.guardedPut(DB.STORES.lessonPlans, target);
  });

  const loadFichaBtn = container.querySelector('#mp-plan-load-ficha');
  if (loadFichaBtn) loadFichaBtn.addEventListener('click', async () => {
    const plan = getPlanByDate(AppState.planDate);
    const fichaLetter = plan?.ficha;
    if (!fichaLetter) return;
    const template = getTemplate(fichaLetter);
    if (!template || !template.items.length) { Utils.toast(`A Ficha ${fichaLetter} ainda não tem exercícios cadastrados.`, 'error'); return; }
    const target = ensurePlan(AppState.planDate);
    template.items.forEach((it) => {
      target.items.push({ ...it, id: dbUuid(), completed: false, sessionId: null });
    });
    AppState.planEditItemId = null;
    render();
    await AppShell.guardedPut(DB.STORES.lessonPlans, target);
    Utils.toast(`Exercícios da Ficha ${fichaLetter} carregados ✓`, 'success');
  });

  bindExerciseItemFormEvents(container, 'mp-p');

  const planDupBtn = container.querySelector('#mp-plan-duplicate');
  if (planDupBtn) planDupBtn.addEventListener('click', async () => {
    const baseSelect = container.querySelector('#mp-plan-base');
    const basePlan = AppState.data.plans.find((p) => p.id === baseSelect.value);
    if (!basePlan) return;
    const target = ensurePlan(AppState.planDate);
    basePlan.items.forEach((it) => {
      target.items.push({ ...it, id: dbUuid(), completed: false, sessionId: null });
    });
    AppState.planEditItemId = null;
    render();
    await AppShell.guardedPut(DB.STORES.lessonPlans, target);
    Utils.toast('Plano copiado ✓', 'success');
  });

  const planItemBtn = container.querySelector('#mp-planitem-submit');
  if (planItemBtn) {
    planItemBtn.addEventListener('click', async () => {
      const result = readExerciseItemForm(container, 'mp-p');
      if (result.error) { Utils.toast(result.error, 'error'); return; }
      const plan = ensurePlan(AppState.planDate);

      if (AppState.planEditItemId) {
        const item = plan.items.find((it) => it.id === AppState.planEditItemId);
        if (!item) { AppState.planEditItemId = null; render(); return; }
        Object.assign(item, result);
        AppState.planEditItemId = null;
        render();
        Utils.toast('Exercício atualizado ✓', 'success');
      } else {
        plan.items.push({ id: dbUuid(), ...result, completed: false, sessionId: null });
        render();
        Utils.toast('Adicionado ao plano ✓', 'success');
      }
      await AppShell.guardedPut(DB.STORES.lessonPlans, plan);
    });
  }

  const planItemCancelBtn = container.querySelector('#mp-planitem-cancel-edit');
  if (planItemCancelBtn) planItemCancelBtn.addEventListener('click', () => { AppState.planEditItemId = null; render(); });

  container.querySelectorAll('[data-edit-planitem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      AppState.planEditItemId = btn.dataset.editPlanitem;
      render();
      const form = document.getElementById('mp-planitem-form');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  container.querySelectorAll('[data-del-planitem]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const plan = getPlanByDate(AppState.planDate);
      if (plan) plan.items = plan.items.filter((it) => it.id !== btn.dataset.delPlanitem);
      if (AppState.planEditItemId === btn.dataset.delPlanitem) AppState.planEditItemId = null;
      render();
      if (plan) await AppShell.guardedPut(DB.STORES.lessonPlans, plan);
    });
  });

  const printBtn = container.querySelector('#mp-plan-print');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // ---------- Fichas de treino ----------
  container.querySelectorAll('[data-ficha-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      AppState.planFicha = btn.dataset.fichaTab;
      AppState.planFichaEditItemId = null;
      render();
    });
  });

  bindExerciseItemFormEvents(container, 'mp-t');

  const fichaItemBtn = container.querySelector('#mp-ficha-item-submit');
  if (fichaItemBtn) {
    fichaItemBtn.addEventListener('click', async () => {
      const result = readExerciseItemForm(container, 'mp-t');
      if (result.error) { Utils.toast(result.error, 'error'); return; }
      const template = ensureTemplate(AppState.planFicha);

      if (AppState.planFichaEditItemId) {
        const item = template.items.find((it) => it.id === AppState.planFichaEditItemId);
        if (!item) { AppState.planFichaEditItemId = null; render(); return; }
        Object.assign(item, result);
        AppState.planFichaEditItemId = null;
        render();
        Utils.toast('Exercício da ficha atualizado ✓', 'success');
      } else {
        template.items.push({ id: dbUuid(), ...result });
        render();
        Utils.toast(`Adicionado à Ficha ${AppState.planFicha} ✓`, 'success');
      }
      await persistTemplate(template);
    });
  }

  const fichaCancelBtn = container.querySelector('#mp-ficha-cancel-edit');
  if (fichaCancelBtn) fichaCancelBtn.addEventListener('click', () => { AppState.planFichaEditItemId = null; render(); });

  container.querySelectorAll('[data-edit-fichaitem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      AppState.planFichaEditItemId = btn.dataset.editFichaitem;
      render();
      const form = document.getElementById('mp-ficha-form');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  container.querySelectorAll('[data-del-fichaitem]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const template = ensureTemplate(AppState.planFicha);
      template.items = template.items.filter((it) => it.id !== btn.dataset.delFichaitem);
      if (AppState.planFichaEditItemId === btn.dataset.delFichaitem) AppState.planFichaEditItemId = null;
      render();
      await persistTemplate(template);
    });
  });
}

window.PlanningView = { renderHtml: planRenderHtml, bindEvents: planBindEvents };
