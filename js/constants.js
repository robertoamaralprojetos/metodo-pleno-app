// Constantes compartilhadas — Método Pleno

const STAGE_OPTIONS = [
  { value: 'adaptacao', label: 'Adaptação' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

function stageLabel(value) {
  return STAGE_OPTIONS.find((s) => s.value === value)?.label || 'Não definido';
}

// Objetivo geral do aluno (ao lado do Estágio de treino) — junto com o Estágio, define
// qual linha da tabela de %1RM (Metodologia de Treinamento e Periodização) se aplica.
const OBJECTIVE_OPTIONS = [
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'fortalecimento', label: 'Fortalecimento Muscular' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'manutencao', label: 'Manutenção da Qualidade de Vida' },
  { value: 'resistencia', label: 'Resistência Muscular Localizada' },
];

function objectiveLabel(value) {
  return OBJECTIVE_OPTIONS.find((o) => o.value === value)?.label || 'Não definido';
}

// Fichas de treino: rótulos fixos (A a E) — modelos reutilizáveis de exercícios,
// independentes de data, editáveis a qualquer momento (Planejar Aula).
const FICHA_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

// ---------- Teste de 1RM: tabela de referência (Metodologia de Treinamento e Periodização, Parte 1 — Musculação) ----------
// Cruza Estágio (adaptacao/intermediario/avancado) × Objetivo para sugerir série/reps/%carga/descanso
// a partir do 1RM testado. Faixas conforme documento de referência técnica do professor.
const ONE_RM_GUIDANCE_TABLE = {
  adaptacao: {
    emagrecimento:  { metodologia: 'Circuito Metabólico de Adaptação (CMA)',        series: [2, 3], reps: [15, 20], pct: [40, 50], restSeconds: [30, 45] },
    fortalecimento: { metodologia: 'Base Neural Progressiva (BNP)',                 series: [2, 3], reps: [10, 12], pct: [50, 60], restSeconds: [60, 90] },
    hipertrofia:    { metodologia: 'Estímulo de Iniciação Muscular (EIM)',          series: [2, 3], reps: [10, 15], pct: [50, 65], restSeconds: [60, 60] },
    manutencao:     { metodologia: 'Programa de Ativação Funcional Básica (PAFB)',  series: [2, 2], reps: [12, 15], pct: [40, 50], restSeconds: [60, 60] },
    resistencia:    { metodologia: 'Circuito de Base Aeróbia-Muscular (CBAM)',      series: [2, 3], reps: [18, 25], pct: [30, 40], restSeconds: [20, 30] },
  },
  intermediario: {
    emagrecimento:  { metodologia: 'Treinamento Intervalado de Resistência (TIR)',  series: [3, 4], reps: [12, 20], pct: [50, 65], restSeconds: [30, 45] },
    fortalecimento: { metodologia: 'Progressão de Força Ondulatória (PFO)',         series: [3, 4], reps: [6, 10],  pct: [70, 80], restSeconds: [90, 120] },
    hipertrofia:    { metodologia: 'Método de Sobrecarga Progressiva Ondulatória (MSPO)', series: [3, 4], reps: [8, 12], pct: [65, 80], restSeconds: [60, 90] },
    manutencao:     { metodologia: 'Programa de Manutenção Funcional Progressiva (PMFP)', series: [2, 3], reps: [10, 15], pct: [50, 65], restSeconds: [60, 60] },
    resistencia:    { metodologia: 'Circuito Metabólico Intermediário (CMI)',       series: [3, 4], reps: [15, 25], pct: [40, 55], restSeconds: [30, 30] },
  },
  avancado: {
    emagrecimento:  { metodologia: 'Método Metabólico de Alta Densidade (MMAD)',    series: [4, 5], reps: [12, 20], pct: [55, 70], restSeconds: [20, 40] },
    fortalecimento: { metodologia: 'Bloco de Força Máxima (BFM)',                   series: [4, 6], reps: [1, 6],   pct: [85, 95], restSeconds: [180, 300] },
    hipertrofia:    { metodologia: 'Método de Sobrecarga por Volume em Blocos (MSVB)', series: [4, 5], reps: [6, 15], pct: [65, 85], restSeconds: [60, 90] },
    manutencao:     { metodologia: 'Programa de Preservação Neuromuscular Avançada (PPNA)', series: [3, 3], reps: [8, 15], pct: [55, 75], restSeconds: [60, 90] },
    resistencia:    { metodologia: 'Circuito de Alta Resistência Avançada (CARA)',  series: [4, 5], reps: [20, 30], pct: [30, 50], restSeconds: [15, 30] },
  },
};

// Devolve a linha da tabela para o estágio+objetivo do aluno, ou null se algum dos dois
// não estiver definido / não existir combinação (não deveria acontecer, mas defensivo).
function oneRmGuidance(stage, objective) {
  return ONE_RM_GUIDANCE_TABLE[stage]?.[objective] || null;
}

// A partir do 1RM testado (kg) e da linha da tabela, calcula a faixa de carga de trabalho sugerida.
function oneRmSuggestedLoad(oneRm, guidance) {
  if (!oneRm || !guidance) return null;
  const loadMin = Math.round((oneRm * guidance.pct[0]) / 100 * 2) / 2; // arredonda para 0.5kg
  const loadMax = Math.round((oneRm * guidance.pct[1]) / 100 * 2) / 2;
  return { loadMin, loadMax };
}

function formatRangeLabel(range, suffix) {
  if (!range) return '';
  return range[0] === range[1] ? `${range[0]}${suffix}` : `${range[0]}–${range[1]}${suffix}`;
}

// ---------- Ajuste hierárquico de treino (antes da data de revisão) ----------
// Ordem fixa de progressão: repetição → série → descanso → carga. Ao registrar um ajuste,
// o app sugere o próximo passo dessa sequência desde o último ajuste de carga (ou desde o início).
const ADJUSTMENT_TYPE_OPTIONS = [
  { value: 'reps', label: 'Repetições' },
  { value: 'series', label: 'Séries' },
  { value: 'descanso', label: 'Tempo de descanso' },
  { value: 'carga', label: 'Carga' },
];

const ADJUSTMENT_ORDER = ['reps', 'series', 'descanso', 'carga'];

function adjustmentTypeLabel(value) {
  return ADJUSTMENT_TYPE_OPTIONS.find((a) => a.value === value)?.label || value;
}

// Dado o histórico de ajustes (já ordenado do mais recente para o mais antigo) de um
// exercício específico, sugere o próximo tipo de ajuste na hierarquia. Reinicia o ciclo
// (sugere "reps") sempre que o último ajuste registrado foi de carga, ou se não há histórico.
function nextSuggestedAdjustment(historyDesc) {
  const last = historyDesc && historyDesc[0];
  if (!last || last.tipoAjuste === 'carga') return 'reps';
  const idx = ADJUSTMENT_ORDER.indexOf(last.tipoAjuste);
  return ADJUSTMENT_ORDER[Math.min(idx + 1, ADJUSTMENT_ORDER.length - 1)];
}

const WEEKDAYS = [
  { key: 'seg', label: 'Segunda' },
  { key: 'ter', label: 'Terça' },
  { key: 'qua', label: 'Quarta' },
  { key: 'qui', label: 'Quinta' },
  { key: 'sex', label: 'Sexta' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' },
];

const ANAMNESE_QUESTIONS = [
  { key: 'quedas', text: 'Você sofreu alguma queda nos últimos 12 meses?' },
  { key: 'osteoporose', text: 'Você tem diagnóstico de osteoporose ou osteopenia?' },
  { key: 'diabetes', text: 'Você tem diabetes?' },
  { key: 'cirurgia', text: 'Você foi submetido(a) a alguma cirurgia nos últimos 12 meses?' },
  { key: 'mobilidade', text: 'Você sente dificuldade para caminhar, subir escadas ou se levantar de uma cadeira sem apoio?' },
  { key: 'dispositivoApoio', text: 'Você utiliza algum dispositivo de apoio para caminhar (bengala, andador, etc.)?' },
  { key: 'acompanhamentoMedico', text: 'Você está atualmente sob acompanhamento médico para alguma condição crônica (hipertensão, doença cardíaca, respiratória, renal, etc.)?' },
  { key: 'medicamentoContinuo', text: 'Você faz uso contínuo de algum medicamento?', hasFollowUp: true, followUpLabel: 'Quais medicamentos?' },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: 'musculacao', label: 'Musculação' },
  { value: 'pilates_solo', label: 'Pilates Solo' },
  { value: 'treinamento_funcional', label: 'Treinamento Funcional' },
  { value: 'bike_indoor', label: 'Bike Indoor' },
  { value: 'metodo_pleno', label: 'Método Pleno' },
  { value: 'custom', label: 'Personalizada...' },
];

function activityTypeLabel(student) {
  if (!student || !student.activityType) return 'Não definido';
  if (student.activityType === 'custom') return student.activityTypeCustom || 'Personalizada';
  return ACTIVITY_TYPE_OPTIONS.find((a) => a.value === student.activityType)?.label || 'Não definido';
}

const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kg' },
  { value: 'placas', label: 'Placas' },
  { value: 'peso_corporal', label: 'Peso Corporal' },
  { value: 'segundos', label: 'Segundos' },
  { value: 'elastico', label: 'Elástico' },
  { value: 'outros', label: 'Outros' },
];

