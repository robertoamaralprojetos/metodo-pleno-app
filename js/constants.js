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

window.STAGE_OPTIONS = STAGE_OPTIONS;
window.stageLabel = stageLabel;
window.WEEKDAYS = WEEKDAYS;
window.ANAMNESE_QUESTIONS = ANAMNESE_QUESTIONS;
