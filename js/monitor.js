// Aba: Carga e Deload — platô por exercício, sinais de sobrecarga, sugestão de deload
// (por volume ou "espelhado", seguindo a hierarquia reps → séries → descanso → carga em ordem
// inversa) e histórico. Também expõe a faixa de alerta do Registro de Treino e o cartão de
// limites editáveis em Configurações. Lógica em monitor-logic.js.

const MON_STATUS = {
  progredindo: { label: 'Progredindo', pill: 'mp-pill-leve' },
  plato: { label: 'Platô', pill: 'mp-pill-moderado' },
  platoFadiga: { label: 'Platô com fadiga', pill: 'mp-pill-alto' },
  adaptando: { label: 'Adaptando — hora de progredir', pill: 'mp-pill-leve' },
  poucos: { label: 'Dados insuficientes', pill: 'mp-pill-neutro' },
  inativo: { label: 'Sem registros recentes', pill: 'mp-pill-neutro' },
};
const MON_OVERLOAD = {
  nenhum: { label: 'Sem sinais de sobrecarga', pill: 'mp-pill-leve' },
  atencao: { label: 'Sobrecarga: atenção (1 sinal)', pill: 'mp-pill-moderado' },
  alto: { label: 'Sobrecarga alta (2+ sinais)', pill: 'mp-pill-alto' },
};

let monMode = null;   // modo de deload escolhido na tela (volume | espelhado)

function monAnalyze() {
  const student = currentStudent();
  const today = Utils.todayISO();
  const age = student && student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;
  return MonitorLogic.analyzeLoad({
    student, today,
    sessions: AppState.data.sessions,
    checkins: AppState.data.checkins || [],
    adjustments: AppState.data.adjustments || [],
    templates: AppState.data.workoutTemplates || [],
    settings: AppState.settings,
    band: PeriodizationLogic.ageBandFor(age),
    evalCheckin: (c) => CheckinLogic.evaluate(c),
  });
}

function monFichaOf(exerciseName) {
  const key = PosturalLogic.normalizeName(exerciseName);
  const t = (AppState.data.workoutTemplates || []).find((tp) => (tp.items || []).some((it) => PosturalLogic.normalizeName(it.exerciseName) === key));
  return t ? { ficha: t.ficha, name: t.items.find((it) => PosturalLogic.normalizeName(it.exerciseName) === key).exerciseName } : null;
}

function monActionText(e, a) {
  const located = monFichaOf(e.name);
  const hist = located ? adjustmentHistoryFor(located.ficha, located.name) : [];
  const next = adjustmentTypeLabel(nextSuggestedAdjustment(hist)).toLowerCase();
  if (e.status === 'progredindo') return 'Manter: o exercício está evoluindo.';
  if (e.status === 'adaptando') return `Esforço caiu ${Math.abs(e.pseDelta).toFixed(1)} ponto(s) com a mesma carga: hora de progredir. Próximo passo da hierarquia: ${next}.`;
  if (e.status === 'plato') return `Sem novo recorde há ${e.weeksStalled} semanas, com esforço estável: mude o estímulo. Próximo passo da hierarquia: ${next}.`;
  if (e.status === 'platoFadiga') return `Sem novo recorde há ${e.weeksStalled} semanas e esforço subindo (+${e.pseDelta.toFixed(1)}): sinal de fadiga. Considere deload antes de progredir.`;
  if (e.status === 'poucos') return `Ainda sem dados para julgar (mínimo: ${a.cfg.plateauMinExposures} registros em ~${a.cfg.plateauWeeks} semanas).`;
  return '';
}

function monFmtExposure(e) {
  if (!e) return '—';
  return `${e.series}×${e.reps} · ${e.load} ${formatUnitLabel(e.unit, '')}${e.borg != null ? ' · Borg ' + e.borg : ''}`;
}
function monFmtValues(v, unit, unitDetail) {
  return `${v.series}×${v.reps} · ${v.load} ${formatUnitLabel(unit, unitDetail)} · desc ${Utils.formatRestLabel(v.restSeconds)}`;
}

