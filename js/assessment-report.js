// Aba: Relatório de Avaliação — documento único com a avaliação física (composição corporal,
// dobras, circunferências, testes personalizados), a avaliação funcional e a avaliação postural.
// Escolha qual avaliação de cada tipo entra (por padrão, a mais recente, comparada com a anterior).
// Fotos posturais: SÓ entram se você marcar, em cada relatório, e só se o aluno tiver autorizado
// o registro de fotos. Elas nunca vão no resumo de WhatsApp. Tudo local.

const AR_SECTIONS = [
  { key: 'ident', label: 'Identificação do aluno', def: true },
  { key: 'fisica', label: 'Avaliação física (peso, IMC, composição corporal, circunferências)', def: true },
  { key: 'custom', label: 'Testes personalizados', def: true },
  { key: 'funcional', label: 'Avaliação funcional (Senior Fitness Test)', def: true },
  { key: 'postural', label: 'Avaliação postural (achados e ênfases do treino)', def: true },
  { key: 'trabalho', label: 'Trabalho necessário (prioridades do treino)', def: true },
  { key: 'parecer', label: 'Parecer e recomendações do profissional', def: true },
];
const AR_GREEN = '#1F3D30';
let arState = null;

const arEsc = (s) => Utils.escapeHtml(s == null ? '' : String(s));
const arFmt = (n) => (n == null ? '—' : String(n).replace('.', ','));
const arMulti = (s) => arEsc(s).replace(/\n/g, '<br>');

