// Progressão de Treino — vive dentro da seção "Fichas de treino" (Planejar Aula),
// operando sobre a Ficha ativa. Duas partes:
//  1) Teste de 1RM: reaproveita os exercícios já cadastrados na Ficha; ao registrar o teste,
//     sugere série/reps/%carga/descanso conforme Estágio + Objetivo do aluno (Metodologia
//     de Treinamento e Periodização, Parte 1 — Musculação).
//  2) Ajuste hierárquico: quando o treino "fica leve" antes da data de revisão da Ficha,
//     registra o ajuste seguindo a ordem reps → séries → descanso → carga, com histórico.

// ---------- Data de revisão da Ficha ----------

function reviewDateFieldHtml(template, fichaLetter) {
  const reviewDate = template?.reviewDate || '';
  const today = Utils.todayISO();
  let badge = '';
  if (reviewDate && reviewDate < today) {
    badge = `<span class="mp-pill mp-pill-alto">⚠ revisão vencida (${Utils.formatDateBR(reviewDate)})</span>`;
  } else if (reviewDate === today) {
    badge = `<span class="mp-pill mp-pill-alto">⚠ revisão é hoje</span>`;
  } else if (reviewDate) {
    badge = `<span class="mp-pill mp-pill-moderado">próxima revisão: ${Utils.formatDateBR(reviewDate)}</span>`;
  }
  return `
    <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin:14px 0;">
      <div class="mp-field" style="max-width:220px;margin:0;">
        <label>Data de revisão — Ficha ${fichaLetter}</label>
        <input type="date" id="mp-ficha-review-date" value="${reviewDate}">
      </div>
      ${badge}
    </div>
  `;
}

function bindReviewDateEvents(container, fichaLetter) {
  const input = container.querySelector('#mp-ficha-review-date');
  if (!input) return;
  input.addEventListener('change', async () => {
    const template = ensureTemplate(fichaLetter);
    template.reviewDate = input.value || null;
    render();
    await persistTemplate(template);
    Utils.toast('Data de revisão atualizada ✓', 'success');
  });
}

// ---------- Teste de 1RM ----------

function oneRmSectionHtml(fichaLetter, student, templateItems) {
  const forcaItems = templateItems.filter((it) => it.type !== 'aerobico');
  if (!forcaItems.length) {
    return `<div class="mp-sub" style="margin-top:14px;">Adicione exercícios de força à Ficha ${fichaLetter} acima para poder testar o 1RM.</div>`;
  }

  const guidance = (student?.stage && student?.objective) ? oneRmGuidance(student.stage, student.objective) : null;
  const guidanceMissing = !guidance ? `
    <div class="mp-inline-alert mp-inline-alert-moderado" style="margin:10px 0 0;">
      Defina o Estágio de treino e o Objetivo do aluno (no topo da tela) para receber a sugestão automática de carga/série/repetição a partir do 1RM.
    </div>` : '';

  const cards = forcaItems.map((it) => {
    const last = latestOneRm(fichaLetter, it.exerciseName);
    const suggestion = (last && guidance) ? oneRmSuggestedLoad(last.cargaTestada, guidance) : null;
    return `
    <div class="mp-check-card" id="mp-1rm-${it.id}">
      <div class="mp-check-title">${Utils.escapeHtml(it.exerciseName)}
        <span class="mp-check-alvo">${last ? `1RM atual: ${last.cargaTestada} kg (${Utils.formatDateBR(last.data)})` : 'Ainda não testado'}</span>
      </div>
      <div class="mp-check-row">
        <div class="mp-field" style="max-width:160px;">
          <label>Carga testada (1 execução)</label>
          <input type="number" min="0" step="0.5" id="mp-1rm-input-${it.id}" placeholder="kg">
        </div>
        <div class="mp-field" style="justify-content:flex-end;display:flex;">
          <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" style="margin-top:20px;" data-onerm-save="${it.id}" data-exercise="${Utils.escapeHtml(it.exerciseName)}">Registrar teste</button>
        </div>
      </div>
      ${suggestion ? `
      <div class="mp-inline-alert mp-inline-alert-leve" style="margin-top:10px;">
        <strong>Sugestão — ${stageLabel(student.stage)} · ${objectiveLabel(student.objective)} (${Utils.escapeHtml(guidance.metodologia)})</strong><br>
        Séries ${formatRangeLabel(guidance.series, '')} · Reps ${formatRangeLabel(guidance.reps, '')} ·
        Carga ${suggestion.loadMin}–${suggestion.loadMax} kg (${formatRangeLabel(guidance.pct, '%')} de 1RM) ·
        Descanso ${Utils.formatRestLabel(guidance.restSeconds[0])}${guidance.restSeconds[0] !== guidance.restSeconds[1] ? '–' + Utils.formatRestLabel(guidance.restSeconds[1]) : ''}
        <div class="mp-form-actions" style="justify-content:flex-start;margin-top:8px;">
          <button type="button" class="mp-btn mp-btn-gold mp-btn-sm" style="background:var(--verde-principal);color:#fff;" data-onerm-apply="${it.id}">✓ Aplicar à Ficha ${fichaLetter}</button>
        </div>
      </div>` : ''}
    </div>`;
  }).join('');

  return `${guidanceMissing}<div style="margin-top:14px;display:flex;flex-direction:column;gap:12px;">${cards}</div>`;
}

