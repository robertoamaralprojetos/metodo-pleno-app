// Periodização — sequência de fases sugerida pelo "Roteiro Fisiológico de Progressão no
// Treinamento de Musculação" (Partes 2 a 5): perfil de entrada + objetivo + faixa etária (+ gênero).
//
// O app SUGERE; o personal aceita (podendo escolher a fase inicial), recusa ou encerra.
// Regra de precedência combinada: quando as camadas conflitam, a FAIXA ETÁRIA vence a fase
// e o %1RM (ex.: fase de força máxima não é sugerida acima de 85% de 1RM para 51+).
// Tudo é regra local e transparente — cada ajuste aparece com o motivo.

// ---------- Dados do roteiro (Parte 3) ----------
// stage = estágio de treino do app (adaptacao/intermediario/avancado) que a fase representa.
// methods: {t, failure} — failure=true marca métodos que levam a série até a falha.
const ROTEIRO = {
  emagrecimento: {
    label: 'Emagrecimento', cyclic: false,
    phases: [
      { n: 1, name: 'Adaptação Metabólica (RML inicial)', method: 'Circuito Metabólico de Adaptação (CMA)', pct: [40, 50], series: [2, 3], reps: [15, 20], rest: [30, 45], weeks: [4, 6], stage: 'adaptacao', methods: [{ t: 'Circuito' }, { t: 'alternado por segmento' }] },
      { n: 2, name: 'RML com componente aeróbio', method: 'Circuito de Base Aeróbia-Muscular (CBAM)', pct: [30, 40], series: [2, 3], reps: [18, 25], rest: [20, 30], weeks: [4, 6], stage: 'adaptacao', methods: [{ t: 'Circuito por estações' }] },
      { n: 3, name: 'Treinamento Intervalado de Resistência', method: 'TIR (nível intermediário)', pct: [50, 65], series: [3, 4], reps: [12, 20], rest: [30, 45], weeks: [4, 6], stage: 'intermediario', methods: [{ t: 'Bi-set' }, { t: 'circuito' }] },
      { n: 4, name: 'Método Metabólico de Alta Densidade', method: 'MMAD (avançado — opcional)', pct: [55, 70], series: [4, 5], reps: [12, 20], rest: [20, 40], weeks: [3, 4], stage: 'avancado', optional: true, methods: [{ t: 'Superséries' }, { t: 'circuito de alta densidade' }] },
    ],
    maintenance: 'Manutenção: ondular entre as Fases 2 e 3 a cada 4–6 semanas, sempre associado a déficit calórico nutricional adequado (fora do escopo do app). Reavaliar 1RM a cada ciclo.',
  },
  fortalecimento: {
    label: 'Fortalecimento Muscular', cyclic: false,
    phases: [
      { n: 1, name: 'Adaptação Neural', method: 'Base Neural Progressiva (BNP)', pct: [50, 60], series: [2, 3], reps: [10, 12], rest: [60, 90], weeks: [4, 8], stage: 'adaptacao', methods: [{ t: 'Alternado por segmento' }] },
      { n: 2, name: 'Progressão de Força Ondulatória', method: 'PFO', pct: [70, 80], series: [3, 4], reps: [6, 10], rest: [90, 120], weeks: [4, 6], stage: 'intermediario', methods: [{ t: 'Pirâmide crescente' }, { t: 'agonista-antagonista' }] },
      { n: 3, name: 'Bloco de Força Máxima', method: 'BFM (avançado)', pct: [85, 95], series: [4, 6], reps: [1, 6], rest: [180, 300], weeks: [3, 4], stage: 'avancado', methods: [{ t: 'Séries diretas' }, { t: 'agonista-antagonista' }] },
    ],
    maintenance: 'Manutenção: ciclos de 3–4 semanas em blocos de força alternados com blocos de volume moderado; macrociclo de 3–6 meses com deload a cada 4–6 semanas.',
  },
  hipertrofia: {
    label: 'Aumento de Massa Muscular (Hipertrofia)', cyclic: false,
    phases: [
      { n: 1, name: 'Adaptação Anatômica / RML', method: 'Estímulo de Iniciação Muscular (EIM)', pct: [50, 65], series: [2, 3], reps: [10, 15], rest: [60, 60], weeks: [4, 6], stage: 'adaptacao', methods: [{ t: 'Alternado por segmento' }] },
      { n: 2, name: 'Força de Base (eleva o teto de carga)', method: 'Força de Base', pct: [50, 70], series: [3, 4], reps: [8, 12], rest: [90, 90], weeks: [4, 6], stage: 'intermediario', methods: [{ t: 'Agonista-antagonista' }] },
      { n: 3, name: 'Hipertrofia Inicial (volume moderado)', method: 'MSPO', pct: [65, 80], series: [3, 4], reps: [8, 12], rest: [60, 90], weeks: [4, 6], stage: 'intermediario', methods: [{ t: 'Pirâmide' }, { t: 'pré-exaustão introdutória', failure: true }], note: 'ACSM 2026: priorizar chegar progressivamente a ≥10 séries semanais por grupamento pesa mais no resultado do que um %1RM exato.' },
      { n: 4, name: 'Hipertrofia Consolidada / Alto Volume', method: 'MSVB (avançado)', pct: [65, 85], series: [4, 5], reps: [6, 15], rest: [60, 90], weeks: [3, 4], stage: 'avancado', methods: [{ t: 'Bi-set / tri-set' }, { t: 'pré e pós-exaustão', failure: true }, { t: 'drop-set', failure: true }], note: 'ACSM 2026: priorizar chegar progressivamente a ≥10 séries semanais por grupamento pesa mais no resultado do que um %1RM exato.' },
    ],
    maintenance: 'Manutenção/avançado: alternar blocos de força (Fase 2) com blocos de hipertrofia (Fases 3–4) em periodização conjugada, ciclos de 3–4 semanas, deload a cada 4–6 semanas.',
  },
  manutencao: {
    label: 'Melhorar Qualidade de Vida', cyclic: true,
    phases: [
      { n: 1, name: 'Ativação Funcional e Equilíbrio', method: 'Programa de Ativação Funcional Básica (PAFB)', pct: [40, 50], pctText: 'RPE 3–5/10 (≈40–50% quando aplicável)', series: [2, 2], reps: [12, 15], rest: [60, 60], weeks: [6, 8], stage: 'adaptacao', methods: [{ t: 'Série única / alternado por segmento' }] },
      { n: 2, name: 'Força Funcional Moderada', method: 'Programa de Manutenção Funcional Progressiva (PMFP)', pct: [50, 70], series: [2, 3], reps: [10, 15], rest: [60, 60], weeks: [6, 8], stage: 'intermediario', methods: [{ t: 'Alternado por segmento' }, { t: 'circuito' }], note: 'Cargas moderadas a moderadamente altas, não só leves: o treino de força é o pilar de prevenção de sarcopenia e osteoporose (NSCA).' },
    ],
    maintenance: 'Sem prazo definido: ondular entre as Fases 1 e 2 permanentemente, com reavaliação a cada 3 meses.',
  },
};

