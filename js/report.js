// Aba: Relatório de Evolução — documento para o aluno e a família.
// O profissional escolhe o período e o que incluir; a pré-visualização é o próprio documento.
// PDF: usa a impressão do navegador ("Salvar como PDF"), como os demais relatórios do app.
// WhatsApp: resumo em texto (compartilhar/copiar). Fotos NUNCA entram no relatório.
// Cálculos em report-logic.js. Tudo local: nada sai do aparelho sem uma ação sua.

const REP_SECTIONS = [
  { key: 'freq', label: 'Frequência e dedicação', def: true },
  { key: 'conquistas', label: 'Conquistas', def: true },
  { key: 'forca', label: 'Ficando mais forte (carga e repetições)', def: true },
  { key: 'esforco', label: 'Percepção de esforço por treino (Borg)', def: false },
  { key: 'funcional', label: 'Avaliação funcional (Senior Fitness Test)', def: true },
  { key: 'fase', label: 'Fase atual do treino', def: true },
  { key: 'fisica', label: 'Avaliação física (peso, IMC, gordura, abdômen)', def: false },
  { key: 'postura', label: 'Foco postural do treino (sem fotos)', def: false },
  { key: 'bemestar', label: 'Bem-estar nas aulas (sono e disposição)', def: false },
];
const REP_RANGES = [
  ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias'], ['180', 'Últimos 6 meses'],
  ['365', 'Últimos 12 meses'], ['all', 'Desde o primeiro treino'], ['custom', 'Personalizado'],
];
const REP_GREEN = '#1F3D30';
const REP_GOLD = '#B08D3C';

let repState = null;

function repEnsureState() {
  if (!repState || repState.studentId !== AppState.currentId) {
    const sections = {};
    REP_SECTIONS.forEach((s) => { sections[s.key] = s.def; });
    repState = { studentId: AppState.currentId, range: '90', from: '', to: '', sections, message: '', focus: '' };
  }
  return repState;
}

const repFmt = (n) => (n == null ? '—' : String(n).replace('.', ','));
const repUnit = (u) => (String(u) === 'Kg' ? 'kg' : String(u));   // "Kg" -> "kg"
const repEsc = (s) => Utils.escapeHtml(s == null ? '' : String(s));
const repMultiline = (s) => repEsc(s).replace(/\n/g, '<br>');

function repFirstName(student) { return (student.name || '').trim().split(/\s+/)[0] || 'Aluno(a)'; }
function repProfessor() { return (AppState.settings && AppState.settings.headerProfessionalName) || ''; }

// ---------- Modelo (dados da tela + cálculos) ----------
function repBuildModel() {
  const st = repEnsureState();
  const student = currentStudent();
  const today = Utils.todayISO();
  const dates = AppState.data.sessions.map((s) => s.date).sort();
  const period = ReportLogic.reportPeriod(st.range, today, dates[0] || null, st.from, st.to);
  const model = ReportLogic.computeReport({
    student, from: period.from, to: period.to, today,
    sessions: AppState.data.sessions, evaluations: AppState.data.evaluations,
    physicalEvaluations: AppState.data.physicalEvaluations, checkins: AppState.data.checkins || [],
    dailyMeta: AppState.data.dailyMeta || [],
  });

  // fase atual da periodização
  const active = PeriodizationLogic.activePeriodization();
  if (active && active.phases[active.currentIndex]) {
    const ph = active.phases[active.currentIndex];
    const cyclic = active.phases.length <= 2 && active.objective === 'manutencao';
    model.phase = { n: ph.n, total: active.phases.length, cyclic, name: ph.name, method: ph.method, stage: stageLabel(ph.stage), week: PeriodizationLogic.weeksSince(active.phaseStartDate, today) };
  } else model.phase = null;

  // foco postural (só os grupos a fortalecer, em linguagem simples)
  const posturals = [...(AppState.data.posturalEvaluations || [])].sort((a, b) => b.date.localeCompare(a.date));
  model.posture = null;
  if (posturals[0] && posturals[0].findings.length) {
    const res = PosturalLogic.crossPosture({ evaluation: posturals[0], student, physicalEvaluation: null, templates: [], guidance: null, age: null });
    if (res.strengthen.length) model.posture = { date: posturals[0].date, groups: res.strengthen.slice(0, 3).map((p) => p.label.toLowerCase()) };
  }
  model.today = today;
  return model;
}

