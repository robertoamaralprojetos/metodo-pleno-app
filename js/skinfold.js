// Dobras cutâneas — protocolos, cálculo do % de gordura e orientações de técnica.
// Só entram protocolos cujas equações foram conferidas (ver documento "Protocolos de Dobras
// Cutâneas"). Pendentes de conferência, e por isso AINDA FORA daqui: Petroski, Visser, Evans,
// Weststrate & Deurenberg, equações de lutadores e os ajustes étnicos de Slaughter.
// É uma ESTIMATIVA: erro típico de 3 a 4 pontos percentuais. Cálculo 100% local.

const SF_SITES = {
  triceps: { label: 'Tríceps', how: 'Face posterior do braço, no ponto médio entre o acrômio e o olécrano. Prega vertical.' },
  biceps: { label: 'Bíceps', how: 'Face anterior do braço, na mesma altura do tríceps. Prega vertical.' },
  subscapular: { label: 'Subescapular', how: 'Logo abaixo do ângulo inferior da escápula. Prega oblíqua, a cerca de 45° da coluna.' },
  chest: { label: 'Peitoral', how: 'Homens: metade da distância entre a prega axilar anterior e o mamilo. Mulheres: um terço dessa distância. Prega oblíqua.' },
  midaxillary: { label: 'Axilar média', how: 'Na linha axilar média, na altura do apêndice xifoide.' },
  suprailiac: { label: 'Supra-ilíaca', how: 'Logo acima da crista ilíaca, na linha axilar anterior. Prega oblíqua. Siga sempre a mesma definição.' },
  abdominal: { label: 'Abdominal', how: 'Cerca de 2 cm à direita da cicatriz umbilical. Prega vertical (a orientação varia entre autores: mantenha a mesma).' },
  thigh: { label: 'Coxa', how: 'Face anterior, no ponto médio entre a prega inguinal e a borda superior da patela, com o peso do corpo no outro pé. Prega vertical.' },
  calf: { label: 'Panturrilha medial', how: 'Face medial da perna, no ponto de maior circunferência. Prega vertical.' },
};

const SF_TECHNIQUE = [
  'Meça sempre o lado direito, com a pessoa em pé e relaxada.',
  'Destaque a prega com polegar e indicador, cerca de 1 cm do ponto marcado, e aplique o compasso perpendicular à prega.',
  'Leia em 2 a 4 segundos. Faça 2 rodadas, alternando os pontos (não repita o mesmo ponto em seguida).',
  'Se duas leituras do mesmo ponto diferirem mais de 2 mm, faça uma 3ª: o app usa a mediana.',
  'Evite medir logo após o exercício, com a pele úmida ou com creme.',
  'Use o mesmo adipômetro e o mesmo avaliador ao longo do acompanhamento.',
];

// Conversões de densidade (g/cm³) para % de gordura.
const SF_CONVERSIONS = {
  siri: { label: 'Siri (1961)', fn: (d) => 495 / d - 450 },
  brozek: { label: 'Brozek (1963)', fn: (d) => 457 / d - 414.2 },
};

const SF_DW = {
  M: [[17, 19, 1.1620, 0.0630], [20, 29, 1.1631, 0.0632], [30, 39, 1.1422, 0.0544], [40, 49, 1.1620, 0.0700], [50, 200, 1.1715, 0.0779]],
  F: [[17, 19, 1.1549, 0.0678], [20, 29, 1.1599, 0.0717], [30, 39, 1.1423, 0.0632], [40, 49, 1.1333, 0.0612], [50, 200, 1.1339, 0.0645]],
};