// ---------- Perfil de entrada (Parte 2) ----------
const PROFILE_LABELS = {
  sedentario: 'Sedentário, sem histórico',
  destreinado: 'Já treinou, destreinado',
  ativo: 'Já fisicamente ativo',
};

// ---------- Faixas etárias (Parte 5) ----------
// adaptWeeks: duração mínima da adaptação inicial; adaptAppliesTo: 'sedentario' (só se sedentário)
// ou 'todos'. capPct = teto de %1RM; capPctHyper = faixa de %1RM na hipertrofia; restMin/restMax
// em segundos (força e hipertrofia); forceStartF1 = sempre começa pela fase de adaptação.
const AGE_BANDS = [
  { key: '15-17', min: 15, max: 17, label: '15 a 17 anos', adaptWeeks: [8, 8], adaptAppliesTo: 'todos', direct1RM: false, repsClamp: [8, 15], noFailure: true, forceStartF1: true,
    notes: ['Ênfase máxima em técnica e padrões motores; supervisão constante.', 'Progressão de carga só após consolidação técnica (NSCA — treino resistido em jovens).', 'Evitar treino até a falha.'] },
  { key: '18-20', min: 18, max: 20, label: '18 a 20 anos', adaptWeeks: [4, 6], adaptAppliesTo: 'sedentario',
    notes: ['Janela de resposta neural rápida: bom momento para consolidar a técnica antes de blocos avançados.'] },
  { key: '21-30', min: 21, max: 30, label: '21 a 30 anos', adaptWeeks: [4, 6], adaptAppliesTo: 'sedentario',
    notes: ['Blocos avançados bem tolerados sem restrições adicionais.'] },
  { key: '31-40', min: 31, max: 40, label: '31 a 40 anos', adaptWeeks: [4, 6], adaptAppliesTo: 'sedentario',
    notes: ['Protocolo padrão; atenção proativa à saúde articular nos exercícios de maior impacto axial.', 'Deload a cada 4–6 semanas passa a ser recomendado.'] },
  { key: '41-50', min: 41, max: 50, label: '41 a 50 anos', adaptWeeks: [4, 6], adaptAppliesTo: 'sedentario',
    notes: ['Manter o treino de força como prioridade; reforçar aquecimento e controle técnico.'] },
  { key: '51-60', min: 51, max: 60, label: '51 a 60 anos', adaptWeeks: [6, 6], adaptAppliesTo: 'sedentario', capPct: 85,
    notes: ['Cargas de 70–85% de 1RM para força seguem seguras na ausência de contraindicação médica.', 'Priorizar multiarticulares de baixo impacto, controlar a fase excêntrica, aquecimento mais longo.', 'Deload a cada 4 semanas.'] },
  { key: '61-70', min: 61, max: 70, label: '61 a 70 anos', adaptWeeks: [6, 8], adaptAppliesTo: 'todos', capPct: 85, capPctHyper: [51, 69], noFailure: true, restMin: 90, restMax: 180,
    notes: ['Referências NSCA: força 70–85% de 1RM, 2–3x/semana; potência 40–60% de 1RM com concêntrica rápida; hipertrofia 51–69% de 1RM.', 'Nunca treinar até a falha concêntrica; descanso de 1,5 a 3 minutos em treino de força.'] },
  { key: '71+', min: 71, max: 200, label: '71 anos ou mais', adaptWeeks: [8, 12], adaptAppliesTo: 'todos', direct1RM: false, initialPct: [20, 30], capPct: 85, capPctHyper: [51, 69], noFailure: true, restMin: 90, restMax: 180, forceStartF1: true, medicalRequired: true,
    notes: ['Iniciar por RPE/RM submáximo, com 20–30% de 1RM e progressão conservadora até as faixas de 61–70 anos, quando possível.', 'Priorizar técnica e segurança. Programas bem supervisionados têm risco muito baixo de eventos adversos.'] },
];

