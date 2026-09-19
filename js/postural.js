// Aba: Avaliação Postural — checklist de achados por segmento, fotos (opcionais, com
// consentimento), análise na foto (grade, linha de prumo, inclinação e ângulos), histórico com
// comparação e o cruzamento que sugere ênfases de treino (ver postural-logic.js).
// Fotos ficam SÓ no aparelho (data URL comprimida no IndexedDB), como o resto do app.

const POS_VIEWS = [
  { key: 'anterior', label: 'Anterior (frente)' },
  { key: 'posterior', label: 'Posterior (costas)' },
  { key: 'lateralD', label: 'Lateral direita' },
  { key: 'lateralE', label: 'Lateral esquerda' },
];
const POS_VIEW_LABEL = Object.fromEntries(POS_VIEWS.map((v) => [v.key, v.label]));
const POS_VIEW_HINT = { frontal: 'vista anterior', lateral: 'vista lateral', posterior: 'vista posterior' };

const POS_MEASURE_KINDS = {
  horiz: { label: 'Inclinação vs horizontal', points: 2, hint: 'Clique em 2 pontos. Ex.: C7 → trágus mede o ângulo craniovertebral (CVA); linha entre os acrômios mede a inclinação dos ombros.' },
  vert: { label: 'Inclinação vs vertical', points: 2, hint: 'Clique em 2 pontos. Ex.: alinhamento do tronco em relação à vertical.' },
  ang3: { label: 'Ângulo entre 3 pontos', points: 3, hint: 'Clique em 3 pontos; o ângulo é medido no ponto do meio. Ex.: quadril → joelho → tornozelo.' },
};
const POS_MEASURE_LABELS = ['CVA (cabeça)', 'Ombros', 'Pelve', 'Tronco', 'Joelho', 'Outro'];

let posDraft = null;        // rascunho da nova avaliação
let posCompareId = null;    // avaliação aberta em comparação

function posEnsureDraft() {
  if (!posDraft || posDraft.studentId !== AppState.currentId) {
    posDraft = { studentId: AppState.currentId, date: Utils.todayISO(), findings: {}, notes: '', consent: false, photos: {}, measures: [] };
  }
  return posDraft;
}

