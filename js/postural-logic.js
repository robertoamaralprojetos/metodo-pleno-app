// Avaliação Postural — lógica pura (sem tela): catálogo de achados, regras de ênfase de treino,
// classificação dos exercícios das Fichas por grupo muscular e o CRUZAMENTO entre
// avaliação postural × avaliação física × objetivo × treino.
//
// Enquadramento: o app sugere ÊNFASE DE TREINO (onde redistribuir séries), não "correção" nem
// diagnóstico. A evidência de que desequilíbrios musculares específicos causam desvios
// posturais é limitada; achados estruturais geram encaminhamento, não exercício.

const SEVERITY_LABELS = { 1: 'Leve', 2: 'Moderada', 3: 'Acentuada' };
const SIDE_LABELS = { D: 'direito', E: 'esquerdo', B: 'bilateral' };

const GROUP_LABELS = {
  flex_prof_pescoco: 'Flexores profundos do pescoço',
  trap_med_inf: 'Trapézio médio e inferior',
  romboides: 'Romboides',
  delt_post: 'Deltoide posterior',
  rot_ext_ombro: 'Rotadores externos do ombro',
  serratil: 'Serrátil anterior',
  ext_toracicos: 'Extensores torácicos',
  ext_lombares: 'Extensores lombares',
  gluteo_max: 'Glúteo máximo',
  gluteo_med: 'Glúteo médio',
  rot_ext_quadril: 'Rotadores externos do quadril',
  core_abd: 'Core / abdominais',
  isquios: 'Isquiotibiais',
  intrinsecos_pe: 'Musculatura intrínseca do pé',
  peitoral: 'Peitoral',
  trap_sup: 'Trapézio superior',
  flex_quadril: 'Flexores do quadril',
  adutores: 'Adutores',
  tfl: 'Tensor da fáscia lata',
  panturrilha: 'Panturrilha',
};

