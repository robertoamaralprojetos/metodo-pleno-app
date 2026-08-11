// Tabelas normativas do Senior Fitness Test (Rikli & Jones, 2013) + testes complementares.
// Replicado fielmente de DOCUMENTAÇÃO/Ficha_Avaliacao_Funcional_55mais.xlsx (aba Tabelas_Normativas).
// Fontes: Rikli RE, Jones CJ. Senior Fitness Test Manual. 2nd ed. Human Kinetics; 2013.
//         Springer BA, et al. J Geriatr Phys Ther. 2007 (Apoio Unipodal).
//         Shumway-Cook A, et al. Phys Ther. 2000 (referência clínica TUG).

// Cada linha: ageMin, F_P25, F_P50, F_P75, M_P25, M_P50, M_P75
// direction 'higher' = maior resultado é melhor; 'lower' = menor resultado é melhor (TUG).

const SFT_TABLES = {
  sitToStand: {
    label: 'Levantar e Sentar na Cadeira',
    unit: 'reps/30s',
    direction: 'higher',
    rows: [
      [60, 11, 14, 17, 12, 16, 19],
      [65, 11, 13, 16, 12, 15, 18],
      [70, 10, 12, 15, 10, 14, 17],
      [75, 10, 12, 15, 10, 13, 17],
      [80, 9, 11, 14, 8, 11, 15],
      [85, 8, 10, 13, 7, 10, 13],
    ],
  },
  armCurl: {
    label: 'Flexão de Antebraço',
    unit: 'reps/30s',
    direction: 'higher',
    rows: [
      [60, 13, 16, 19, 16, 19, 22],
      [65, 12, 15, 18, 15, 18, 21],
      [70, 12, 14, 17, 14, 17, 20],
      [75, 11, 13, 16, 13, 16, 19],
      [80, 10, 13, 16, 13, 15, 19],
      [85, 10, 12, 15, 11, 14, 17],
    ],
  },
  chairSitReach: {
    label: 'Sentar e Alcançar o Pé na Cadeira',
    unit: 'cm',
    direction: 'higher',
    rows: [
      [60, -2.5, 1.3, 5.1, -6.4, -1.3, 3.8],
      [65, -2.5, 1.3, 5.1, -7.6, -2.5, 2.5],
      [70, -3.8, 0, 3.8, -8.9, -3.8, 1.3],
      [75, -3.8, 0, 3.8, -10.2, -5.1, 0],
      [80, -5.1, -1.3, 2.5, -12.7, -7.6, -2.5],
      [85, -7.6, -3.8, 1.3, -14, -8.9, -3.8],
    ],
  },
  tug: {
    label: 'TUG - Timed Up and Go',
    unit: 's',
    direction: 'lower',
    rows: [
      [60, 6, 5.3, 4.6, 5.7, 5.1, 4.5],
      [65, 6.4, 5.7, 5, 6.3, 5.6, 4.9],
      [70, 7.1, 6.2, 5.3, 6.9, 6, 5.1],
      [75, 7.8, 6.9, 6, 7.6, 6.7, 5.8],
      [80, 9.4, 8.1, 6.8, 8.7, 7.5, 6.3],
      [85, 11.5, 9.7, 7.9, 11.2, 9.4, 7.6],
    ],
  },
};

// Apoio Unipodal: corte clínico fixo (não há tabela por idade/sexo publicada).
const UNIPODAL_CUTOFFS = [
  { max: 10, label: 'Risco Alto de Quedas', score: 1, includesMax: false },
  { max: 15, label: 'Zona de Atenção', score: 2, includesMax: false },
  { max: 25, label: 'Adequado', score: 3, includesMax: false },
  { max: Infinity, label: 'Bom', score: 4, includesMax: false },
];

const TEST_ORDER = ['sitToStand', 'armCurl', 'chairSitReach', 'tug', 'unipodalStance'];

const INDEX_CLASSIFICATION = [
  { max: 25, label: 'Frágil / Zona de Risco' },
  { max: 50, label: 'Abaixo da Média' },
  { max: 75, label: 'Adequado' },
  { max: Infinity, label: 'Bom / Ótimo Condicionamento Funcional' },
];

// Encontra a linha da tabela normativa correspondente à idade, replicando
// MATCH(idade, colunaIdadeMin, 1): última linha cujo ageMin <= idade;
// se a idade for menor que a primeira faixa (60), cai no fallback (primeira linha),
// igual ao IFERROR(...,1) da planilha original.
function findAgeRow(rows, age) {
  let found = rows[0];
  for (const row of rows) {
    if (row[0] <= age) found = row;
    else break;
  }
  return found;
}

function getPercentiles(testKey, age, sex) {
  const table = SFT_TABLES[testKey];
  const row = findAgeRow(table.rows, age);
  const isF = sex === 'F';
  const p25 = isF ? row[1] : row[4];
  const p50 = isF ? row[2] : row[5];
  const p75 = isF ? row[3] : row[6];
  return { p25, p50, p75 };
}