function unitOptionLabel(value) {
  return UNIT_OPTIONS.find((u) => u.value === value)?.label || value || '';
}

// Formata a unidade completa para exibição (ex: "Elástico vermelho", texto livre de "Outros",
// ou o rótulo padrão). Registros antigos (unidades pré-migração, ex: "kg", "nível") continuam
// aparecendo com o texto bruto salvo na época.
function formatUnitLabel(unit, unitDetail) {
  if (unit === 'elastico') return unitDetail ? `Elástico ${unitDetail}` : 'Elástico';
  if (unit === 'outros') return unitDetail || 'Outros';
  const known = UNIT_OPTIONS.find((u) => u.value === unit);
  return known ? known.label : (unit || '');
}

// Bloco reutilizável de seleção de unidade (Planejar Aula + Registro de Treino avulso),
// com campos condicionais para cor do elástico (autocomplete) ou descrição livre em "Outros".
function unitFieldHtml(idPrefix, unit, detail, elasticColors) {
  const colorListId = idPrefix + '-elastic-colors';
  return `
    <div class="mp-field">
      <label>Unidade</label>
      <select id="${idPrefix}-unidade">
        ${UNIT_OPTIONS.map((u) => `<option value="${u.value}" ${unit === u.value ? 'selected' : ''}>${u.label}</option>`).join('')}
      </select>
    </div>
    <div class="mp-field autocomplete" id="${idPrefix}-elastic-wrap" style="${unit === 'elastico' ? '' : 'display:none;'}">
      <label>Cor do elástico</label>
      <input type="text" id="${idPrefix}-elastic-color" list="${colorListId}" value="${unit === 'elastico' ? Utils.escapeHtml(detail || '') : ''}" placeholder="Ex: vermelho">
      <datalist id="${colorListId}">${(elasticColors || []).map((c) => `<option value="${Utils.escapeHtml(c)}">`).join('')}</datalist>
    </div>
    <div class="mp-field" id="${idPrefix}-outros-wrap" style="${unit === 'outros' ? '' : 'display:none;'}">
      <label>Descreva a unidade</label>
      <input type="text" id="${idPrefix}-outros-detail" value="${unit === 'outros' ? Utils.escapeHtml(detail || '') : ''}" placeholder="Ex: halteres duplos">
    </div>
  `;
}