function ageBandFor(age) {
  if (age == null) return null;
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max) || null;
}

// ---------- Utilitários ----------
function fmtRange(r, suffix = '') {
  if (!r) return '—';
  return (r[0] === r[1] ? `${r[0]}` : `${r[0]}–${r[1]}`) + suffix;
}
function fmtSeconds(s) {
  return s < 90 ? `${s} s` : `${String(s / 60).replace('.', ',')} min`;
}
function fmtRest(r) {
  if (!r) return '—';
  return r[0] === r[1] ? fmtSeconds(r[0]) : `${fmtSeconds(r[0])}–${fmtSeconds(r[1])}`;
}
function clampRange(r, lo, hi) {
  const a = Math.max(r[0], lo);
  const b = Math.min(r[1], hi);
  return a <= b ? [a, b] : null;
}
function maxRange(a, b) { return [Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
function sameRange(a, b) { return a[0] === b[0] && a[1] === b[1]; }

// ---------- Ajuste de UMA fase pela faixa etária (precedência da idade) ----------
function adjustPhase(phase, band, objective, isStart) {
  const out = { ...phase, notes: [], blocked: false, blockReason: '' };
  let pct = phase.pct.slice();
  let reps = phase.reps.slice();
  let rest = phase.rest.slice();
  let methods = (phase.methods || []).slice();
  const block = (reason) => { out.blocked = true; out.blockReason = reason; };

  if (band) {
    // %1RM
    if (band.initialPct && isStart && phase.n === 1) {
      pct = band.initialPct.slice();
      out.notes.push('Iniciar com 20–30% de 1RM (ou RPE 3–4/10) e progredir de forma conservadora.');
    } else if (band.capPctHyper && objective === 'hipertrofia') {
      const r = clampRange(pct, band.capPctHyper[0], band.capPctHyper[1]);
      if (!r) block(`%1RM fora da faixa de ${fmtRange(band.capPctHyper, '%')} indicada para ${band.label}.`);
      else if (!sameRange(r, pct)) { pct = r; out.notes.push(`%1RM ajustado para ${fmtRange(r, '%')} (faixa de hipertrofia para ${band.label}).`); }
    } else if (band.capPct) {
      if (pct[0] >= band.capPct) block(`%1RM (${fmtRange(phase.pct, '%')}) acima do teto de ${band.capPct}% para ${band.label}.`);
      else if (pct[1] > band.capPct) { pct = [pct[0], band.capPct]; out.notes.push(`%1RM limitado a ${band.capPct}% pela faixa etária (${band.label}).`); }
    }
    // repetições
    if (band.repsClamp) {
      const r = clampRange(reps, band.repsClamp[0], band.repsClamp[1]);
      if (!r) block(`Repetições (${fmtRange(phase.reps)}) fora de ${fmtRange(band.repsClamp)} para ${band.label}.`);
      else if (!sameRange(r, reps)) { reps = r; out.notes.push(`Repetições limitadas a ${fmtRange(r)} (${band.label}).`); }
    }
    // métodos até a falha
    if (band.noFailure) {
      const removed = methods.filter((m) => m.failure).map((m) => m.t);
      if (removed.length) {
        methods = methods.filter((m) => !m.failure);
        out.notes.push(`Métodos até a falha removidos (${removed.join(', ')}): não recomendados para ${band.label}.`);
      }
    }
    // descanso
    if (band.restMin && (objective === 'fortalecimento' || objective === 'hipertrofia')) {
      const r = [Math.min(Math.max(rest[0], band.restMin), band.restMax), Math.min(Math.max(rest[1], band.restMin), band.restMax)];
      if (!sameRange(r, rest)) { rest = r; out.notes.push(`Descanso ajustado para ${fmtRest(r)} (NSCA: 1,5 a 3 min em treino de força nesta faixa).`); }
    } else if (band.restMin && rest[1] < band.restMin) {
      out.notes.push('Descanso curto (circuito): monitorar resposta (pressão, frequência cardíaca, tontura). A NSCA sugere 1,5 a 3 min em treino de força nesta faixa.');
    }
    if (band.direct1RM === false) out.notes.push('Evitar teste de 1RM direto: estimar a carga por RM submáximo (8–12RM) ou RPE.');
  }

  out.pct = pct; out.reps = reps; out.rest = rest;
  out.methodsText = methods.map((m) => m.t).join(' · ');
  out.pctText = phase.pctText && sameRange(pct, phase.pct) ? phase.pctText : fmtRange(pct, '% 1RM');
  return out;
}

// ---------- Motor de sugestão ----------
function suggestPeriodization(student, todayISO) {
  const res = { status: 'ok', missing: [], warnings: [], notes: [] };
  if (!student) return { status: 'missing', missing: ['aluno'], warnings: [], notes: [] };

  const objective = student.objective || null;
  const entry = student.anamnesis?.entryProfile || null;
  const pauseMonths = student.anamnesis?.pauseMonths ?? null;
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, todayISO) : null;
  const band = ageBandFor(age);

  Object.assign(res, { objective, entry, pauseMonths, age, band, sex: student.sex || null });

  if (age == null) res.missing.push({ what: 'Data de nascimento', where: 'aba Cadastro do Aluno' });
  else if (!band) res.missing.push({ what: `Faixa etária (${age} anos) fora da coberta pelo roteiro (a partir de 15 anos)`, where: 'aba Cadastro do Aluno' });
  if (!objective) res.missing.push({ what: 'Objetivo do aluno', where: 'aba Planejar Aula' });
  if (!entry) res.missing.push({ what: 'Perfil de entrada no treino', where: 'aba Anamnese (pergunta 10)' });
  if (res.missing.length) { res.status = 'missing'; return res; }

  const seq = ROTEIRO[objective];
  if (!seq) {
    res.status = 'unsupported';
    res.message = 'O roteiro não tem sequência para o objetivo "Resistência Muscular Localizada". Escolha outro objetivo em Planejar Aula ou siga com o Estágio e o guia de 1RM manualmente.';
    return res;
  }
  res.sequence = seq;

  // Fase inicial e duração da adaptação (Partes 2 e 5)
  let startIndex = 0;
  let weeks0 = seq.phases[0].weeks.slice();
  if (entry === 'sedentario') {
    weeks0 = maxRange(weeks0, [6, 8]);
  } else if (entry === 'destreinado') {
    if (pauseMonths == null) { weeks0 = [3, 4]; res.warnings.push('Informe o tempo de pausa na Anamnese para calibrar a adaptação inicial (usei 3 a 4 semanas).'); }
    else if (pauseMonths < 3) weeks0 = [1, 2];
    else if (pauseMonths <= 12) weeks0 = [3, 4];
    else { weeks0 = [6, 8]; res.notes.push('Pausa acima de 12 meses: o roteiro não define esse caso; usei a adaptação completa (como sedentário). Ajuste se achar melhor.'); }
    if (pauseMonths != null && pauseMonths > 6) res.warnings.push('Pausa maior que 6 meses: reavaliar a técnica do zero, mesmo reduzindo a duração da fase.');
  } else if (entry === 'ativo') {
    if (objective === 'manutencao') weeks0 = [2, 4];
    else { startIndex = 1; res.notes.push('Ponte técnica: 1 a 2 semanas de adaptação específica à musculação antes de assumir cargas de força ou hipertrofia, mesmo para quem já é ativo.'); }
  }

  if (band.forceStartF1) {
    startIndex = 0;
    weeks0 = entry === 'sedentario' ? maxRange(weeks0, band.adaptWeeks) : maxRange(seq.phases[0].weeks, band.adaptWeeks);
    res.warnings.push(`Faixa etária de ${band.label}: a periodização começa pela fase de adaptação, qualquer que seja o perfil de entrada.`);
  } else if (band.adaptAppliesTo === 'todos' && startIndex === 0) {
    weeks0 = maxRange(weeks0, band.adaptWeeks);
  } else if (band.adaptAppliesTo === 'sedentario' && entry === 'sedentario') {
    weeks0 = maxRange(weeks0, band.adaptWeeks);
  }
  if (entry === 'ativo' && startIndex === 1 && band.adaptAppliesTo === 'todos') {
    res.warnings.push(`A faixa de ${band.label} recomenda adaptação de ${fmtRange(band.adaptWeeks)} semanas: confirme o nível técnico avaliado antes de assumir a Fase 2.`);
  }
  if (band.medicalRequired) res.warnings.push('Avaliação médica prévia obrigatória para esta faixa etária (Parte 5 do roteiro).');

  res.phases = seq.phases.map((p, i) => {
    const adj = adjustPhase(p, band, objective, i === startIndex);
    if (i === 0) adj.weeks = weeks0;
    return adj;
  });
  res.startIndex = startIndex;
  if (res.phases[startIndex].blocked) {
    const firstOk = res.phases.findIndex((p) => !p.blocked);
    res.startIndex = firstOk >= 0 ? firstOk : 0;
  }

  // Duração total estimada até a última fase recomendada
  if (!seq.cyclic) {
    const usable = res.phases.slice(res.startIndex).filter((p) => !p.blocked);
    res.totalWeeks = [usable.reduce((s, p) => s + p.weeks[0], 0), usable.reduce((s, p) => s + p.weeks[1], 0)];
  }

  // Notas de faixa etária, gênero e manutenção
  res.bandNotes = band.notes.slice();
  res.genderNote = res.sex === 'M'
    ? 'Gênero: a ordem das fases e o %1RM são iguais para homens e mulheres. Só se o treino for monitorado por velocidade, o critério de queda de velocidade costuma ser ≈20% em homens.'
    : 'Gênero: a ordem das fases e o %1RM são iguais para homens e mulheres. Mulheres podem tolerar frequência semanal levemente maior por grupamento; com monitoramento de velocidade, o critério de queda costuma ser ≈40%.';
  res.maintenance = seq.maintenance;
  return res;
}

// ---------- Guia de carga efetivo (fase ativa > tabela estágio×objetivo, sempre com teto de idade) ----------
function capGuidanceByAge(guidance, band, objective) {
  if (!guidance || !band) return { guidance, capped: false };
  let pct = guidance.pct.slice();
  if (band.capPctHyper && objective === 'hipertrofia') {
    pct = [Math.max(pct[0], band.capPctHyper[0]), Math.min(pct[1], band.capPctHyper[1])];
    if (pct[0] > pct[1]) pct = band.capPctHyper.slice();
  } else if (band.capPct) {
    pct = [Math.min(pct[0], band.capPct), Math.min(pct[1], band.capPct)];
  }
  const capped = !sameRange(pct, guidance.pct);
  return { guidance: { ...guidance, pct }, capped };
}

function activePeriodization() {
  return (AppState.data.periodizations || []).find((p) => p.status === 'ativa') || null;
}

function effectiveGuidance(student) {
  if (!student) return null;
  const active = activePeriodization();
  if (active) {
    const ph = active.phases[active.currentIndex];
    if (ph) {
      return {
        source: 'periodizacao',
        label: `Fase ${ph.n} · ${ph.method}`,
        guidance: { metodologia: ph.method, series: ph.series, reps: ph.reps, pct: ph.pct, restSeconds: ph.rest },
        capped: false,
      };
    }
  }
  if (!student.stage || !student.objective) return null;
  const base = oneRmGuidance(student.stage, student.objective);
  if (!base) return null;
  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, Utils.todayISO()) : null;
  const capped = capGuidanceByAge(base, ageBandFor(age), student.objective);
  return {
    source: 'tabela',
    label: `${stageLabel(student.stage)} · ${objectiveLabel(student.objective)} (${base.metodologia})${capped.capped ? ' — %1RM limitado pela faixa etária' : ''}`,
    guidance: capped.guidance,
    capped: capped.capped,
  };
}