function arSorted(list) { return [...(list || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')); }

function arEnsureState() {
  if (!arState || arState.studentId !== AppState.currentId) {
    const sections = {}; AR_SECTIONS.forEach((s) => { sections[s.key] = s.def; });
    arState = {
      studentId: AppState.currentId, sections, compare: true, parecer: '',
      // null = "a mais recente" (padrão); '' = "não incluir"; outro valor = avaliação escolhida.
      physId: null, funcId: null, posId: null,
      photos: false, photoViews: {},
    };
  }
  return arState;
}

// Id efetivo: padrão = mais recente; some se a avaliação escolhida foi excluída.
function arEffId(list, id) {
  const s = arSorted(list);
  if (id === '') return '';
  if (id && s.some((r) => r.id === id)) return id;
  return s.length ? s[0].id : '';
}

// Registro escolhido + o imediatamente anterior (mais antigo) da mesma lista.
function arPick(list, rawId) {
  const s = arSorted(list);
  const id = arEffId(list, rawId);
  const i = s.findIndex((r) => r.id === id);
  if (i < 0) return { cur: null, prev: null };
  return { cur: s[i], prev: s[i + 1] || null };
}

function arSection(title, inner) {
  return `<section style="break-inside:avoid;margin:0 0 18px;"><h3 style="font-family:Georgia,serif;font-size:16px;margin:0 0 8px;color:${AR_GREEN};border-bottom:1px solid #ddd;padding-bottom:4px;">${arEsc(title)}</h3>${inner}</section>`;
}

function arPhysicalHtml(cur, prev, compare) {
  const rows = peRowsData(cur, compare ? prev : null).filter(([, c, p]) => c != null || (compare && p != null));
  const body = rows.map(([label, c, p]) => {
    let delta = '';
    if (compare && typeof c === 'number' && typeof p === 'number') { const d = Math.round((c - p) * 100) / 100; delta = d > 0 ? `+${arFmt(d)}` : arFmt(d); }
    return `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${arEsc(label)}</td>${compare ? `<td style="padding:5px 8px;border-bottom:1px solid #eee;">${arFmt(p)}</td>` : ''}<td style="padding:5px 8px;border-bottom:1px solid #eee;"><strong>${arFmt(c)}</strong></td>${compare ? `<td style="padding:5px 8px;border-bottom:1px solid #eee;">${delta}</td>` : ''}</tr>`;
  }).join('');
  const cls = Skinfold.classifyBodyFat(cur.bodyFatPercent, cur.age, cur.sex);
  const notes = [];
  if (cur.skinfold) notes.push(`Percentual de gordura estimado por dobras cutâneas (${arEsc(cur.skinfold.protocolLabel)}): é uma estimativa, com erro típico de 3 a 4 pontos percentuais.`);
  if (cls) notes.push(`Classificação do % de gordura: ${arEsc(Skinfold.BF_REF)} Os graus I, II e III de obesidade pertencem ao IMC.`);
  if (compare && prev && cur.bodyFatPercent != null && prev.bodyFatPercent != null && (cur.skinfold ? cur.skinfold.protocolId : 'bio') !== (prev.skinfold ? prev.skinfold.protocolId : 'bio')) {
    notes.push('<strong>Atenção: a avaliação anterior usou outro método para o % de gordura, então a diferença não é diretamente comparável.</strong>');
  }
  return arSection(`Avaliação física — ${Utils.formatDateBR(cur.date)}`, `
    ${compare && prev ? `<div style="color:#666;margin-bottom:6px;">Comparada com a avaliação de ${Utils.formatDateBR(prev.date)}.</div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="text-align:left;color:#666;"><th style="padding:5px 8px;">Medida</th>${compare ? '<th style="padding:5px 8px;">Anterior</th>' : ''}<th style="padding:5px 8px;">Atual</th>${compare ? '<th style="padding:5px 8px;">Diferença</th>' : ''}</tr></thead><tbody>${body}</tbody></table>
    ${notes.map((n) => `<div style="margin-top:6px;font-size:11.5px;color:#666;">${n}</div>`).join('')}`);
}

function arFunctionalHtml(cur, prev, compare) {
  const model = window.ReportLogic.reportFunctional([cur, ...(compare && prev ? [prev] : [])], '9999-12-31');
  if (!model) return '';
  const c = model.current; const p = compare ? model.previous : null;
  const idx = c.complete
    ? `<div style="margin-bottom:8px;">Índice de Aptidão Funcional: <strong style="font-size:18px;color:${AR_GREEN};">${c.index}</strong> de 100 — ${arEsc(c.classification)}${p && p.complete ? ` (antes: ${p.index})` : ''}.</div>`
    : '<div style="margin-bottom:8px;">Avaliação incompleta: faltam testes para calcular o índice.</div>';
  const rows = model.tests.map((t) => `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${arEsc(t.label)}</td>
    ${compare ? `<td style="padding:5px 8px;border-bottom:1px solid #eee;">${t.prev != null ? arFmt(t.prev) + ' ' + arEsc(t.unit) : '—'}</td>` : ''}
    <td style="padding:5px 8px;border-bottom:1px solid #eee;"><strong>${arFmt(t.cur)} ${arEsc(t.unit)}</strong></td>
    ${compare ? `<td style="padding:5px 8px;border-bottom:1px solid #eee;">${t.improved === true ? '▲ melhorou' : (t.worse === true ? '▼ piorou' : (t.improved === false ? 'igual' : '—'))}</td>` : ''}
    <td style="padding:5px 8px;border-bottom:1px solid #eee;">${arEsc(t.classification)}</td></tr>`).join('');
  return arSection(`Avaliação funcional (Senior Fitness Test) — ${Utils.formatDateBR(cur.date)}`, `${idx}
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;"><thead><tr style="text-align:left;color:#666;"><th style="padding:5px 8px;">Teste</th>${compare ? '<th style="padding:5px 8px;">Antes</th>' : ''}<th style="padding:5px 8px;">Agora</th>${compare ? '<th style="padding:5px 8px;">Evolução</th>' : ''}<th style="padding:5px 8px;">Classificação</th></tr></thead><tbody>${rows}</tbody></table>`);
}

function arPosturalHtml(cur, prev, compare, st, student) {
  const text = (f) => PosturalLogic.describeFinding(f) + ' · ' + PosturalLogic.SEVERITY_LABELS[f.severity];
  const list = (cur.findings || []).map(text);
  let diff = '';
  if (compare && prev) {
    const id = (f) => f.key + '|' + (f.side || '');
    const sevOf = (f) => PosturalLogic.SEVERITY_LABELS[f.severity];
    const prevMap = new Map((prev.findings || []).map((f) => [id(f), f]));
    const curMap = new Map((cur.findings || []).map((f) => [id(f), f]));
    const novos = [], mudaram = [], persistem = [], resolvidos = [];
    (cur.findings || []).forEach((f) => {
      const p = prevMap.get(id(f));
      if (!p) novos.push(text(f));
      else if (p.severity !== f.severity) mudaram.push(`${PosturalLogic.describeFinding(f)} · ${sevOf(p)} → ${sevOf(f)}`);
      else persistem.push(text(f));
    });
    (prev.findings || []).forEach((f) => { if (!curMap.has(id(f))) resolvidos.push(text(f)); });
    const grp = (title, arr) => (arr.length ? `<div style="margin-top:6px;"><strong>${title}</strong><ul style="margin:2px 0 0 18px;padding:0;">${arr.map((x) => `<li>${arEsc(x)}</li>`).join('')}</ul></div>` : '');
    diff = `<div style="margin-top:8px;font-size:12.5px;"><div style="color:#666;">Comparação com a avaliação de ${Utils.formatDateBR(prev.date)}:</div>${grp('Novos', novos)}${grp('Mudaram de intensidade', mudaram)}${grp('Persistem', persistem)}${grp('Não aparecem mais', resolvidos)}</div>`;
  }
  let emphasis = '';
  if ((cur.findings || []).length) {
    try {
      const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, cur.date) : null;
      const res = PosturalLogic.crossPosture({ evaluation: cur, student, physicalEvaluation: null, templates: [], guidance: null, age });
      const g = res.strengthen.slice(0, 4).map((p) => p.label.toLowerCase());
      const m = res.mobilize.slice(0, 4).map((x) => x.label.toLowerCase());
      if (g.length || m.length) emphasis = `<div style="margin-top:8px;font-size:12.5px;">${g.length ? `Ênfase de fortalecimento no treino: <strong>${arEsc(g.join(', '))}</strong>.` : ''}${m.length ? ` Mobilidade e alongamento: ${arEsc(m.join(', '))}.` : ''}</div>`;
    } catch (e) { /* sem ênfases */ }
  }
  const canPhotos = st.photos && cur.photoConsent && cur.photos;
  const views = window.POS_VIEWS_LIST || [];
  const photoViews = canPhotos ? views.filter((v) => st.photoViews[v.key] !== false && cur.photos[v.key]) : [];
  const photos = photoViews.length ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">${photoViews.map((v) => `<figure style="margin:0;width:46%;min-width:160px;"><img src="${arEsc(cur.photos[v.key])}" alt="" style="width:100%;max-height:300px;object-fit:contain;border:1px solid #ddd;border-radius:6px;background:#fafafa;"><figcaption style="font-size:11.5px;color:#555;text-align:center;">${arEsc(v.label)}</figcaption></figure>`).join('')}</div>` : '';
  return arSection(`Avaliação postural — ${Utils.formatDateBR(cur.date)}`, `
    ${list.length ? `<ul style="margin:0 0 0 18px;padding:0;font-size:13px;">${list.map((x) => `<li>${arEsc(x)}</li>`).join('')}</ul>` : '<div style="font-size:13px;">Sem alterações marcadas.</div>'}
    ${cur.notes ? `<div style="margin-top:6px;font-size:12.5px;color:#444;">${arMulti(cur.notes)}</div>` : ''}
    ${diff}${emphasis}${photos}
    <div style="margin-top:8px;font-size:11px;color:#777;">Achados posturais orientam a ênfase do treino; não constituem diagnóstico. A relação entre desequilíbrios musculares e desvios posturais tem evidência limitada.</div>`);
}

function arWorkNeedsHtml(phys) {
  const labels = phys ? workNeedLabels(phys.workNeeds) : [];
  if (!labels.length && !(phys && phys.workNeedsNotes)) return '';
  return arSection('Trabalho necessário', `<div style="font-size:13px;">${arEsc(labels.join(', ') || '—')}</div>${phys.workNeedsNotes ? `<div style="margin-top:4px;font-size:12.5px;color:#444;">${arMulti(phys.workNeedsNotes)}</div>` : ''}`);
}

function arCustomHtml(cur) {
  if (!(cur.customTests || []).length) return '';
  const lines = (cur.customTests || []).map((x) => `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;">${arEsc(x.name)}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;"><strong>${arFmt(x.value)} ${arEsc(x.unit)}</strong></td><td style="padding:5px 8px;border-bottom:1px solid #eee;">${arEsc(x.level || '—')}</td></tr>`).join('');
  return arSection('Testes personalizados', lines ? `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="text-align:left;color:#666;"><th style="padding:5px 8px;">Teste</th><th style="padding:5px 8px;">Resultado</th><th style="padding:5px 8px;">Classificação</th></tr></thead><tbody>${lines}</tbody></table>` : '<div style="font-size:13px;">Nenhum teste personalizado nesta avaliação.</div>');
}

function arModel() {
  const st = arEnsureState();
  const d = AppState.data;
  return {
    st, student: currentStudent(),
    phys: arPick(d.physicalEvaluations, st.physId),
    func: arPick(d.evaluations, st.funcId),
    pos: arPick(d.posturalEvaluations, st.posId),
  };
}

function arHtml(m) {
  const { st, student } = m;
  const sec = st.sections; const parts = [];
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, Utils.todayISO()) : null;
  const dates = [m.phys.cur?.date, m.func.cur?.date, m.pos.cur?.date].filter(Boolean).sort();
  parts.push(`<div style="font-family:'Segoe UI',Arial,sans-serif;color:#222;font-size:13.5px;line-height:1.5;">
    ${Profile.docHeaderHtml('Relatório de Avaliação', `Aluno(a): <strong>${arEsc(student.name)}</strong> &nbsp;·&nbsp; Emitido em ${Utils.formatDateBR(Utils.todayISO())}`)}`);
  if (sec.ident) {
    parts.push(arSection('Identificação', `<div style="display:flex;gap:26px;flex-wrap:wrap;font-size:13px;"><div>Nome: <strong>${arEsc(student.name)}</strong></div>${age != null ? `<div>Idade: <strong>${age} anos</strong></div>` : ''}<div>Sexo: <strong>${student.sex === 'F' ? 'Feminino' : 'Masculino'}</strong></div>${dates.length ? `<div>Avaliações de: <strong>${[...new Set(dates)].map(Utils.formatDateBR).join(', ')}</strong></div>` : ''}</div>`));
  }
  if (sec.fisica && m.phys.cur) parts.push(arPhysicalHtml(m.phys.cur, m.phys.prev, st.compare));
  if (sec.custom && m.phys.cur) parts.push(arCustomHtml(m.phys.cur));
  if (sec.funcional && m.func.cur) parts.push(arFunctionalHtml(m.func.cur, m.func.prev, st.compare));
  if (sec.postural && m.pos.cur) parts.push(arPosturalHtml(m.pos.cur, m.pos.prev, st.compare, st, student));
  if (sec.trabalho && m.phys.cur) parts.push(arWorkNeedsHtml(m.phys.cur));
  if (sec.parecer && st.parecer.trim()) parts.push(`<section style="break-inside:avoid;margin:0 0 18px;background:#eef3ef;border-left:4px solid ${AR_GREEN};padding:10px 14px;border-radius:6px;"><div style="font-weight:700;color:${AR_GREEN};margin-bottom:4px;">Parecer e recomendações</div>${arMulti(st.parecer.trim())}</section>`);
  parts.push(`<div style="border-top:1px solid #ddd;padding-top:8px;margin-top:8px;font-size:11px;color:#777;">Este relatório reúne informações de avaliação e acompanhamento e não substitui avaliação ou orientação médica. Documento confidencial, destinado ao aluno e às pessoas que ele autorizar.</div>
    <div style="display:flex;gap:40px;margin-top:40px;font-size:12px;"><div style="flex:1;border-top:1px solid #555;padding-top:4px;text-align:center;">${arEsc(Profile.signatureLine ? Profile.signatureLine() : 'Profissional')}</div><div style="flex:1;border-top:1px solid #555;padding-top:4px;text-align:center;">${arEsc(student.name)}</div></div></div>`);
  return parts.join('');
}

function arWhatsText(m) {
  const { st, student } = m; const L = [`*Relatório de avaliação — ${student.name}*`, ''];
  const c = m.phys.cur;
  if (st.sections.fisica && c) {
    L.push(`📏 Avaliação de ${Utils.formatDateBR(c.date)}`);
    const imc = computeImcResult(c.weight, c.height, c.age);
    L.push(`Peso: ${arFmt(c.weight)} kg${imc ? ` · IMC ${arFmt(imc.imc)} (${imc.label})` : ''}`);
    if (c.bodyFatPercent != null) {
      const cl = Skinfold.classifyBodyFat(c.bodyFatPercent, c.age, c.sex);
      const p = m.phys.prev;
      L.push(`Gordura corporal: ${arFmt(c.bodyFatPercent)}%${cl ? ` (${cl.label})` : ''}${st.compare && p && p.bodyFatPercent != null ? ` · antes: ${arFmt(p.bodyFatPercent)}%` : ''}`);
    }
  }
  if (st.sections.custom && c) (c.customTests || []).forEach((x) => L.push(`• ${x.name}: ${arFmt(x.value)} ${x.unit}${x.level ? ' (' + x.level + ')' : ''}`));
  if (st.sections.funcional && m.func.cur) {
    const a = window.SFT.computeFunctionalAssessment(m.func.cur.results, m.func.cur.age, m.func.cur.sex);
    if (a.complete) L.push(`📈 Aptidão funcional: ${a.index} pontos (${a.classification})`);
  }
  if (st.sections.postural && m.pos.cur) L.push(`🧍 Avaliação postural de ${Utils.formatDateBR(m.pos.cur.date)}: ${(m.pos.cur.findings || []).length ? (m.pos.cur.findings || []).length + ' ponto(s) de atenção para o treino' : 'sem alterações marcadas'}`);
  if (st.sections.parecer && st.parecer.trim()) { L.push(''); L.push(st.parecer.trim()); }
  L.push(''); L.push(`${Profile.signatureLine() ? Profile.signatureLine() + ' · ' : ''}Método Pleno`);
  return L.join('\n');
}

// ---------- Aba ----------
function arRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';
  const st = arEnsureState();
  const d = AppState.data;
  const opt = (list, raw) => { const sel = arEffId(list, raw); return `<option value="">Não incluir</option>${arSorted(list).map((r) => `<option value="${arEsc(r.id)}" ${r.id === sel ? 'selected' : ''}>${Utils.formatDateBR(r.date)}</option>`).join('')}`; };
  const pos = arPick(d.posturalEvaluations, st.posId).cur;
  const hasPhotos = !!(pos && pos.photoConsent && pos.photos && Object.values(pos.photos).some(Boolean));
  const views = window.POS_VIEWS_LIST || [];
  if (!d.physicalEvaluations.length && !d.evaluations.length && !d.posturalEvaluations.length) {
    return '<div class="mp-empty"><h3>Ainda não há avaliações</h3><p>Registre uma avaliação física, funcional ou postural deste aluno para gerar o relatório.</p></div>';
  }
  return `
  <div class="mp-card">
    <h3>Relatório de Avaliação</h3>
    <div class="mp-sub">Documento único com o resultado das avaliações do aluno. Escolha qual avaliação de cada tipo entra (por padrão, a mais recente) e o que incluir. A pré-visualização abaixo é o próprio documento.</div>
    <div class="mp-form-row mp-row3">
      <div class="mp-field"><label>Avaliação física</label><select id="ar-phys">${opt(d.physicalEvaluations, st.physId)}</select></div>
      <div class="mp-field"><label>Avaliação funcional</label><select id="ar-func">${opt(d.evaluations, st.funcId)}</select></div>
      <div class="mp-field"><label>Avaliação postural</label><select id="ar-pos">${opt(d.posturalEvaluations, st.posId)}</select></div>
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0 10px;cursor:pointer;"><input type="checkbox" id="ar-compare" style="width:auto;" ${st.compare ? 'checked' : ''}> Comparar cada avaliação com a anterior</label>
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:8px 0;color:var(--verde-principal);">O que incluir</h4>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin-bottom:12px;">
      ${AR_SECTIONS.map((s) => `<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:pointer;"><input type="checkbox" data-ar-sec="${s.key}" style="margin-top:3px;width:auto;" ${st.sections[s.key] ? 'checked' : ''}><span>${arEsc(s.label)}</span></label>`).join('')}
    </div>
    <div style="padding:10px 12px;border:1px solid var(--borda);border-radius:10px;margin-bottom:12px;background:#fff;">
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;cursor:${hasPhotos ? 'pointer' : 'not-allowed'};opacity:${hasPhotos ? 1 : .6};"><input type="checkbox" id="ar-photos" style="margin-top:3px;width:auto;" ${st.photos && hasPhotos ? 'checked' : ''} ${hasPhotos ? '' : 'disabled'}><span><strong>Incluir fotos posturais neste relatório</strong><br><span style="color:var(--texto-suave);font-size:12px;">${hasPhotos ? 'Fotos são dado sensível. Inclua só se o aluno autorizou o uso neste documento. A escolha vale só para este relatório e as fotos nunca vão no resumo de WhatsApp.' : 'Disponível apenas quando a avaliação postural escolhida tem fotos e o aluno autorizou o registro.'}</span></span></label>
      ${st.photos && hasPhotos ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin:8px 0 0 26px;">${views.filter((v) => pos.photos[v.key]).map((v) => `<label style="font-size:12.5px;display:flex;gap:6px;align-items:center;cursor:pointer;"><input type="checkbox" data-ar-view="${v.key}" style="width:auto;" ${st.photoViews[v.key] !== false ? 'checked' : ''}> ${arEsc(v.label)}</label>`).join('')}</div>` : ''}
    </div>
    <div class="mp-field"><label>Parecer e recomendações do profissional (opcional)</label><textarea id="ar-parecer" rows="4" placeholder="Ex: Boa evolução da força de membros inferiores. Prioridade nos próximos 3 meses: equilíbrio e mobilidade de ombros.">${arEsc(st.parecer)}</textarea></div>
    <div class="mp-form-actions" style="justify-content:flex-start;flex-wrap:wrap;">
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="ar-print">🖨 Imprimir / Salvar em PDF</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="ar-share">💬 Compartilhar resumo (WhatsApp)</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="ar-copy">📋 Copiar resumo</button>
    </div>
    <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">Antes de enviar a terceiros, confirme a autorização do aluno. No PDF, escolha "Salvar como PDF" na janela de impressão.</div>
  </div>
  <div class="mp-card" style="margin-top:20px;">
    <h3>Pré-visualização</h3>
    <div id="ar-preview" style="border:1px solid var(--borda);border-radius:10px;padding:22px;background:#fff;overflow-x:auto;"></div>
  </div>
  <div id="mp-print-area" class="mp-print-only"></div>`;
}

function arBindEvents(container) {
  const student = currentStudent();
  if (!student) return;
  const st = arEnsureState();
  const update = () => { const b = container.querySelector('#ar-preview'); if (b) b.innerHTML = arHtml(arModel()); };
  update();
  const rerender = () => render();
  container.querySelector('#ar-phys')?.addEventListener('change', (e) => { st.physId = e.target.value; rerender(); });
  container.querySelector('#ar-func')?.addEventListener('change', (e) => { st.funcId = e.target.value; rerender(); });
  container.querySelector('#ar-pos')?.addEventListener('change', (e) => { st.posId = e.target.value; st.photos = false; rerender(); });
  container.querySelector('#ar-compare')?.addEventListener('change', (e) => { st.compare = e.target.checked; update(); });
  container.querySelectorAll('[data-ar-sec]').forEach((cb) => cb.addEventListener('change', () => { st.sections[cb.dataset.arSec] = cb.checked; update(); }));
  container.querySelector('#ar-photos')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const ok = await Utils.confirmDialog('As fotos posturais são dado sensível. Confirme que o aluno autorizou o uso das fotos neste relatório. Incluir as fotos?');
      if (!ok) { e.target.checked = false; return; }
    }
    st.photos = e.target.checked; rerender();
  });
  container.querySelectorAll('[data-ar-view]').forEach((cb) => cb.addEventListener('change', () => { st.photoViews[cb.dataset.arView] = cb.checked; update(); }));
  let timer = null;
  container.querySelector('#ar-parecer')?.addEventListener('input', (e) => { st.parecer = e.target.value; clearTimeout(timer); timer = setTimeout(update, 200); });
  container.querySelector('#ar-print')?.addEventListener('click', () => {
    container.querySelector('#mp-print-area').innerHTML = arHtml(arModel());
    window.print();
  });
  const text = () => arWhatsText(arModel());
  container.querySelector('#ar-share')?.addEventListener('click', async () => {
    const t = text();
    if (navigator.share) { try { await navigator.share({ title: `Relatório de avaliação — ${student.name}`, text: t }); } catch (e) { /* cancelado */ } }
    else window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  });
  container.querySelector('#ar-copy')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text()); Utils.toast('Resumo copiado ✓', 'success'); }
    catch (e) { Utils.toast('Não foi possível copiar.', 'error'); }
  });
}

window.AssessmentReportView = { renderHtml: arRenderHtml, bindEvents: arBindEvents, html: arHtml, model: arModel, whatsText: arWhatsText };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['assessment-report.js'] = 'v1.23.0';