function bindUnitFieldEvents(container, idPrefix) {
  const select = container.querySelector(`#${idPrefix}-unidade`);
  const elasticWrap = container.querySelector(`#${idPrefix}-elastic-wrap`);
  const outrosWrap = container.querySelector(`#${idPrefix}-outros-wrap`);
  if (!select) return;
  select.addEventListener('change', () => {
    if (elasticWrap) elasticWrap.style.display = select.value === 'elastico' ? '' : 'none';
    if (outrosWrap) outrosWrap.style.display = select.value === 'outros' ? '' : 'none';
  });
}

function readUnitFieldValues(container, idPrefix) {
  const unit = container.querySelector(`#${idPrefix}-unidade`).value;
  let unitDetail = '';
  if (unit === 'elastico') unitDetail = container.querySelector(`#${idPrefix}-elastic-color`)?.value.trim() || '';
  if (unit === 'outros') unitDetail = container.querySelector(`#${idPrefix}-outros-detail`)?.value.trim() || '';
  return { unit, unitDetail };
}

// ---------- Tipos de treino (Planejar Aula + Registro de Treino) ----------
// "forca" e "aerobico" têm campos próprios; os demais (funcional, localizada, pilates,
// outro) usam um bloco genérico: atividade, tempo e, opcionalmente, séries × repetições.
const TRAINING_TYPE_OPTIONS = [
  { value: 'forca', label: 'Força (musculação)' },
  { value: 'aerobico', label: 'Aeróbico' },
  { value: 'funcional', label: 'Treinamento Funcional' },
  { value: 'localizada', label: 'Ginástica Localizada' },
  { value: 'pilates', label: 'Pilates' },
  { value: 'outro', label: 'Outros' },
];
const GENERIC_TRAINING_TYPES = ['funcional', 'localizada', 'pilates', 'outro'];

