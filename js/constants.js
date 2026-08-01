// Constantes compartilhadas — Método Pleno

const STAGE_OPTIONS = [
  { value: 'adaptacao', label: 'Adaptação' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

function stageLabel(value) {
  return STAGE_OPTIONS.find((s) => s.value === value)?.label || 'Não definido';
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
window.WEEKDAYS = WEEKDAYS;
window.ANAMNESE_QUESTIONS = ANAMNESE_QUESTIONS;
window.ACTIVITY_TYPE_OPTIONS = ACTIVITY_TYPE_OPTIONS;
window.activityTypeLabel = activityTypeLabel;
window.UNIT_OPTIONS = UNIT_OPTIONS;
window.unitOptionLabel = unitOptionLabel;
window.formatUnitLabel = formatUnitLabel;
window.classifyImc = classifyImc;
window.CIRCUMFERENCE_FIELDS = CIRCUMFERENCE_FIELDS;