function posSortedDesc() {
  return [...(AppState.data.posturalEvaluations || [])].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function posFindingText(f) {
  const text = PosturalLogic.describeFinding(f);
  return text ? `${text} · ${PosturalLogic.SEVERITY_LABELS[f.severity]}` : '';
}

// ---------- Fotos ----------
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
    img.src = src;
  });
}
// Reduz para no máximo `maxSide` px e comprime em JPEG — mantém o app leve e o backup viável.
async function compressPhoto(file, maxSide = 1000, quality = 0.72) {
  const img = await loadImage(await readFileAsDataUrl(file));
  const { w, h } = PosturalLogic.fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// ---------- Análise na foto ----------
function measureValue(kind, pts, w, h) {
  const L = PosturalLogic;
  if (kind === 'horiz') return L.inclinationFromHorizontal(pts[0], pts[1], w, h);
  if (kind === 'vert') return L.inclinationFromVertical(pts[0], pts[1], w, h);
  return L.angleAtVertex(pts[0], pts[1], pts[2], w, h);
}

async function openPhotoAnalysis(holder, viewKey, onChange) {
  const src = holder.photos && holder.photos[viewKey];
  if (!src) { Utils.toast('Esta vista não tem foto.', 'error'); return; }
  let img;
  try { img = await loadImage(src); } catch (e) { Utils.toast(e.message, 'error'); return; }

  const overlay = Utils.el(`
    <div class="modal-overlay">
      <div class="modal" style="max-width:760px;width:96vw;max-height:94vh;overflow-y:auto;">
        <h3 style="font-family:'Fraunces',serif;margin-bottom:8px;">Análise da foto — ${Utils.escapeHtml(POS_VIEW_LABEL[viewKey] || viewKey)}</h3>
        <div class="mp-sub" style="margin:0 0 8px;">Medidas por foto são estimativas: a repetibilidade depende de padronizar câmera, distância e posição do aluno nas reavaliações.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          ${Object.entries(POS_MEASURE_KINDS).map(([k, d]) => `<button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-tool="${k}">${Utils.escapeHtml(d.label)}</button>`).join('')}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px;font-size:13px;">
          <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="pa-grid" checked> Grade</label>
          <label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="pa-plumb" checked> Linha de prumo</label>
        </div>
        <div class="mp-sub" id="pa-hint" style="margin:0 0 8px;min-height:18px;"></div>
        <canvas id="pa-canvas" style="max-width:100%;height:auto;border-radius:10px;cursor:crosshair;touch-action:manipulation;"></canvas>
        <div id="pa-pending" style="margin-top:10px;"></div>
        <div id="pa-list" style="margin-top:10px;"></div>
        <div class="modal__actions"><button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-action="close" type="button">Fechar</button></div>
      </div>
    </div>`);
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector('#pa-canvas');
  const scale = Math.min(1, 640 / img.naturalWidth, 760 / img.naturalHeight);
  const cw = Math.max(1, Math.round(img.naturalWidth * scale));
  const ch = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  let tool = null;
  let pending = [];
  let pendingKind = null;
  const listEl = overlay.querySelector('#pa-list');
  const pendingEl = overlay.querySelector('#pa-pending');
  const hintEl = overlay.querySelector('#pa-hint');

  const P = (p) => [p.x * cw, p.y * ch];
  function line(a, b, color, dash) {
    ctx.beginPath(); ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); ctx.setLineDash([]);
  }
  function dot(p, color) { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(...P(p), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
  function text(str, p, color) {
    ctx.font = '700 13px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.fillStyle = color;
    const [x, y] = P(p); ctx.strokeText(str, x + 8, y - 8); ctx.fillText(str, x + 8, y - 8);
  }
  function drawMeasure(kind, pts, value, color) {
    if (kind === 'ang3') { line(pts[0], pts[1], color); line(pts[1], pts[2], color); }
    else {
      line(pts[0], pts[1], color);
      const ref = kind === 'horiz' ? { x: pts[1].x, y: pts[0].y } : { x: pts[0].x, y: pts[1].y };
      line(pts[0], ref, 'rgba(255,255,255,.8)', [5, 4]);
    }
    pts.forEach((p) => dot(p, color));
    if (value != null) text(`${value.toFixed(1)}°`, kind === 'ang3' ? pts[1] : pts[0], color);
  }
  function draw() {
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    if (overlay.querySelector('#pa-grid').checked) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(cw * i / 8, 0); ctx.lineTo(cw * i / 8, ch); ctx.stroke(); }
      for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(0, ch * i / 10); ctx.lineTo(cw, ch * i / 10); ctx.stroke(); }
    }
    if (overlay.querySelector('#pa-plumb').checked) {
      ctx.strokeStyle = 'rgba(220,60,40,.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke(); ctx.setLineDash([]);
    }
    (holder.measures || []).filter((m) => m.view === viewKey).forEach((m) => drawMeasure(m.kind, m.points, m.value, '#E4D2A6'));
    if (pending.length) {
      pending.forEach((p) => dot(p, '#7CFC9A'));
      if (pending.length >= 2) line(pending[0], pending[1], '#7CFC9A');
      if (pending.length === 3) line(pending[1], pending[2], '#7CFC9A');
    }
  }
  function renderList() {
    const own = (holder.measures || []).filter((m) => m.view === viewKey);
    listEl.innerHTML = own.length ? `
      <div class="mp-sub" style="margin:0 0 6px;font-weight:700;">Medidas salvas nesta foto</div>
      ${own.map((m) => `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid var(--borda);padding:6px 0;font-size:13px;">
        <span>${Utils.escapeHtml(m.label)} — ${Utils.escapeHtml(POS_MEASURE_KINDS[m.kind]?.label || m.kind)}: <strong>${m.value.toFixed(1)}°</strong></span>
        <button type="button" class="mp-btn-danger" data-del-measure="${m.id}">Excluir</button></div>`).join('')}` : '';
  }
  function renderPending() {
    if (!pendingKind) { pendingEl.innerHTML = ''; return; }
    const need = POS_MEASURE_KINDS[pendingKind].points;
    if (pending.length < need) {
      pendingEl.innerHTML = `<div class="mp-sub" style="margin:0;">Ponto ${pending.length + 1} de ${need}.
        ${pending.length ? '<button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="pa-undo">Desfazer ponto</button>' : ''}</div>`;
      pendingEl.querySelector('#pa-undo')?.addEventListener('click', () => { pending.pop(); draw(); renderPending(); });
      return;
    }
    const value = measureValue(pendingKind, pending, cw, ch);
    pendingEl.innerHTML = `
      <div class="mp-inline-alert mp-inline-alert-moderado" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <span>Medida: <strong>${value.toFixed(1)}°</strong></span>
        <select id="pa-label" class="mp-select-inline">${POS_MEASURE_LABELS.map((l) => `<option>${Utils.escapeHtml(l)}</option>`).join('')}</select>
        <button type="button" class="mp-btn mp-btn-gold mp-btn-sm" style="background:var(--verde-principal);color:#fff;" id="pa-save-measure">Salvar medida</button>
        <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="pa-cancel-measure">Descartar</button>
      </div>`;
    pendingEl.querySelector('#pa-cancel-measure').addEventListener('click', () => { pending = []; pendingKind = null; tool = null; draw(); renderPending(); hintEl.textContent = ''; });
    pendingEl.querySelector('#pa-save-measure').addEventListener('click', async () => {
      holder.measures = holder.measures || [];
      holder.measures.push({ id: dbUuid(), view: viewKey, kind: pendingKind, label: pendingEl.querySelector('#pa-label').value, points: pending.map((p) => ({ x: p.x, y: p.y })), value });
      pending = []; pendingKind = null; tool = null;
      hintEl.textContent = '';
      draw(); renderPending(); renderList();
      if (onChange) await onChange();
      Utils.toast('Medida salva ✓', 'success');
    });
  }

  overlay.querySelectorAll('[data-tool]').forEach((btn) => btn.addEventListener('click', () => {
    tool = btn.dataset.tool; pendingKind = tool; pending = [];
    hintEl.textContent = POS_MEASURE_KINDS[tool].hint;
    draw(); renderPending();
  }));
  overlay.querySelector('#pa-grid').addEventListener('change', draw);
  overlay.querySelector('#pa-plumb').addEventListener('change', draw);
  canvas.addEventListener('click', (e) => {
    if (!tool) { hintEl.textContent = 'Escolha uma ferramenta de medida acima.'; return; }
    const need = POS_MEASURE_KINDS[tool].points;
    if (pending.length >= need) return;
    const rect = canvas.getBoundingClientRect();
    pending.push({ x: Math.min(1, Math.max(0, (e.clientX - rect.left) / (rect.width || cw))), y: Math.min(1, Math.max(0, (e.clientY - rect.top) / (rect.height || ch))) });
    draw(); renderPending();
  });
  listEl.addEventListener('click', async (e) => {
    const id = e.target.dataset.delMeasure;
    if (!id) return;
    holder.measures = holder.measures.filter((m) => m.id !== id);
    draw(); renderList();
    if (onChange) await onChange();
  });
  overlay.addEventListener('click', (e) => { if (e.target.dataset.action === 'close' || e.target === overlay) { overlay.remove(); render(); } });

  draw(); renderList();
}

