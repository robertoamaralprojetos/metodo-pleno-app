// Testes personalizados — o profissional cria seus próprios testes (abdominal, equilíbrio, força…)
// com nome, unidade, sentido (maior ou menor é melhor), nº de tentativas e, se quiser, uma tabela
// de referência por sexo e idade. Os testes ficam na biblioteca do profissional (Configurações do
// app) e os resultados entram na Avaliação Física do aluno. Cada resultado guarda uma cópia do
// nome e da unidade, então apagar ou editar um teste não altera avaliações já feitas.
// O app NÃO traz tabelas de referência prontas para estes testes: quem cria define as suas.

const CT_CATEGORIES = ['Força / resistência muscular', 'Abdômen e core', 'Equilíbrio', 'Flexibilidade e mobilidade', 'Aeróbico', 'Funcional', 'Outro'];
const CT_UNITS = ['repetições', 'segundos', 'minutos', 'cm', 'metros', 'kg', 'pontos', 'bpm', 'outra'];
const CT_ATTEMPTS = { single: 'Um único resultado', best3: 'Melhor de até 3 tentativas', mean3: 'Média de até 3 tentativas' };
const CT_DEFAULT_LEVELS = ['Fraco', 'Regular', 'Bom', 'Muito bom', 'Excelente'];

// Modelos para começar mais rápido (sem tabela de referência: você define as suas).
const CT_TEMPLATES = [
  { name: 'Abdominal em 1 minuto', category: 'Abdômen e core', unit: 'repetições', direction: 'higher', attempts: 'single', description: 'Número de repetições completas em 1 minuto. Descreva aqui a posição inicial, o padrão de movimento e o que invalida a repetição.' },
  { name: 'Prancha abdominal', category: 'Abdômen e core', unit: 'segundos', direction: 'higher', attempts: 'single', description: 'Tempo que o aluno mantém o alinhamento. Descreva o critério de parada.' },
  { name: 'Apoio em uma perna (olhos abertos)', category: 'Equilíbrio', unit: 'segundos', direction: 'higher', attempts: 'best3', description: 'Tempo de equilíbrio em apoio unipodal, até um limite que você define. Registre o lado testado.' },
  { name: 'Alcance funcional', category: 'Equilíbrio', unit: 'cm', direction: 'higher', attempts: 'best3', description: 'Distância máxima alcançada à frente sem perder o equilíbrio.' },
];

let ctEditing = null; // rascunho do teste em edição (ou null)

