// Aba: Registro de Treino — checklist do plano do dia (com Borg CR-10 por exercício)
// + registro de exercício avulso fora do plano + histórico completo de sessões.

const BORG_LABELS = ['Repouso', 'Muito, muito leve', 'Fácil', 'Moderado', 'Um pouco difícil', 'Difícil', 'Difícil +', 'Muito difícil', 'Muito difícil +', 'Muito, muito difícil', 'Esforço máximo'];

function borgPillClass(v) {
  if (v <= 3) return 'mp-pill-leve';
  if (v <= 6) return 'mp-pill-moderado';
  return 'mp-pill-alto';
}

function execRenderHtml() {
  if (!AppState.execDate) AppState.execDate = Utils.todayISO();
  const execDate = AppState.execDate;
  const ex = exerciseList();
  const datalist = '<datalist id="mp-ex-list">' + ex.map((e) => `<option value="${Utils.escapeHtml(e)}">`).join('') + '</datalist>';
  const sorted = [...AppState.data.sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));

  const rows = sorted.map((s) => `
    <tr>
      <td>${Utils.formatDateBR(s.date)}</td>
      <td>${Utils.escapeHtml(s.exerciseName)}</td>
      <td>${s.series}×${s.reps}</td>
      <td>${s.load}${s.unit ? ' ' + Utils.escapeHtml(s.unit) : ''}</td>
      <td><span class="mp-pill ${borgPillClass(s.borg)}">${s.borg} · ${BORG_LABELS[s.borg]}</span></td>
      <td style="max-width:180px;color:var(--texto-suave);font-size:12.5px;">${Utils.escapeHtml(s.notes || '')}</td>
      <td><button class="mp-btn-danger" data-del-session="${s.id}" type="button">Excluir</button></td>
    </tr>`).join('');

  const plan = getPlanByDate(execDate);
  const planItens = plan ? plan.items : [];
  const pendentes = planItens.filter((it) => !it.completed);
  const concluidos = planItens.filter((it) => it.completed);

  const checklistCards = pendentes.map((it) => `
    <div class="mp-check-card" id="mp-check-${it.id}">
      <div class="mp-check-title">${Utils.escapeHtml(it.exerciseName)}<span class="mp-check-alvo">alvo: ${it.series}×${it.reps} · ${it.load}${it.unit ? ' ' + Utils.escapeHtml(it.unit) : ''}</span></div>
      <div class="mp-check-row">
        <div class="mp-field"><label>Séries</label><input type="number" min="0" step="1" id="mp-real-series-${it.id}" value="${it.series}"></div>
        <div class="mp-field"><label>Reps</label><input type="number" min="0" step="1" id="mp-real-reps-${it.id}" value="${it.reps}"></div>
        <div class="mp-field"><label>Carga</label><input type="number" min="0" step="0.5" id="mp-real-carga-${it.id}" value="${it.load}"></div>
        <div class="mp-field">
          <label>Borg <span id="mp-real-borg-num-${it.id}">5</span></label>
          <input type="range" min="0" max="10" step="1" value="5" id="mp-real-borg-${it.id}" data-borg-live="${it.id}">
        </div>
      </div>
      <div class="mp-form-actions">
        <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-concluir-item="${it.id}">✓ Concluir exercício</button>
      </div>
    </div>`).join('');

  const concluidosList = concluidos.length
    ? `<div class="mp-sub" style="margin-top:16px;">Concluídos hoje: ${concluidos.map((it) => Utils.escapeHtml(it.exerciseName)).join(', ')}</div>`
    : '';

  return `
  <div class="mp-card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h3 style="margin-bottom:0;">Executar plano da aula</h3>
      <div class="mp-field" style="margin:0;"><input type="date" id="mp-exec-date" value="${execDate}"></div>
    </div>
    <div class="mp-sub" style="margin-top:10px;">${planItens.length ? 'Marque cada exercício conforme for aplicando — os valores já vêm preenchidos com o alvo planejado, é só ajustar.' : 'Nenhum plano criado para esta data. Vá em "Planejar Aula" para montar a sequência com antecedência, ou registre um exercício avulso abaixo.'}</div>
    ${pendentes.length ? checklistCards : (planItens.length ? '<div class="mp-sub" style="margin:0;">Todos os exercícios planejados já foram concluídos hoje. 🎉</div>' : '')}
    ${concluidosList}
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Registrar exercício avulso (fora do plano)</h3>
    <div class="mp-sub">Use para lançar algo que não estava no plano, ou se você prefere registrar tudo manualmente.</div>
    <form id="mp-session-form">
      <div class="mp-form-row">
        <div class="mp-field"><label>Data</label><input type="date" id="mp-f-data" value="${execDate}" required></div>
        <div class="mp-field"><label>Exercício</label><input type="text" id="mp-f-exercicio" list="mp-ex-list" placeholder="Ex: Agachamento na cadeira" required></div>
        <div class="mp-field"><label>Séries</label><input type="number" id="mp-f-series" min="1" step="1" value="3" required></div>
        <div class="mp-field"><label>Repetições</label><input type="number" id="mp-f-reps" min="1" step="1" value="12" required></div>
      </div>
      ${datalist}
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Carga / Resistência</label><input type="number" id="mp-f-carga" min="0" step="0.5" value="0" required></div>
        <div class="mp-field"><label>Unidade</label>
          <select id="mp-f-unidade">
            <option value="kg">kg</option>
            <option value="nível">nível (elástico/máquina)</option>
            <option value="peso corporal">peso corporal</option>
            <option value="seg">segundos</option>
          </select>
        </div>
      </div>
      <div class="mp-field" style="margin-bottom:12px;">
        <label>Percepção de Esforço — Escala de Borg (CR-10)</label>
        <div class="mp-borg-wrap">
          <div class="mp-borg-top">
            <span class="mp-borg-value" id="mp-borg-num">5</span>
            <span class="mp-borg-label" id="mp-borg-lbl">Difícil</span>
          </div>
          <input type="range" id="mp-f-borg" min="0" max="10" step="1" value="5">
        </div>
      </div>
      <div class="mp-field" style="margin-bottom:14px;">
        <label>Observações (opcional)</label>
        <textarea id="mp-f-obs" placeholder="Dor, adaptação, execução, etc."></textarea>
      </div>
      <div class="mp-form-actions">
        <button type="button" id="mp-session-submit" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar registro</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de sessões</h3>
    ${sorted.length ? `
    <div style="overflow-x:auto;">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Exercício</th><th>Séries×Rep</th><th>Carga</th><th>Borg</th><th>Obs.</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>` : `<div class="mp-sub" style="margin:0;">Nenhum registro ainda. Lance a primeira sessão acima.</div>`}
  </div>`;
}

