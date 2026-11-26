// Aba: Avaliação Física — antropometria, IMC (Lipschitz/OMS) e bioimpedância.
// Múltiplos registros por aluno ao longo do tempo (mesmo padrão de Avaliação Funcional).

const BIOIMPEDANCE_FIELDS = [
  { key: 'bodyFatPercent', label: 'Percentual de gordura corporal', unit: '%' },
  { key: 'leanMassPercent', label: 'Percentual de massa magra', unit: '%' },
  { key: 'basalMetabolism', label: 'Metabolismo basal', unit: 'kcal' },
  { key: 'bodyAge', label: 'Idade corporal', unit: 'anos' },
  { key: 'visceralFat', label: 'Gordura visceral', unit: '' },
];

// Uma entrada por métrica com gráfico de evolução individual (peso + bioimpedância + circunferências).
const PE_METRICS = [
  { key: 'weight', label: 'Peso (kg)', getValue: (r) => r.weight },
  { key: 'bodyFatPercent', label: 'Gordura corporal (%)', getValue: (r) => r.bodyFatPercent },
  { key: 'leanMassPercent', label: 'Massa magra (%)', getValue: (r) => r.leanMassPercent },
  { key: 'basalMetabolism', label: 'Metabolismo basal (kcal)', getValue: (r) => r.basalMetabolism },
  { key: 'bodyAge', label: 'Idade corporal (anos)', getValue: (r) => r.bodyAge },
  { key: 'visceralFat', label: 'Gordura visceral', getValue: (r) => r.visceralFat },
  { key: 'skinfoldSum', label: 'Soma das dobras cutâneas (mm)', getValue: (r) => r.skinfold?.sum },
  { key: 'fatMassKg', label: 'Massa gorda (kg)', getValue: (r) => r.skinfold?.fatMassKg },
  { key: 'leanMassKg', label: 'Massa magra (kg)', getValue: (r) => r.skinfold?.leanMassKg },
  { key: 'sitReach', label: 'Sentar e alcançar (cm)', getValue: (r) => r.sitReach?.best },
  ...CIRCUMFERENCE_FIELDS.map((f) => ({ key: 'circ_' + f.key, label: f.label + ' (cm)', getValue: (r) => r.circumferences?.[f.key] })),
];

// Tipos de trabalho que o aluno precisa priorizar (preenchido pelo personal na avaliação).
// As chaves alimentam as sugestões do app nas próximas etapas; o texto livre complementa.
const WORK_NEEDS = [
  { key: 'forca', label: 'Força muscular' },
  { key: 'hipertrofia', label: 'Massa muscular (hipertrofia)' },
  { key: 'potencia', label: 'Potência muscular' },
  { key: 'equilibrio', label: 'Equilíbrio e prevenção de quedas' },
  { key: 'mobilidade', label: 'Mobilidade / flexibilidade' },
  { key: 'postura', label: 'Postura' },
  { key: 'core', label: 'Estabilidade do core' },
  { key: 'aerobico', label: 'Condicionamento aeróbico' },
  { key: 'composicao', label: 'Composição corporal' },
  { key: 'coordenacao', label: 'Coordenação / funcional' },
  { key: 'saudeOssea', label: 'Saúde óssea (estímulo de carga)' },
];
window.WORK_NEEDS = WORK_NEEDS;

function workNeedLabels(keys) {
  return (keys || []).map((k) => WORK_NEEDS.find((n) => n.key === k)?.label).filter(Boolean);
}

function computeImcResult(weight, height, age) {
  if (!weight || !height) return null;
  const heightM = height / 100;
  const imc = weight / (heightM * heightM);
  const classification = classifyImc(imc, age);
  return { imc: Math.round(imc * 10) / 10, ...classification };
}

// Flexibilidade — Sentar e alcançar (banco de Wells). Guarda as tentativas, o melhor
// resultado (maior leitura, em cm) e o ponto de referência dos pés no banco.
const SIT_REACH_FOOT_MARKS = [15, 23, 26, 38];

// Classificação por idade e sexo — Teste de flexão do tronco à frente (sentar e alcançar).
// Fonte: CSEP, Canadian Physical Activity, Fitness & Lifestyle Approach (3ª ed., 2003),
// reproduzida nas diretrizes do ACSM (categorias de aptidão, em cm). Valores válidos para
// 20 a 69 anos, em banco com o ponto zero (marca dos pés) em 26 cm. Em banco com a marca em
// 23 cm, subtrai-se 3 cm de cada valor. Cada linha traz o MÍNIMO (cm) de cada categoria;
// abaixo do mínimo de "Regular" = "Precisa melhorar".
const SIT_REACH_NORMS = {
  M: [
    { min: 20, max: 29, excelente: 40, muitoBom: 34, bom: 30, regular: 25 },
    { min: 30, max: 39, excelente: 38, muitoBom: 33, bom: 28, regular: 23 },
    { min: 40, max: 49, excelente: 35, muitoBom: 29, bom: 24, regular: 18 },
    { min: 50, max: 59, excelente: 35, muitoBom: 28, bom: 24, regular: 16 },
    { min: 60, max: 69, excelente: 33, muitoBom: 25, bom: 20, regular: 15 },
  ],
  F: [
    { min: 20, max: 29, excelente: 41, muitoBom: 37, bom: 33, regular: 28 },
    { min: 30, max: 39, excelente: 41, muitoBom: 36, bom: 32, regular: 27 },
    { min: 40, max: 49, excelente: 38, muitoBom: 34, bom: 30, regular: 25 },
    { min: 50, max: 59, excelente: 39, muitoBom: 33, bom: 30, regular: 25 },
    { min: 60, max: 69, excelente: 35, muitoBom: 31, bom: 27, regular: 23 },
  ],
};
// Ajuste da tabela conforme a marca dos pés no banco (cm). Outras marcas: sem classificação.
const SIT_REACH_MARK_OFFSET = { 26: 0, 23: -3 };