// kind 'density' = a equação devolve densidade (depois converte); 'percent' = devolve %G direto.
// Cada protocolo traz, por sexo, os pontos e a equação. ageRange = faixa em que foi validado.
const SF_PROTOCOLS = [
  {
    id: 'jp3', label: 'Jackson & Pollock — 3 dobras', kind: 'density', short: 'JP 3',
    by: {
      M: { sites: ['chest', 'abdominal', 'thigh'], range: [18, 61], fn: (s, a) => 1.10938 - 0.0008267 * s + 0.0000016 * s * s - 0.0002574 * a },
      F: { sites: ['triceps', 'suprailiac', 'thigh'], range: [18, 55], fn: (s, a) => 1.0994921 - 0.0009929 * s + 0.0000023 * s * s - 0.0001392 * a },
    },
    ref: 'Jackson & Pollock (1978), homens; Jackson, Pollock & Ward (1980), mulheres. Adultos.',
  },
  {
    id: 'jp7', label: 'Jackson & Pollock — 7 dobras', kind: 'density', short: 'JP 7',
    by: {
      M: { sites: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'], range: [18, 61], fn: (s, a) => 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * a },
      F: { sites: ['chest', 'midaxillary', 'triceps', 'subscapular', 'abdominal', 'suprailiac', 'thigh'], range: [18, 55], fn: (s, a) => 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * a },
    },
    ref: 'Jackson & Pollock (1978), homens; Jackson, Pollock & Ward (1980), mulheres. Adultos.',
  },
  {
    id: 'jp4', label: 'Jackson, Pollock & Ward — 4 dobras (mulheres)', kind: 'density', short: 'JPW 4',
    by: { F: { sites: ['triceps', 'abdominal', 'suprailiac', 'thigh'], range: [18, 55], fn: (s, a) => 1.096095 - 0.0006952 * s + 0.0000011 * s * s - 0.0000714 * a } },
    ref: 'Jackson, Pollock & Ward (1980). Mulheres adultas.',
  },
  {
    id: 'dw', label: 'Durnin & Womersley — 4 dobras', kind: 'density', short: 'D&W',
    by: ['M', 'F'].reduce((o, sx) => {
      o[sx] = {
        sites: ['biceps', 'triceps', 'subscapular', 'suprailiac'], range: [17, 72],
        fn: (s, a) => { const row = SF_DW[sx].find((r) => a >= r[0] && a <= r[1]); return row ? row[2] - row[3] * Math.log10(s) : null; },
      };
      return o;
    }, {}),
    ref: 'Durnin & Womersley (1974). Adultos de 17 a 72 anos; constantes por faixa de idade. Boa opção para idosos.',
  },
  {
    id: 'guedes', label: 'Guedes — 3 dobras (população brasileira)', kind: 'density', short: 'Guedes',
    by: {
      M: { sites: ['triceps', 'suprailiac', 'abdominal'], range: [18, 38], fn: (s) => 1.1714 - 0.0671 * Math.log10(s) },
      F: { sites: ['subscapular', 'suprailiac', 'thigh'], range: [18, 38], fn: (s) => 1.1665 - 0.0706 * Math.log10(s) },
    },
    ref: 'Guedes (década de 1980). Adultos jovens brasileiros.',
  },
  {
    id: 'slaughter_ts', label: 'Slaughter — tríceps + subescapular (crianças e adolescentes)', kind: 'percent', short: 'Slaughter TS',
    needsMaturation: true,
    by: ['M', 'F'].reduce((o, sx) => {
      o[sx] = {
        sites: ['triceps', 'subscapular'], range: [8, 18],
        fn: (s, a, opts) => {
          if (s > 35) return sx === 'M' ? 0.783 * s + 1.6 : 0.546 * s + 9.7;
          if (sx === 'F') return 1.33 * s - 0.013 * s * s - 2.5;
          const I = { pre: 1.7, pub: 3.2, pos: 5.2 }[(opts && opts.maturation) || 'pub'];
          return 1.21 * s - 0.008 * s * s - I;
        },
      };
      return o;
    }, {}),
    ref: 'Slaughter et al. (1988). Crianças e adolescentes de 8 a 18 anos. Equações para a referência geral; sem ajuste étnico.',
  },
  {
    id: 'slaughter_tc', label: 'Slaughter — tríceps + panturrilha (crianças e adolescentes)', kind: 'percent', short: 'Slaughter TC',
    by: ['M', 'F'].reduce((o, sx) => {
      o[sx] = { sites: ['triceps', 'calf'], range: [8, 18], fn: (s) => (sx === 'M' ? 0.735 * s + 1.0 : 0.610 * s + 5.0) };
      return o;
    }, {}),
    ref: 'Slaughter et al. (1988). Crianças e adolescentes de 8 a 18 anos.',
  },
];

function sfSex(sex) { return sex === 'F' ? 'F' : 'M'; }
function sfProtocol(id) { return SF_PROTOCOLS.find((p) => p.id === id) || null; }
function sfAvailable(protocol, sex) { return !!protocol.by[sfSex(sex)]; }
function sfProtocolsFor(sex) { return SF_PROTOCOLS.filter((p) => sfAvailable(p, sex)); }

// Protocolo sugerido pela idade e pelo sexo (o profissional pode trocar).
function sfSuggest(age, sex) {
  const sx = sfSex(sex);
  if (age == null) return sx === 'F' ? 'jp3' : 'jp3';
  if (age < 18) return 'slaughter_ts';
  if (age >= 60) return 'dw';
  return 'jp3';
}

// Média de 2 leituras ou mediana de 3. Devolve { value, n, divergent }.
function sfSiteValue(readings) {
  const v = (readings || []).filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return { value: v[0], n: 1, divergent: false };
  const spread = v[v.length - 1] - v[0];
  if (v.length === 2) return { value: Math.round(((v[0] + v[1]) / 2) * 10) / 10, n: 2, divergent: spread > 2 };
  return { value: v[1], n: v.length, divergent: v[1] - v[0] > 2 || v[v.length - 1] - v[1] > 2 };
}

// input: { protocolId, sex, age, values: { site: [leituras] }, conversion, maturation, weight }
function sfCompute(input) {
  const p = sfProtocol(input.protocolId);
  const sx = sfSex(input.sex);
  const out = { ok: false, errors: [], warnings: [] };
  if (!p || !p.by[sx]) { out.errors.push('Protocolo indisponível para este sexo.'); return out; }
  const cfg = p.by[sx];
  const age = input.age;
  if (age == null) { out.errors.push('Preencha a data de nascimento do aluno no Cadastro para calcular.'); return out; }
  if (p.id === 'dw' && age < 17) { out.errors.push('Durnin & Womersley vale a partir de 17 anos.'); return out; }

  const means = {}; let sum = 0; let missing = [];
  cfg.sites.forEach((s) => {
    const r = sfSiteValue((input.values || {})[s]);
    if (!r) { missing.push(SF_SITES[s].label); return; }
    means[s] = r.value; sum += r.value;
    if (r.n === 1) out.warnings.push(`${SF_SITES[s].label}: só 1 leitura — faça ao menos 2.`);
    if (r.divergent) out.warnings.push(`${SF_SITES[s].label}: leituras divergem mais de 2 mm — confira a medida.`);
    if (r.value > 70) out.warnings.push(`${SF_SITES[s].label}: valor muito alto (${r.value} mm) — confira se o compasso abrangeu a prega.`);
  });
  if (missing.length) { out.errors.push('Falta medir: ' + missing.join(', ') + '.'); out.means = means; return out; }
  sum = Math.round(sum * 10) / 10;

  if (age < cfg.range[0] || age > cfg.range[1]) out.warnings.push(`Idade fora da faixa em que este protocolo foi validado (${cfg.range[0]} a ${cfg.range[1]} anos). Interprete com cautela ou escolha outro protocolo.`);

  let percent;
  if (p.kind === 'density') {
    const d = cfg.fn(sum, age);
    if (!d || !Number.isFinite(d)) { out.errors.push('Não foi possível calcular a densidade para esta idade.'); return out; }
    const conv = SF_CONVERSIONS[input.conversion] || SF_CONVERSIONS.siri;
    percent = conv.fn(d);
    out.density = Math.round(d * 100000) / 100000;
    out.conversion = SF_CONVERSIONS[input.conversion] ? input.conversion : 'siri';
  } else {
    percent = cfg.fn(sum, age, { maturation: input.maturation });
    if (p.needsMaturation && sx === 'M' && sum <= 35) out.maturation = input.maturation || 'pub';
  }
  percent = Math.round(percent * 10) / 10;
  if (percent < 2 || percent > 60) out.warnings.push('Resultado fora do esperado — confira as medidas e o protocolo.');
  if (age >= 60) out.warnings.push('Em idosos a gordura interna aumenta e a pele comprime menos: o erro da estimativa é maior. Acompanhe a tendência (soma das dobras) mais que o valor absoluto.');
  if (age < 18) out.warnings.push('Em crianças e adolescentes a maturação influencia o resultado. Evite rótulos; acompanhe a evolução.');
  const w = Number(input.weight) || 0;
  if (w > 0 && percent > 0 && percent < 100) {
    out.fatMassKg = Math.round((w * percent) / 10) / 10;
    out.leanMassKg = Math.round((w - out.fatMassKg) * 10) / 10;
  }
  out.ok = true; out.means = means; out.sum = sum; out.percent = percent; out.sites = cfg.sites.slice();
  return out;
}

function sfCrossMethodNote(records) {
  const methods = new Set(records.filter((r) => r.bodyFatPercent != null).map((r) => r.skinfold ? 'sf:' + r.skinfold.protocolId : 'bio'));
  return methods.size > 1;
}

window.Skinfold = {
  SITES: SF_SITES, TECHNIQUE: SF_TECHNIQUE, CONVERSIONS: SF_CONVERSIONS, PROTOCOLS: SF_PROTOCOLS,
  protocol: sfProtocol, protocolsFor: sfProtocolsFor, suggest: sfSuggest, siteValue: sfSiteValue,
  compute: sfCompute, mixedMethods: sfCrossMethodNote,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['skinfold.js'] = 'v1.21.0';
