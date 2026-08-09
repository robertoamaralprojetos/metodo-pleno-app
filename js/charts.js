// Gráficos SVG feitos à mão — sem dependências externas (necessário p/ funcionar 100% offline).
// Paleta e estilo visual espelham o protótipo (linha com área preenchida, pontos dourados).

const CHART_COLORS = {
  verdeProfundo: '#152219',
  verdePrincipal: '#1F3D30',
  verdeSuave: '#3F6152',
  verdePallido: '#DCE6DE',
  dourado: '#B8924A',
  douradoClaro: '#E4D2A6',
  douradoEscuro: '#8F701F',
  alerta: '#A24E33',
  grid: '#D9DED2',
  text: '#5B6B61',
};

function svgEl(tag, attrs) {
  const ns = 'http://www.w3.org/2000/svg';
  const node = document.createElementNS(ns, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

// points: [{label, value}]. Funciona com 1 único ponto (desenha o ponto centralizado,
// sem linha) ou com vários (linha + área). Os valores ficam sempre visíveis como rótulo
// acima de cada ponto — não só ao passar o mouse.
function lineChart(points, { width = 640, height = 230, color = CHART_COLORS.verdePrincipal, pointColor = CHART_COLORS.dourado, fillOpacity = 0.12, formatY = (v) => v, yMin, yMax } = {}) {
  const padding = { top: 26, right: 16, bottom: 34, left: 42 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const valid = points.filter((p) => p.value !== null && p.value !== undefined && !Number.isNaN(p.value));
  if (!valid.length) return null;

  let min = yMin !== undefined ? yMin : Math.min(...valid.map((p) => p.value));
  let max = yMax !== undefined ? yMax : Math.max(...valid.map((p) => p.value));
  if (min === max) { min -= 1; max += 1; }
  if (yMin === undefined) { const range = max - min; min -= range * 0.12; }
  if (yMax === undefined) { const range = max - min; max += range * 0.12; }

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' });

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xFor = (i) => points.length === 1 ? padding.left + innerW / 2 : padding.left + stepX * i;
  const yFor = (v) => padding.top + innerH - ((v - min) / (max - min)) * innerH;

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const v = min + ((max - min) * i) / gridSteps;
    const y = yFor(v);
    svg.appendChild(svgEl('line', { x1: padding.left, x2: width - padding.right, y1: y, y2: y, stroke: CHART_COLORS.grid, 'stroke-width': 1 }));
    const label = svgEl('text', { x: padding.left - 8, y: y + 4, 'font-size': 10, fill: CHART_COLORS.text, 'text-anchor': 'end', 'font-family': 'Manrope, sans-serif' });
    label.textContent = formatY(Math.round(v * 10) / 10);
    svg.appendChild(label);
  }

  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    const label = svgEl('text', { x: xFor(i), y: height - padding.bottom + 16, 'font-size': 10, fill: CHART_COLORS.text, 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif' });
    label.textContent = p.label;
    svg.appendChild(label);
  });

  let lineD = '';
  let areaD = '';
  points.forEach((p, i) => {
    if (p.value === null || p.value === undefined) return;
    const cmd = lineD === '' ? 'M' : 'L';
    lineD += `${cmd}${xFor(i)},${yFor(p.value)} `;
    areaD += `${cmd}${xFor(i)},${yFor(p.value)} `;
  });
  if (areaD) {
    const lastIdx = points.length - 1;
    areaD += `L${xFor(lastIdx)},${padding.top + innerH} L${xFor(0)},${padding.top + innerH} Z`;
    svg.appendChild(svgEl('path', { d: areaD, fill: color, opacity: fillOpacity, stroke: 'none' }));
  }
  svg.appendChild(svgEl('path', { d: lineD.trim(), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));

  points.forEach((p, i) => {
    if (p.value === null || p.value === undefined) return;
    const cx = xFor(i);
    const cy = yFor(p.value);
    const circle = svgEl('circle', { cx, cy, r: 4.5, fill: pointColor, stroke: '#fff', 'stroke-width': 1.5 });
    const title = svgEl('title', {});
    title.textContent = `${p.label}: ${formatY(p.value)}`;
    circle.appendChild(title);
    svg.appendChild(circle);

    const valueLabel = svgEl('text', { x: cx, y: Math.max(cy - 10, 11), 'font-size': 10.5, fill: CHART_COLORS.verdeProfundo, 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif', 'font-weight': '700' });
    valueLabel.textContent = formatY(p.value);
    svg.appendChild(valueLabel);
  });

  return svg;
}

// bars: [{label, value, color}]. Os valores ficam sempre visíveis como rótulo acima de
// cada barra — não só ao passar o mouse. Funciona normalmente com 1 única barra.
function barChart(bars, { width = 640, height = 220, formatY = (v) => v, maxValueOverride } = {}) {
  const padding = { top: 26, right: 10, bottom: 34, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const maxValue = maxValueOverride ?? Math.max(1, ...bars.map((b) => b.value || 0));

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img' });

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const v = (maxValue * i) / gridSteps;
    const y = padding.top + innerH - (v / maxValue) * innerH;
    svg.appendChild(svgEl('line', { x1: padding.left, x2: width - padding.right, y1: y, y2: y, stroke: CHART_COLORS.grid, 'stroke-width': 1 }));
    const label = svgEl('text', { x: padding.left - 6, y: y + 4, 'font-size': 10, fill: CHART_COLORS.text, 'text-anchor': 'end', 'font-family': 'Manrope, sans-serif' });
    label.textContent = formatY(Math.round(v * 10) / 10);
    svg.appendChild(label);
  }

  const gap = 6;
  const barW = Math.max(4, innerW / bars.length - gap);
  bars.forEach((b, i) => {
    const x = padding.left + i * (innerW / bars.length) + (innerW / bars.length - barW) / 2;
    const barH = ((b.value || 0) / maxValue) * innerH;
    const y = padding.top + innerH - barH;
    const rect = svgEl('rect', { x, y, width: barW, height: Math.max(barH, 0), fill: b.color || CHART_COLORS.dourado, rx: 4 });
    const title = svgEl('title', {});
    title.textContent = `${b.label}: ${formatY(b.value)}`;
    rect.appendChild(title);
    svg.appendChild(rect);

    const valueLabel = svgEl('text', { x: x + barW / 2, y: Math.max(y - 8, 11), 'font-size': 10.5, fill: CHART_COLORS.verdeProfundo, 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif', 'font-weight': '700' });
    valueLabel.textContent = formatY(b.value);
    svg.appendChild(valueLabel);

    const label = svgEl('text', { x: x + barW / 2, y: height - padding.bottom + 16, 'font-size': 10, fill: CHART_COLORS.text, 'text-anchor': 'middle', 'font-family': 'Manrope, sans-serif' });
    label.textContent = b.label;
    svg.appendChild(label);
  });

  return svg;
}

// Trilha de evolução — linha pontilhada horizontal com um ponto por mês com sessões
// e marcos em losango dourado nos meses com avaliação funcional (igual ao protótipo).
function trilha(monthsTreino, assessByMonth) {
  const allMonths = Array.from(new Set([...monthsTreino, ...Object.keys(assessByMonth)])).sort();
  const wrap = Utils.el('<div class="mp-trilha"></div>');
  if (!allMonths.length) return wrap;

  const line = Utils.el('<div class="mp-trilha-line"></div>');
  const n = allMonths.length;
  allMonths.forEach((k, i) => {
    const pct = n === 1 ? 50 : (i / (n - 1)) * 100;
    const isCheckpoint = assessByMonth[k] !== undefined;
    const point = Utils.el(`
      <div class="mp-trilha-point ${isCheckpoint ? 'checkpoint' : ''}" style="left:${pct}%;">
        <div class="mp-trilha-dot"></div>
        <div class="mp-trilha-month">${Utils.escapeHtml(monthLabelFromKey(k))}</div>
        ${isCheckpoint ? `<div class="mp-trilha-idx">${assessByMonth[k]}</div>` : ''}
      </div>
    `);
    line.appendChild(point);
  });
  wrap.appendChild(line);
  return wrap;
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function monthLabelFromKey(key) {
  const [y, m] = key.split('-');
  return MONTHS_PT[parseInt(m, 10) - 1] + '/' + y.slice(2);
}

window.Charts = { lineChart, barChart, trilha, monthLabelFromKey, COLORS: CHART_COLORS, MONTHS_PT };