// ---------- Gráfico de barras (SVG inline, funciona na tela e na impressão) ----------
function repBarsSvg(buckets) {
  const W = 640; const H = 170; const padL = 26; const padB = 26; const padT = 16;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const slot = (W - padL - 8) / buckets.length;
  const step = Math.ceil(buckets.length / 12);
  const bars = buckets.map((b, i) => {
    const h = (b.count / max) * (H - padB - padT);
    const x = padL + i * slot + slot * 0.15;
    const w = slot * 0.7;
    const y = H - padB - h;
    return `${b.count ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${REP_GREEN}"/><text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="10" text-anchor="middle" fill="#333" font-family="sans-serif">${b.count}</text>` : ''}
      ${i % step === 0 ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#666" font-family="sans-serif">${repEsc(b.label)}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;" role="img" aria-label="Treinos por período">
    <line x1="${padL}" y1="${H - padB}" x2="${W - 8}" y2="${H - padB}" stroke="#bbb" stroke-width="1"/>${bars}</svg>`;
}

// Gráfico de linha do esforço: pontos = nota de cada treino; linha = média de 3 treinos.
function repEffortSvg(points) {
  const W = 640; const H = 210; const padL = 34; const padB = 30; const padT = 22; const padR = 24;
  const x = (i) => padL + (points.length === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (points.length - 1));
  const y = (v) => padT + (1 - v / 10) * (H - padT - padB);
  const grid = [0, 2, 4, 6, 8, 10].map((v) => `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${W - padR}" y2="${y(v).toFixed(1)}" stroke="${v === 0 ? '#bbb' : '#e6e6e6'}" stroke-width="1"/><text x="${padL - 6}" y="${(y(v) + 3).toFixed(1)}" font-size="10" text-anchor="end" fill="#777" font-family="sans-serif">${v}</text>`).join('');
  const step = Math.ceil(points.length / 10);
  const xlabels = points.map((p, i) => (i % step === 0 ? `<text x="${x(i).toFixed(1)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="#666" font-family="sans-serif">${p.date.slice(8, 10)}/${p.date.slice(5, 7)}</text>` : '')).join('');
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.2" fill="#b9c4bd"/>`).join('');
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.avg).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;" role="img" aria-label="Percepção de esforço por treino">
    ${grid}${xlabels}${dots}<polyline points="${line}" fill="none" stroke="${REP_GREEN}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${W - 250}" cy="9" r="3.2" fill="#b9c4bd"/><text x="${W - 243}" y="12.5" font-size="10.5" fill="#555" font-family="sans-serif">nota de cada treino</text>
    <line x1="${W - 128}" y1="9" x2="${W - 108}" y2="9" stroke="${REP_GREEN}" stroke-width="2.6"/><text x="${W - 103}" y="12.5" font-size="10.5" fill="#555" font-family="sans-serif">média de 3 treinos</text></svg>`;
}

// ---------- Documento ----------
function repSectionBox(title, inner) {
  return `<section style="break-inside:avoid;page-break-inside:avoid;margin:0 0 18px;">
    <h2 style="font-family:Georgia,serif;font-size:16px;color:${REP_GREEN};margin:0 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px;">${title}</h2>${inner}</section>`;
}
function repTile(value, label) {
  return `<div style="flex:1 1 130px;border:1px solid #ddd;border-radius:10px;padding:10px 12px;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:${REP_GREEN};">${value}</div>
    <div style="font-size:12px;color:#666;">${label}</div></div>`;
}

function repHtml(model, opts) {
  const student = currentStudent();
  const sec = opts.sections;
  const first = repEsc(repFirstName(student));
  const parts = [];

  parts.push(`
  <div style="font-family:'Segoe UI',Arial,sans-serif;color:#222;font-size:13.5px;line-height:1.5;">
    <div style="border-bottom:3px solid ${REP_GOLD};padding-bottom:10px;margin-bottom:16px;">
      <div style="font-size:11px;letter-spacing:.14em;color:#8a6d2b;font-weight:700;">MÉTODO PLENO · MOVIMENTO E LONGEVIDADE</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:4px 0 6px;color:${REP_GREEN};">Relatório de evolução</h1>
      <div><strong>${repEsc(student.name)}</strong> &nbsp;·&nbsp; Período: ${Utils.formatDateBR(model.from)} a ${Utils.formatDateBR(model.to)}</div>
      <div style="color:#666;">${repProfessor() ? 'Professor: ' + repEsc(repProfessor()) + ' &nbsp;·&nbsp; ' : ''}Emitido em ${Utils.formatDateBR(model.today)}</div>
    </div>`);

  if (opts.message.trim()) {
    parts.push(`<section style="break-inside:avoid;margin:0 0 18px;background:#faf6ea;border-left:4px solid ${REP_GOLD};padding:10px 14px;border-radius:6px;">
      <div style="font-weight:700;color:#6b5320;margin-bottom:4px;">Mensagem do professor</div>${repMultiline(opts.message.trim())}</section>`);
  }

  // Frequência
  if (sec.freq) {
    const f = model.freq;
    const cmp = f.prevCount > 0
      ? (f.count > f.prevCount ? `<span style="color:#2e7d32;">▲ ${f.count - f.prevCount} a mais</span>` : (f.count < f.prevCount ? `<span style="color:#8a6d2b;">▼ ${f.prevCount - f.count} a menos</span>` : 'igual'))
      : '—';
    parts.push(repSectionBox('Frequência e dedicação', f.count === 0
      ? `<div>Nenhum treino registrado neste período.</div>`
      : `<div style="margin-bottom:10px;">${first} treinou <strong>${f.count} ${f.count === 1 ? 'vez' : 'vezes'}</strong> neste período, em <strong>${f.weeksWithTraining} de ${f.totalWeeks}</strong> semanas.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          ${repTile(f.count, 'treinos no período')}${repTile(repFmt(f.avgPerWeek), 'treinos por semana (média)')}${repTile(f.streak, 'semanas seguidas')}${f.prevCount > 0 ? repTile(cmp, `vs. período anterior (${f.prevCount})`) : ''}
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:4px;">Treinos por ${f.monthly ? 'mês' : 'semana'}:</div>${repBarsSvg(f.buckets)}`));
  }

  // Conquistas
  if (sec.conquistas && model.achievements.length) {
    parts.push(repSectionBox('Conquistas', `<ul style="list-style:none;padding:0;margin:0;">${model.achievements.map((a) => `<li style="margin:4px 0;">${a.icon} ${repEsc(a.text)}</li>`).join('')}</ul>`));
  }

  // Força
  if (sec.forca) {
    const s = model.strength;
    if (s.improved.length) {
      const rows = s.improved.slice(0, 6).map((e) => {
        const unit = repUnit(formatUnitLabel(e.last.unit, ''));
        const txt = e.type === 'carga' ? `${repFmt(e.first.load)} → <strong>${repFmt(e.last.load)} ${repEsc(unit)}</strong>${e.pct != null ? ` (+${e.pct}%)` : ''}`
          : (e.type === 'reps' ? `${e.first.reps} → <strong>${e.last.reps} repetições</strong> com a mesma carga` : `${e.first.series} → <strong>${e.last.series} séries</strong>`);
        return `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${repEsc(e.name)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${txt}</td></tr>`;
      }).join('');
      parts.push(repSectionBox('Ficando mais forte', `<div style="margin-bottom:8px;"><strong>${s.improved.length}</strong> de ${s.evaluated} exercícios acompanhados evoluíram neste período.</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;"><tbody>${rows}</tbody></table>`));
    } else if (s.evaluated) {
      parts.push(repSectionBox('Ficando mais forte', `<div>${s.evaluated} exercícios acompanhados mantiveram a mesma carga e repetições neste período — sinal de consolidação do movimento. O próximo passo é definido pelo professor.</div>`));
    }
  }

  // Esforço percebido (só com dados suficientes; texto descritivo e neutro)
  if (sec.esforco && model.effort && model.effort.ok) {
    const e = model.effort;
    const trend = Math.abs(e.delta) < 0.5
      ? `O esforço médio percebido se manteve estável, em torno de <strong>${repFmt(e.lastAvg)}</strong>`
      : `O esforço médio percebido foi de <strong>${repFmt(e.firstAvg)}</strong> nos primeiros treinos para <strong>${repFmt(e.lastAvg)}</strong> nos últimos`;
    const load = e.topLoad ? `, enquanto a carga de <strong>${repEsc(e.topLoad.name)}</strong> subiu <strong>${e.topLoad.pct}%</strong>` : '';
    parts.push(repSectionBox('Percepção de esforço nos treinos', `
      <div style="font-size:12.5px;color:#555;margin-bottom:8px;">A nota de esforço (escala Borg CR-10, de 0 a 10) é a percepção do próprio aluno sobre o quanto o treino foi difícil. Com a mesma carga, a nota cair indica adaptação; subir junto com o aumento de carga é esperado. Ela também varia com o sono, o humor e o dia.</div>
      ${repEffortSvg(e.points)}
      <div style="margin-top:8px;">${trend}${load}. Média do período: ${repFmt(e.overallAvg)} (${e.count} treinos com nota).</div>`));
  }

  // Funcional
  if (sec.funcional && model.functional) {
    const fn = model.functional;
    const cur = fn.current;
    const prev = fn.previous;
    const bar = (label, value, color) => `<div style="margin:4px 0;"><div style="font-size:12px;color:#666;">${label}</div><div style="background:#eee;border-radius:6px;height:16px;"><div style="width:${Math.max(2, value)}%;background:${color};height:16px;border-radius:6px;"></div></div></div>`;
    const indexBlock = cur.complete
      ? `<div style="margin-bottom:10px;">Índice de Aptidão Funcional: <strong style="font-size:18px;color:${REP_GREEN};">${cur.index}</strong> de 100 — ${repEsc(cur.classification)}${prev && prev.complete ? ` (antes: ${prev.index})` : ''}.</div>
         ${prev && prev.complete ? bar(`Antes (${Utils.formatDateBR(prev.date)})`, prev.index, '#b9c4bd') : ''}${bar(`Agora (${Utils.formatDateBR(cur.date)})`, cur.index, REP_GREEN)}`
      : `<div style="margin-bottom:10px;">Avaliação de ${Utils.formatDateBR(cur.date)} ainda incompleta (faltam testes para calcular o índice).</div>`;
    const rows = fn.tests.map((t) => {
      const arrow = t.improved === true ? '<span style="color:#2e7d32;">▲ melhorou</span>' : (t.worse === true ? '<span style="color:#8a6d2b;">▼ piorou</span>' : (t.improved === false ? 'igual' : '—'));
      return `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${repEsc(t.label)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${t.prev != null ? repFmt(t.prev) + ' ' + repEsc(t.unit) : '—'}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;"><strong>${repFmt(t.cur)} ${repEsc(t.unit)}</strong></td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${arrow}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${repEsc(t.classification)}</td></tr>`;
    }).join('');
    parts.push(repSectionBox('Avaliação funcional (Senior Fitness Test)', `${indexBlock}
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px;">
        <thead><tr style="text-align:left;color:#666;"><th style="padding:5px 8px;">Teste</th><th style="padding:5px 8px;">Antes</th><th style="padding:5px 8px;">Agora</th><th style="padding:5px 8px;">Evolução</th><th style="padding:5px 8px;">Classificação</th></tr></thead>
        <tbody>${rows}</tbody></table>`));
  }

  // Fase
  if (sec.fase && model.phase) {
    const p = model.phase;
    parts.push(repSectionBox('Fase atual do treino', `<div><strong>${p.cyclic ? 'Ciclo de manutenção' : `Fase ${p.n} de ${p.total}`} — ${repEsc(p.name)}</strong></div>
      <div style="color:#555;">Nível de treino: ${repEsc(p.stage)} · semana ${p.week} desta fase. O treino evolui em etapas planejadas, respeitando o ritmo e a segurança de cada pessoa.</div>`));
  }

  // Física
  if (sec.fisica && model.physical && model.physical.rows.length) {
    const ph = model.physical;
    const rows = ph.rows.map((r) => `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${r.label}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;">${r.prev != null ? repFmt(r.prev) + ' ' + r.unit : '—'}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eee;"><strong>${repFmt(r.cur)} ${r.unit}</strong></td></tr>`).join('');
    parts.push(repSectionBox('Avaliação física', `<div style="color:#666;margin-bottom:6px;">Avaliação de ${Utils.formatDateBR(ph.currentDate)}${ph.previousDate ? ` (comparada com ${Utils.formatDateBR(ph.previousDate)})` : ''}.</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="text-align:left;color:#666;"><th style="padding:5px 8px;">Medida</th><th style="padding:5px 8px;">Antes</th><th style="padding:5px 8px;">Agora</th></tr></thead><tbody>${rows}</tbody></table>`));
  }

  // Postura
  if (sec.postura && model.posture) {
    const g = model.posture.groups;
    const list = g.length > 1 ? g.slice(0, -1).join(', ') + ' e ' + g[g.length - 1] : g[0];
    parts.push(repSectionBox('Foco postural do treino', `<div>Com base na avaliação postural de ${Utils.formatDateBR(model.posture.date)}, o treino dá ênfase ao fortalecimento de <strong>${repEsc(list)}</strong>, junto de mobilidade e alongamento.</div>`));
  }

  // Bem-estar
  if (sec.bemestar && model.wellbeing) {
    const w = model.wellbeing;
    parts.push(repSectionBox('Bem-estar nas aulas', `<div style="display:flex;gap:10px;flex-wrap:wrap;">${repTile(repFmt(w.avgSono) + '/5', 'qualidade do sono (média)')}${repTile(repFmt(w.avgDisp) + '/5', 'disposição (média)')}${repTile(w.greenPct + '%', `das aulas sem alerta (${w.count} check-ins)`)}</div>`));
  }

  if (opts.focus.trim()) {
    parts.push(`<section style="break-inside:avoid;margin:0 0 18px;background:#eef3ef;border-left:4px solid ${REP_GREEN};padding:10px 14px;border-radius:6px;">
      <div style="font-weight:700;color:${REP_GREEN};margin-bottom:4px;">Foco do próximo período</div>${repMultiline(opts.focus.trim())}</section>`);
  }

  parts.push(`<div style="border-top:1px solid #ddd;padding-top:8px;margin-top:8px;font-size:11px;color:#777;">Este relatório reúne informações de acompanhamento do treino e não substitui avaliação ou orientação médica. Documento confidencial, destinado ao aluno e às pessoas que ele autorizar.</div></div>`);
  return parts.join('');
}