// Retorna { label, level } ou null (sem tabela para a idade, o sexo ou a marca do banco).
function sitReachClassification(best, age, sex, footMark) {
  if (best == null || age == null) return null;
  const offset = SIT_REACH_MARK_OFFSET[footMark];
  if (offset === undefined) return null;
  const table = SIT_REACH_NORMS[sex === 'F' ? 'F' : 'M'];
  const row = table.find((r) => age >= r.min && age <= r.max);
  if (!row) return null;
  if (best >= row.excelente + offset) return { label: 'Excelente', level: 'leve' };
  if (best >= row.muitoBom + offset) return { label: 'Muito bom', level: 'leve' };
  if (best >= row.bom + offset) return { label: 'Bom', level: 'leve' };
  if (best >= row.regular + offset) return { label: 'Regular', level: 'moderado' };
  return { label: 'Precisa melhorar', level: 'alto' };
}

function sitReachSummary(record) {
  const sr = record && record.sitReach;
  return sr && typeof sr.best === 'number' ? sr : null;
}

// Métricas fixas + uma por teste personalizado que já tenha resultado.
function peAllMetrics(list) { return [...PE_METRICS, ...CustomTests.metrics(list)]; }

function metricPoints(list, metric) {
  return list
    .filter((r) => metric.getValue(r) != null)
    .map((r) => ({ label: Utils.formatDateBR(r.date).slice(0, 5), value: metric.getValue(r) }));
}

function peRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const today = Utils.todayISO();
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;
  const list = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
  const listDesc = [...list].sort((a, b) => b.date.localeCompare(a.date));

  const rows = listDesc.map((rec) => {
    const imcResult = computeImcResult(rec.weight, rec.height, rec.age);
    return `
      <tr>
        <td>${Utils.formatDateBR(rec.date)}</td>
        <td>${rec.weight ?? '—'} kg</td>
        <td>${imcResult ? imcResult.imc : '—'}</td>
        <td>${imcResult ? Utils.escapeHtml(imcResult.label) : '—'}</td>
        <td>${rec.bodyFatPercent ?? '—'}${rec.bodyFatPercent != null ? '%' : ''}${rec.bodyFatPercent != null ? `<div style="font-size:11px;color:var(--texto-suave);">${rec.skinfold ? 'Dobras · ' + Utils.escapeHtml(Skinfold.protocol(rec.skinfold.protocolId)?.short || '') + ' · soma ' + rec.skinfold.sum + ' mm' : 'Bioimpedância'}</div>${(() => { const c = Skinfold.classifyBodyFat(rec.bodyFatPercent, rec.age, rec.sex); return c ? `<span class="mp-pill mp-pill-${c.level}" style="margin-top:3px;">${Utils.escapeHtml(c.label)}</span>` : ''; })()}` : ''}</td>
        <td>${sitReachSummary(rec) ? sitReachSummary(rec).best + ' cm' + (() => { const c = sitReachClassification(sitReachSummary(rec).best, rec.age, rec.sex, sitReachSummary(rec).footMark); return c ? ' · ' + Utils.escapeHtml(c.label) : ''; })() : '—'}</td>
        <td style="max-width:240px;font-size:12.5px;">${(rec.customTests || []).length ? (rec.customTests || []).map((x) => `<div>${Utils.escapeHtml(x.name)}: <strong>${String(x.value).replace('.', ',')} ${Utils.escapeHtml(x.unit)}</strong>${x.level ? ` <span class="mp-pill mp-pill-${x.levelKind || 'leve'}">${Utils.escapeHtml(x.level)}</span>` : ''}</div>`).join('') : '—'}</td>
        <td style="max-width:230px;font-size:12.5px;">${workNeedLabels(rec.workNeeds).length ? Utils.escapeHtml(workNeedLabels(rec.workNeeds).join(', ')) : '—'}${rec.workNeedsNotes ? `<div style="color:var(--texto-suave);margin-top:2px;">${Utils.escapeHtml(rec.workNeedsNotes)}</div>` : ''}</td>
        <td>
          <button class="mp-btn mp-btn-ghost mp-btn-sm" data-print-eval="${rec.id}" type="button">🖨 Comparar c/ anterior</button>
          <button class="mp-btn-danger" data-del-eval="${rec.id}" type="button">Excluir</button>
        </td>
      </tr>`;
  }).join('');

  const availableMetrics = peAllMetrics(list).filter((m) => metricPoints(list, m).length >= 1);
  const reassessment = listDesc.length ? Utils.reassessmentStatus(listDesc[0].date) : null;

  return `
  <div class="mp-card">
    <h3>Nova avaliação física</h3>
    <div class="mp-sub" style="margin-top:10px;">Antropometria e composição corporal — repita a cada ciclo (ex: 3 em 3 meses) para acompanhar a evolução.</div>
    ${reassessment ? `<div style="margin:0 0 14px;"><span class="mp-pill mp-pill-${reassessment.level}">${Utils.escapeHtml(reassessment.text)}</span></div>` : ''}
    <form id="mp-pe-form">
      <div class="mp-form-row mp-row-pe-header">
        <div class="mp-field"><label>Data da avaliação</label><input type="date" id="pe-date" value="${today}"></div>
        <div class="mp-field"><label>Nome do aluno</label><input value="${Utils.escapeHtml(student.name)}" disabled></div>
        <div class="mp-field"><label>Idade</label><input value="${age != null ? age + ' anos' : '—'}" disabled></div>
        <div class="mp-field"><label>Sexo</label><input value="${student.sex === 'F' ? 'Feminino' : 'Masculino'}" disabled></div>
      </div>
      <div class="mp-form-row mp-row2">
        <div class="mp-field"><label>Peso (kg)</label><input type="number" min="0" step="0.1" id="pe-weight"></div>
        <div class="mp-field"><label>Altura (cm)</label><input type="number" min="0" step="0.5" id="pe-height"></div>
      </div>
      <div id="pe-imc-preview"></div>

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Composição corporal (% de gordura)</h4>
      <div class="mp-field" style="max-width:360px;">
        <label>Como você mede o percentual de gordura?</label>
        <select id="pe-method">
          <option value="bio">Bioimpedância (ou valor digitado)</option>
          <option value="skinfold">Dobras cutâneas (adipômetro)</option>
        </select>
      </div>
      <div id="pe-panel-bio">
        <div class="mp-form-row mp-row5">
          ${BIOIMPEDANCE_FIELDS.map((f) => `
            <div class="mp-field"><label>${Utils.escapeHtml(f.label)}</label><input type="number" step="0.1" id="pe-${f.key}"><small style="color:var(--texto-suave);">${f.unit}</small></div>
          `).join('')}
        </div>
        <div id="pe-bf-class"></div>
      </div>
      <div id="pe-panel-sf" style="display:none;">
        <div class="mp-sub" style="margin:8px 0;">O app sugere o protocolo conforme o sexo e a idade do aluno; você pode trocar. O resultado é uma <strong>estimativa</strong> (erro típico de 3 a 4 pontos percentuais): para acompanhar a evolução, use sempre o mesmo protocolo, o mesmo adipômetro e o mesmo avaliador.</div>
        <div class="mp-form-row mp-row3">
          <div class="mp-field"><label>Protocolo</label><select id="sf-protocol"></select></div>
          <div class="mp-field" id="sf-conv-wrap"><label>Conversão densidade → % gordura</label>
            <select id="sf-conv">${Object.entries(Skinfold.CONVERSIONS).map(([k, c]) => `<option value="${k}">${Utils.escapeHtml(c.label)}</option>`).join('')}</select></div>
          <div class="mp-field" id="sf-mat-wrap" style="display:none;"><label>Maturação (meninos, soma até 35 mm)</label>
            <select id="sf-mat"><option value="pre">Pré-púbere</option><option value="pub" selected>Púbere</option><option value="pos">Pós-púbere</option></select></div>
        </div>
        <div id="sf-ref" class="mp-sub" style="margin:0 0 8px;font-size:12px;"></div>
        <div id="sf-sites"></div>
        <div id="sf-preview"></div>
        <details style="margin-top:10px;">
          <summary style="cursor:pointer;font-weight:700;font-size:13px;">Como medir (técnica e localização dos pontos)</summary>
          <ul style="margin:8px 0 0 18px;font-size:12.5px;line-height:1.5;">${Skinfold.TECHNIQUE.map((t) => `<li>${Utils.escapeHtml(t)}</li>`).join('')}</ul>
          <div id="sf-how" style="margin-top:8px;font-size:12.5px;"></div>
        </details>
      </div>

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Circunferências (cm)</h4>
      <div class="mp-form-row mp-row4">
        ${CIRCUMFERENCE_FIELDS.map((f) => `
          <div class="mp-field"><label>${Utils.escapeHtml(f.label)}</label><input type="number" min="0" step="0.1" id="pe-circ-${f.key}"></div>
        `).join('')}
      </div>

      ${CustomTests.formHtml()}

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Trabalho necessário</h4>
      <div class="mp-sub" style="margin:0 0 8px;">Marque o que este aluno precisa priorizar no treino — isso alimenta as sugestões do app — e detalhe abaixo, se quiser.</div>
      <div class="mp-yesno" id="pe-work-needs">
        ${WORK_NEEDS.map((n) => `<button type="button" class="mp-yesno-btn" style="min-width:0;flex:0 1 auto;" data-work="${n.key}">${Utils.escapeHtml(n.label)}</button>`).join('')}
      </div>
      <div class="mp-field" style="margin-top:10px;">
        <label>Observações sobre o trabalho necessário</label>
        <textarea id="pe-work-notes" placeholder="Ex: reforçar glúteo médio e extensores da coluna; evitar impacto no joelho direito."></textarea>
      </div>

      <h4 style="font-family:'Fraunces',serif;font-size:14px;margin:16px 0 8px;color:var(--verde-principal);">Flexibilidade — Sentar e alcançar (banco de Wells)</h4>
      <div class="mp-sub" style="margin:0 0 8px;">Faça um aquecimento e registre até 3 tentativas (leitura em cm). O melhor resultado é a maior leitura. Informe a marca onde ficam os pés no seu banco, para comparar avaliações sempre com o mesmo padrão.</div>
      <div class="mp-form-row mp-row4">
        <div class="mp-field"><label>Tentativa 1 (cm)</label><input type="number" step="0.5" id="pe-sr-1"></div>
        <div class="mp-field"><label>Tentativa 2 (cm)</label><input type="number" step="0.5" id="pe-sr-2"></div>
        <div class="mp-field"><label>Tentativa 3 (cm)</label><input type="number" step="0.5" id="pe-sr-3"></div>
        <div class="mp-field"><label>Marca dos pés no banco</label>
          <select id="pe-sr-mark">
            <option value="">Não informado</option>
            ${SIT_REACH_FOOT_MARKS.map((m) => `<option value="${m}"${m === 23 ? ' selected' : ''}>${m} cm</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="pe-sr-preview"></div>

      <div class="mp-form-actions" style="margin-top:14px;">
        <button type="button" id="pe-save" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;">Salvar avaliação</button>
      </div>
    </form>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
      <h3 style="margin-bottom:0;">Evolução por métrica</h3>
      <button type="button" id="pe-report-btn" class="mp-btn mp-btn-outline" style="color:var(--verde-principal);border-color:var(--verde-suave);">📄 Baixar relatório</button>
    </div>
    <div class="mp-sub" style="margin-top:10px;">${availableMetrics.length ? 'Um gráfico por métrica, com pelo menos 1 avaliação registrada.' : 'Registre pelo menos 1 avaliação para ver os gráficos de evolução.'}</div>
    ${Skinfold.mixedMethods(list) ? '<div class="mp-sub" style="margin:6px 0 0;color:#8a5a00;">⚠ O % de gordura deste aluno foi medido por métodos ou protocolos diferentes. Valores de métodos diferentes não são diretamente comparáveis: confira o método na coluna "% Gordura" do histórico.</div>' : ''}
    ${availableMetrics.length ? `
    <div class="mp-metric-grid">
      ${availableMetrics.map((m) => `
        <div>
          <div class="mp-sub" style="margin:0 0 6px;font-weight:700;">${Utils.escapeHtml(m.label)}</div>
          <div class="mp-chart-box" id="pe-chart-${m.key}"></div>
        </div>
      `).join('')}
    </div>` : ''}
  </div>

  ${listDesc.length ? `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de avaliações</h3>
    <div class="mp-table-scroll">
    <table class="mp-table">
      <thead><tr><th>Data</th><th>Peso</th><th>IMC</th><th>Classificação</th><th>% Gordura</th><th>Sentar e alcançar</th><th>Testes personalizados</th><th>Trabalho necessário</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </div>` : ''}

  ${CustomTests.manageHtml()}

  <div id="mp-print-area" class="mp-print-only"></div>
  `;
}

// Faixa de classificação do % de gordura (pílula + faixa saudável + nota de referência).
function peBodyFatClassHtml(percent, age, sex) {
  const c = Skinfold.classifyBodyFat(percent, age, sex);
  if (!c) {
    return percent != null ? '<div style="font-size:11.5px;color:var(--texto-suave);margin-top:4px;">Sem classificação: a tabela de referência vale para adultos de 20 a 79 anos.</div>' : '';
  }
  return `<div style="margin-top:6px;"><span class="mp-pill mp-pill-${c.level}">${Utils.escapeHtml(c.label)}</span>
    <span style="font-size:12px;color:var(--texto-suave);margin-left:6px;">faixa saudável para a idade e o sexo: ${c.healthyRange}</span></div>
    <div style="font-size:11px;color:var(--texto-suave);margin-top:3px;">Referência: ${Utils.escapeHtml(c.ref)} Os "graus" I, II e III de obesidade são do IMC (mostrado acima), não do % de gordura.</div>`;
}

// Linhas dos testes personalizados (união dos testes do atual e do anterior).
function peCustomPrintRows(current, previous) {
  const ids = [];
  [current, previous].forEach((r) => (r?.customTests || []).forEach((x) => { if (!ids.includes(x.testId)) ids.push(x.testId); }));
  const find = (r, id) => (r?.customTests || []).find((x) => x.testId === id);
  const rows = [];
  ids.forEach((id) => {
    const c = find(current, id); const p = find(previous, id); const ref = c || p;
    rows.push([`${ref.name} (${ref.unit})`, c ? c.value : undefined, p ? p.value : undefined]);
    if ((c && c.level) || (p && p.level)) rows.push([`${ref.name} — classificação`, c ? c.level : undefined, p ? p.level : undefined]);
  });
  return rows;
}

function peMethodText(rec) {
  if (!rec || rec.bodyFatPercent == null) return undefined;
  return rec.skinfold ? 'Dobras — ' + (Skinfold.protocol(rec.skinfold.protocolId)?.short || '') : 'Bioimpedância';
}

// Linhas [rótulo, atual, anterior] da avaliação física (usadas na impressão e no Relatório de Avaliação).
function peRowsData(current, previous) {
  const curImc = computeImcResult(current.weight, current.height, current.age);
  const prevImc = previous ? computeImcResult(previous.weight, previous.height, previous.age) : null;

  const rowsData = [
    ['Peso (kg)', current.weight, previous?.weight],
    ['Altura (cm)', current.height, previous?.height],
    ['IMC', curImc?.imc, prevImc?.imc],
    ['Classificação IMC', curImc?.label, prevImc?.label],
    ...BIOIMPEDANCE_FIELDS.map((f) => [f.label, current[f.key], previous?.[f.key]]),
    ['Método do % de gordura', peMethodText(current), previous ? peMethodText(previous) : undefined],
    ['Classificação do % de gordura', Skinfold.classifyBodyFat(current.bodyFatPercent, current.age, current.sex)?.label, previous ? Skinfold.classifyBodyFat(previous.bodyFatPercent, previous.age, previous.sex)?.label : undefined],
    ['Soma das dobras cutâneas (mm)', current.skinfold?.sum, previous?.skinfold?.sum],
    ['Massa gorda (kg)', current.skinfold?.fatMassKg, previous?.skinfold?.fatMassKg],
    ['Massa magra (kg)', current.skinfold?.leanMassKg, previous?.skinfold?.leanMassKg],
    ...CIRCUMFERENCE_FIELDS.map((f) => [f.label, current.circumferences?.[f.key], previous?.circumferences?.[f.key]]),
    ['Sentar e alcançar — melhor resultado (cm)', sitReachSummary(current)?.best, sitReachSummary(previous)?.best],
    ...peCustomPrintRows(current, previous),
  ];
  const curSr = sitReachSummary(current);
  const curSrClass = curSr ? sitReachClassification(curSr.best, current.age, current.sex, curSr.footMark) : null;
  if (curSrClass) {
    const prevSr = sitReachSummary(previous);
    const prevSrClass = prevSr ? sitReachClassification(prevSr.best, previous.age, previous.sex, prevSr.footMark) : null;
    rowsData.push(['Sentar e alcançar — classificação', curSrClass.label, prevSrClass?.label]);
  }
  return rowsData;
}

function pePrintHtml(student, current, previous) {
  const rowsData = peRowsData(current, previous);
  const curSr = sitReachSummary(current);
  const srNoteMark = curSr?.footMark ?? sitReachSummary(previous)?.footMark;
  const srNote = (curSr || sitReachSummary(previous))
    ? `<div style="margin-top:8px;font-size:12px;color:#555;">Sentar e alcançar (banco de Wells): melhor de até 3 tentativas${srNoteMark != null ? `; marca dos pés no banco: ${srNoteMark} cm` : ''}. Compare avaliações feitas com o mesmo banco e a mesma marca.</div>`
    : '';

  const rowsHtml = rowsData.map(([label, cur, prev]) => {
    let delta = '';
    if (typeof cur === 'number' && typeof prev === 'number') {
      const diff = Math.round((cur - prev) * 100) / 100;
      delta = diff > 0 ? `+${diff}` : `${diff}`;
    }
    return `<tr><td>${Utils.escapeHtml(label)}</td><td>${prev ?? '—'}</td><td>${cur ?? '—'}</td><td>${delta}</td></tr>`;
  }).join('');

  return `
    ${Profile.docHeaderHtml('Avaliação Física', `Aluno: ${Utils.escapeHtml(student.name)} &nbsp;·&nbsp; Data: ${Utils.formatDateBR(current.date)}${previous ? ` &nbsp;·&nbsp; Anterior: ${Utils.formatDateBR(previous.date)}` : ''}`)}
    <table class="mp-print-table">
      <thead><tr><th>Medida</th><th>${previous ? 'Anterior' : ''}</th><th>Atual</th><th>${previous ? 'Diferença' : ''}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${Skinfold.classifyBodyFat(current.bodyFatPercent, current.age, current.sex) ? `<div style="margin-top:8px;font-size:12px;color:#555;">Classificação do % de gordura: ${Utils.escapeHtml(Skinfold.BF_REF)} Os graus I, II e III de obesidade pertencem ao IMC.</div>` : ''}
    ${current.skinfold ? `<div style="margin-top:8px;font-size:12px;color:#555;">Percentual de gordura estimado por dobras cutâneas (${Utils.escapeHtml(current.skinfold.protocolLabel)}). É uma estimativa, com erro típico de 3 a 4 pontos percentuais; para comparar avaliações, use sempre o mesmo protocolo, adipômetro e avaliador.${previous && ((previous.skinfold ? previous.skinfold.protocolId : 'bio') !== current.skinfold.protocolId) ? ' <strong>Atenção: a avaliação anterior usou outro método, então a diferença de % de gordura não é diretamente comparável.</strong>' : ''}</div>` : ''}
    ${srNote}
    ${workNeedLabels(current.workNeeds).length || current.workNeedsNotes ? `
    <div style="margin-top:14px;"><strong>Trabalho necessário:</strong> ${Utils.escapeHtml(workNeedLabels(current.workNeeds).join(', ') || '—')}${current.workNeedsNotes ? `<br><span style="color:#555;">${Utils.escapeHtml(current.workNeedsNotes)}</span>` : ''}</div>` : ''}
  `;
}

// Monta o relatório visual completo (todas as métricas com gráfico de evolução) dentro
// de #mp-print-area e aciona a impressão/"Salvar como PDF" do navegador.
function peBuildAndPrintReport(printArea, student, list) {
  const availableMetrics = peAllMetrics(list).filter((m) => metricPoints(list, m).length >= 1);
  if (!availableMetrics.length) {
    Utils.toast('Registre pelo menos 1 avaliação para gerar o relatório.', 'error');
    return;
  }

  printArea.innerHTML = '';
  printArea.appendChild(Utils.el(`
    <div class="mp-report-header">
      ${Profile.docHeaderHtml('Relatório de Evolução Física', `Aluno: ${Utils.escapeHtml(student.name)} &nbsp;·&nbsp; Gerado em ${Utils.formatDateBR(Utils.todayISO())} &nbsp;·&nbsp; ${list.length} avaliação(ões) registrada(s)`)}
    </div>
  `));

  availableMetrics.forEach((m) => {
    const section = Utils.el(`<div class="mp-report-section"><h3 style="font-family:Georgia,serif;font-size:15px;margin-bottom:6px;">${Utils.escapeHtml(m.label)}</h3></div>`);
    const points = metricPoints(list, m);
    const chart = Charts.lineChart(points, { color: Charts.COLORS.verdePrincipal, pointColor: Charts.COLORS.dourado, width: 680, height: 190 });
    if (chart) section.appendChild(chart);
    if (m.key === 'sitReach') {
      const lastWithMark = [...list].reverse().find((r) => sitReachSummary(r) && sitReachSummary(r).footMark != null);
      const lastSr = [...list].reverse().find((r) => sitReachSummary(r));
      const cls = lastSr ? sitReachClassification(sitReachSummary(lastSr).best, lastSr.age, lastSr.sex, sitReachSummary(lastSr).footMark) : null;
      const noteParts = ['Banco de Wells: melhor de até 3 tentativas por avaliação.'];
      if (lastWithMark) noteParts.push(`Marca dos pés no banco: ${sitReachSummary(lastWithMark).footMark} cm.`);
      if (cls) noteParts.push(`Última classificação: ${cls.label}.`);
      section.appendChild(Utils.el(`<div style="margin-top:4px;font-size:12px;color:#555;">${Utils.escapeHtml(noteParts.join(' '))}</div>`));
    }
    printArea.appendChild(section);
  });

  window.print();
}

function peBindEvents(container) {
  const student = currentStudent();
  if (!student) return;
  const today = Utils.todayISO();
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, today) : null;

  function recomputePreview() {
    const weight = Number(container.querySelector('#pe-weight').value) || 0;
    const height = Number(container.querySelector('#pe-height').value) || 0;
    const result = computeImcResult(weight, height, age ?? 0);
    const el = container.querySelector('#pe-imc-preview');
    el.innerHTML = result ? `
      <div class="index-gauge" style="display:flex;align-items:center;gap:14px;margin:6px 0 4px;">
        <div style="font-family:'Fraunces',serif;font-weight:600;font-size:26px;color:var(--verde-principal);">${result.imc}</div>
        <div>
          <div style="font-size:12px;color:var(--texto-suave);">IMC (${result.reference})</div>
          <span class="mp-pill mp-pill-${result.label.includes('Normal') || result.label.includes('Eutrófico') ? 'leve' : (result.label.includes('Baixo') ? 'moderado' : 'alto')}">${Utils.escapeHtml(result.label)}</span>
        </div>
      </div>` : '';
  }
  container.querySelector('#pe-weight')?.addEventListener('input', recomputePreview);
  container.querySelector('#pe-height')?.addEventListener('input', recomputePreview);
  recomputePreview();

  // ---------- Dobras cutâneas ----------
  const sfSex = student.sex === 'F' ? 'F' : 'M';
  const sfCache = {};
  const methodSel = container.querySelector('#pe-method');
  const sfProtocolSel = container.querySelector('#sf-protocol');
  let sfState = { protocolId: Skinfold.suggest(age, sfSex) };

  function sfReadInputs() {
    container.querySelectorAll('#sf-sites input[data-site]').forEach((inp) => {
      const k = inp.dataset.site; const i = Number(inp.dataset.n);
      sfCache[k] = sfCache[k] || [];
      sfCache[k][i] = inp.value === '' ? null : Number(inp.value);
    });
  }
  function sfValues() {
    sfReadInputs();
    const out = {};
    Object.keys(sfCache).forEach((k) => { out[k] = (sfCache[k] || []).filter((x) => x != null && Number.isFinite(x)); });
    return out;
  }
  function sfCurrent() {
    const weight = Number(container.querySelector('#pe-weight')?.value) || 0;
    return Skinfold.compute({
      protocolId: sfProtocolSel.value, sex: sfSex, age,
      values: sfValues(), conversion: container.querySelector('#sf-conv').value,
      maturation: container.querySelector('#sf-mat').value, weight,
    });
  }
  function sfRenderPreview() {
    const el = container.querySelector('#sf-preview');
    if (!el) return;
    const r = sfCurrent();
    const warn = (r.warnings || []).map((w) => `<div style="font-size:12px;color:#8a5a00;margin-top:3px;">⚠ ${Utils.escapeHtml(w)}</div>`).join('');
    if (!r.ok) {
      const anyValue = Object.values(sfCache).some((a) => (a || []).some((x) => x != null));
      el.innerHTML = anyValue || (r.errors || []).some((e) => e.includes('data de nascimento') || e.includes('17 anos') || e.includes('indisponível'))
        ? `<div style="font-size:12.5px;color:var(--texto-suave);margin:8px 0;">${Utils.escapeHtml((r.errors || []).join(' '))}</div>${warn}` : '';
      return;
    }
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:18px;margin:8px 0 4px;flex-wrap:wrap;">
        <div style="font-family:'Fraunces',serif;font-weight:600;font-size:26px;color:var(--verde-principal);">${String(r.percent).replace('.', ',')}%<div style="font-size:11px;font-family:inherit;font-weight:400;color:var(--texto-suave);">gordura estimada</div></div>
        <div style="font-size:13px;">Soma das dobras: <strong>${String(r.sum).replace('.', ',')} mm</strong>${r.density ? `<br>Densidade: ${String(r.density).replace('.', ',')} g/cm³` : ''}${r.fatMassKg != null ? `<br>Massa gorda: <strong>${String(r.fatMassKg).replace('.', ',')} kg</strong> · massa magra: <strong>${String(r.leanMassKg).replace('.', ',')} kg</strong>` : ''}</div>
      </div>${peBodyFatClassHtml(r.percent, age, sfSex)}${warn}`;
  }
  function sfRenderSites() {
    sfReadInputs();
    const p = Skinfold.protocol(sfProtocolSel.value);
    if (!p) return;
    const cfg = p.by[sfSex];
    container.querySelector('#sf-ref').textContent = p.ref;
    container.querySelector('#sf-conv-wrap').style.display = p.kind === 'density' ? '' : 'none';
    container.querySelector('#sf-mat-wrap').style.display = (p.needsMaturation && sfSex === 'M') ? '' : 'none';
    container.querySelector('#sf-sites').innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;">${cfg.sites.map((s) => `
      <div class="mp-field"><label>${Utils.escapeHtml(Skinfold.SITES[s].label)} (mm)</label>
        <div style="display:flex;gap:6px;">${[0, 1, 2].map((n) => `<input type="number" min="0" step="0.5" inputmode="decimal" data-site="${s}" data-n="${n}" placeholder="${n === 2 ? '3ª (se divergir)' : (n + 1) + 'ª'}" value="${(sfCache[s] && sfCache[s][n] != null) ? sfCache[s][n] : ''}" style="min-width:0;">`).join('')}</div>
      </div>`).join('')}</div>`;
    container.querySelector('#sf-how').innerHTML = cfg.sites.map((s) => `<div style="margin-bottom:4px;"><strong>${Utils.escapeHtml(Skinfold.SITES[s].label)}:</strong> ${Utils.escapeHtml(Skinfold.SITES[s].how)}</div>`).join('');
    container.querySelectorAll('#sf-sites input').forEach((inp) => inp.addEventListener('input', sfRenderPreview));
    sfRenderPreview();
  }
  if (methodSel && sfProtocolSel) {
    const suggested = Skinfold.suggest(age, sfSex);
    sfProtocolSel.innerHTML = Skinfold.protocolsFor(sfSex).map((p) => `<option value="${p.id}" ${p.id === suggested ? 'selected' : ''}>${Utils.escapeHtml(p.label)}${p.id === suggested ? ' — sugerido' : ''}</option>`).join('');
    methodSel.addEventListener('change', () => {
      const sf = methodSel.value === 'skinfold';
      container.querySelector('#pe-panel-sf').style.display = sf ? '' : 'none';
      container.querySelector('#pe-panel-bio').style.display = sf ? 'none' : '';
      if (sf) sfRenderSites();
    });
    sfProtocolSel.addEventListener('change', sfRenderSites);
    container.querySelector('#sf-conv').addEventListener('change', sfRenderPreview);
    container.querySelector('#sf-mat').addEventListener('change', sfRenderPreview);
    container.querySelector('#pe-weight')?.addEventListener('input', () => { if (methodSel.value === 'skinfold') sfRenderPreview(); });
  }

  const bfInput = container.querySelector('#pe-bodyFatPercent');
  const bfClassEl = container.querySelector('#pe-bf-class');
  function bfRenderClass() {
    if (!bfInput || !bfClassEl) return;
    bfClassEl.innerHTML = bfInput.value === '' ? '' : peBodyFatClassHtml(Number(bfInput.value), age, student.sex);
  }
  bfInput?.addEventListener('input', bfRenderClass);

  const ctRead = CustomTests.bindForm(container, age, student.sex);
  CustomTests.bindManage(container);

  const workNeeds = new Set();
  container.querySelectorAll('[data-work]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.work;
      if (workNeeds.has(key)) workNeeds.delete(key); else workNeeds.add(key);
      btn.classList.toggle('mp-yesno-btn--active-yes', workNeeds.has(key));
    });
  });

  function readSitReachAttempts() {
    return [1, 2, 3]
      .map((n) => container.querySelector(`#pe-sr-${n}`)?.value)
      .filter((v) => v !== '' && v != null)
      .map(Number)
      .filter((n) => Number.isFinite(n));
  }
  function recomputeSitReachPreview() {
    const el = container.querySelector('#pe-sr-preview');
    if (!el) return;
    const attempts = readSitReachAttempts();
    if (!attempts.length) { el.innerHTML = ''; return; }
    const best = Math.max(...attempts);
    const markValue = container.querySelector('#pe-sr-mark')?.value;
    const cls = sitReachClassification(best, age, student.sex, markValue ? Number(markValue) : null);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin:6px 0 4px;">
        <div style="font-family:'Fraunces',serif;font-weight:600;font-size:26px;color:var(--verde-principal);">${best} cm</div>
        <div>
          <div style="font-size:12px;color:var(--texto-suave);">Melhor resultado (maior leitura)</div>
          ${cls
            ? `<span class="mp-pill mp-pill-${cls.level}">${Utils.escapeHtml(cls.label)}</span> <span style="font-size:11px;color:var(--texto-suave);">ACSM/CSEP, 20–69 anos</span>`
            : '<span style="font-size:11px;color:var(--texto-suave);">Sem classificação para esta idade ou marca do banco (tabela: 20–69 anos, marca de 23 ou 26 cm).</span>'}
        </div>
      </div>`;
  }
  [1, 2, 3].forEach((n) => container.querySelector(`#pe-sr-${n}`)?.addEventListener('input', recomputeSitReachPreview));
  container.querySelector('#pe-sr-mark')?.addEventListener('change', recomputeSitReachPreview);

  container.querySelector('#pe-save')?.addEventListener('click', async () => {
    const weight = Number(container.querySelector('#pe-weight').value) || null;
    const height = Number(container.querySelector('#pe-height').value) || null;
    if (!weight || !height) { Utils.toast('Preencha peso e altura.', 'error'); return; }

    const circumferences = {};
    CIRCUMFERENCE_FIELDS.forEach((f) => {
      const v = container.querySelector(`#pe-circ-${f.key}`).value;
      circumferences[f.key] = v === '' ? null : Number(v);
    });

    const record = {
      id: dbUuid(),
      studentId: AppState.currentId,
      date: container.querySelector('#pe-date').value || today,
      age: age ?? null,
      sex: student.sex,
      weight,
      height,
      circumferences,
      workNeeds: Array.from(workNeeds),
      workNeedsNotes: container.querySelector('#pe-work-notes').value.trim(),
      createdAt: new Date().toISOString(),
    };
    BIOIMPEDANCE_FIELDS.forEach((f) => {
      const v = container.querySelector(`#pe-${f.key}`).value;
      record[f.key] = v === '' ? null : Number(v);
    });
    record.bodyFatMethod = record.bodyFatPercent != null ? 'bio' : null;
    if (methodSel && methodSel.value === 'skinfold') {
      const res = sfCurrent();
      if (!res.ok) { Utils.toast('Dobras cutâneas: ' + (res.errors[0] || 'confira as medidas.'), 'error'); return; }
      BIOIMPEDANCE_FIELDS.forEach((f) => { record[f.key] = null; });
      record.bodyFatPercent = res.percent;
      record.leanMassPercent = Math.round((100 - res.percent) * 10) / 10;
      record.bodyFatMethod = 'skinfold';
      record.skinfold = {
        protocolId: sfProtocolSel.value, protocolLabel: Skinfold.protocol(sfProtocolSel.value).label,
        sites: res.means, readings: sfValues(), sum: res.sum, density: res.density ?? null,
        conversion: res.conversion ?? null, maturation: res.maturation ?? null,
        fatMassKg: res.fatMassKg ?? null, leanMassKg: res.leanMassKg ?? null,
      };
    }

    const srAttempts = readSitReachAttempts();
    if (srAttempts.length) {
      const markValue = container.querySelector('#pe-sr-mark')?.value;
      record.sitReach = {
        attempts: srAttempts,
        best: Math.max(...srAttempts),
        footMark: markValue === '' || markValue == null ? null : Number(markValue),
      };
    }

    const customResults = ctRead();
    if (customResults.length) record.customTests = customResults;

    AppState.data.physicalEvaluations.push(record);
    render();
    Utils.toast('Avaliação física salva ✓', 'success');
    const ok = await AppShell.guardedPut(DB.STORES.physicalEvaluations, record);
    if (!ok) render();
  });

  container.querySelectorAll('[data-del-eval]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await Utils.confirmDialog('Excluir esta avaliação física?');
      if (!ok) return;
      AppState.data.physicalEvaluations = AppState.data.physicalEvaluations.filter((r) => r.id !== btn.dataset.delEval);
      render();
      await DB.delete(DB.STORES.physicalEvaluations, btn.dataset.delEval);
    });
  });

  container.querySelectorAll('[data-print-eval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sorted = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
      const idx = sorted.findIndex((r) => r.id === btn.dataset.printEval);
      const current = sorted[idx];
      const previous = idx > 0 ? sorted[idx - 1] : null;
      container.querySelector('#mp-print-area').innerHTML = pePrintHtml(student, current, previous);
      window.print();
    });
  });

  container.querySelector('#pe-report-btn')?.addEventListener('click', () => {
    const sorted = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
    peBuildAndPrintReport(container.querySelector('#mp-print-area'), student, sorted);
  });
}

function peAfterRender(container) {
  const list = [...AppState.data.physicalEvaluations].sort((a, b) => a.date.localeCompare(b.date));
  peAllMetrics(list).forEach((m) => {
    const target = container.querySelector(`#pe-chart-${m.key}`);
    if (!target) return; // métrica sem dados suficientes — nem renderizada no HTML
    const points = metricPoints(list, m);
    target.innerHTML = '';
    target.appendChild(Charts.lineChart(points, { color: Charts.COLORS.verdePrincipal, pointColor: Charts.COLORS.dourado, height: 170 }));
  });
}

window.PhysicalEvaluationView = { renderHtml: peRenderHtml, bindEvents: peBindEvents, afterRender: peAfterRender };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['physical-evaluation.js'] = 'v1.23.0';