// ---------- Renderização ----------
function posFormHtml(draft) {
  const rows = [];
  let lastSegment = null;
  PosturalLogic.POSTURE_FINDINGS.forEach((def) => {
    if (def.segment !== lastSegment) { rows.push(`<tr><td colspan="3" style="background:var(--verde-pallido);font-weight:700;color:var(--verde-principal);font-size:12.5px;">${Utils.escapeHtml(def.segment)}</td></tr>`); lastSegment = def.segment; }
    const cur = draft.findings[def.key] || { severity: 0, side: '' };
    rows.push(`
      <tr>
        <td>${Utils.escapeHtml(def.label)}<div style="font-size:11.5px;color:var(--texto-suave);">${POS_VIEW_HINT[def.view] || ''}${def.structural ? ' · achado estrutural: gera encaminhamento' : ''}</div></td>
        <td><select class="mp-select-inline" data-pf-sev="${def.key}">
          <option value="0" ${!cur.severity ? 'selected' : ''}>—</option>
          ${[1, 2, 3].map((s) => `<option value="${s}" ${cur.severity === s ? 'selected' : ''}>${PosturalLogic.SEVERITY_LABELS[s]}</option>`).join('')}
        </select></td>
        <td>${PosturalLogic.sideOptionsFor(def) ? `<select class="mp-select-inline" style="max-width:100%;" data-pf-side="${def.key}">
          <option value="" ${!cur.side ? 'selected' : ''}>${def.sideRequired ? Utils.escapeHtml((def.sideLabel || 'Selecione') + ' *') : 'lado'}</option>
          ${PosturalLogic.sideOptionsFor(def).map(([code, label]) => `<option value="${code}" ${cur.side === code ? 'selected' : ''}>${Utils.escapeHtml(label)}</option>`).join('')}
        </select>` : ''}</td>
      </tr>`);
  });

  const slots = POS_VIEWS.map((v) => {
    const src = draft.photos[v.key];
    return `
      <div style="border:1px solid var(--borda);border-radius:10px;padding:8px;background:#fff;text-align:center;">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px;">${v.label}</div>
        ${src ? `<img src="${src}" alt="${Utils.escapeHtml(v.label)}" style="width:100%;max-height:140px;object-fit:contain;border-radius:6px;">
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:6px;">
            <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-pp-analyze="${v.key}">🔍 Analisar</button>
            <button type="button" class="mp-btn-danger" data-pp-remove="${v.key}">Remover</button>
          </div>` : `
          <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-pp-add="${v.key}" ${draft.consent ? '' : 'disabled'}>📷 Adicionar foto</button>
          <input type="file" accept="image/*" style="display:none;" data-pp-file="${v.key}">`}
      </div>`;
  }).join('');

  return `
  <div class="mp-card">
    <h3>Nova avaliação postural</h3>
    <div class="mp-sub" style="margin-top:10px;">Marque o que observar em cada segmento (gravidade e, quando houver, o lado). Sem achado marcado, a postura é considerada sem alterações. Fotos são opcionais.</div>
    <div class="mp-form-row mp-row3" style="margin-bottom:8px;">
      <div class="mp-field"><label>Data da avaliação</label><input type="date" id="pos-date" value="${draft.date}"></div>
    </div>
    <div class="mp-table-scroll"><table class="mp-table"><thead><tr><th>Achado</th><th>Gravidade</th><th>Lado / padrão</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>

    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Fotos posturais (opcional)</h4>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;">
      <input type="checkbox" id="pos-consent" style="margin-top:3px;width:auto;" ${draft.consent ? 'checked' : ''}>
      <span>O aluno autorizou o registro de fotos posturais. As fotos são dado sensível: ficam salvas só neste aparelho, comprimidas, e podem ser excluídas a qualquer momento.</span>
    </label>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;">${slots}</div>
    <div class="mp-sub" style="margin:8px 0 0;font-size:11.5px;">Para comparar entre avaliações, repita o mesmo protocolo: mesma distância, câmera na altura do meio do corpo, aluno descalço e com roupa que permita ver o contorno.</div>

    <div class="mp-field" style="margin-top:14px;">
      <label>Observações</label>
      <textarea id="pos-notes" placeholder="Ex: ombro direito mais alto ao final da aula; queixa de tensão cervical.">${Utils.escapeHtml(draft.notes)}</textarea>
    </div>
    <div class="mp-form-actions" style="margin-top:14px;">
      <button type="button" class="mp-btn mp-btn-ghost" id="pos-clear">Limpar</button>
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="pos-save">Salvar avaliação postural</button>
    </div>
  </div>`;
}