function ctList() { return (AppState.settings && Array.isArray(AppState.settings.customTests)) ? AppState.settings.customTests : []; }
async function ctSave(list) { await saveSettingsPatch({ customTests: list }); }
function ctUid() { return 'ct_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); }
const ctEsc = (s) => Utils.escapeHtml(s == null ? '' : String(s));
const ctFmt = (n) => (n == null ? '—' : String(n).replace('.', ','));

// Valor final a partir das tentativas.
function ctValue(test, attempts) {
  const v = (attempts || []).filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  if (test.attempts === 'single') return v[0];
  if (test.attempts === 'mean3') return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
  return test.direction === 'lower' ? Math.min(...v) : Math.max(...v);
}

// Classificação pela tabela do próprio teste. Devolve { label, level, idx } ou null.
function ctClassify(test, value, age, sex) {
  if (value == null || age == null || !test || !Array.isArray(test.ref) || !test.ref.length) return null;
  const sx = sex === 'F' ? 'F' : 'M';
  const row = test.ref.find((r) => (r.sex === 'A' || r.sex === sx) && age >= r.ageMin && age <= r.ageMax);
  if (!row) return null;
  const levels = test.levels && test.levels.length ? test.levels : CT_DEFAULT_LEVELS;
  let idx = 0;
  (row.cuts || []).forEach((c, i) => {
    if (c == null) return;
    if (test.direction === 'lower' ? value <= c : value >= c) idx = i + 1;
  });
  idx = Math.min(idx, levels.length - 1);
  const level = idx === 0 ? 'alto' : (idx === 1 && levels.length > 2 ? 'moderado' : 'leve');
  return { label: levels[idx], level, idx };
}

// Validação do teste antes de salvar. Devolve texto de erro ou ''.
function ctValidate(t) {
  if (!t.name.trim()) return 'Dê um nome ao teste.';
  if (!t.unit.trim()) return 'Informe a unidade.';
  const levels = t.levels;
  if (t.ref.length && levels.length < 2) return 'Informe pelo menos 2 níveis (ex.: Fraco, Bom).';
  for (const [i, r] of t.ref.entries()) {
    if (!(r.ageMin >= 0 && r.ageMax >= r.ageMin)) return `Linha ${i + 1} da tabela: confira as idades.`;
    if ((r.cuts || []).length !== levels.length - 1 || r.cuts.some((c) => c == null || !Number.isFinite(c))) return `Linha ${i + 1} da tabela: preencha todos os valores de corte.`;
    for (let k = 1; k < r.cuts.length; k++) {
      if (t.direction === 'lower' ? r.cuts[k] >= r.cuts[k - 1] : r.cuts[k] <= r.cuts[k - 1]) return `Linha ${i + 1} da tabela: os valores devem ${t.direction === 'lower' ? 'diminuir' : 'aumentar'} a cada nível.`;
    }
  }
  return '';
}

// ---------- Biblioteca (gerenciar) ----------
function ctManageHtml() {
  const list = ctList();
  const rows = list.map((t) => `
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid var(--borda);">
      <div style="min-width:200px;"><strong>${ctEsc(t.name)}</strong>
        <div style="font-size:12px;color:var(--texto-suave);">${ctEsc(t.category)} · ${ctEsc(t.unit)} · ${t.direction === 'lower' ? 'menor é melhor' : 'maior é melhor'} · ${ctEsc(CT_ATTEMPTS[t.attempts] || '')}${t.ref && t.ref.length ? ' · com tabela de referência' : ' · sem tabela de referência'}</div></div>
      <div><button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-ct-edit="${ctEsc(t.id)}">Editar</button>
      <button type="button" class="mp-btn-danger" data-ct-del="${ctEsc(t.id)}">Excluir</button></div>
    </div>`).join('');
  return `
  <div class="mp-card" style="margin-top:20px;" id="ct-manage">
    <h3>Meus testes personalizados</h3>
    <div class="mp-sub" style="margin-top:10px;">Crie os testes que você aplica (abdominal, equilíbrio, força…). Eles aparecem na nova avaliação de qualquer aluno, entram no histórico, nos gráficos e na impressão. Você pode definir uma tabela de referência por sexo e idade, ou usar o teste só para acompanhar a evolução do aluno.</div>
    ${list.length ? `<div style="margin:8px 0;">${rows}</div>` : '<div class="mp-sub" style="margin:10px 0;">Você ainda não criou nenhum teste.</div>'}
    ${ctEditing ? ctEditorHtml() : `
    <div class="mp-form-actions" style="justify-content:flex-start;flex-wrap:wrap;gap:8px;">
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="ct-new">+ Novo teste</button>
      <select id="ct-template" style="max-width:300px;"><option value="">Começar de um modelo…</option>${CT_TEMPLATES.map((t, i) => `<option value="${i}">${ctEsc(t.name)}</option>`).join('')}</select>
    </div>`}
  </div>`;
}

function ctEditorHtml() {
  const t = ctEditing;
  const nCuts = Math.max(t.levels.length - 1, 0);
  const refRows = t.ref.map((r, i) => `
    <tr>
      <td><select data-ct-ref="${i}" data-f="sex"><option value="A" ${r.sex === 'A' ? 'selected' : ''}>Ambos</option><option value="M" ${r.sex === 'M' ? 'selected' : ''}>Masc.</option><option value="F" ${r.sex === 'F' ? 'selected' : ''}>Fem.</option></select></td>
      <td><input type="number" min="0" max="120" style="width:64px;" data-ct-ref="${i}" data-f="ageMin" value="${r.ageMin ?? ''}"></td>
      <td><input type="number" min="0" max="120" style="width:64px;" data-ct-ref="${i}" data-f="ageMax" value="${r.ageMax ?? ''}"></td>
      ${Array.from({ length: nCuts }, (_, k) => `<td><input type="number" step="0.1" style="width:78px;" data-ct-ref="${i}" data-cut="${k}" value="${r.cuts && r.cuts[k] != null ? r.cuts[k] : ''}"></td>`).join('')}
      <td><button type="button" class="mp-btn-danger" data-ct-refdel="${i}">×</button></td>
    </tr>`).join('');
  return `
  <div style="margin-top:12px;padding:14px;border:1px solid var(--borda);border-radius:10px;background:#fff;">
    <h4 style="font-family:'Fraunces',serif;margin:0 0 10px;color:var(--verde-principal);">${t.id ? 'Editar teste' : 'Novo teste'}</h4>
    <div class="mp-form-row mp-row3">
      <div class="mp-field"><label>Nome do teste</label><input id="cte-name" value="${ctEsc(t.name)}" maxlength="80" placeholder="Ex: Abdominal em 1 minuto"></div>
      <div class="mp-field"><label>Categoria</label><select id="cte-category">${CT_CATEGORIES.map((c) => `<option ${c === t.category ? 'selected' : ''}>${ctEsc(c)}</option>`).join('')}</select></div>
      <div class="mp-field"><label>Unidade</label><select id="cte-unit">${CT_UNITS.map((u) => `<option value="${u}" ${(CT_UNITS.includes(t.unit) ? t.unit : 'outra') === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <input id="cte-unit-other" placeholder="Qual unidade?" value="${CT_UNITS.includes(t.unit) ? '' : ctEsc(t.unit)}" style="margin-top:6px;${CT_UNITS.includes(t.unit) ? 'display:none;' : ''}"></div>
    </div>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Qual resultado é melhor?</label><select id="cte-direction"><option value="higher" ${t.direction !== 'lower' ? 'selected' : ''}>Maior é melhor (ex.: repetições, tempo de equilíbrio)</option><option value="lower" ${t.direction === 'lower' ? 'selected' : ''}>Menor é melhor (ex.: tempo para percorrer)</option></select></div>
      <div class="mp-field"><label>Tentativas</label><select id="cte-attempts">${Object.entries(CT_ATTEMPTS).map(([k, l]) => `<option value="${k}" ${t.attempts === k ? 'selected' : ''}>${ctEsc(l)}</option>`).join('')}</select></div>
    </div>
    <div class="mp-field"><label>Protocolo / como aplicar (aparece na hora de registrar)</label><textarea id="cte-desc" rows="3" maxlength="1200" placeholder="Posição inicial, execução, critério de parada, tempo, materiais…">${ctEsc(t.description)}</textarea></div>
    <div class="mp-field"><label>Níveis de classificação, do pior para o melhor (separados por vírgula) — só se for usar tabela de referência</label><input id="cte-levels" value="${ctEsc(t.levels.join(', '))}"></div>
    <div style="font-size:13px;font-weight:700;margin:10px 0 4px;">Tabela de referência (opcional)</div>
    <div class="mp-sub" style="margin:0 0 6px;">Em cada linha, informe o valor ${t.direction === 'lower' ? '<strong>máximo</strong> (igual ou menor)' : '<strong>mínimo</strong> (igual ou maior)'} para o aluno <em>alcançar</em> cada nível. Abaixo do primeiro valor, o aluno fica no nível "${ctEsc(t.levels[0] || '')}".</div>
    ${t.ref.length ? `<div class="mp-table-scroll"><table class="mp-table"><thead><tr><th>Sexo</th><th>Idade de</th><th>até</th>${t.levels.slice(1).map((l) => `<th>${ctEsc(l)}</th>`).join('')}<th></th></tr></thead><tbody>${refRows}</tbody></table></div>` : ''}
    <div class="mp-form-actions" style="justify-content:flex-start;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" id="cte-addref">+ Linha da tabela</button>
    </div>
    <div id="cte-error" style="color:#a24e33;font-size:13px;font-weight:600;margin-top:8px;"></div>
    <div class="mp-form-actions" style="justify-content:flex-start;gap:8px;margin-top:10px;">
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="cte-save">Salvar teste</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="cte-cancel">Cancelar</button>
    </div>
  </div>`;
}

function ctReadEditor(container) {
  const t = ctEditing;
  const q = (s) => container.querySelector(s);
  t.name = q('#cte-name').value;
  t.category = q('#cte-category').value;
  const u = q('#cte-unit').value;
  t.unit = u === 'outra' ? q('#cte-unit-other').value.trim() : u;
  t.direction = q('#cte-direction').value;
  t.attempts = q('#cte-attempts').value;
  t.description = q('#cte-desc').value;
  container.querySelectorAll('[data-ct-ref]').forEach((el) => {
    const r = t.ref[Number(el.dataset.ctRef)]; if (!r) return;
    if (el.dataset.f === 'sex') r.sex = el.value;
    else if (el.dataset.f) r[el.dataset.f] = el.value === '' ? null : Number(el.value);
    else if (el.dataset.cut != null) { r.cuts = r.cuts || []; r.cuts[Number(el.dataset.cut)] = el.value === '' ? null : Number(el.value); }
  });
}

function ctBindManage(container) {
  const root = container.querySelector('#ct-manage');
  if (!root) return;
  const redraw = () => { root.outerHTML = ctManageHtml(); ctBindManage(container); };
  const q = (s) => root.querySelector(s);
  const blank = (tpl) => ({ id: null, name: '', category: CT_CATEGORIES[0], unit: 'repetições', direction: 'higher', attempts: 'single', description: '', levels: CT_DEFAULT_LEVELS.slice(), ref: [], ...(tpl || {}) });

  q('#ct-new')?.addEventListener('click', () => { ctEditing = blank(); redraw(); });
  q('#ct-template')?.addEventListener('change', (e) => { if (e.target.value === '') return; ctEditing = blank(CT_TEMPLATES[Number(e.target.value)]); redraw(); });
  root.querySelectorAll('[data-ct-edit]').forEach((b) => b.addEventListener('click', () => {
    const t = ctList().find((x) => x.id === b.dataset.ctEdit); if (!t) return;
    ctEditing = JSON.parse(JSON.stringify({ ...blank(), ...t })); redraw();
  }));
  root.querySelectorAll('[data-ct-del]').forEach((b) => b.addEventListener('click', async () => {
    const t = ctList().find((x) => x.id === b.dataset.ctDel); if (!t) return;
    if (!(await Utils.confirmDialog(`Excluir o teste "${t.name}"? As avaliações já feitas continuam com o resultado registrado.`))) return;
    await ctSave(ctList().filter((x) => x.id !== t.id));
    render();
  }));
  if (!ctEditing) return;

  q('#cte-unit')?.addEventListener('change', () => { q('#cte-unit-other').style.display = q('#cte-unit').value === 'outra' ? '' : 'none'; });
  q('#cte-direction')?.addEventListener('change', () => { ctReadEditor(root); redraw(); });
  q('#cte-levels')?.addEventListener('change', () => {
    ctReadEditor(root);
    const labels = q('#cte-levels').value.split(',').map((s) => s.trim()).filter(Boolean);
    if (labels.length >= 2) { ctEditing.levels = labels; ctEditing.ref.forEach((r) => { r.cuts = (r.cuts || []).slice(0, labels.length - 1); }); }
    redraw();
  });
  q('#cte-addref')?.addEventListener('click', () => { ctReadEditor(root); ctEditing.ref.push({ sex: 'A', ageMin: 18, ageMax: 99, cuts: [] }); redraw(); });
  root.querySelectorAll('[data-ct-refdel]').forEach((b) => b.addEventListener('click', () => { ctReadEditor(root); ctEditing.ref.splice(Number(b.dataset.ctRefdel), 1); redraw(); }));
  q('#cte-cancel')?.addEventListener('click', () => { ctEditing = null; redraw(); });
  q('#cte-save')?.addEventListener('click', async () => {
    ctReadEditor(root);
    const t = ctEditing;
    t.name = t.name.trim(); t.description = t.description.trim();
    const err = ctValidate(t);
    if (err) { q('#cte-error').textContent = err; return; }
    const list = ctList().slice();
    const saved = { ...t, id: t.id || ctUid() };
    const i = list.findIndex((x) => x.id === saved.id);
    if (i >= 0) list[i] = saved; else list.push(saved);
    ctEditing = null;
    await ctSave(list);
    Utils.toast('Teste salvo ✓', 'success');
    render();
  });
}

// ---------- Registro dentro da avaliação ----------
function ctFormHtml() {
  const list = ctList();
  if (!list.length) return `<h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Testes personalizados</h4><div class="mp-sub" style="margin:0 0 8px;">Você ainda não criou testes próprios. Use o cartão "Meus testes personalizados", mais abaixo nesta aba.</div>`;
  return `
  <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Testes personalizados</h4>
  <div class="mp-sub" style="margin:0 0 8px;">Preencha só os testes que aplicou hoje; os demais ficam em branco.</div>
  ${list.map((t) => {
    const n = t.attempts === 'single' ? 1 : 3;
    return `<div class="mp-field" style="padding:10px;border:1px solid var(--borda);border-radius:10px;margin-bottom:8px;" data-ct-box="${ctEsc(t.id)}">
      <label style="display:block;">${ctEsc(t.name)} <span style="font-weight:400;color:var(--texto-suave);">(${ctEsc(t.unit)} · ${t.direction === 'lower' ? 'menor é melhor' : 'maior é melhor'})</span></label>
      ${t.description ? `<details style="margin:2px 0 6px;"><summary style="cursor:pointer;font-size:12px;">Como aplicar</summary><div style="font-size:12.5px;white-space:pre-wrap;margin-top:4px;">${ctEsc(t.description)}</div></details>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${Array.from({ length: n }, (_, i) => `<input type="number" step="0.1" inputmode="decimal" style="width:110px;" data-ct-in="${ctEsc(t.id)}" placeholder="${n > 1 ? (i + 1) + 'ª tentativa' : 'Resultado'}">`).join('')}</div>
      <div data-ct-prev="${ctEsc(t.id)}" style="margin-top:6px;font-size:13px;"></div>
    </div>`;
  }).join('')}`;
}

// Liga a pré-visualização; devolve a função que lê os resultados preenchidos.
function ctBindForm(container, age, sex) {
  const list = ctList();
  const readOne = (t) => Array.from(container.querySelectorAll(`[data-ct-in="${t.id}"]`)).map((i) => (i.value === '' ? null : Number(i.value))).filter((v) => v != null && Number.isFinite(v));
  const preview = (t) => {
    const el = container.querySelector(`[data-ct-prev="${t.id}"]`); if (!el) return;
    const attempts = readOne(t); const val = ctValue(t, attempts);
    if (val == null) { el.innerHTML = ''; return; }
    const c = ctClassify(t, val, age, sex);
    el.innerHTML = `<strong>${ctFmt(val)} ${ctEsc(t.unit)}</strong>${t.attempts !== 'single' ? ` <span style="color:var(--texto-suave);">(${t.attempts === 'mean3' ? 'média' : 'melhor'} de ${attempts.length})</span>` : ''} ${c ? `<span class="mp-pill mp-pill-${c.level}">${ctEsc(c.label)}</span>` : ''}`;
  };
  list.forEach((t) => container.querySelectorAll(`[data-ct-in="${t.id}"]`).forEach((i) => i.addEventListener('input', () => preview(t))));
  return () => list.map((t) => {
    const attempts = readOne(t); const value = ctValue(t, attempts);
    if (value == null) return null;
    const c = ctClassify(t, value, age, sex);
    return { testId: t.id, name: t.name, unit: t.unit, direction: t.direction, attemptsMode: t.attempts, attempts, value, level: c ? c.label : null, levelKind: c ? c.level : null };
  }).filter(Boolean);
}

// Métricas para os gráficos de evolução (uma por teste usado em alguma avaliação).
function ctMetrics(records) {
  const seen = new Map();
  records.forEach((r) => (r.customTests || []).forEach((x) => { if (!seen.has(x.testId)) seen.set(x.testId, x); }));
  return Array.from(seen.values()).map((x) => ({
    key: 'ct_' + x.testId, label: `${x.name} (${x.unit})`,
    getValue: (r) => { const f = (r.customTests || []).find((y) => y.testId === x.testId); return f ? f.value : null; },
  }));
}

function ctSummaryText(rec) {
  return (rec.customTests || []).map((x) => `${x.name}: ${ctFmt(x.value)} ${x.unit}${x.level ? ' · ' + x.level : ''}`).join(' | ');
}

window.CustomTests = {
  list: ctList, value: ctValue, classify: ctClassify, validate: ctValidate,
  manageHtml: ctManageHtml, bindManage: ctBindManage, formHtml: ctFormHtml, bindForm: ctBindForm,
  metrics: ctMetrics, summaryText: ctSummaryText, TEMPLATES: CT_TEMPLATES,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['custom-tests.js'] = 'v1.22.0';