function bindOneRmEvents(container, fichaLetter) {
  container.querySelectorAll('[data-onerm-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.onermSave;
      const exerciseName = btn.dataset.exercise;
      const input = container.querySelector(`#mp-1rm-input-${itemId}`);
      const carga = parseFloat(input.value);
      if (!carga || carga <= 0) { Utils.toast('Informe a carga testada.', 'error'); return; }
      const test = {
        id: dbUuid(),
        ts: Date.now(),
        studentId: AppState.currentId,
        ficha: fichaLetter,
        exerciseName,
        cargaTestada: carga,
        data: Utils.todayISO(),
        observacao: '',
      };
      await persistOneRmTest(test);
      Utils.toast(`1RM de ${exerciseName} registrado ✓`, 'success');
    });
  });

  container.querySelectorAll('[data-onerm-apply]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.onermApply;
      const template = ensureTemplate(fichaLetter);
      const item = template.items.find((it) => it.id === itemId);
      const student = currentStudent();
      if (!item || !student?.stage || !student?.objective) return;
      const last = latestOneRm(fichaLetter, item.exerciseName);
      const guidance = oneRmGuidance(student.stage, student.objective);
      if (!last || !guidance) return;
      const suggestion = oneRmSuggestedLoad(last.cargaTestada, guidance);
      item.series = Math.round((guidance.series[0] + guidance.series[1]) / 2);
      item.reps = Math.round((guidance.reps[0] + guidance.reps[1]) / 2);
      item.load = Math.round(((suggestion.loadMin + suggestion.loadMax) / 2) * 2) / 2;
      item.restSeconds = Math.round((guidance.restSeconds[0] + guidance.restSeconds[1]) / 2);
      render();
      await persistTemplate(template);
      Utils.toast(`Ficha ${fichaLetter} atualizada com a sugestão ✓`, 'success');
    });
  });
}

// ---------- Ajuste hierárquico (reps → séries → descanso → carga) ----------

function adjustButtonHtml(item) {
  if (item.type === 'aerobico') return '';
  return `<button class="mp-btn mp-btn-ghost mp-btn-sm" data-adjust-open="${item.id}" type="button">🔧 Ajustar</button>`;
}