// Classifica um teste com tabela de percentil (sitToStand, armCurl, chairSitReach, tug).
function classifyTableTest(testKey, result, age, sex) {
  const table = SFT_TABLES[testKey];
  const { p25, p50, p75 } = getPercentiles(testKey, age, sex);
  let score, label;

  if (table.direction === 'higher') {
    if (result < p25) { score = 1; label = 'Zona de Atenção'; }
    else if (result < p50) { score = 2; label = 'Abaixo da Média'; }
    else if (result < p75) { score = 3; label = 'Dentro da Média'; }
    else { score = 4; label = 'Bom Condicionamento'; }
  } else {
    // direction 'lower' (TUG) — lógica invertida, replicando a planilha:
    // p25 aqui é o valor MAIOR (pior) e p75 o valor MENOR (melhor).
    if (result > p25) { score = 1; label = 'Zona de Atenção'; }
    else if (result > p50) { score = 2; label = 'Abaixo da Média'; }
    else if (result > p75) { score = 3; label = 'Dentro da Média'; }
    else { score = 4; label = 'Bom Condicionamento'; }
  }

  return { p25, p50, p75, score, label, unit: table.unit, testLabel: table.label };
}

function classifyUnipodal(result) {
  for (const c of UNIPODAL_CUTOFFS) {
    if (result < c.max) return { score: c.score, label: c.label, unit: 's', testLabel: 'Apoio Unipodal' };
  }
  const last = UNIPODAL_CUTOFFS[UNIPODAL_CUTOFFS.length - 1];
  return { score: last.score, label: last.label, unit: 's', testLabel: 'Apoio Unipodal' };
}

// Apoio Unipodal com as duas pernas classificadas separadamente (mesmos pontos de corte
// clínicos para cada uma). A pontuação usada no Índice composto é a da perna PIOR (menor
// tempo) — não a média — porque um déficit assimétrico entre os lados é clinicamente
// relevante e não deve ser mascarado. Também sinaliza possível assimetria quando a diferença
// entre as pernas é grande (>=30% em relação à perna melhor).
function classifyUnipodalPair(rightValue, leftValue) {
  const right = { value: rightValue, ...classifyUnipodal(rightValue) };
  const left = { value: leftValue, ...classifyUnipodal(leftValue) };
  const worseSide = rightValue <= leftValue ? 'right' : 'left';
  const worse = worseSide === 'right' ? right : left;
  const better = worseSide === 'right' ? left : right;
  const asymmetryPercent = better.value > 0 ? Math.round(((better.value - worse.value) / better.value) * 100) : 0;
  const asymmetry = better.value > 0 && worse.value < better.value && asymmetryPercent >= 30;
  return {
    right,
    left,
    worseSide,
    asymmetry,
    asymmetryPercent,
    score: worse.score,
    label: worse.label,
    unit: 's',
    testLabel: 'Apoio Unipodal',
  };
}

// results: { sitToStand, armCurl, chairSitReach, tug, unipodalStanceRight, unipodalStanceLeft }
// (números ou null/undefined). age: número; sex: 'F' | 'M'
function computeFunctionalAssessment(results, age, sex) {
  const perTest = {};
  let filledCount = 0;
  let sumScore = 0;

  for (const key of TEST_ORDER) {
    if (key === 'unipodalStance') {
      const rightRaw = results.unipodalStanceRight;
      const leftRaw = results.unipodalStanceLeft;
      const isEmpty = (v) => v === null || v === undefined || v === '';
      if (isEmpty(rightRaw) || isEmpty(leftRaw)) {
        perTest.unipodalStance = null;
        continue;
      }
      filledCount += 1;
      const pair = classifyUnipodalPair(Number(rightRaw), Number(leftRaw));
      perTest.unipodalStance = pair;
      sumScore += pair.score;
      continue;
    }
    const value = results[key];
    if (value === null || value === undefined || value === '') {
      perTest[key] = null;
      continue;
    }
    const numValue = Number(value);
    filledCount += 1;
    const classification = classifyTableTest(key, numValue, age, sex);
    perTest[key] = { value: numValue, ...classification };
    sumScore += classification.score;
  }

  if (filledCount < TEST_ORDER.length) {
    return { perTest, complete: false, index: null, classification: null };
  }

  const index = Math.round(((sumScore - 5) / 15) * 100);
  const classification = INDEX_CLASSIFICATION.find((c) => index <= c.max).label;

  return { perTest, complete: true, sumScore, index, classification };
}

window.SFT = {
  TABLES: SFT_TABLES,
  UNIPODAL_CUTOFFS,
  TEST_ORDER,
  INDEX_CLASSIFICATION,
  getPercentiles,
  classifyTableTest,
  classifyUnipodal,
  classifyUnipodalPair,
  computeFunctionalAssessment,
};