// ---------- Resumo para WhatsApp ----------
function repWhatsText(model, opts) {
  const student = currentStudent();
  const sec = opts.sections;
  const L = [];
  L.push(`*Relatório de evolução — ${student.name}*`);
  L.push(`Período: ${Utils.formatDateBR(model.from)} a ${Utils.formatDateBR(model.to)}`);
  L.push('');
  if (sec.freq) {
    const f = model.freq;
    L.push(`✅ ${f.count} ${f.count === 1 ? 'treino' : 'treinos'}${f.count ? ` (média de ${repFmt(f.avgPerWeek)} por semana)` : ''}`);
    if (f.streak >= 2) L.push(`🔥 ${f.streak} semanas seguidas treinando`);
  }
  if (sec.forca && model.strength.improved.length) {
    L.push(`💪 ${model.strength.improved.length} exercício(s) com mais carga ou repetições`);
    model.strength.improved.filter((e) => e.type === 'carga').slice(0, 3).forEach((e) => L.push(`   • ${e.name}: ${repFmt(e.first.load)} → ${repFmt(e.last.load)} ${repUnit(formatUnitLabel(e.last.unit, ''))}`));
  }
  if (sec.funcional && model.functional && model.functional.current.complete) {
    const fn = model.functional;
    L.push(`📈 Aptidão funcional: ${fn.previous && fn.previous.complete ? fn.previous.index + ' → ' : ''}${fn.current.index} pontos (${fn.current.classification})`);
  }
  if (sec.fase && model.phase) L.push(`🎯 Fase atual: ${model.phase.name}`);
  if (sec.conquistas) model.freq.crossedMilestones.forEach((m) => L.push(`🏅 Marca de ${m} treinos alcançada!`));
  if (opts.message.trim()) { L.push(''); L.push(opts.message.trim()); }
  if (opts.focus.trim()) { L.push(''); L.push(`Foco do próximo período: ${opts.focus.trim()}`); }
  L.push('');
  L.push(`${repProfessor() ? repProfessor() + ' · ' : ''}Método Pleno`);
  return L.join('\n');
}