// Aviso sobre teste de 1RM direto conforme a faixa etária (Parte 5).
function oneRmAgeWarning(student) {
  const age = student?.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate, Utils.todayISO()) : null;
  const band = ageBandFor(age);
  if (band && band.direct1RM === false) {
    return `Faixa etária de ${band.label}: o roteiro recomenda evitar teste de 1RM direto — estime a carga por RM submáximo (8–12RM) ou RPE. O teste continua disponível, a critério do profissional.`;
  }
  return '';
}

function weeksSince(startISO, todayISO) {
  const ms = new Date(todayISO + 'T00:00:00') - new Date(startISO + 'T00:00:00');
  return Math.max(1, Math.floor(ms / 86400000 / 7) + 1);
}

function nextIndex(phases, from, dir) {
  for (let i = from + dir; i >= 0 && i < phases.length; i += dir) {
    if (!phases[i].blocked) return i;
  }
  return -1;
}

window.PeriodizationLogic = {
  ROTEIRO, AGE_BANDS, PROFILE_LABELS,
  ageBandFor, suggest: suggestPeriodization, effectiveGuidance, capGuidanceByAge,
  oneRmAgeWarning, activePeriodization, weeksSince, nextIndex, fmtRange, fmtRest,
};

// =====================================================================================
// Aba "Periodização"
// =====================================================================================