function monChangesTable(changes) {
  if (!changes.length) return '<div class="mp-sub" style="margin:0;">Nenhum exercício de força nas Fichas com o que reduzir neste modo.</div>';
  return `<div class="mp-table-scroll"><table class="mp-table">
    <thead><tr><th>Ficha</th><th>Exercício</th><th>Antes</th><th>Deload</th><th>Como</th></tr></thead>
    <tbody>${changes.map((c) => `<tr>
      <td>${Utils.escapeHtml(c.ficha)}</td><td>${Utils.escapeHtml(c.exerciseName)}</td>
      <td>${Utils.escapeHtml(monFmtValues(c.before, c.unit, c.unitDetail))}</td>
      <td><strong>${Utils.escapeHtml(monFmtValues(c.after, c.unit, c.unitDetail))}</strong></td>
      <td style="font-size:12.5px;">${c.how.map(Utils.escapeHtml).join('<br>')}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Faixa de alerta (Registro de Treino) ----------
function monBannerHtml() {
  const student = currentStudent();
  if (!student || !AppState.data.sessions.length) return '';
  const a = monAnalyze();
  const lines = [];
  if (a.deload.active) {
    lines.push(['moderado', `Deload ativo de ${Utils.formatDateBR(a.deload.active.startDate)} a ${Utils.formatDateBR(a.deload.active.endDate)}: os valores das Fichas estão reduzidos. Ao terminar, restaure em "Carga e Deload".`]);
  } else {
    if (a.overload === 'alto') lines.push(['alto', 'Sobrecarga alta: mais de um sinal ao mesmo tempo. Veja "Carga e Deload".']);
    else if (a.overload === 'atencao') lines.push(['moderado', 'Um sinal de sobrecarga detectado. Veja "Carga e Deload".']);
    if (a.deload.suggested && !a.deload.dismissed) lines.push(['moderado', 'Deload sugerido para este aluno. Veja "Carga e Deload".']);
  }
  if (!lines.length) return '';
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">${lines.map(([lv, t]) => `<div class="mp-inline-alert mp-inline-alert-${lv === 'alto' ? 'alto' : 'moderado'}">⚠ ${Utils.escapeHtml(t)}</div>`).join('')}</div>`;
}

// ---------- Aba ----------
function monRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';
  if (!AppState.data.sessions.length) {
    return '<div class="mp-empty"><h3>Ainda não há dados de treino</h3><p>Assim que houver sessões registradas, o app detecta platôs e sinais de sobrecarga aqui.</p></div>';
  }
  const a = monAnalyze();
  const today = Utils.todayISO();
  const cfg = a.cfg;
  const ov = MON_OVERLOAD[a.overload];

  // Cartão de resumo
  const summary = `
  <div class="mp-card">
    <h3>Carga e Deload</h3>
    <div class="mp-sub">Monitoramento por regras simples e transparentes, com limites editáveis em Configurações. O app sugere; a decisão é sua.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
      <span class="mp-pill ${ov.pill}">${ov.label}</span>
      <span class="mp-pill ${a.platoCount ? 'mp-pill-moderado' : 'mp-pill-leve'}">${a.platoCount} exercício(s) em platô</span>
      <span class="mp-pill mp-pill-neutro">${a.calendar.weeksSince != null ? a.calendar.weeksSince + ' sem. desde ' + (a.calendar.lastDeload ? 'o último deload' : 'o 1º treino') : 'sem base de calendário'} · intervalo ${a.calendar.every} sem.</span>
    </div>
    ${a.signals.length ? `<div class="mp-inline-alert ${a.overload === 'alto' ? 'mp-inline-alert-alto' : 'mp-inline-alert-moderado'}">${a.signals.map((s) => `<div>• ${Utils.escapeHtml(s.text)}</div>`).join('')}</div>` : '<div class="mp-sub" style="margin:0;">Nenhum sinal de sobrecarga (esforço, check-ins e volume semanal) no momento.</div>'}
  </div>`;

  // Cartão de deload
  let deloadCard = '';
  const active = a.deload.active;
  if (active) {
    const ended = today > active.endDate;
    deloadCard = `
    <div class="mp-card" style="margin-top:20px;">
      <h3>Deload ativo</h3>
      <div class="mp-sub">${Utils.formatDateBR(active.startDate)} a ${Utils.formatDateBR(active.endDate)} · modo ${active.mode === 'espelhado' ? 'espelhado (desfaz ajustes da hierarquia)' : 'volume'}${ended ? ' · <strong>o período previsto já terminou</strong>' : ''}.</div>
      ${monChangesTable(active.changes)}
      <div class="mp-form-actions" style="justify-content:flex-start;margin-top:14px;">
        <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="mon-restore">↩ Restaurar valores originais e encerrar</button>
        <button type="button" class="mp-btn mp-btn-outline" id="mon-keep">Encerrar mantendo os valores atuais</button>
      </div>
      <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">O deload não entra no histórico de ajustes da hierarquia: a sequência reps → séries → descanso → carga continua de onde estava.</div>
    </div>`;
  } else if (a.deload.suggested && !a.deload.dismissed) {
    const mode = monMode || a.deload.mode;
    const changes = MonitorLogic.buildDeloadPlan(AppState.data.workoutTemplates, AppState.data.adjustments, mode, cfg, a.overload === 'alto');
    deloadCard = `
    <div class="mp-card" style="margin-top:20px;">
      <h3>Deload sugerido${a.deload.urgency === 'alta' ? ' — prioridade alta' : ''}</h3>
      <div class="mp-inline-alert ${a.deload.urgency === 'alta' ? 'mp-inline-alert-alto' : 'mp-inline-alert-moderado'}" style="margin:8px 0 12px;">${a.deload.reasons.map((r) => `<div>• ${Utils.escapeHtml(r)}</div>`).join('')}</div>
      <div class="mp-field" style="max-width:420px;">
        <label>Modo do deload</label>
        <select id="mon-mode">
          <option value="volume" ${mode === 'volume' ? 'selected' : ''}>Volume: corta ~${cfg.deloadVolumeCutPct}% das séries, mantém carga e repetições</option>
          <option value="espelhado" ${mode === 'espelhado' ? 'selected' : ''}>Espelhado: desfaz o último ajuste da hierarquia (carga → descanso → séries → reps)</option>
        </select>
      </div>
      <div class="mp-sub" style="margin:0 0 8px;">Duração: ${cfg.deloadDays} dias. Pré-visualização do que muda nas Fichas:</div>
      ${monChangesTable(changes)}
      <div class="mp-form-actions" style="justify-content:flex-start;margin-top:14px;">
        <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="mon-apply" ${changes.length ? '' : 'disabled'}>✓ Aplicar deload às Fichas</button>
        <button type="button" class="mp-btn mp-btn-outline" id="mon-dismiss">Dispensar por 14 dias</button>
      </div>
      <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">O app nunca aumenta carga, repetições ou séries no deload. Você pode restaurar os valores originais quando o período terminar.</div>
    </div>`;
  } else {
    deloadCard = `
    <div class="mp-card" style="margin-top:20px;">
      <h3>Deload</h3>
      <div class="mp-sub" style="margin:0;">${a.deload.dismissed ? `Sugestão dispensada até ${Utils.formatDateBR(student.deloadDismissedUntil)}.` : 'Nenhum deload necessário agora.'}${a.calendar.nextDueDate ? ` Próximo pelo calendário: ${Utils.formatDateBR(a.calendar.nextDueDate)}.` : ''}</div>
    </div>`;
  }

  // Registrar deload já realizado (reinicia o calendário sem mexer nas Fichas)
  const registerCard = `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Registrar um deload que você já fez</h3>
    <div class="mp-sub">Use se você já aliviou a carga por conta própria: isso reinicia a contagem do calendário, sem alterar as Fichas.</div>
    <div class="mp-form-row mp-row2" style="align-items:end;">
      <div class="mp-field"><label>Data de início do deload</label><input type="date" id="mon-past-date" value="${today}"></div>
      <div class="mp-field"><label>Observação (opcional)</label><input type="text" id="mon-past-note" placeholder="Ex: semana de férias do aluno"></div>
    </div>
    <div class="mp-form-actions" style="justify-content:flex-start;"><button type="button" class="mp-btn mp-btn-ghost" id="mon-past-save">Registrar deload realizado</button></div>
  </div>`;

  // Exercícios
  const rows = a.exercises.map((e) => {
    const st = MON_STATUS[e.status];
    return `<tr>
      <td><strong>${Utils.escapeHtml(e.name)}</strong></td>
      <td>${e.exposures}</td>
      <td style="font-size:12.5px;">${Utils.escapeHtml(monFmtExposure(e.last))}</td>
      <td style="font-size:12.5px;">${e.record ? Utils.formatDateBR(e.record.date) : '—'}</td>
      <td><span class="mp-pill ${st.pill}">${st.label}</span>${e.pseRise ? ' <span class="mp-pill mp-pill-alto">esforço subindo</span>' : ''}</td>
      <td style="font-size:12.5px;max-width:320px;">${Utils.escapeHtml(monActionText(e, a))}</td>
    </tr>`;
  }).join('');
  const exercisesCard = `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Exercícios</h3>
    <div class="mp-sub">Platô = nenhum novo recorde há ${cfg.plateauWeeks} semanas (mais carga; ou mais repetições com a mesma carga; ou mais séries), com pelo menos ${cfg.plateauMinExposures} registros. Com o Borg caindo ${cfg.pseDrop}+ ponto, o exercício está adaptando e é hora de progredir.</div>
    <div class="mp-table-scroll"><table class="mp-table">
      <thead><tr><th>Exercício</th><th>Registros</th><th>Última execução</th><th>Último recorde</th><th>Situação</th><th>Sugestão</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;

  // Histórico
  const log = [...(student.deloadLog || [])].sort((x, y) => y.startDate.localeCompare(x.startDate));
  const history = log.length ? `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de deloads</h3>
    <div class="mp-table-scroll"><table class="mp-table">
      <thead><tr><th>Período</th><th>Modo</th><th>Motivo</th><th>Situação</th></tr></thead>
      <tbody>${log.map((d) => `<tr>
        <td>${Utils.formatDateBR(d.startDate)}${d.endDate ? ' a ' + Utils.formatDateBR(d.endDate) : ''}</td>
        <td>${d.mode === 'espelhado' ? 'Espelhado' : (d.mode === 'volume' ? 'Volume' : 'Registrado (feito fora do app)')}</td>
        <td style="font-size:12.5px;">${(d.reasons || []).map(Utils.escapeHtml).join('<br>') || Utils.escapeHtml(d.note || '—')}</td>
        <td>${d.status === 'ativo' ? '<span class="mp-pill mp-pill-moderado">Ativo</span>' : '<span class="mp-pill mp-pill-neutro">Encerrado</span>'}${d.restored ? `<div style="font-size:11.5px;color:var(--texto-suave);">${d.restored} valor(es) restaurado(s)</div>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>` : '';

  return summary + deloadCard + registerCard + exercisesCard + history;
}

async function monSaveLog(student, log, extra) {
  await updateCurrentStudent({ deloadLog: log, ...(extra || {}) });
}

function monBindEvents(container) {
  const student = currentStudent();
  if (!student) return;

  container.querySelector('#mon-mode')?.addEventListener('change', (e) => { monMode = e.target.value; render(); });

  container.querySelector('#mon-apply')?.addEventListener('click', async () => {
    const a = monAnalyze();
    const mode = container.querySelector('#mon-mode').value;
    const changes = MonitorLogic.buildDeloadPlan(AppState.data.workoutTemplates, AppState.data.adjustments, mode, a.cfg, a.overload === 'alto');
    if (!changes.length) { Utils.toast('Nada a reduzir nas Fichas.', 'error'); return; }
    const touched = new Set();
    changes.forEach((c) => {
      const t = getTemplate(c.ficha);
      const it = t && t.items.find((x) => x.id === c.itemId);
      if (!it) return;
      it.series = c.after.series; it.reps = c.after.reps; it.load = c.after.load; it.restSeconds = c.after.restSeconds;
      touched.add(t);
    });
    const today = Utils.todayISO();
    const entry = { id: dbUuid(), startDate: today, endDate: MonitorLogic.addDays(today, a.cfg.deloadDays - 1), mode, severe: a.overload === 'alto', reasons: a.deload.reasons, changes, status: 'ativo' };
    monMode = null;
    render();
    Utils.toast('Deload aplicado às Fichas ✓', 'success');
    for (const t of touched) await persistTemplate(t);
    await monSaveLog(student, [...(student.deloadLog || []), entry], { deloadDismissedUntil: null });
    render();
  });

  container.querySelector('#mon-dismiss')?.addEventListener('click', async () => {
    await updateCurrentStudent({ deloadDismissedUntil: MonitorLogic.addDays(Utils.todayISO(), 14) });
    render();
    Utils.toast('Sugestão dispensada por 14 dias.', 'success');
  });

  const closeActive = async (restore) => {
    const log = student.deloadLog || [];
    const entry = log.find((d) => d.status === 'ativo');
    if (!entry) return;
    let restored = 0;
    if (restore) {
      const touched = new Set();
      entry.changes.forEach((c) => {
        const t = getTemplate(c.ficha);
        const it = t && t.items.find((x) => x.id === c.itemId);
        if (!it) return;
        [['series', 'series'], ['reps', 'reps'], ['load', 'load'], ['restSeconds', 'restSeconds']].forEach(([f]) => {
          if (c.after[f] !== c.before[f] && it[f] === c.after[f]) { it[f] = c.before[f]; restored += 1; touched.add(t); }
        });
      });
      for (const t of touched) await persistTemplate(t);
    }
    entry.status = 'encerrado';
    entry.endedAt = Utils.todayISO();
    entry.restored = restored;
    await monSaveLog(student, log);
    render();
    Utils.toast(restore ? `Deload encerrado — ${restored} valor(es) restaurado(s) ✓` : 'Deload encerrado ✓', 'success');
  };
  container.querySelector('#mon-restore')?.addEventListener('click', () => closeActive(true));
  container.querySelector('#mon-keep')?.addEventListener('click', () => closeActive(false));

  container.querySelector('#mon-past-save')?.addEventListener('click', async () => {
    const date = container.querySelector('#mon-past-date').value || Utils.todayISO();
    const note = container.querySelector('#mon-past-note').value.trim();
    const entry = { id: dbUuid(), startDate: date, endDate: date, mode: 'registrado', reasons: [], note, changes: [], status: 'encerrado', endedAt: date, restored: 0 };
    await monSaveLog(student, [...(student.deloadLog || []), entry]);
    render();
    Utils.toast('Deload registrado — calendário reiniciado ✓', 'success');
  });
}

// ---------- Cartão em Configurações ----------
const MON_SETTINGS_FIELDS = [
  { key: 'monitorPlateauWeeks', label: 'Semanas sem novo recorde para considerar platô', min: 2, max: 12, step: 1 },
  { key: 'monitorPlateauMinExposures', label: 'Mínimo de registros no período do platô', min: 2, max: 10, step: 1 },
  { key: 'monitorPseDrop', label: 'Queda de Borg (pontos) que indica adaptação', min: 0.5, max: 5, step: 0.5 },
  { key: 'monitorPseRise', label: 'Alta de Borg (pontos) com a mesma carga que indica sobrecarga', min: 0.5, max: 5, step: 0.5 },
  { key: 'monitorVolumeJumpPct', label: 'Salto do volume semanal (%) que acende alerta', min: 5, max: 100, step: 5 },
  { key: 'monitorReadinessDrop', label: 'Queda da prontidão nos check-ins (pontos)', min: 5, max: 60, step: 5 },
  { key: 'monitorDeloadEveryWeeks', label: 'Intervalo entre deloads (semanas)', min: 3, max: 12, step: 1 },
  { key: 'monitorDeloadVolumeCutPct', label: 'Corte de volume no deload (%)', min: 10, max: 60, step: 5 },
  { key: 'monitorDeloadDays', label: 'Duração do deload (dias)', min: 3, max: 14, step: 1 },
  { key: 'ckPainRed', label: 'Check-in: dor a partir de (1–5) = vermelho', min: 2, max: 5, step: 1 },
  { key: 'ckPainAmber', label: 'Check-in: dor a partir de (1–5) = amarelo', min: 2, max: 5, step: 1 },
  { key: 'ckLowScore', label: 'Check-in: sono/disposição até (1–5) = amarelo', min: 1, max: 3, step: 1 },
  { key: 'ckReadinessRed', label: 'Check-in: prontidão abaixo de (0–100) = vermelho', min: 5, max: 60, step: 5 },
  { key: 'ckReadinessAmber', label: 'Check-in: prontidão abaixo de (0–100) = amarelo', min: 20, max: 90, step: 5 },
];

function monSettingsHtml(s) {
  const field = (f) => `<div class="mp-field"><label>${Utils.escapeHtml(f.label)}</label><input type="number" min="${f.min}" max="${f.max}" step="${f.step}" id="cfg-${f.key}" value="${s[f.key]}"></div>`;
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Monitoramento de carga e check-in</h3>
    <div class="mp-sub" style="margin-top:10px;">Limites usados para detectar platô e sobrecarga, sugerir deload e classificar o semáforo do check-in. São valores práticos de partida — ajuste conforme a sua experiência com cada perfil de aluno.</div>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:12px 0 8px;color:var(--verde-principal);">Platô, sobrecarga e deload</h4>
    <div class="mp-form-row mp-row3">${MON_SETTINGS_FIELDS.slice(0, 9).map(field).join('')}</div>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:12px 0 8px;color:var(--verde-principal);">Semáforo do check-in</h4>
    <div class="mp-form-row mp-row3">${MON_SETTINGS_FIELDS.slice(9).map(field).join('')}</div>
    <div class="mp-form-actions" style="margin-top:14px;">
      <button type="button" class="mp-btn mp-btn-ghost" id="cfg-mon-reset">Restaurar padrões</button>
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="cfg-mon-save">Salvar limites</button>
    </div>
  </div>`;
}

function monSettingsBind(container) {
  container.querySelector('#cfg-mon-save')?.addEventListener('click', async () => {
    const patch = {};
    MON_SETTINGS_FIELDS.forEach((f) => {
      const v = Number(container.querySelector('#cfg-' + f.key).value);
      patch[f.key] = Math.min(f.max, Math.max(f.min, Number.isFinite(v) ? v : DEFAULT_SETTINGS[f.key]));
    });
    await saveSettingsPatch(patch);
    Utils.toast('Limites salvos ✓', 'success');
    render();
  });
  container.querySelector('#cfg-mon-reset')?.addEventListener('click', async () => {
    const patch = {};
    MON_SETTINGS_FIELDS.forEach((f) => { patch[f.key] = DEFAULT_SETTINGS[f.key]; });
    await saveSettingsPatch(patch);
    Utils.toast('Limites restaurados ao padrão ✓', 'success');
    render();
  });
}

window.MonitorView = { renderHtml: monRenderHtml, bindEvents: monBindEvents, bannerHtml: monBannerHtml, settingsHtml: monSettingsHtml, settingsBind: monSettingsBind };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['monitor.js'] = 'v1.13.1';