// s = grupos a fortalecer [grupo, peso]; m = grupos a mobilizar/alongar [grupo, peso].
// alertAt2/alertAt3 = alerta a partir da gravidade 2/3; alertAny = alerta em qualquer gravidade.
const POSTURE_FINDINGS = [
  { key: 'cabeca_anteriorizada', segment: 'Cabeça e pescoço', label: 'Cabeça anteriorizada', view: 'lateral',
    s: [['flex_prof_pescoco', 2], ['trap_med_inf', 1], ['romboides', 1], ['ext_toracicos', 1]], m: [['peitoral', 1], ['trap_sup', 1]] },
  { key: 'cabeca_inclinada', segment: 'Cabeça e pescoço', label: 'Inclinação lateral da cabeça', view: 'frontal', side: true,
    s: [], m: [['trap_sup', 1]], alertAt3: 'Inclinação lateral acentuada da cabeça: investigue a causa (visual, cervical) e considere encaminhar se persistir.' },
  { key: 'ombro_protuso', segment: 'Ombros e escápulas', label: 'Ombros protusos (arredondados)', view: 'lateral',
    s: [['trap_med_inf', 2], ['romboides', 2], ['delt_post', 1], ['rot_ext_ombro', 1]], m: [['peitoral', 2]] },
  { key: 'ombro_assimetrico', segment: 'Ombros e escápulas', label: 'Assimetria de altura dos ombros', view: 'frontal', side: true,
    s: [['trap_med_inf', 1]], m: [['trap_sup', 1]] },
  { key: 'escapula_alada', segment: 'Ombros e escápulas', label: 'Escápulas aladas', view: 'posterior', side: true,
    s: [['serratil', 2], ['trap_med_inf', 1]], m: [], alertAt2: 'Escápula alada moderada/acentuada, sobretudo unilateral: considere encaminhar para avaliação clínica.' },
  { key: 'hipercifose', segment: 'Coluna', label: 'Hipercifose torácica', view: 'lateral', spine: true,
    s: [['ext_toracicos', 2], ['trap_med_inf', 1], ['romboides', 1]], m: [['peitoral', 1]] },
  { key: 'hiperlordose', segment: 'Coluna', label: 'Hiperlordose lombar', view: 'lateral', spine: true,
    s: [['gluteo_max', 2], ['core_abd', 2], ['isquios', 1]], m: [['flex_quadril', 2]] },
  { key: 'retificacao_lombar', segment: 'Coluna', label: 'Retificação lombar', view: 'lateral', spine: true,
    s: [['ext_lombares', 2]], m: [['isquios', 2]] },
  { key: 'escoliose', segment: 'Coluna', label: 'Suspeita de desvio lateral da coluna (escoliose)', view: 'posterior', structural: true, spine: true,
    s: [], m: [], alertAny: 'Suspeita de escoliose: encaminhe para avaliação (ortopedia/fisioterapia). O treino não corrige escoliose estrutural — mantenha o trabalho bilateral e equilibrado e evite ênfases unilaterais sem orientação.' },
  { key: 'anteversao', segment: 'Pelve', label: 'Anteversão pélvica', view: 'lateral',
    s: [['gluteo_max', 2], ['core_abd', 2], ['isquios', 1]], m: [['flex_quadril', 2]] },
  { key: 'retroversao', segment: 'Pelve', label: 'Retroversão pélvica', view: 'lateral',
    s: [['ext_lombares', 1]], m: [['isquios', 2]] },
  { key: 'pelve_assimetrica', segment: 'Pelve', label: 'Assimetria pélvica (inclinação lateral)', view: 'frontal', side: true,
    s: [['gluteo_med', 2], ['core_abd', 1]], m: [], alertAt3: 'Assimetria pélvica acentuada: considere avaliar a diferença de comprimento dos membros inferiores e encaminhar.' },
  { key: 'joelho_valgo', segment: 'Joelhos', label: 'Valgo de joelho', view: 'frontal', side: true,
    s: [['gluteo_med', 2], ['rot_ext_quadril', 2], ['gluteo_max', 1]], m: [['adutores', 1], ['tfl', 1]] },
  { key: 'joelho_varo', segment: 'Joelhos', label: 'Varo de joelho', view: 'frontal', side: true,
    s: [['gluteo_med', 1]], m: [], alertAt3: 'Varo acentuado: acompanhe e considere avaliação ortopédica se houver dor.' },
  { key: 'joelho_recurvato', segment: 'Joelhos', label: 'Hiperextensão de joelho (recurvato)', view: 'lateral', side: true,
    s: [['isquios', 2], ['gluteo_max', 1]], m: [], cue: 'Recurvato: oriente o aluno a não "travar" o joelho na extensão durante os exercícios.' },
  { key: 'pe_plano', segment: 'Pés', label: 'Pé plano / pronação excessiva', view: 'posterior', side: true,
    s: [['intrinsecos_pe', 2], ['gluteo_med', 1]], m: [['panturrilha', 1]] },
  { key: 'pe_cavo', segment: 'Pés', label: 'Pé cavo / supinação', view: 'posterior', side: true,
    s: [['intrinsecos_pe', 1]], m: [['panturrilha', 2]] },
];
const FINDING_BY_KEY = Object.fromEntries(POSTURE_FINDINGS.map((f) => [f.key, f]));