// Força = tudo que entra em carga/platô/deload/1RM. Registros antigos sem "type" são força.
function isStrengthType(type) { return !type || type === 'forca'; }
function isGenericType(type) { return GENERIC_TRAINING_TYPES.includes(type); }
function trainingTypeLabel(type, custom) {
  if (type === 'outro') return custom || 'Outros';
  return TRAINING_TYPE_OPTIONS.find((o) => o.value === (type || 'forca'))?.label || type;
}
function trainingTypeShort(type, custom) {
  return ({ aerobico: 'aeróbico', funcional: 'funcional', localizada: 'localizada', pilates: 'pilates' })[type] || (type === 'outro' ? (custom || 'outro').toLowerCase() : '');
}

// Tempo "mm:ss" (ou só minutos, aceita decimal) ⇄ segundos.
function parseMmSs(v) {
  const t = String(v ?? '').trim().replace(',', '.');
  if (!t) return null;
  if (t.includes(':')) {
    const [m, sec] = t.split(':');
    const total = (parseInt(m, 10) || 0) * 60 + (parseInt(sec, 10) || 0);
    return total > 0 ? total : null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : null;
}
function fmtMmSs(seconds) {
  if (seconds == null || seconds === '') return '';
  const s = Math.round(Number(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// Ritmo (pace) em min/km a partir de minutos e km.
function paceLabel(durationMinutes, distanceKm) {
  const d = Number(distanceKm); const t = Number(durationMinutes);
  if (!d || !t) return '';
  return `${fmtMmSs((t * 60) / d)} min/km`;
}

// ---------- Treino aeróbico ----------
const AEROBIC_TYPE_OPTIONS = [
  { value: 'corridaLivre', label: 'Corrida ao ar livre' },
  { value: 'caminhadaLivre', label: 'Caminhada ao ar livre' },
  { value: 'intervaladoCaminhadaCorrida', label: 'Intervalado caminhada/corrida' },
  { value: 'intervaladoCorrida', label: 'Treino de corrida intervalado' },
  { value: 'esteira', label: 'Esteira' },
  { value: 'bicicletaErgometrica', label: 'Bicicleta Ergométrica' },
  { value: 'bicicletaSpinning', label: 'Bicicleta de Spinning' },
  { value: 'eliptico', label: 'Elíptico' },
  { value: 'outros', label: 'Outros' },
];

function aerobicTypeLabel(type, custom) {
  if (!type) return 'Treino aeróbico';
  if (type === 'outros') return custom || 'Outros';
  return AEROBIC_TYPE_OPTIONS.find((o) => o.value === type)?.label || type;
}

// Quais campos fazem sentido por tipo de aeróbico.
function aerobicFieldsFor(type) {
  const outdoor = type === 'corridaLivre' || type === 'caminhadaLivre';
  const interval = type === 'intervaladoCaminhadaCorrida' || type === 'intervaladoCorrida';
  return {
    duration: !!type,
    speed: type === 'esteira',
    incline: type === 'esteira',
    load: ['bicicletaErgometrica', 'bicicletaSpinning', 'eliptico', 'outros'].includes(type),
    distance: outdoor || interval,
    interval,
    t1Label: type === 'intervaladoCaminhadaCorrida' ? 'Tempo de caminhada (mm:ss)' : 'Tempo 1 · estímulo (mm:ss)',
    t2Label: type === 'intervaladoCaminhadaCorrida' ? 'Tempo de corrida (mm:ss)' : 'Tempo 2 · recuperação (mm:ss)',
  };
}

// Resumo textual (tabelas do plano, checklist, histórico, impressão, relatório).
function formatAerobicSummary(item) {
  const parts = [];
  if (item.rounds && (item.t1Seconds || item.t2Seconds)) {
    const a = fmtMmSs(item.t1Seconds) || '0:00';
    const b = fmtMmSs(item.t2Seconds) || '0:00';
    parts.push(item.aerobicType === 'intervaladoCaminhadaCorrida' ? `${item.rounds}× (${a} caminhada + ${b} corrida)` : `${item.rounds}× (${a} + ${b})`);
  }
  if (item.durationMinutes != null && item.durationMinutes !== '' && Number(item.durationMinutes) > 0) parts.push(`${Math.round(item.durationMinutes * 10) / 10} min`);
  if (item.distanceKm) parts.push(`${String(item.distanceKm).replace('.', ',')} km`);
  const pace = paceLabel(item.durationMinutes, item.distanceKm);
  if (pace) parts.push(pace);
  if (item.speed != null && item.speed !== '') parts.push(`${item.speed} km/h`);
  if (item.incline != null && item.incline !== '') parts.push(`${item.incline}% inclin.`);
  if (item.load != null && item.load !== '') parts.push(`carga ${item.load}`);
  if (item.hrZone && window.Cardio) parts.push(Cardio.zoneShort(item.hrZone));
  return parts.join(' · ') || '—';
}

// Bloco de campos do aeróbico. opts.lockType: tipo fixo (Registro de Treino) — o seletor
// vira um campo oculto; opts.zone: mostra o seletor de zona de FC alvo (Planejar Aula).
function aerobicFieldHtml(idPrefix, values, opts = {}) {
  values = values || {};
  const type = values.aerobicType || '';
  const f = aerobicFieldsFor(type);
  const show = (on) => (on ? '' : 'display:none;');
  const zoneSelect = opts.zone && window.Cardio ? `
    <div class="mp-field">
      <label>Zona de FC alvo (opcional)</label>
      <select id="${idPrefix}-aerobic-zone"><option value="">—</option>${Cardio.ZONES.map((z) => `<option value="${z.key}" ${values.hrZone === z.key ? 'selected' : ''}>${Utils.escapeHtml(z.key.toUpperCase() + ' · ' + z.pct[0] + '–' + z.pct[1] + '% · ' + z.name)}</option>`).join('')}</select>
    </div>` : '';
  return `
    ${opts.lockType ? `<input type="hidden" id="${idPrefix}-aerobic-type" value="${Utils.escapeHtml(type)}"><input type="hidden" id="${idPrefix}-aerobic-custom" value="${Utils.escapeHtml(values.aerobicTypeCustom || '')}">` : `
    <div class="mp-field">
      <label>Tipo de treino aeróbico</label>
      <select id="${idPrefix}-aerobic-type">
        <option value="">Selecione</option>
        ${AEROBIC_TYPE_OPTIONS.map((o) => `<option value="${o.value}" ${type === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-custom-wrap" style="${show(type === 'outros')}">
      <label>Qual?</label>
      <input type="text" id="${idPrefix}-aerobic-custom" value="${Utils.escapeHtml(values.aerobicTypeCustom || '')}" placeholder="Ex: Remo, escada...">
    </div>`}
    <div class="mp-field" id="${idPrefix}-aerobic-t1-wrap" style="${show(f.interval)}">
      <label id="${idPrefix}-aerobic-t1-label">${f.t1Label}</label>
      <input type="text" inputmode="decimal" id="${idPrefix}-aerobic-t1" value="${fmtMmSs(values.t1Seconds)}" placeholder="Ex: 2:00">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-t2-wrap" style="${show(f.interval)}">
      <label id="${idPrefix}-aerobic-t2-label">${f.t2Label}</label>
      <input type="text" inputmode="decimal" id="${idPrefix}-aerobic-t2" value="${fmtMmSs(values.t2Seconds)}" placeholder="Ex: 1:00">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-rounds-wrap" style="${show(f.interval)}">
      <label>Repetições (ciclos)</label>
      <input type="number" min="0" step="1" id="${idPrefix}-aerobic-rounds" value="${values.rounds ?? ''}">
    </div>
    <div class="mp-field">
      <label>Tempo total (min)${f.interval ? ' — vazio = calculado' : ''}</label>
      <input type="number" min="0" step="0.5" id="${idPrefix}-aerobic-duration" value="${values.durationMinutes ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-distance-wrap" style="${show(f.distance)}">
      <label>Distância (km)</label>
      <input type="number" min="0" step="0.01" id="${idPrefix}-aerobic-distance" value="${values.distanceKm ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-speed-wrap" style="${show(f.speed)}">
      <label>Velocidade (km/h)</label>
      <input type="number" min="0" step="0.1" id="${idPrefix}-aerobic-speed" value="${values.speed ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-incline-wrap" style="${show(f.incline)}">
      <label>Inclinação (%)</label>
      <input type="number" min="0" step="0.5" id="${idPrefix}-aerobic-incline" value="${values.incline ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-load-wrap" style="${show(f.load)}">
      <label>Carga / Resistência</label>
      <input type="number" min="0" step="0.5" id="${idPrefix}-aerobic-load" value="${values.load ?? ''}">
    </div>
    ${zoneSelect}
  `;
}

function bindAerobicFieldEvents(container, idPrefix) {
  const select = container.querySelector(`#${idPrefix}-aerobic-type`);
  if (!select || select.tagName !== 'SELECT') return;
  const wrap = (k) => container.querySelector(`#${idPrefix}-aerobic-${k}-wrap`);
  select.addEventListener('change', () => {
    const f = aerobicFieldsFor(select.value);
    const set = (k, on) => { const w = wrap(k); if (w) w.style.display = on ? '' : 'none'; };
    set('custom', select.value === 'outros');
    set('speed', f.speed); set('incline', f.incline); set('load', f.load); set('distance', f.distance);
    set('t1', f.interval); set('t2', f.interval); set('rounds', f.interval);
    const l1 = container.querySelector(`#${idPrefix}-aerobic-t1-label`); if (l1) l1.textContent = f.t1Label;
    const l2 = container.querySelector(`#${idPrefix}-aerobic-t2-label`); if (l2) l2.textContent = f.t2Label;
  });
}

function readAerobicFieldValues(container, idPrefix) {
  const q = (k) => container.querySelector(`#${idPrefix}-aerobic-${k}`);
  const num = (k) => { const el = q(k); const v = el ? Number(String(el.value).replace(',', '.')) : 0; return Number.isFinite(v) && v > 0 ? v : null; };
  const aerobicType = q('type').value;
  const f = aerobicFieldsFor(aerobicType);
  const aerobicTypeCustom = aerobicType === 'outros' ? (q('custom')?.value.trim() || '') : '';
  const t1Seconds = f.interval ? parseMmSs(q('t1')?.value) : null;
  const t2Seconds = f.interval ? parseMmSs(q('t2')?.value) : null;
  const rounds = f.interval ? (parseInt(q('rounds')?.value, 10) || null) : null;
  let durationMinutes = num('duration');
  if (!durationMinutes && f.interval && rounds && (t1Seconds || t2Seconds)) durationMinutes = Math.round((((t1Seconds || 0) + (t2Seconds || 0)) * rounds) / 6) / 10;
  return {
    aerobicType, aerobicTypeCustom,
    durationMinutes: durationMinutes || 0,
    distanceKm: f.distance ? num('distance') : null,
    t1Seconds, t2Seconds, rounds,
    speed: f.speed ? (num('speed') || 0) : null,
    incline: f.incline ? (num('incline') || 0) : null,
    load: f.load ? (num('load') || 0) : null,
    hrZone: q('zone') ? (q('zone').value || null) : undefined,
  };
}

// ---------- Treinos Funcional / Localizada / Pilates / Outros ----------
const GENERIC_PLACEHOLDERS = {
  funcional: 'Ex: Circuito funcional — agachamento, prancha, passada',
  localizada: 'Ex: Glúteos e abdômen com caneleira',
  pilates: 'Ex: Mat Pilates — série básica',
  outro: 'Ex: Alongamento, dança, hidroginástica...',
};
function genericFieldHtml(idPrefix, type, values, opts = {}) {
  values = values || {};
  const esc = Utils.escapeHtml;
  return `
    ${!opts.lockType ? `<div class="mp-field" id="${idPrefix}-g-custom-wrap" style="${type === 'outro' ? '' : 'display:none;'}"><label>Qual tipo de treino?</label><input type="text" id="${idPrefix}-g-custom" value="${esc(values.trainingTypeCustom || '')}" placeholder="Ex: Alongamento"></div>` : `<input type="hidden" id="${idPrefix}-g-custom" value="${esc(values.trainingTypeCustom || '')}">`}
    ${opts.lockType ? `<input type="hidden" id="${idPrefix}-g-name" value="${esc(values.exerciseName || '')}">` : `<div class="mp-field" style="grid-column:1/-1;"><label>Atividade / exercícios</label><input type="text" id="${idPrefix}-g-name" value="${esc(values.genericName ?? values.exerciseName ?? '')}" placeholder="${esc(GENERIC_PLACEHOLDERS[type] || '')}"></div>`}
    <div class="mp-field"><label>Tempo (min)</label><input type="number" min="0" step="1" id="${idPrefix}-g-duration" value="${values.durationMinutes ?? ''}"></div>
    <div class="mp-field"><label>Séries (opcional)</label><input type="number" min="0" step="1" id="${idPrefix}-g-series" value="${values.series ?? ''}"></div>
    <div class="mp-field"><label>Repetições (opcional)</label><input type="number" min="0" step="1" id="${idPrefix}-g-reps" value="${values.reps ?? ''}"></div>
  `;
}
function readGenericFieldValues(container, idPrefix, type) {
  const q = (k) => container.querySelector(`#${idPrefix}-g-${k}`);
  const custom = type === 'outro' ? (q('custom')?.value.trim() || '') : '';
  const name = q('name')?.value.trim() || '';
  return {
    trainingTypeCustom: custom,
    genericName: name,
    exerciseName: name || trainingTypeLabel(type, custom),
    durationMinutes: Number(q('duration')?.value) || 0,
    series: parseInt(q('series')?.value, 10) || null,
    reps: parseInt(q('reps')?.value, 10) || null,
  };
}
function formatGenericSummary(item) {
  const parts = [];
  if (item.durationMinutes) parts.push(`${item.durationMinutes} min`);
  if (item.series && item.reps) parts.push(`${item.series}×${item.reps}`);
  else if (item.series) parts.push(`${item.series} séries`);
  return parts.join(' · ') || '—';
}
// Resumo de qualquer item/sessão que não seja força.
function formatNonStrengthSummary(item) {
  return item.type === 'aerobico' ? formatAerobicSummary(item) : formatGenericSummary(item);
}

// Idosos (>=60): Classificação de Lipschitz — abaixo de 22 baixo peso, 22 a 27 eutrófico, acima de 27 sobrepeso.
// Adultos (<60): tabela padrão da OMS — <18,5 baixo peso, 18,5–24,9 normal, 25–29,9 sobrepeso, 30+ obesidade.
function classifyImc(imc, age) {
  if (age >= 60) {
    if (imc < 22) return { label: 'Baixo peso', reference: 'Lipschitz (idosos)' };
    if (imc <= 27) return { label: 'Eutrófico (normal)', reference: 'Lipschitz (idosos)' };
    return { label: 'Sobrepeso', reference: 'Lipschitz (idosos)' };
  }
  if (imc < 18.5) return { label: 'Baixo peso', reference: 'OMS' };
  if (imc < 25) return { label: 'Normal', reference: 'OMS' };
  if (imc < 30) return { label: 'Sobrepeso', reference: 'OMS' };
  return { label: 'Obesidade', reference: 'OMS' };
}

const CIRCUMFERENCE_FIELDS = [
  { key: 'armR', label: 'Braço direito' },
  { key: 'forearmR', label: 'Antebraço direito' },
  { key: 'armL', label: 'Braço esquerdo' },
  { key: 'forearmL', label: 'Antebraço esquerdo' },
  { key: 'chest', label: 'Peitoral' },
  { key: 'abdomen', label: 'Abdômen' },
  { key: 'hip', label: 'Quadril' },
  { key: 'thighR', label: 'Coxa direita' },
  { key: 'calfR', label: 'Perna direita' },
  { key: 'thighL', label: 'Coxa esquerda' },
  { key: 'calfL', label: 'Perna esquerda' },
];

window.STAGE_OPTIONS = STAGE_OPTIONS;
window.stageLabel = stageLabel;
window.OBJECTIVE_OPTIONS = OBJECTIVE_OPTIONS;
window.objectiveLabel = objectiveLabel;
window.FICHA_OPTIONS = FICHA_OPTIONS;
window.ONE_RM_GUIDANCE_TABLE = ONE_RM_GUIDANCE_TABLE;
window.oneRmGuidance = oneRmGuidance;
window.oneRmSuggestedLoad = oneRmSuggestedLoad;
window.formatRangeLabel = formatRangeLabel;
window.ADJUSTMENT_TYPE_OPTIONS = ADJUSTMENT_TYPE_OPTIONS;
window.ADJUSTMENT_ORDER = ADJUSTMENT_ORDER;
window.adjustmentTypeLabel = adjustmentTypeLabel;
window.nextSuggestedAdjustment = nextSuggestedAdjustment;
window.WEEKDAYS = WEEKDAYS;
window.ANAMNESE_QUESTIONS = ANAMNESE_QUESTIONS;
window.ACTIVITY_TYPE_OPTIONS = ACTIVITY_TYPE_OPTIONS;
window.activityTypeLabel = activityTypeLabel;
window.UNIT_OPTIONS = UNIT_OPTIONS;
window.unitOptionLabel = unitOptionLabel;
window.formatUnitLabel = formatUnitLabel;
window.unitFieldHtml = unitFieldHtml;
window.bindUnitFieldEvents = bindUnitFieldEvents;
window.readUnitFieldValues = readUnitFieldValues;
window.classifyImc = classifyImc;
window.CIRCUMFERENCE_FIELDS = CIRCUMFERENCE_FIELDS;
window.AEROBIC_TYPE_OPTIONS = AEROBIC_TYPE_OPTIONS;
window.aerobicTypeLabel = aerobicTypeLabel;
window.TRAINING_TYPE_OPTIONS = TRAINING_TYPE_OPTIONS;
window.isStrengthType = isStrengthType;
window.isGenericType = isGenericType;
window.trainingTypeLabel = trainingTypeLabel;
window.trainingTypeShort = trainingTypeShort;
window.parseMmSs = parseMmSs;
window.fmtMmSs = fmtMmSs;
window.paceLabel = paceLabel;
window.genericFieldHtml = genericFieldHtml;
window.readGenericFieldValues = readGenericFieldValues;
window.formatGenericSummary = formatGenericSummary;
window.formatNonStrengthSummary = formatNonStrengthSummary;
window.aerobicFieldsFor = aerobicFieldsFor;
window.formatAerobicSummary = formatAerobicSummary;
window.aerobicFieldHtml = aerobicFieldHtml;
window.bindAerobicFieldEvents = bindAerobicFieldEvents;
window.readAerobicFieldValues = readAerobicFieldValues;

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['constants.js'] = 'v1.19.0';