function perPill(text, cls = 'mp-pill-neutro') { return `<span class="mp-pill ${cls}">${Utils.escapeHtml(text)}</span>`; }

function perPhaseStatusText(rec, today) {
  const ph = rec.phases[rec.currentIndex];
  const w = weeksSince(rec.phaseStartDate, today);   // semana corrente (1 = primeira semana)
  const done = w - 1;                                  // semanas já completas
  if (ROTEIRO[rec.objective]?.cyclic) return `Semana ${w} · ciclo contínuo (reavaliar a cada 3 meses)`;
  if (done < ph.weeks[0]) return `Semana ${w} · janela recomendada da fase: ${fmtRange(ph.weeks)} semanas`;
  if (done < ph.weeks[1]) return `Semana ${w} · janela mínima cumprida — avalie o avanço para a próxima fase`;
  return `Semana ${w} · prazo máximo da fase atingido — recomenda-se avançar ou reavaliar`;
}

// Selo curto (Registro de Treino e Planejar Aula): fase atual da periodização ativa.
function perPhasePillHtml() {
  const rec = activePeriodization();
  if (!rec) return '';
  const ph = rec.phases[rec.currentIndex];
  if (!ph) return '';
  const w = weeksSince(rec.phaseStartDate, Utils.todayISO());
  const total = ROTEIRO[rec.objective]?.cyclic ? '' : `/${rec.phases.length}`;
  return `<span class="mp-pill mp-pill-leve" title="${Utils.escapeHtml(ph.name)}">Periodização: Fase ${ph.n}${total} · ${Utils.escapeHtml(ph.method.split(' (')[0])} · semana ${w}</span>`;
}