// Sugestões de exercício por grupo a fortalecer. Cada nome PRECISA ser reconhecido pelo
// classificador abaixo como pertencente ao grupo (há teste automático disso).
const EXERCISE_CATALOG = {
  flex_prof_pescoco: [{ name: 'Retração cervical (queixo para dentro)', unit: 'peso_corporal', series: 2, reps: 10 }],
  trap_med_inf: [{ name: 'Remada baixa no cabo (pegada neutra)', unit: 'kg' }, { name: 'Elevação em Y no banco inclinado', unit: 'kg' }, { name: 'Face pull no cabo ou elástico', unit: 'kg' }],
  romboides: [{ name: 'Remada sentada com retração escapular', unit: 'kg' }, { name: 'Remada curvada com halteres', unit: 'kg' }, { name: 'Crucifixo inverso', unit: 'kg' }],
  delt_post: [{ name: 'Crucifixo inverso', unit: 'kg' }, { name: 'Elevação posterior com halteres', unit: 'kg' }, { name: 'Face pull no cabo ou elástico', unit: 'kg' }],
  rot_ext_ombro: [{ name: 'Rotação externa de ombro com elástico', unit: 'elastico' }, { name: 'Rotação externa de ombro no cabo', unit: 'kg' }],
  serratil: [{ name: 'Flexão de braço com protração na parede', unit: 'peso_corporal' }, { name: 'Protração escapular no cabo', unit: 'kg' }],
  ext_toracicos: [{ name: 'Extensão torácica no banco (amplitude controlada)', unit: 'peso_corporal' }, { name: 'Superman no solo', unit: 'peso_corporal' }],
  ext_lombares: [{ name: 'Bird dog (quatro apoios)', unit: 'peso_corporal' }, { name: 'Extensão lombar no banco romano (amplitude controlada)', unit: 'peso_corporal' }],
  gluteo_max: [{ name: 'Elevação pélvica', unit: 'peso_corporal' }, { name: 'Agachamento no banco', unit: 'kg' }, { name: 'Coice de glúteo no cabo', unit: 'kg' }],
  gluteo_med: [{ name: 'Abdução de quadril com elástico', unit: 'elastico' }, { name: 'Caminhada lateral com elástico', unit: 'elastico' }, { name: 'Prancha lateral', unit: 'segundos', series: 2, reps: 1, load: 20 }],
  rot_ext_quadril: [{ name: 'Concha (clamshell) com elástico', unit: 'elastico' }, { name: 'Rotação externa de quadril sentado com elástico', unit: 'elastico' }],
  core_abd: [{ name: 'Prancha frontal', unit: 'segundos', series: 2, reps: 1, load: 20 }, { name: 'Dead bug', unit: 'peso_corporal' }, { name: 'Pallof press no cabo', unit: 'kg' }],
  isquios: [{ name: 'Mesa flexora', unit: 'kg' }, { name: 'Stiff com halteres', unit: 'kg' }, { name: 'Ponte com apoio de um pé', unit: 'peso_corporal' }],
  intrinsecos_pe: [{ name: 'Exercício do pé curto (short foot)', unit: 'peso_corporal' }, { name: 'Caminhada descalça com foco no arco do pé', unit: 'segundos', series: 2, reps: 1, load: 30 }],
};

// Mobilidade/alongamento (só orientação; não entra automaticamente na Ficha).
const MOBILITY_CATALOG = {
  peitoral: 'Alongamento de peitoral no batente da porta',
  trap_sup: 'Alongamento de trapézio superior (inclinação lateral do pescoço)',
  flex_quadril: 'Alongamento de flexores do quadril (afundo baixo)',
  isquios: 'Alongamento de isquiotibiais (sentado ou deitado com faixa)',
  adutores: 'Alongamento de adutores (posição de borboleta)',
  tfl: 'Alongamento do tensor da fáscia lata (cruzando a perna)',
  panturrilha: 'Alongamento de panturrilha na parede',
};

