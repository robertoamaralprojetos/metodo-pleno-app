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

// ---------- Treino aeróbico (Planejar Aula + Registro de Treino) ----------
const AEROBIC_TYPE_OPTIONS = [
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

// Quais campos de intensidade fazem sentido por tipo: esteira usa velocidade/inclinação;
// bicicletas/elíptico/outros usam carga (resistência).
function aerobicFieldsFor(type) {
  return { speed: type === 'esteira', incline: type === 'esteira', load: type !== 'esteira' && !!type };
}

// Resumo textual (usado nas tabelas — plano, checklist, histórico, impressão) já que o
// treino aeróbico não tem "séries×rep"/"carga" no mesmo sentido do treino de força.
function formatAerobicSummary(item) {
  const parts = [];
  if (item.durationMinutes != null && item.durationMinutes !== '') parts.push(`${item.durationMinutes} min`);
  if (item.speed != null && item.speed !== '') parts.push(`${item.speed} km/h`);
  if (item.incline != null && item.incline !== '') parts.push(`${item.incline}% inclin.`);
  if (item.load != null && item.load !== '') parts.push(`carga ${item.load}`);
  return parts.join(' · ') || '—';
}

// Bloco reutilizável de campos de treino aeróbico (Planejar Aula, checklist do dia e
// exercício avulso), com campos condicionais conforme o tipo escolhido.
function aerobicFieldHtml(idPrefix, values) {
  values = values || {};
  const type = values.aerobicType || '';
  const fields = aerobicFieldsFor(type);
  return `
    <div class="mp-field">
      <label>Tipo de treino aeróbico</label>
      <select id="${idPrefix}-aerobic-type">
        <option value="">Selecione</option>
        ${AEROBIC_TYPE_OPTIONS.map((o) => `<option value="${o.value}" ${type === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-custom-wrap" style="${type === 'outros' ? '' : 'display:none;'}">
      <label>Qual?</label>
      <input type="text" id="${idPrefix}-aerobic-custom" value="${Utils.escapeHtml(values.aerobicTypeCustom || '')}" placeholder="Ex: Remo, escada...">
    </div>
    <div class="mp-field">
      <label>Tempo (minutos)</label>
      <input type="number" min="0" step="1" id="${idPrefix}-aerobic-duration" value="${values.durationMinutes ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-speed-wrap" style="${fields.speed ? '' : 'display:none;'}">
      <label>Velocidade (km/h)</label>
      <input type="number" min="0" step="0.1" id="${idPrefix}-aerobic-speed" value="${values.speed ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-incline-wrap" style="${fields.incline ? '' : 'display:none;'}">
      <label>Inclinação (%)</label>
      <input type="number" min="0" step="0.5" id="${idPrefix}-aerobic-incline" value="${values.incline ?? ''}">
    </div>
    <div class="mp-field" id="${idPrefix}-aerobic-load-wrap" style="${fields.load ? '' : 'display:none;'}">
      <label>Carga / Resistência</label>
      <input type="number" min="0" step="0.5" id="${idPrefix}-aerobic-load" value="${values.load ?? ''}">
    </div>
  `;
}

function bindAerobicFieldEvents(container, idPrefix) {
  const select = container.querySelector(`#${idPrefix}-aerobic-type`);
  if (!select) return;
  const customWrap = container.querySelector(`#${idPrefix}-aerobic-custom-wrap`);
  const speedWrap = container.querySelector(`#${idPrefix}-aerobic-speed-wrap`);
  const inclineWrap = container.querySelector(`#${idPrefix}-aerobic-incline-wrap`);
  const loadWrap = container.querySelector(`#${idPrefix}-aerobic-load-wrap`);
  select.addEventListener('change', () => {
    const fields = aerobicFieldsFor(select.value);
    if (customWrap) customWrap.style.display = select.value === 'outros' ? '' : 'none';
    if (speedWrap) speedWrap.style.display = fields.speed ? '' : 'none';
    if (inclineWrap) inclineWrap.style.display = fields.incline ? '' : 'none';
    if (loadWrap) loadWrap.style.display = fields.load ? '' : 'none';
  });
}

function readAerobicFieldValues(container, idPrefix) {
  const aerobicType = container.querySelector(`#${idPrefix}-aerobic-type`).value;
  const aerobicTypeCustom = aerobicType === 'outros' ? (container.querySelector(`#${idPrefix}-aerobic-custom`)?.value.trim() || '') : '';
  const durationMinutes = Number(container.querySelector(`#${idPrefix}-aerobic-duration`).value) || 0;
  const fields = aerobicFieldsFor(aerobicType);
  const speed = fields.speed ? (Number(container.querySelector(`#${idPrefix}-aerobic-speed`)?.value) || 0) : null;
  const incline = fields.incline ? (Number(container.querySelector(`#${idPrefix}-aerobic-incline`)?.value) || 0) : null;
  const load = fields.load ? (Number(container.querySelector(`#${idPrefix}-aerobic-load`)?.value) || 0) : null;
  return { aerobicType, aerobicTypeCustom, durationMinutes, speed, incline, load };
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
window.aerobicFieldsFor = aerobicFieldsFor;
window.formatAerobicSummary = formatAerobicSummary;
window.aerobicFieldHtml = aerobicFieldHtml;
window.bindAerobicFieldEvents = bindAerobicFieldEvents;
window.readAerobicFieldValues = readAerobicFieldValues;