function perPhasesTableHtml(phases, { currentIndex = -1, startIndex = -1 } = {}) {
  const rows = phases.map((p, i) => {
    const marker = i === currentIndex ? ' <span class="mp-pill mp-pill-leve">atual</span>'
      : (i === startIndex ? ' <span class="mp-pill mp-pill-moderado">início sugerido</span>' : '');
    const status = p.blocked ? ' <span class="mp-pill mp-pill-alto">não recomendada</span>' : (p.optional ? ' <span class="mp-pill mp-pill-neutro">opcional</span>' : '');
    const noteLines = [...(p.notes || []), ...(p.blocked ? [p.blockReason] : []), ...(p.note ? [p.note] : [])];
    return `
      <tr style="${p.blocked ? 'opacity:.6;' : ''}${i === currentIndex ? 'background:var(--verde-pallido);' : ''}">
        <td><strong>Fase ${p.n}</strong> — ${Utils.escapeHtml(p.name)}${marker}${status}
          <div style="font-size:12px;color:var(--texto-suave);">${Utils.escapeHtml(p.method)} · ${Utils.escapeHtml(stageLabel(p.stage))}</div>
          ${p.methodsText ? `<div style="font-size:12px;color:var(--texto-suave);">${Utils.escapeHtml(p.methodsText)}</div>` : ''}
          ${noteLines.map((n) => `<div style="font-size:12px;color:var(--dourado-escuro);margin-top:2px;">• ${Utils.escapeHtml(n)}</div>`).join('')}
        </td>
        <td>${Utils.escapeHtml(p.pctText || fmtRange(p.pct, '%'))}</td>
        <td>${fmtRange(p.series)}</td>
        <td>${fmtRange(p.reps)}</td>
        <td>${fmtRest(p.rest)}</td>
        <td>${fmtRange(p.weeks)} sem</td>
      </tr>`;
  }).join('');
  return `
    <div class="mp-table-scroll">
    <table class="mp-table">
      <thead><tr><th>Fase</th><th>% 1RM</th><th>Séries</th><th>Reps</th><th>Descanso</th><th>Duração</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>`;
}

function perContextHtml(sug) {
  const student = currentStudent();
  const pills = [];
  pills.push(perPill(sug.age != null ? `${sug.age} anos${sug.band ? ' · ' + sug.band.label : ''}` : 'Idade não informada'));
  pills.push(perPill(`Sexo: ${student?.sex === 'M' ? 'Masculino' : 'Feminino'}`));
  pills.push(perPill(`Objetivo: ${sug.objective ? objectiveLabel(sug.objective) : 'não definido'}`));
  pills.push(perPill(`Perfil de entrada: ${sug.entry ? PROFILE_LABELS[sug.entry] + (sug.entry === 'destreinado' && sug.pauseMonths != null ? ` (${sug.pauseMonths} meses)` : '') : 'não informado'}`));
  pills.push(perPill(`Estágio atual: ${stageLabel(student?.stage)}`, 'mp-pill-moderado'));
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">${pills.join('')}</div>`;
}

function perListHtml(items, cls) {
  return items.length ? `<div class="mp-inline-alert ${cls}" style="margin-top:10px;">${items.map((t) => `<div>• ${Utils.escapeHtml(t)}</div>`).join('')}</div>` : '';
}