// ---------- Aba ----------
function repRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';
  const st = repEnsureState();
  return `
  <div class="mp-card">
    <h3>Relatório de evolução para aluno e família</h3>
    <div class="mp-sub">Escolha o período e o que incluir. A pré-visualização abaixo é o próprio documento. Por padrão, avaliação física, postura e bem-estar ficam desmarcados, e fotos nunca entram no relatório.</div>
    <div class="mp-form-row mp-row3">
      <div class="mp-field"><label>Período</label><select id="rep-range">${REP_RANGES.map(([v, l]) => `<option value="${v}" ${st.range === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="mp-field" id="rep-custom-from" style="${st.range === 'custom' ? '' : 'display:none;'}"><label>De</label><input type="date" id="rep-from" value="${st.from}"></div>
      <div class="mp-field" id="rep-custom-to" style="${st.range === 'custom' ? '' : 'display:none;'}"><label>Até</label><input type="date" id="rep-to" value="${st.to}"></div>
    </div>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:8px 0;color:var(--verde-principal);">O que incluir</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;margin-bottom:12px;">
      ${REP_SECTIONS.map((s) => `<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;"><input type="checkbox" data-rep-sec="${s.key}" style="margin-top:3px;width:auto;" ${st.sections[s.key] ? 'checked' : ''}><span>${repEsc(s.label)}</span></label>`).join('')}
    </div>
    <div class="mp-field"><label>Mensagem do professor (opcional)</label><textarea id="rep-msg" placeholder="Ex: Parabéns pela dedicação! Continue assim.">${repEsc(st.message)}</textarea></div>
    <div class="mp-field"><label>Foco do próximo período (opcional)</label><textarea id="rep-focus" placeholder="Ex: aumentar a carga do leg press e melhorar o equilíbrio.">${repEsc(st.focus)}</textarea></div>
    <div class="mp-form-actions" style="justify-content:flex-start;flex-wrap:wrap;">
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="rep-print">🖨 Imprimir / Salvar em PDF</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="rep-share">💬 Compartilhar resumo (WhatsApp)</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="rep-copy">📋 Copiar resumo</button>
    </div>
    <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">Antes de enviar a terceiros, confirme a autorização do aluno. No PDF, escolha "Salvar como PDF" na janela de impressão e depois anexe o arquivo na conversa.</div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Pré-visualização</h3>
    <div id="rep-hint" class="mp-sub" style="margin:0 0 10px;color:var(--dourado-escuro);"></div>
    <div id="rep-preview" style="border:1px solid var(--borda);border-radius:10px;padding:22px;background:#fff;overflow-x:auto;"></div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Dados deste aluno (cópia para o aluno)</h3>
    <div class="mp-sub">Gera um arquivo com todos os dados de <strong>${repEsc(student.name)}</strong> (cadastro, treinos, avaliações, check-ins, pagamentos e periodização), sem os de outros alunos. Útil quando o aluno pede uma cópia dos próprios dados.</div>
    <div class="mp-form-actions" style="justify-content:flex-start;"><button type="button" class="mp-btn mp-btn-ghost" id="rep-export">⬇ Exportar dados deste aluno (JSON)</button></div>
  </div>

  <div id="mp-print-area" class="mp-print-only"></div>`;
}

function repOpts() {
  const st = repEnsureState();
  return { sections: st.sections, message: st.message, focus: st.focus };
}

function repUpdatePreview(container) {
  const box = container.querySelector('#rep-preview');
  if (!box) return;
  const model = repBuildModel();
  box.innerHTML = repHtml(model, repOpts());
  const hint = container.querySelector('#rep-hint');
  if (hint) {
    hint.textContent = repOpts().sections.esforco && model.effort && !model.effort.ok
      ? `A seção de esforço foi omitida do documento: são necessários pelo menos 6 treinos com nota de Borg no período (há ${model.effort.count}).`
      : '';
  }
}

function repDownloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function repExportStudent() {
  const student = currentStudent();
  const d = AppState.data;
  const payload = {
    app: 'Método Pleno', tipo: 'exportacao-de-um-aluno', exportadoEm: new Date().toISOString(),
    aluno: student, sessions: d.sessions, plans: d.plans, evaluations: d.evaluations, payments: d.payments,
    cancellations: d.cancellations, physicalEvaluations: d.physicalEvaluations, dailyMeta: d.dailyMeta,
    workoutTemplates: d.workoutTemplates, oneRmTests: d.oneRmTests, adjustments: d.adjustments,
    checkins: d.checkins, periodizations: d.periodizations, posturalEvaluations: d.posturalEvaluations,
  };
  const withPhotos = (payload.posturalEvaluations || []).some((ev) => ev.photos && Object.values(ev.photos).some(Boolean));
  if (withPhotos) {
    const choice = await askBackupPhotoChoice();
    if (choice === null) return;
    if (choice === 'sem') payload.posturalEvaluations = payload.posturalEvaluations.map((ev) => ({ ...ev, photos: {}, photosOmitted: true }));
  }
  const slug = student.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aluno';
  repDownloadJson(`metodo-pleno-aluno-${slug}-${Utils.todayISO()}.json`, payload);
  Utils.toast('Dados do aluno exportados ✓', 'success');
}

function repBindEvents(container) {
  const student = currentStudent();
  if (!student) return;
  const st = repEnsureState();
  repUpdatePreview(container);

  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => repUpdatePreview(container), 200); };

  container.querySelector('#rep-range')?.addEventListener('change', (e) => {
    st.range = e.target.value;
    const custom = st.range === 'custom';
    container.querySelector('#rep-custom-from').style.display = custom ? '' : 'none';
    container.querySelector('#rep-custom-to').style.display = custom ? '' : 'none';
    repUpdatePreview(container);
  });
  container.querySelector('#rep-from')?.addEventListener('change', (e) => { st.from = e.target.value; repUpdatePreview(container); });
  container.querySelector('#rep-to')?.addEventListener('change', (e) => { st.to = e.target.value; repUpdatePreview(container); });
  container.querySelectorAll('[data-rep-sec]').forEach((cb) => cb.addEventListener('change', () => { st.sections[cb.dataset.repSec] = cb.checked; repUpdatePreview(container); }));
  container.querySelector('#rep-msg')?.addEventListener('input', (e) => { st.message = e.target.value; later(); });
  container.querySelector('#rep-focus')?.addEventListener('input', (e) => { st.focus = e.target.value; later(); });

  container.querySelector('#rep-print')?.addEventListener('click', () => {
    const area = container.querySelector('#mp-print-area');
    area.innerHTML = repHtml(repBuildModel(), repOpts());
    window.print();
  });

  const summary = () => repWhatsText(repBuildModel(), repOpts());
  container.querySelector('#rep-share')?.addEventListener('click', async () => {
    const text = summary();
    if (navigator.share) {
      try { await navigator.share({ title: `Relatório de evolução — ${student.name}`, text }); } catch (e) { /* compartilhamento cancelado */ }
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  });
  container.querySelector('#rep-copy')?.addEventListener('click', async () => {
    const text = summary();
    try { await navigator.clipboard.writeText(text); Utils.toast('Resumo copiado ✓', 'success'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); Utils.toast('Resumo copiado ✓', 'success'); } catch (e2) { Utils.toast('Não foi possível copiar.', 'error'); }
      document.body.removeChild(ta);
    }
  });

  container.querySelector('#rep-export')?.addEventListener('click', repExportStudent);
}

window.ReportView = { renderHtml: repRenderHtml, bindEvents: repBindEvents, whatsText: repWhatsText, buildModel: repBuildModel, html: repHtml };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['report.js'] = 'v1.14.1';
