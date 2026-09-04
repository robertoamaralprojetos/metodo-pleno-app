// Constantes compartilhadas — Método Pleno

const STAGE_OPTIONS = [
  { value: 'adaptacao', label: 'Adaptação' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

function stageLabel(value) {
  return STAGE_OPTIONS.find((s) => s.value === value)?.label || 'Não definido';
}

// Fichas de treino: rótulos fixos (A a E) — modelos reutilizáveis de exercícios,
// independentes de data, editáveis a qualquer momento (Planejar Aula).
const FICHA_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

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
window.FICHA_OPTIONS = FICHA_OPTIONS;
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