function perHistoryHtml() {
  const list = [...(AppState.data.periodizations || [])].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  if (!list.length) return '';
  const rows = list.map((r) => {
    const statusPill = r.status === 'ativa' ? perPill('Ativa', 'mp-pill-leve') : (r.status === 'recusada' ? perPill('Recusada', 'mp-pill-alto') : perPill('Encerrada'));
    const decisions = (r.decisions || []).map((d) => `${Utils.formatDateBR(d.date)} — ${Utils.escapeHtml(d.text)}`).join('<br>');
    return `<tr>
      <td>${Utils.formatDateBR((r.createdAt || '').slice(0, 10))}</td>
      <td>${statusPill}</td>
      <td>${Utils.escapeHtml(objectiveLabel(r.objective))}</td>
      <td style="font-size:12.5px;">${decisions}</td>
    </tr>`;
  }).join('');
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>Histórico de decisões</h3>
    <div class="mp-table-scroll"><table class="mp-table">
      <thead><tr><th>Data</th><th>Situação</th><th>Objetivo</th><th>Decisões</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function perRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';
  const today = Utils.todayISO();
  const active = activePeriodization();
  const sug = suggestPeriodization(student, today);

  const header = `
  <div class="mp-card">
    <h3>Periodização — Roteiro Fisiológico de Progressão</h3>
    <div class="mp-sub">Sequência de fases sugerida a partir do perfil de entrada, objetivo, faixa etária e gênero. O app sugere; você aceita, ajusta a fase inicial ou recusa.</div>
    ${perContextHtml(sug)}
  </div>`;

  // ----- Periodização ativa -----
  if (active) {
    const ph = active.phases[active.currentIndex];
    const cyclic = ROTEIRO[active.objective]?.cyclic;
    const prev = nextIndex(active.phases, active.currentIndex, -1);
    const next = nextIndex(active.phases, active.currentIndex, +1);
    const nextLabel = cyclic
      ? (next >= 0 ? `Alternar para a Fase ${active.phases[next].n}` : (prev >= 0 ? `Alternar para a Fase ${active.phases[prev].n}` : ''))
      : (next >= 0 ? `Avançar para a Fase ${active.phases[next].n} ▶` : '');
    const notes = [...(active.warnings || []), ...(active.notes || [])];
    return `${header}
  <div class="mp-card" style="margin-top:20px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
      <div>
        <div class="mp-eyebrow" style="color:var(--dourado-escuro);">Estágio de treino conforme a periodização</div>
        <h3 style="margin:4px 0 2px;">Fase ${ph.n}${cyclic ? '' : ' de ' + active.phases.length} — ${Utils.escapeHtml(ph.name)}</h3>
        <div class="mp-sub" style="margin:0;">${Utils.escapeHtml(ph.method)} · estágio: <strong>${Utils.escapeHtml(stageLabel(ph.stage))}</strong> · iniciada em ${Utils.formatDateBR(active.phaseStartDate)}</div>
      </div>
      ${perPill(perPhaseStatusText(active, today), 'mp-pill-moderado')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;">
      ${perPill('%1RM: ' + (ph.pctText || fmtRange(ph.pct, '%')), 'mp-pill-leve')}
      ${perPill('Séries: ' + fmtRange(ph.series), 'mp-pill-leve')}
      ${perPill('Reps: ' + fmtRange(ph.reps), 'mp-pill-leve')}
      ${perPill('Descanso: ' + fmtRest(ph.rest), 'mp-pill-leve')}
    </div>
    ${perPhasesTableHtml(active.phases, { currentIndex: active.currentIndex })}
    ${perListHtml(notes, 'mp-inline-alert-moderado')}
    <div class="mp-sub" style="margin:10px 0 0;">${Utils.escapeHtml(active.maintenance || '')}</div>
    <div class="mp-form-actions" style="justify-content:flex-start;margin-top:14px;">
      ${!cyclic && prev >= 0 ? `<button type="button" class="mp-btn mp-btn-ghost" id="per-prev">◀ Voltar à Fase ${active.phases[prev].n}</button>` : ''}
      ${nextLabel ? `<button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="per-next">${Utils.escapeHtml(nextLabel)}</button>` : ''}
      <button type="button" class="mp-btn mp-btn-outline" style="color:var(--alerta);border-color:var(--alerta);" id="per-end">Encerrar periodização</button>
    </div>
    <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">Ao mudar de fase, o Estágio de treino do aluno é atualizado e o guia de 1RM passa a usar os parâmetros da nova fase.</div>
  </div>
  ${perHistoryHtml()}`;
  }

  // ----- Sem periodização ativa: sugestão -----
  if (sug.status === 'missing') {
    return `${header}
  <div class="mp-card" style="margin-top:20px;">
    <h3>Faltam dados para sugerir a periodização</h3>
    <div class="mp-inline-alert mp-inline-alert-moderado" style="margin-top:10px;">
      ${sug.missing.map((m) => `<div>• ${Utils.escapeHtml(m.what)} — preencha na ${Utils.escapeHtml(m.where)}.</div>`).join('')}
    </div>
  </div>
  ${perHistoryHtml()}`;
  }
  if (sug.status === 'unsupported') {
    return `${header}
  <div class="mp-card" style="margin-top:20px;"><div class="mp-inline-alert mp-inline-alert-moderado">${Utils.escapeHtml(sug.message)}</div></div>
  ${perHistoryHtml()}`;
  }

  const startOptions = sug.phases.map((p, i) => `<option value="${i}" ${i === sug.startIndex ? 'selected' : ''} ${p.blocked ? 'disabled' : ''}>Fase ${p.n} — ${Utils.escapeHtml(p.method.split(' (')[0])}${p.blocked ? ' (não recomendada)' : ''}</option>`).join('');
  const lastRefusal = [...(AppState.data.periodizations || [])].filter((r) => r.status === 'recusada').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  return `${header}
  <div class="mp-card" style="margin-top:20px;">
    <h3>Sugestão do app</h3>
    <div class="mp-sub">Começar pela <strong>Fase ${sug.phases[sug.startIndex].n} — ${Utils.escapeHtml(sug.phases[sug.startIndex].name)}</strong>${sug.totalWeeks ? ` · duração estimada até a última fase recomendada: ${fmtRange(sug.totalWeeks)} semanas` : ' · ciclo contínuo entre as duas fases'}.</div>
    ${lastRefusal ? `<div class="mp-sub" style="margin-top:0;">Última sugestão recusada em ${Utils.formatDateBR((lastRefusal.createdAt || '').slice(0, 10))}${lastRefusal.refusalNote ? ' — ' + Utils.escapeHtml(lastRefusal.refusalNote) : ''}.</div>` : ''}
    ${perPhasesTableHtml(sug.phases, { startIndex: sug.startIndex })}
    ${perListHtml(sug.warnings, 'mp-inline-alert-alto')}
    ${perListHtml([...sug.notes, ...sug.bandNotes.map((n) => sug.band.label + ': ' + n), sug.genderNote], 'mp-inline-alert-moderado')}
    <div class="mp-sub" style="margin:10px 0 0;">${Utils.escapeHtml(sug.maintenance)}</div>

    <div class="mp-form-row mp-row3" style="margin-top:16px;">
      <div class="mp-field"><label>Fase inicial</label><select id="per-start">${startOptions}</select></div>
      <div class="mp-field"><label>Data de início</label><input type="date" id="per-date" value="${today}"></div>
      <div class="mp-field"><label>Motivo, se recusar (opcional)</label><input type="text" id="per-refuse-note" placeholder="Ex: prefiro outra abordagem por ora"></div>
    </div>
    <div class="mp-form-actions" style="justify-content:flex-start;">
      <button type="button" class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" id="per-accept">✓ Aceitar sugestão</button>
      <button type="button" class="mp-btn mp-btn-outline" style="color:var(--alerta);border-color:var(--alerta);" id="per-refuse">Recusar</button>
    </div>
    <div class="mp-sub" style="margin:10px 0 0;font-size:11.5px;">Ao aceitar, o Estágio de treino do aluno passa a acompanhar a fase e o guia de 1RM usa os parâmetros dela (já com os limites da faixa etária). Fonte: Roteiro Fisiológico de Progressão, Partes 2 a 5.</div>
  </div>
  ${perHistoryHtml()}`;
}