async function persistSession(session) {
  AppState.data.sessions.push(session);
  render();
  const ok = await AppShell.guardedPut(DB.STORES.sessions, session);
  if (!ok) render();
}

function bindEvents(container) {
  const execDateInput = container.querySelector('#mp-exec-date');
  if (execDateInput) execDateInput.addEventListener('change', () => { AppState.execDate = execDateInput.value; render(); });

  container.querySelectorAll('[data-borg-live]').forEach((slider) => {
    slider.addEventListener('input', () => {
      container.querySelector('#mp-real-borg-num-' + slider.dataset.borgLive).textContent = slider.value;
    });
  });

  container.querySelectorAll('[data-concluir-item]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const itemId = btn.dataset.concluirItem;
      const plan = getPlanByDate(AppState.execDate);
      const item = plan ? plan.items.find((it) => it.id === itemId) : null;
      if (!item) return;
      const realSeries = parseInt(container.querySelector('#mp-real-series-' + itemId).value, 10) || 0;
      const realReps = parseInt(container.querySelector('#mp-real-reps-' + itemId).value, 10) || 0;
      const realCarga = parseFloat(container.querySelector('#mp-real-carga-' + itemId).value) || 0;
      const realBorg = parseInt(container.querySelector('#mp-real-borg-' + itemId).value, 10) || 0;
      const session = {
        id: dbUuid(),
        ts: Date.now(),
        studentId: AppState.currentId,
        date: AppState.execDate,
        exerciseName: item.exerciseName,
        series: realSeries,
        reps: realReps,
        load: realCarga,
        unit: item.unit,
        borg: realBorg,
        notes: '',
        planItemId: item.id,
      };
      item.completed = true;
      item.sessionId = session.id;
      AppState.data.sessions.push(session);
      render();
      Utils.toast(item.exerciseName + ' concluído ✓', 'success');
      const ok1 = await AppShell.guardedPut(DB.STORES.sessions, session);
      const ok2 = await AppShell.guardedPut(DB.STORES.lessonPlans, plan);
      if (!ok1 || !ok2) render();
    });
  });

  const form = container.querySelector('#mp-session-form');
  if (form) {
    const borgInput = container.querySelector('#mp-f-borg');
    const borgNum = container.querySelector('#mp-borg-num');
    const borgLbl = container.querySelector('#mp-borg-lbl');
    borgInput.addEventListener('input', () => {
      const v = parseInt(borgInput.value, 10);
      borgNum.textContent = v;
      borgLbl.textContent = BORG_LABELS[v];
    });
    form.addEventListener('submit', (e) => e.preventDefault());
    const sessionBtn = container.querySelector('#mp-session-submit');
    if (sessionBtn) sessionBtn.addEventListener('click', async () => {
      const exerciseName = container.querySelector('#mp-f-exercicio').value.trim();
      if (!exerciseName) { Utils.toast('Preencha o nome do exercício.', 'error'); return; }
      const session = {
        id: dbUuid(),
        ts: Date.now(),
        studentId: AppState.currentId,
        date: container.querySelector('#mp-f-data').value || AppState.execDate,
        exerciseName,
        series: parseInt(container.querySelector('#mp-f-series').value, 10) || 0,
        reps: parseInt(container.querySelector('#mp-f-reps').value, 10) || 0,
        load: parseFloat(container.querySelector('#mp-f-carga').value) || 0,
        unit: container.querySelector('#mp-f-unidade').value,
        borg: parseInt(container.querySelector('#mp-f-borg').value, 10) || 0,
        notes: container.querySelector('#mp-f-obs').value.trim(),
        planItemId: null,
      };
      await persistSession(session);
      Utils.toast('Registro salvo ✓', 'success');
    });
  }

  container.querySelectorAll('[data-del-session]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir este registro de sessão?');
      if (!ok) return;
      AppState.data.sessions = AppState.data.sessions.filter((s) => s.id !== btn.dataset.delSession);
      render();
      await DB.delete(DB.STORES.sessions, btn.dataset.delSession);
    });
  });
}

window.ExecutionView = { renderHtml: execRenderHtml, bindEvents, BORG_LABELS, borgPillClass };