function adjustFormHtml(item, fichaLetter) {
  const history = adjustmentHistoryFor(fichaLetter, item.exerciseName);
  const suggested = nextSuggestedAdjustment(history);
  const currentValueFor = (type) => {
    if (type === 'reps') return item.reps;
    if (type === 'series') return item.series;
    if (type === 'descanso') return item.restSeconds;
    return item.load;
  };
  const historyHtml = history.length ? `
    <div class="mp-sub" style="margin-top:10px;margin-bottom:0;">Histórico recente: ${history.slice(0, 5).map((h) => `${adjustmentTypeLabel(h.tipoAjuste)} ${h.valorAnterior}→${h.valorNovo} (${Utils.formatDateBR(h.data)})`).join(' · ')}</div>
  ` : '';
  return `
    <div class="mp-card" style="background:var(--verde-pallido);margin-top:8px;padding:14px;box-shadow:none;">
      <div class="mp-sub" style="margin-top:0;color:var(--verde-principal);font-weight:700;">🔧 Ajustar "${Utils.escapeHtml(item.exerciseName)}" — próximo passo sugerido: ${adjustmentTypeLabel(suggested)}</div>
      <div class="mp-form-row mp-row3" style="margin-top:10px;">
        <div class="mp-field">
          <label>Tipo de ajuste</label>
          <select id="mp-adjust-tipo-${item.id}">
            ${ADJUSTMENT_TYPE_OPTIONS.map((o) => `<option value="${o.value}" ${o.value === suggested ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
        <div class="mp-field">
          <label>Valor novo</label>
          <input type="number" min="0" step="${suggested === 'carga' ? '0.5' : '1'}" id="mp-adjust-valor-${item.id}" value="${currentValueFor(suggested)}">
        </div>
        <div class="mp-field">
          <label>Observação (opcional)</label>
          <input type="text" id="mp-adjust-obs-${item.id}" placeholder="Ex: treino ficou leve">
        </div>
      </div>
      <div class="mp-form-actions" style="justify-content:space-between;">
        <button type="button" class="mp-btn mp-btn-outline mp-btn-sm" style="color:var(--texto-suave);border-color:var(--borda);" data-adjust-cancel="${item.id}">Cancelar</button>
        <button type="button" class="mp-btn mp-btn-gold mp-btn-sm" style="background:var(--verde-principal);color:#fff;" data-adjust-save="${item.id}">💾 Salvar ajuste</button>
      </div>
      ${historyHtml}
    </div>
  `;
}

function bindAdjustEvents(container, fichaLetter) {
  container.querySelectorAll('[data-adjust-open]').forEach((btn) => {
    btn.addEventListener('click', () => { AppState.fichaAdjustItemId = btn.dataset.adjustOpen; render(); });
  });
  container.querySelectorAll('[data-adjust-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => { AppState.fichaAdjustItemId = null; render(); });
  });

  const openId = AppState.fichaAdjustItemId;
  const tipoSelect = openId ? container.querySelector(`#mp-adjust-tipo-${openId}`) : null;
  const valorInput = openId ? container.querySelector(`#mp-adjust-valor-${openId}`) : null;
  if (tipoSelect && valorInput) {
    tipoSelect.addEventListener('change', () => {
      valorInput.step = tipoSelect.value === 'carga' ? '0.5' : '1';
    });
  }

  container.querySelectorAll('[data-adjust-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.adjustSave;
      const template = ensureTemplate(fichaLetter);
      const item = template.items.find((it) => it.id === itemId);
      if (!item) return;
      const tipo = container.querySelector(`#mp-adjust-tipo-${itemId}`).value;
      const novoValorRaw = parseFloat(container.querySelector(`#mp-adjust-valor-${itemId}`).value);
      const obs = container.querySelector(`#mp-adjust-obs-${itemId}`).value.trim();
      if (isNaN(novoValorRaw)) { Utils.toast('Informe o novo valor.', 'error'); return; }
      const novoValor = tipo === 'carga' ? novoValorRaw : Math.round(novoValorRaw);

      let valorAnterior;
      if (tipo === 'reps') { valorAnterior = item.reps; item.reps = novoValor; }
      else if (tipo === 'series') { valorAnterior = item.series; item.series = novoValor; }
      else if (tipo === 'descanso') { valorAnterior = item.restSeconds; item.restSeconds = novoValor; }
      else { valorAnterior = item.load; item.load = novoValor; }

      const adjustment = {
        id: dbUuid(),
        ts: Date.now(),
        studentId: AppState.currentId,
        ficha: fichaLetter,
        exerciseId: item.id,
        exerciseName: item.exerciseName,
        tipoAjuste: tipo,
        valorAnterior,
        valorNovo: novoValor,
        data: Utils.todayISO(),
        observacao: obs,
      };

      AppState.fichaAdjustItemId = null;
      render();
      await persistTemplate(template);
      await persistAdjustment(adjustment);
      Utils.toast('Ajuste registrado ✓', 'success');

      if (tipo === 'carga') {
        const resetReview = await Utils.confirmDialog(`Você ajustou a carga antes da data de revisão. Deseja limpar a data de revisão da Ficha ${fichaLetter} agora (você define a nova data quando quiser)?`);
        if (resetReview) {
          const tpl = ensureTemplate(fichaLetter);
          tpl.reviewDate = null;
          render();
          await persistTemplate(tpl);
        }
      }
    });
  });
}

window.ProgressionView = {
  reviewDateFieldHtml,
  bindReviewDateEvents,
  oneRmSectionHtml,
  bindOneRmEvents,
  adjustButtonHtml,
  adjustFormHtml,
  bindAdjustEvents,
};