async function perSyncStage(stage) {
  if (!stage) return;
  await updateCurrentStudent({ stage });
  AppState.students = await StudentsData.listStudents();
}

function perBindEvents(container) {
  const student = currentStudent();
  if (!student) return;

  const acceptBtn = container.querySelector('#per-accept');
  if (acceptBtn) acceptBtn.addEventListener('click', async () => {
    const today = Utils.todayISO();
    const sug = suggestPeriodization(student, today);
    if (sug.status !== 'ok') return;
    const startIndex = parseInt(container.querySelector('#per-start').value, 10);
    if (sug.phases[startIndex]?.blocked) { Utils.toast('Esta fase não é recomendada para a faixa etária do aluno.', 'error'); return; }
    const startDate = container.querySelector('#per-date').value || today;
    const rec = {
      id: dbUuid(),
      studentId: AppState.currentId,
      status: 'ativa',
      createdAt: new Date().toISOString(),
      objective: sug.objective,
      entryProfile: sug.entry,
      pauseMonths: sug.pauseMonths,
      sex: sug.sex,
      ageAtStart: sug.age,
      bandKey: sug.band.key,
      suggestedStartIndex: sug.startIndex,
      startIndex,
      currentIndex: startIndex,
      phaseStartDate: startDate,
      phases: JSON.parse(JSON.stringify(sug.phases)),
      warnings: sug.warnings,
      notes: [...sug.notes, ...sug.bandNotes.map((n) => sug.band.label + ': ' + n), sug.genderNote],
      maintenance: sug.maintenance,
      decisions: [{ date: today, text: startIndex === sug.startIndex ? `Sugestão aceita — início na Fase ${sug.phases[startIndex].n}` : `Sugestão ajustada — início na Fase ${sug.phases[startIndex].n} (sugerida: Fase ${sug.phases[sug.startIndex].n})` }],
    };
    // encerra qualquer periodização ativa anterior
    const toSave = [];
    (AppState.data.periodizations || []).forEach((p) => {
      if (p.status === 'ativa') { p.status = 'encerrada'; p.decisions.push({ date: today, text: 'Substituída por nova periodização' }); toSave.push(p); }
    });
    AppState.data.periodizations.push(rec);
    await perSyncStage(rec.phases[startIndex].stage);
    render();
    Utils.toast('Periodização iniciada ✓ — estágio atualizado para ' + stageLabel(rec.phases[startIndex].stage), 'success');
    for (const p of toSave) await AppShell.guardedPut(DB.STORES.periodizations, p);
    await AppShell.guardedPut(DB.STORES.periodizations, rec);
  });

  const refuseBtn = container.querySelector('#per-refuse');
  if (refuseBtn) refuseBtn.addEventListener('click', async () => {
    const today = Utils.todayISO();
    const note = container.querySelector('#per-refuse-note').value.trim();
    const rec = {
      id: dbUuid(), studentId: AppState.currentId, status: 'recusada', createdAt: new Date().toISOString(),
      objective: student.objective, refusalNote: note,
      decisions: [{ date: today, text: 'Sugestão recusada' + (note ? ` — ${note}` : '') }],
    };
    AppState.data.periodizations.push(rec);
    render();
    Utils.toast('Sugestão recusada e registrada no histórico.', 'success');
    await AppShell.guardedPut(DB.STORES.periodizations, rec);
  });

  const move = async (dir) => {
    const rec = activePeriodization();
    if (!rec) return;
    const cyclic = ROTEIRO[rec.objective]?.cyclic;
    let target = nextIndex(rec.phases, rec.currentIndex, dir);
    if (cyclic && target < 0) target = nextIndex(rec.phases, rec.currentIndex, -dir);
    if (target < 0) return;
    const today = Utils.todayISO();
    const from = rec.phases[rec.currentIndex];
    const to = rec.phases[target];
    rec.currentIndex = target;
    rec.phaseStartDate = today;
    rec.decisions.push({ date: today, text: `${dir > 0 || cyclic ? 'Mudou' : 'Voltou'} da Fase ${from.n} para a Fase ${to.n}` });
    await perSyncStage(to.stage);
    render();
    Utils.toast(`Fase ${to.n} iniciada ✓ — estágio: ${stageLabel(to.stage)}`, 'success');
    await AppShell.guardedPut(DB.STORES.periodizations, rec);
  };
  container.querySelector('#per-next')?.addEventListener('click', () => move(+1));
  container.querySelector('#per-prev')?.addEventListener('click', () => move(-1));

  const endBtn = container.querySelector('#per-end');
  if (endBtn) endBtn.addEventListener('click', async () => {
    const ok = await Utils.confirmDialog('Encerrar esta periodização? O estágio de treino atual do aluno é mantido.');
    if (!ok) return;
    const rec = activePeriodization();
    if (!rec) return;
    rec.status = 'encerrada';
    rec.decisions.push({ date: Utils.todayISO(), text: 'Periodização encerrada' });
    render();
    await AppShell.guardedPut(DB.STORES.periodizations, rec);
  });
}

window.PeriodizationView = { renderHtml: perRenderHtml, bindEvents: perBindEvents, phasePillHtml: perPhasePillHtml };