function posCrossHtml() {
  const student = currentStudent();
  const list = posSortedDesc();
  const latest = list[0] || null;
  const phys = [...(AppState.data.physicalEvaluations || [])].sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  if (!latest) {
    const needsPosture = (phys?.workNeeds || []).includes('postura');
    return `
    <div class="mp-card" style="margin-top:20px;">
      <h3>Ênfase de treino sugerida</h3>
      <div class="mp-sub" style="margin:0;">${needsPosture ? `Na Avaliação Física de ${Utils.formatDateBR(phys.date)}, "Postura" está marcada como trabalho necessário. ` : ''}Salve uma avaliação postural para receber as sugestões — elas cruzam os achados com a Avaliação Física, o objetivo e as Fichas de treino.</div>
    </div>`;
  }

  const age = student?.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, Utils.todayISO()) : null;
  const eff = PeriodizationLogic.effectiveGuidance(student);
  const active = PeriodizationLogic.activePeriodization();
  const res = PosturalLogic.crossPosture({
    evaluation: latest, student, physicalEvaluation: phys,
    templates: AppState.data.workoutTemplates, guidance: eff ? eff.guidance : null,
    periodizationLabel: active ? eff.label : '', age,
  });

  const alertBox = (items, cls) => items.length ? `<div class="mp-inline-alert ${cls}" style="margin-top:10px;">${items.map((t) => `<div>• ${Utils.escapeHtml(t)}</div>`).join('')}</div>` : '';
  const statusPill = (p) => p.status === 'ok' ? `<span class="mp-pill mp-pill-leve">Coberto · ${p.sets} séries</span>`
    : (p.status === 'baixa' ? `<span class="mp-pill mp-pill-moderado">Volume baixo · ${p.sets} séries</span>` : '<span class="mp-pill mp-pill-alto">Sem exercício nas Fichas</span>');

  const strengthRows = res.strengthen.map((p, gi) => `
    <tr>
      <td><strong>${Utils.escapeHtml(p.label)}</strong><div style="font-size:12px;color:var(--texto-suave);">${p.why.map(Utils.escapeHtml).join(' · ')}</div></td>
      <td>${statusPill(p)}${p.have.length ? `<div style="font-size:11.5px;color:var(--texto-suave);margin-top:4px;">${p.have.slice(0, 3).map(Utils.escapeHtml).join('<br>')}</div>` : ''}</td>
      <td>${p.suggestions.length ? p.suggestions.map((s, si) => `<button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" style="margin:0 4px 4px 0;" data-pos-add="${p.group}|${si}" title="${s.series}×${s.reps}">＋ ${Utils.escapeHtml(s.name)}</button>`).join('') : '<span style="font-size:12px;color:var(--texto-suave);">—</span>'}</td>
    </tr>`).join('');

  const fichaOptions = ['A', 'B', 'C', 'D', 'E'].map((f) => `<option value="${f}">Ficha ${f}</option>`).join('');
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Ênfase de treino sugerida</h3>
    <div class="mp-sub">Cruzamento da avaliação postural de ${Utils.formatDateBR(latest.date)} com a Avaliação Física${phys ? ' de ' + Utils.formatDateBR(phys.date) : ''}, o objetivo do aluno e as Fichas de treino. São sugestões de ênfase (onde redistribuir séries) — não diagnóstico nem "correção" garantida.</div>
    ${!res.hasFindings ? '<div class="mp-inline-alert" style="background:var(--verde-pallido);color:var(--verde-principal);">Nenhum achado postural marcado: sem ênfase corretiva necessária no momento.</div>' : ''}
    ${alertBox(res.alerts, 'mp-inline-alert-alto')}
    ${alertBox(res.cautions, 'mp-inline-alert-moderado')}
    ${alertBox(res.cues, 'mp-inline-alert-moderado')}
    ${res.structural.length ? `<div class="mp-sub" style="margin:10px 0 0;">Achados estruturais (${Utils.escapeHtml(res.structural.join(', '))}) não geram sugestão de exercício, apenas o encaminhamento acima.</div>` : ''}

    ${res.strengthen.length ? `
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Dar ênfase (fortalecer)</h4>
    <div class="mp-field" style="max-width:240px;"><label>Ficha de destino ao adicionar</label><select id="pos-target-ficha">${fichaOptions}</select></div>
    <div class="mp-table-scroll"><table class="mp-table"><thead><tr><th>Grupo muscular</th><th>Nas Fichas atuais</th><th>Sugestões (adicionar à Ficha)</th></tr></thead><tbody>${strengthRows}</tbody></table></div>
    <div class="mp-sub" style="margin:8px 0 0;font-size:11.5px;">Cobertura = soma das séries das Fichas A–E (cada uma contada 1x por semana). Exercícios compostos contam uma fração da série. Referência prática: 6+ séries semanais por grupo prioritário.${res.fichasCount === 0 ? ' Nenhuma Ficha com exercícios ainda.' : ''}</div>` : ''}

    ${res.mobilize.length ? `
    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Mobilidade e alongamento</h4>
    ${res.mobilize.map((m) => `<div style="font-size:13px;margin-bottom:4px;">• <strong>${Utils.escapeHtml(m.label)}</strong>${m.how ? ' — ' + Utils.escapeHtml(m.how) : ''} <span style="color:var(--texto-suave);">(${m.why.map(Utils.escapeHtml).join(' · ')})</span></div>`).join('')}` : ''}

    <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Como aplicar no treino</h4>
    ${res.objectiveTip ? `<div style="font-size:13px;margin-bottom:4px;">• ${Utils.escapeHtml(res.objectiveTip)}</div>` : '<div style="font-size:13px;margin-bottom:4px;">• Defina o objetivo do aluno em Planejar Aula para receber orientação de aplicação.</div>'}
    ${res.periodizationLabel ? `<div style="font-size:13px;margin-bottom:4px;">• Periodização ativa (${Utils.escapeHtml(res.periodizationLabel)}): as séries e repetições sugeridas ao adicionar seguem a fase, limitadas a 3 séries e 8–15 repetições para exercícios corretivos.</div>` : ''}
    ${res.pushPull ? `<div style="font-size:13px;margin-bottom:4px;">• Razão puxar:empurrar nas Fichas: <strong>${res.pushPull.pull}:${res.pushPull.push}</strong> séries. ${res.pushPull.flag ? 'Está abaixo de 1:1 — com os achados de cintura escapular, a prática comum é igualar ou favorecer o puxar (remadas e afins).' : 'Equilibrada ou favorecendo o puxar, o que é adequado para os achados de cintura escapular.'}</div>` : ''}
    ${res.workNeedsNote ? `<div style="font-size:13px;margin-bottom:4px;">• ${Utils.escapeHtml(res.workNeedsNote)}</div>` : ''}
    ${res.unclassified.length ? `<div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">Exercícios das Fichas que o app não soube classificar (não entram na cobertura): ${res.unclassified.map(Utils.escapeHtml).join(', ')}.</div>` : ''}
    <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">A relação entre desequilíbrios musculares e desvios posturais tem evidência limitada; use como direcionamento de ênfase e reavalie periodicamente.</div>
  </div>`;
}

function posHistoryHtml() {
  const list = posSortedDesc();
  if (!list.length) return '';
  const rows = list.map((ev) => {
    const photoKeys = POS_VIEWS.filter((v) => ev.photos && ev.photos[v.key]);
    return `
    <tr>
      <td>${Utils.formatDateBR(ev.date)}</td>
      <td style="font-size:12.5px;">${ev.findings.length ? ev.findings.map((f) => Utils.escapeHtml(posFindingText(f))).join('<br>') : 'Sem alterações marcadas'}${ev.notes ? `<div style="color:var(--texto-suave);margin-top:4px;">${Utils.escapeHtml(ev.notes)}</div>` : ''}</td>
      <td style="font-size:12.5px;">${photoKeys.length ? photoKeys.map((v) => `<button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" style="margin:0 4px 4px 0;" data-hist-analyze="${ev.id}|${v.key}">🔍 ${Utils.escapeHtml(v.label)}</button>`).join('') : (ev.photosOmitted ? 'fotos não incluídas no backup' : '—')}${(ev.measures || []).length ? `<div style="color:var(--texto-suave);">${ev.measures.length} medida(s)</div>` : ''}</td>
      <td style="white-space:nowrap;">
        <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-pos-compare="${ev.id}">Comparar c/ anterior</button>
        <button type="button" class="mp-btn-danger" data-pos-del="${ev.id}">Excluir</button>
      </td>
    </tr>`;
  }).join('');

  let compareHtml = '';
  if (posCompareId) {
    const sorted = [...list].reverse();
    const idx = sorted.findIndex((e) => e.id === posCompareId);
    const cur = sorted[idx];
    const prev = idx > 0 ? sorted[idx - 1] : null;
    if (cur && !prev) compareHtml = '<div class="mp-sub" style="margin:12px 0 0;">Esta é a primeira avaliação postural: não há anterior para comparar.</div>';
    else if (cur) {
      const cmp = PosturalLogic.compareEvaluations(prev, cur);
      const pill = (s) => ({ mudou: '<span class="mp-pill mp-pill-moderado">mudou de lado/padrão</span>', melhorou: '<span class="mp-pill mp-pill-leve">melhorou</span>', resolvido: '<span class="mp-pill mp-pill-leve">resolvido</span>', piorou: '<span class="mp-pill mp-pill-alto">piorou</span>', novo: '<span class="mp-pill mp-pill-moderado">novo</span>', igual: '<span class="mp-pill mp-pill-neutro">igual</span>' }[s]);
      const sev = (n, d) => n ? PosturalLogic.SEVERITY_LABELS[n] + (d ? `<div style="font-size:11.5px;color:var(--texto-suave);">${Utils.escapeHtml(d)}</div>` : '') : '—';
      compareHtml = `
      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Comparação: ${Utils.formatDateBR(prev.date)} → ${Utils.formatDateBR(cur.date)}</h4>
      ${cmp.length ? `<div class="mp-table-scroll"><table class="mp-table"><thead><tr><th>Achado</th><th>Anterior</th><th>Atual</th><th>Evolução</th></tr></thead><tbody>
        ${cmp.map((c) => `<tr><td>${Utils.escapeHtml(c.label)}</td><td>${sev(c.prev, c.prevDetail)}</td><td>${sev(c.cur, c.curDetail)}</td><td>${pill(c.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mp-sub" style="margin:0;">Nenhum achado nas duas avaliações.</div>'}`;
    }
  }

  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de avaliações posturais</h3>
    <div class="mp-table-scroll"><table class="mp-table">
      <thead><tr><th>Data</th><th>Achados</th><th>Fotos e medidas</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${compareHtml}
  </div>`;
}

function posRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';
  return posFormHtml(posEnsureDraft()) + posCrossHtml() + posHistoryHtml();
}

// ---------- Eventos ----------
function posBindEvents(container) {
  const student = currentStudent();
  if (!student) return;
  const draft = posEnsureDraft();

  container.querySelector('#pos-date')?.addEventListener('change', (e) => { draft.date = e.target.value || Utils.todayISO(); });
  container.querySelector('#pos-notes')?.addEventListener('input', (e) => { draft.notes = e.target.value; });

  const syncFinding = (key) => {
    const sev = parseInt(container.querySelector(`[data-pf-sev="${key}"]`).value, 10) || 0;
    const sideEl = container.querySelector(`[data-pf-side="${key}"]`);
    if (!sev) delete draft.findings[key];
    else draft.findings[key] = { severity: sev, side: sideEl ? sideEl.value : '' };
  };
  container.querySelectorAll('[data-pf-sev]').forEach((el) => el.addEventListener('change', () => syncFinding(el.dataset.pfSev)));
  container.querySelectorAll('[data-pf-side]').forEach((el) => el.addEventListener('change', () => syncFinding(el.dataset.pfSide)));

  container.querySelector('#pos-consent')?.addEventListener('change', (e) => {
    draft.consent = e.target.checked;
    if (!draft.consent && Object.keys(draft.photos).length) { draft.photos = {}; draft.measures = []; Utils.toast('Sem autorização, as fotos do rascunho foram descartadas.', 'success'); }
    render();
  });

  container.querySelectorAll('[data-pp-add]').forEach((btn) => btn.addEventListener('click', () => container.querySelector(`[data-pp-file="${btn.dataset.ppAdd}"]`)?.click()));
  container.querySelectorAll('[data-pp-file]').forEach((input) => input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      draft.photos[input.dataset.ppFile] = await compressPhoto(file);
      render();
    } catch (e) { Utils.toast('Não foi possível usar esta foto: ' + (e.message || 'erro'), 'error'); }
  }));
  container.querySelectorAll('[data-pp-remove]').forEach((btn) => btn.addEventListener('click', () => {
    delete draft.photos[btn.dataset.ppRemove];
    draft.measures = draft.measures.filter((m) => m.view !== btn.dataset.ppRemove);
    render();
  }));
  container.querySelectorAll('[data-pp-analyze]').forEach((btn) => btn.addEventListener('click', () => openPhotoAnalysis(draft, btn.dataset.ppAnalyze, null)));

  container.querySelector('#pos-clear')?.addEventListener('click', () => { posDraft = null; render(); });

  container.querySelector('#pos-save')?.addEventListener('click', async () => {
    const findings = Object.entries(draft.findings).map(([key, v]) => ({ key, severity: v.severity, side: v.side || null }));
    const missingSide = findings.map((f) => PosturalLogic.FINDING_BY_KEY[f.key]).filter((def) => def && def.sideRequired && !draft.findings[def.key].side);
    if (missingSide.length) {
      Utils.toast('Indique o lado/padrão de: ' + missingSide.map((d) => d.label).join('; ') + '.', 'error');
      return;
    }
    const hasPhotos = Object.keys(draft.photos).length > 0;
    if (!findings.length && !hasPhotos && !draft.notes.trim()) {
      const ok = await Utils.confirmDialog('Nenhum achado marcado. Salvar como "postura sem alterações"?');
      if (!ok) return;
    }
    const record = {
      id: dbUuid(), studentId: AppState.currentId, date: draft.date || Utils.todayISO(), createdAt: new Date().toISOString(),
      findings, notes: draft.notes.trim(), photoConsent: !!draft.consent,
      photos: draft.consent ? draft.photos : {}, measures: draft.consent ? draft.measures : [],
    };
    AppState.data.posturalEvaluations.push(record);
    posDraft = null;
    render();
    Utils.toast('Avaliação postural salva ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.posturalEvaluations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-pos-compare]').forEach((btn) => btn.addEventListener('click', () => { posCompareId = posCompareId === btn.dataset.posCompare ? null : btn.dataset.posCompare; render(); }));
  container.querySelectorAll('[data-pos-del]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await Utils.confirmDialog('Excluir esta avaliação postural (inclui fotos e medidas)?');
    if (!ok) return;
    AppState.data.posturalEvaluations = AppState.data.posturalEvaluations.filter((e) => e.id !== btn.dataset.posDel);
    if (posCompareId === btn.dataset.posDel) posCompareId = null;
    render();
    await DB.delete(DB.STORES.posturalEvaluations, btn.dataset.posDel);
  }));
  container.querySelectorAll('[data-hist-analyze]').forEach((btn) => btn.addEventListener('click', () => {
    const [id, view] = btn.dataset.histAnalyze.split('|');
    const ev = AppState.data.posturalEvaluations.find((e) => e.id === id);
    if (ev) openPhotoAnalysis(ev, view, () => AppShell.guardedPut(DB.STORES.posturalEvaluations, ev));
  }));

  // Adicionar exercício sugerido a uma Ficha
  container.querySelectorAll('[data-pos-add]').forEach((btn) => {
    if (!btn.dataset.posAdd.includes('|')) return;
    btn.addEventListener('click', async () => {
      const [group, idx] = btn.dataset.posAdd.split('|');
      const latest = posSortedDesc()[0];
      if (!latest) return;
      const phys = [...(AppState.data.physicalEvaluations || [])].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
      const eff = PeriodizationLogic.effectiveGuidance(student);
      const res = PosturalLogic.crossPosture({ evaluation: latest, student, physicalEvaluation: phys, templates: AppState.data.workoutTemplates, guidance: eff ? eff.guidance : null, age: null });
      const item = res.strengthen.find((p) => p.group === group)?.suggestions[parseInt(idx, 10)];
      if (!item) return;
      const letter = container.querySelector('#pos-target-ficha').value;
      const template = ensureTemplate(letter);
      if (template.items.some((it) => PosturalLogic.normalizeName(it.exerciseName) === PosturalLogic.normalizeName(item.name))) {
        Utils.toast('Este exercício já está na Ficha ' + letter + '.', 'error');
        return;
      }
      template.items.push({ id: dbUuid(), type: 'forca', exerciseName: item.name, series: item.series, reps: item.reps, load: item.load, unit: item.unit, unitDetail: '', restSeconds: item.restSeconds });
      render();
      Utils.toast(`${item.name} adicionado à Ficha ${letter} ✓ — ajuste a carga na aba Planejar Aula`, 'success');
      await persistTemplate(template);
    });
  });
}

window.PosturalView = { renderHtml: posRenderHtml, bindEvents: posBindEvents, compressPhoto, openPhotoAnalysis };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['postural.js'] = 'v1.13.1';