// ---------- Classificação dos exercícios das Fichas (primeira regra que casa vence) ----------
// groups: [[grupo, fração da série que conta]]; type: 'push' | 'pull' | null.
const EXERCISE_PATTERNS = [
  { re: /face ?pull/, groups: [['delt_post', 1], ['romboides', 1], ['trap_med_inf', 1], ['rot_ext_ombro', 0.5]], type: 'pull' },
  { re: /crucifixo inverso|voador inverso|pec ?deck inverso|peck ?deck inverso|elevacao posterior|deltoide posterior/, groups: [['delt_post', 1], ['romboides', 1], ['trap_med_inf', 1]], type: 'pull' },
  { re: /elevacao em y|y-?raise/, groups: [['trap_med_inf', 1], ['delt_post', 0.5]], type: 'pull' },
  { re: /remada/, groups: [['romboides', 1], ['trap_med_inf', 1], ['delt_post', 0.5]], type: 'pull' },
  { re: /puxada|pulldown|barra fixa|pull ?up|chin ?up/, groups: [], type: 'pull' },
  { re: /rotacao externa.*quadril|concha|clam/, groups: [['rot_ext_quadril', 1], ['gluteo_med', 0.5]], type: null },
  { re: /rotacao externa/, groups: [['rot_ext_ombro', 1]], type: null },
  { re: /serratil|protracao|push ?up plus/, groups: [['serratil', 1]], type: null },
  { re: /retracao cervical|queixo para dentro|chin ?tuck|flexores profundos/, groups: [['flex_prof_pescoco', 1]], type: null },
  { re: /extensao (de )?(tronco|coluna|lombar|toracica)|hiperextensao|banco romano|superman|bird ?dog|extensora lombar|good ?morning/, groups: [['ext_lombares', 1], ['ext_toracicos', 1]], type: null },
  { re: /prancha lateral/, groups: [['gluteo_med', 1], ['core_abd', 0.5]], type: null },
  { re: /abducao|abdutora|caminhada lateral|lateral band|monster/, groups: [['gluteo_med', 1]], type: null },
  { re: /prancha|abdominal|abdomen|dead ?bug|pallof|crunch|infra|core/, groups: [['core_abd', 1]], type: null },
  { re: /ponte com apoio/, groups: [['isquios', 1], ['gluteo_max', 0.5]], type: null },
  { re: /elevacao pelvica|ponte|hip ?thrust|coice|glute/, groups: [['gluteo_max', 1]], type: null },
  { re: /stiff|levantamento terra|terra romeno/, groups: [['isquios', 1], ['gluteo_max', 0.5], ['ext_lombares', 0.5]], type: null },
  { re: /flexora/, groups: [['isquios', 1]], type: null },
  { re: /agachamento|leg ?press|afundo|passada|avanco|step ?up|sentar e levantar|levantar da cadeira/, groups: [['gluteo_max', 0.5]], type: null },
  { re: /pe curto|short foot|arco do pe|descalc/, groups: [['intrinsecos_pe', 1]], type: null },
  { re: /panturrilha|gemeos|soleo|calf|elevacao de calcanhar/, groups: [], type: null },
  { re: /supino|crucifixo|pec ?deck|peck ?deck|flexao de braco|desenvolvimento|peitoral|paralela|mergulho|press/, groups: [], type: 'push' },
  { re: /rosca|triceps|biceps|elevacao lateral|elevacao frontal|extensora|quadriceps|adutora/, groups: [], type: null },
];

function normalizeName(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// null = exercício não reconhecido; caso contrário { groups, type }.
function classifyExercise(name) {
  const n = normalizeName(name);
  if (!n) return null;
  const hit = EXERCISE_PATTERNS.find((p) => p.re.test(n));
  return hit ? { groups: hit.groups, type: hit.type } : null;
}

// Cobertura semanal aproximada: soma das séries de todas as Fichas (A–E), assumindo cada
// Ficha aplicada 1x por semana. Séries de exercícios compostos contam só a fração indicada.
function coverageFromTemplates(templates) {
  const sets = {};
  const have = {};
  let push = 0;
  let pull = 0;
  const unclassified = [];
  (templates || []).forEach((t) => (t.items || []).forEach((it) => {
    if (it.type === 'aerobico') return;
    const c = classifyExercise(it.exerciseName);
    if (!c) { if (it.exerciseName && !unclassified.includes(it.exerciseName)) unclassified.push(it.exerciseName); return; }
    const n = Number(it.series) || 0;
    c.groups.forEach(([g, fr]) => {
      sets[g] = (sets[g] || 0) + n * fr;
      (have[g] = have[g] || []).push(`${it.exerciseName} (Ficha ${t.ficha})`);
    });
    if (c.type === 'push') push += n;
    if (c.type === 'pull') pull += n;
  }));
  return { sets, have, push, pull, unclassified };
}

const OBJECTIVE_TIPS = {
  emagrecimento: 'Emagrecimento: use os corretivos como estações do circuito, com carga leve e execução controlada — não aumenta o tempo da sessão.',
  fortalecimento: 'Fortalecimento: inclua 2 a 3 corretivos por sessão, com 2 a 3 séries, sem abrir mão da qualidade técnica; mantenha a carga dos exercícios principais da fase.',
  hipertrofia: 'Hipertrofia: os grupos prioritários contam para as ≥10 séries semanais por grupamento (ACSM 2026) — redistribua séries em vez de somar sessões extras.',
  manutencao: 'Qualidade de vida: postura e equilíbrio entram como prioridade — 1 a 2 corretivos por sessão, com progressão gradual.',
  resistencia: 'Resistência muscular localizada: encaixe os corretivos como estações de baixa carga e mais repetições.',
};

// ---------- Cruzamento ----------
// evaluation: avaliação postural mais recente; physicalEvaluation: avaliação física mais recente
// (ou null); templates: Fichas A–E; guidance: guia de carga efetivo (fase ativa ou tabela) ou null.
function crossPosture({ evaluation, student, physicalEvaluation, templates, guidance, periodizationLabel, age }) {
  const findings = (evaluation?.findings || []).filter((f) => FINDING_BY_KEY[f.key] && f.severity > 0);
  const score = { s: {}, m: {} };
  const why = { s: {}, m: {} };
  const alerts = [];
  const cautions = [];
  const cues = [];
  const structural = [];

  findings.forEach((f) => {
    const def = FINDING_BY_KEY[f.key];
    const tag = `${def.label}${f.side && SIDE_LABELS[f.side] ? ' (' + SIDE_LABELS[f.side] + ')' : ''} — ${SEVERITY_LABELS[f.severity].toLowerCase()}`;
    (def.s || []).forEach(([g, w]) => { score.s[g] = (score.s[g] || 0) + f.severity * w; (why.s[g] = why.s[g] || []).push(tag); });
    (def.m || []).forEach(([g, w]) => { score.m[g] = (score.m[g] || 0) + f.severity * w; (why.m[g] = why.m[g] || []).push(tag); });
    if (def.alertAny) alerts.push(def.alertAny);
    if (def.alertAt2 && f.severity >= 2) alerts.push(def.alertAt2);
    if (def.alertAt3 && f.severity >= 3) alerts.push(def.alertAt3);
    if (def.cue) cues.push(def.cue);
    if (def.structural) structural.push(def.label);
  });

  // Cuidados com a coluna (osteoporose/osteopenia na Anamnese; hipercifose acentuada em 55+)
  const spineFindings = findings.filter((f) => FINDING_BY_KEY[f.key].spine);
  const osteo = student?.anamnesis?.answers?.osteoporose === true;
  if (osteo && spineFindings.length) {
    cautions.push('A Anamnese indica osteoporose/osteopenia: priorize extensão de coluna com amplitude controlada, evite flexão de tronco sob carga e rotações forçadas, e confirme a liberação médica para o treino de força.');
  }
  const kyph = findings.find((f) => f.key === 'hipercifose');
  if (kyph && kyph.severity >= 3 && age != null && age >= 55) {
    alerts.push('Hipercifose acentuada aos 55+: considere encaminhamento médico para avaliação antes de progredir cargas na coluna.');
  }

  const cov = coverageFromTemplates(templates);

  // Guia de séries/repetições para os corretivos (máx. 3 séries; 8 a 15 repetições)
  const mid = (r) => (r ? Math.round((r[0] + r[1]) / 2) : null);
  const defSeries = guidance ? Math.max(2, Math.min(3, mid(guidance.series))) : 3;
  const defReps = guidance ? Math.max(8, Math.min(15, mid(guidance.reps))) : 12;
  const defRest = guidance ? Math.max(30, Math.min(90, mid(guidance.restSeconds))) : 60;

  const strengthen = Object.keys(score.s)
    .map((g) => ({ group: g, label: GROUP_LABELS[g], score: score.s[g], why: why.s[g] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((p) => {
      const sets = Math.round((cov.sets[p.group] || 0) * 10) / 10;
      const status = sets === 0 ? 'sem' : (sets < 6 ? 'baixa' : 'ok');
      const haveNames = (cov.have[p.group] || []);
      const suggestions = status === 'ok' ? [] : (EXERCISE_CATALOG[p.group] || [])
        .filter((e) => !haveNames.some((h) => normalizeName(h).includes(normalizeName(e.name))))
        .slice(0, 3)
        .map((e) => ({ name: e.name, unit: e.unit, series: e.series || defSeries, reps: e.reps || defReps, load: e.load || 0, restSeconds: defRest }));
      return { ...p, sets, status, have: haveNames, suggestions };
    });

  const mobilize = Object.keys(score.m)
    .map((g) => ({ group: g, label: GROUP_LABELS[g], score: score.m[g], why: why.m[g], how: MOBILITY_CATALOG[g] || '' }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Razão puxar:empurrar (prática comum de equilíbrio da cintura escapular)
  const shoulderKeys = ['cabeca_anteriorizada', 'ombro_protuso', 'hipercifose'];
  let pushPull = null;
  if (findings.some((f) => shoulderKeys.includes(f.key)) && (cov.push > 0 || cov.pull > 0)) {
    const low = cov.push > 0 && cov.pull / cov.push < 1;
    pushPull = { push: cov.push, pull: cov.pull, flag: low };
  }

  // Cruzamento com a Avaliação Física (trabalho necessário)
  const needs = physicalEvaluation?.workNeeds || [];
  let workNeedsNote = '';
  if (!physicalEvaluation) {
    workNeedsNote = 'Sem Avaliação Física registrada: o cruzamento usa só a avaliação postural, o objetivo e as Fichas.';
  } else if (needs.includes('postura')) {
    workNeedsNote = 'Na Avaliação Física, "Postura" está marcada como trabalho necessário — coerente com os achados.';
  } else if (findings.some((f) => f.severity >= 2)) {
    workNeedsNote = 'Há achados posturais moderados ou acentuados, mas "Postura" não está marcada em Trabalho necessário na Avaliação Física. Considere marcar na próxima avaliação.';
  }

  return {
    hasFindings: findings.length > 0,
    findings, strengthen, mobilize, alerts: Array.from(new Set(alerts)), cautions, cues, structural,
    pushPull, workNeedsNote,
    objectiveTip: OBJECTIVE_TIPS[student?.objective] || '',
    periodizationLabel: periodizationLabel || '',
    unclassified: cov.unclassified,
    fichasCount: (templates || []).filter((t) => (t.items || []).length).length,
  };
}

// Comparação entre duas avaliações posturais (variação por achado)
function compareEvaluations(prev, cur) {
  const map = (ev) => Object.fromEntries((ev?.findings || []).map((f) => [f.key, f.severity]));
  const a = map(prev);
  const b = map(cur);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => FINDING_BY_KEY[k]);
  return keys.map((key) => {
    const p = a[key] || 0;
    const c = b[key] || 0;
    let status = 'igual';
    if (!p && c) status = 'novo';
    else if (p && !c) status = 'resolvido';
    else if (c < p) status = 'melhorou';
    else if (c > p) status = 'piorou';
    return { key, label: FINDING_BY_KEY[key].label, prev: p, cur: c, status };
  });
}

// ---------- Geometria das medidas na foto ----------
// Pontos normalizados (0–1); w/h = dimensões da imagem exibida (corrigem a proporção).
function inclinationFromHorizontal(p1, p2, w, h) {
  const dx = Math.abs((p2.x - p1.x) * w);
  const dy = Math.abs((p2.y - p1.y) * h);
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
function inclinationFromVertical(p1, p2, w, h) {
  return 90 - inclinationFromHorizontal(p1, p2, w, h);
}
// Ângulo no vértice v entre os segmentos v→p1 e v→p2 (0–180°)
function angleAtVertex(p1, v, p2, w, h) {
  const a = { x: (p1.x - v.x) * w, y: (p1.y - v.y) * h };
  const b = { x: (p2.x - v.x) * w, y: (p2.y - v.y) * h };
  const dot = a.x * b.x + a.y * b.y;
  const na = Math.hypot(a.x, a.y);
  const nb = Math.hypot(b.x, b.y);
  if (!na || !nb) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (na * nb)))) * 180 / Math.PI;
}
function fitSize(w, h, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

window.PosturalLogic = {
  POSTURE_FINDINGS, FINDING_BY_KEY, GROUP_LABELS, SEVERITY_LABELS, SIDE_LABELS, EXERCISE_CATALOG, MOBILITY_CATALOG,
  normalizeName, classifyExercise, coverageFromTemplates, crossPosture, compareEvaluations,
  inclinationFromHorizontal, inclinationFromVertical, angleAtVertex, fitSize,
};
