// Documentos do aluno — Orientações e Regras + PAR-Q, com assinatura na tela (v1.17.0)
//
// • O texto das Orientações é editável em Configurações e usa as MESMAS regras de desmarcação/
//   reposição/férias do Controle de Pagamento (marcadores {horas_aviso}, {reposicoes_mes}...).
// • O aluno assina com o dedo na tela do aparelho do profissional. Cada assinatura guarda uma
//   cópia do texto assinado, data/hora, quem assinou e um código de verificação (hash do texto).
//   Se o texto mudar depois, o app mostra que é preciso colher uma nova assinatura.
// • Tudo fica no próprio registro do aluno (student.signedDocs), então entra no Backup (JSON).
// • PDF gerado no aparelho (jsPDF, js/vendor/jspdf.umd.min.js) e compartilhado pelo menu do
//   celular (WhatsApp etc.) — ou baixado, no computador. Nada é enviado a servidores.

const DOC_TYPES = {
  orientacoes: 'Orientações e Regras',
  parq: 'Triagem PAR-Q',
};

const DEFAULT_ORIENTATIONS_TITLE = 'Orientações e Regras do Acompanhamento';

const DEFAULT_ORIENTATIONS_TEMPLATE = `Estas orientações existem para que nosso trabalho, juntos, flua da melhor forma possível, com previsibilidade, respeito ao seu tempo e ao meu, e clareza sobre como lidamos com imprevistos do dia a dia. Não é um documento burocrático: é um combinado simples para que a gente possa focar no que realmente importa, que é o seu progresso.

## 1. Agendamento e Pagamento das Aulas
- As aulas são cobradas por hora/aula e pagas antecipadamente, conforme a periodicidade combinada (semanal, quinzenal ou mensal).
- O horário combinado é reservado exclusivamente para você, por isso, pedimos atenção especial às regras de desmarcação e reposição abaixo, que existem para proteger a agenda de todos os alunos.

## 2. Desmarcação e Reposição de Aulas pelo Aluno
- Caso precise desmarcar uma aula e deseje o direito de repô-la, o aviso deve ser feito com pelo menos {horas_aviso} de antecedência.
- Desmarcações com menos de {horas_aviso} de antecedência, ou sem aviso prévio, infelizmente não garantem reposição.
- É possível repor até {reposicoes_mes} por mês, dentro do próprio mês em que foram desmarcadas.
- {regra_transferencia}
- Aulas não repostas não geram desconto na mensalidade, já que o horário permanece reservado para você durante todo o período.

## 3. Desmarcação por Parte do Professor
- Caso eu precise desmarcar uma aula, o aviso será feito com no mínimo {horas_aviso} de antecedência sempre que possível.
- Nesses casos, a reposição é garantida e deve acontecer em até {prazo_professor} a partir da data desmarcada.

## 4. Férias ou Ausência Temporária do Aluno
- Se você for se ausentar por período de férias e quiser manter seu horário fixo reservado para quando retornar, é cobrado o equivalente a {percentual_ferias} do valor das aulas do período de ausência, garantindo a manutenção do seu horário na agenda.
- Caso prefira não manter o horário reservado durante a ausência, ele ficará sujeito à disponibilidade de agenda no seu retorno.

## 5. Cancelamento do Acompanhamento
- Qualquer cancelamento definitivo do acompanhamento deve ser comunicado com 30 dias de antecedência, permitindo um encerramento tranquilo e a reorganização da agenda.

## 6. Avaliação Física e Liberação Médica
- No início do acompanhamento, é realizada uma avaliação funcional para entendermos seu ponto de partida e definirmos os objetivos do treino com segurança.
- Pode ser solicitado um atestado médico de aptidão para atividade física, especialmente em casos de condições de saúde pré-existentes, cirurgias recentes ou recomendação médica específica.
- É fundamental me informar sobre qualquer mudança no seu quadro de saúde, novo diagnóstico, medicação ou orientação médica que possa impactar o treino.

## 7. Preparo para as Aulas
- Chegar com roupas confortáveis e adequadas para atividade física, e calçado fechado sempre que o treino exigir.
- Manter-se hidratado antes, durante e após a aula.
- Comunicar antes ou durante o treino qualquer dor, desconforto, tontura ou mal-estar, sua segurança vem sempre antes do plano de treino do dia.

## 8. Local de Treino e Estrutura
- Quando o treino for realizado em domicílio ou condomínio, pedimos que o espaço esteja disponível e livre de obstáculos no horário combinado.
- Equipamentos eventualmente levados pelo professor são de uso exclusivo durante a aula e sob orientação profissional.

## 9. Comunicação
- O WhatsApp é o canal oficial para agendamentos, avisos e dúvidas.
- Assuntos administrativos (pagamentos, remarcações, férias) devem ser tratados por esse canal, para manter tudo registrado e organizado para ambas as partes.

## 10. Uso de Imagem
- Eventualmente, fotos ou vídeos das aulas podem ser utilizados para divulgação do trabalho (redes sociais, site, materiais de portfólio).
- Nenhuma imagem é utilizada sem o seu consentimento prévio, basta sinalizar caso prefira não ser fotografado(a) ou filmado(a).

## 11. Reajuste de Valores
- Os valores das aulas podem passar por reajuste anual, com aviso prévio de pelo menos 30 dias antes da nova cobrança entrar em vigor.

## 12. Convivência e Respeito Mútuo
- Buscamos sempre um ambiente cordial, respeitoso e motivador, tanto da minha parte quanto da parte do aluno, para que o processo seja leve e sustentável a longo prazo.

Essas orientações podem ser revisadas periodicamente para se adequarem à realidade do trabalho e serão sempre comunicadas com transparência. Qualquer dúvida, estou à disposição para conversar.`;

const ORIENTATION_PLACEHOLDERS = [
  { key: 'horas_aviso', help: 'antecedência mínima para desmarcar (ex: "1 hora")' },
  { key: 'reposicoes_mes', help: 'limite de reposições (ex: "2 aulas")' },
  { key: 'regra_transferencia', help: 'frase sobre transferir a reposição para o mês seguinte' },
  { key: 'prazo_professor', help: 'prazo de reposição quando o professor desmarca (ex: "2 meses")' },
  { key: 'percentual_ferias', help: '% cobrado nas férias mantendo o horário (ex: "60%")' },
];

const PARQ_DECLARATION = 'Declaro que li e respondi com sinceridade todas as perguntas acima e que as informações prestadas são verdadeiras. Comprometo-me a informar imediatamente o professor sobre qualquer mudança no meu estado de saúde, novo diagnóstico, medicação ou orientação médica.';
const ORIENTATIONS_DECLARATION = 'Li, compreendi e concordo com as orientações e regras acima.';

// ---------- Utilidades ----------
function docHash(text) {
  // djb2 (32 bits) em hexadecimal — "código de verificação" do texto assinado.
  let h = 5381;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, '0');
}

function plural(n, one, many) { return `${n} ${n === 1 ? one : many}`; }

function fmtHours(h) {
  const n = Number(h) || 0;
  if (n > 0 && n < 1) return `${Math.round(n * 60)} minutos`;
  return `${String(n).replace('.', ',')} ${n === 1 ? 'hora' : 'horas'}`;
}

function fmtDateTimeBR(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- Orientações: texto final a partir do modelo + regras atuais ----------
function orientationsTitle(s = AppState.settings || {}) {
  return (s.orientationsTitle || '').trim() || DEFAULT_ORIENTATIONS_TITLE;
}
function orientationsTemplate(s = AppState.settings || {}) {
  return (s.orientationsTemplate || '').trim() ? s.orientationsTemplate : DEFAULT_ORIENTATIONS_TEMPLATE;
}

function orientationsValues(s = AppState.settings || {}) {
  const transfer = s.allowTransfer && Number(s.maxTransfers) > 0
    ? `Se não for possível repor dentro do mesmo mês, a reposição pode ser transferida ${Number(s.maxTransfers) === 1 ? 'uma única vez' : `até ${s.maxTransfers} vezes`} para o mês seguinte, sem gerar desconto na mensalidade seguinte.`
    : 'Reposições não realizadas dentro do próprio mês não são transferidas para o mês seguinte e não geram desconto na mensalidade.';
  return {
    horas_aviso: fmtHours(s.noticeHours),
    reposicoes_mes: plural(Number(s.maxMakeupsPerMonth) || 0, 'aula', 'aulas'),
    regra_transferencia: transfer,
    prazo_professor: plural(Number(s.professorMonths) || 0, 'mês', 'meses'),
    percentual_ferias: `${Number(s.vacationChargePercent) || 0}%`,
  };
}

function renderOrientationsText(s = AppState.settings || {}, template = null) {
  const values = orientationsValues(s);
  return (template ?? orientationsTemplate(s)).replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m)).trim();
}

// Texto simples → blocos: "## Título", "- item" e parágrafos.
function parseDocText(text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  String(text || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (line.startsWith('## ')) { flush(); blocks.push({ type: 'h', text: line.slice(3).trim() }); return; }
    if (/^[-•]\s+/.test(line)) { flush(); blocks.push({ type: 'li', text: line.replace(/^[-•]\s+/, '') }); return; }
    para.push(line);
  });
  flush();
  return blocks;
}

function docTextHtml(text) {
  const esc = Utils.escapeHtml;
  const out = [];
  let inList = false;
  parseDocText(text).forEach((b) => {
    if (b.type !== 'li' && inList) { out.push('</ul>'); inList = false; }
    if (b.type === 'h') out.push(`<h4 class="mp-doc-h">${esc(b.text)}</h4>`);
    else if (b.type === 'li') { if (!inList) { out.push('<ul class="mp-doc-ul">'); inList = true; } out.push(`<li>${esc(b.text)}</li>`); }
    else out.push(`<p class="mp-doc-p">${esc(b.text)}</p>`);
  });
  if (inList) out.push('</ul>');
  return out.join('');
}

// ---------- PAR-Q: texto do documento a partir da triagem salva ----------
function parqQuestionsList() { return (typeof PARQ_QUESTIONS !== 'undefined' ? PARQ_QUESTIONS : []); }

function parqDocText(parq) {
  const lines = [];
  lines.push('Questionário de Prontidão para Atividade Física (PAR-Q), concebido para pessoas de 15 a 69 anos.');
  lines.push('');
  lines.push('## Perguntas');
  parqQuestionsList().forEach((q, i) => {
    const a = parq?.answers?.[q.key];
    lines.push(`- ${i + 1}. ${q.text} Resposta: ${a === true ? 'SIM' : a === false ? 'NÃO' : '—'}`);
  });
  lines.push('');
  lines.push('## Resultado');
  lines.push(`- ${window.ParqTriage ? ParqTriage.resultLabel(parq?.result) : (parq?.result || '—')}`);
  if (parq?.notes) lines.push(`- Observações: ${parq.notes}`);
  lines.push(`- Data da triagem: ${Utils.formatDateBR(parq?.date)} (validade de 12 meses)`);
  return lines.join('\n');
}

// ---------- Situação dos documentos de um aluno ----------
function signedDocsOf(student, type) {
  return (student?.signedDocs || []).filter((d) => d.type === type).sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''));
}

function orientationsStatus(student) {
  const last = signedDocsOf(student, 'orientacoes')[0];
  if (!last) return { code: 'pendente', level: 'alto', text: 'Orientações: assinatura pendente', last: null };
  const current = docHash(renderOrientationsText());
  if (last.hash !== current) return { code: 'desatualizada', level: 'moderado', text: `Orientações: texto mudou desde a assinatura de ${Utils.formatDateBR(last.signedAt.slice(0, 10))} — colher nova assinatura`, last };
  return { code: 'assinada', level: 'leve', text: `Orientações assinadas em ${Utils.formatDateBR(last.signedAt.slice(0, 10))}`, last };
}

function parqSignStatus(student) {
  const parq = student?.anamnesis?.parq;
  if (!parq || !parq.date) return { code: 'sem_parq', level: 'moderado', text: 'PAR-Q: triagem ainda não aplicada (aba Anamnese)', last: null };
  const last = signedDocsOf(student, 'parq')[0];
  if (!last) return { code: 'pendente', level: 'alto', text: 'PAR-Q: assinatura pendente', last: null };
  if (last.hash !== docHash(parqDocText(parq))) return { code: 'desatualizada', level: 'moderado', text: `PAR-Q: triagem alterada após a assinatura de ${Utils.formatDateBR(last.signedAt.slice(0, 10))} — colher nova assinatura`, last };
  return { code: 'assinada', level: 'leve', text: `PAR-Q assinado em ${Utils.formatDateBR(last.signedAt.slice(0, 10))}`, last };
}

// ---------- Assinatura na tela ----------
function setupSignaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  const state = { strokes: 0, drawing: false, last: null };
  function resize() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10213A';
    state.strokes = 0;
  }
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    state.drawing = true; state.last = pos(e);
    ctx.beginPath(); ctx.arc(state.last.x, state.last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#10213A'; ctx.fill();
    state.strokes += 1;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!state.drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.beginPath(); ctx.moveTo(state.last.x, state.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    state.last = p;
  });
  const end = () => { state.drawing = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
  resize();
  return {
    clear() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.restore(); state.strokes = 0; },
    isEmpty() { return state.strokes === 0; },
    // PNG transparente reduzido (até 600 px de largura) para não pesar no backup.
    toDataURL() {
      const w = Math.min(600, canvas.width);
      const h = Math.round(canvas.height * (w / canvas.width));
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      out.getContext('2d').drawImage(canvas, 0, 0, w, h);
      return out.toDataURL('image/png');
    },
    resize,
  };
}

function openSignModal(student, type) {
  const esc = Utils.escapeHtml;
  const isParq = type === 'parq';
  const parq = student.anamnesis?.parq;
  if (isParq && (!parq || !parq.date)) { Utils.toast('Preencha e salve a triagem PAR-Q na aba Anamnese antes de colher a assinatura.', 'error'); return; }
  const title = isParq ? 'Triagem de Prontidão para Atividade Física (PAR-Q)' : orientationsTitle();
  const body = isParq ? parqDocText(parq) : renderOrientationsText();
  const declaration = isParq ? PARQ_DECLARATION : ORIENTATIONS_DECLARATION;

  const overlay = Utils.el(`
    <div class="mp-sign-overlay">
      <div class="mp-sign-sheet">
        <div class="mp-sign-head">
          <div>
            <div class="mp-sign-eyebrow">${esc(Profile.signatureLine() || Profile.brandLine())}</div>
            <h3>${esc(title)}</h3>
            <div class="mp-sign-student">Aluno(a): <strong>${esc(student.name)}</strong> · ${Utils.formatDateBR(Utils.todayISO())}</div>
          </div>
          <button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-sg="cancel">Fechar</button>
        </div>
        <div class="mp-sign-doc">${docTextHtml(body)}</div>
        <div class="mp-sign-form">
          ${isParq ? '' : `
          <div class="mp-sign-q">Uso de imagem (fotos e vídeos das aulas para divulgação):</div>
          <div class="mp-yesno" style="margin-bottom:12px;">
            <button type="button" class="mp-yesno-btn" data-img="1" style="min-width:0;flex:1 1 150px;">Autorizo</button>
            <button type="button" class="mp-yesno-btn" data-img="0" style="min-width:0;flex:1 1 150px;">Não autorizo</button>
          </div>`}
          <label class="mp-sign-check"><input type="checkbox" id="sg-agree"> <span>${esc(declaration)}</span></label>
          <div class="mp-form-row mp-row2" style="margin-top:10px;">
            <div class="mp-field"><label>Quem assina</label>
              <select id="sg-role"><option value="aluno">O(a) próprio(a) aluno(a)</option><option value="responsavel">Responsável pelo(a) aluno(a)</option></select>
            </div>
            <div class="mp-field"><label>Nome de quem assina</label><input type="text" id="sg-name" value="${esc(student.name)}"></div>
          </div>
          <div class="mp-sign-pad-label"><span>Assine com o dedo no quadro abaixo</span><button type="button" class="mp-link-btn" data-sg="clear">Limpar</button></div>
          <canvas class="mp-sign-pad" id="sg-pad"></canvas>
          <div class="mp-sign-actions">
            <button type="button" class="mp-btn mp-btn-ghost" data-sg="cancel">Cancelar</button>
            <button type="button" class="mp-btn mp-btn-gold" data-sg="save" style="background:var(--verde-principal);color:#fff;">Assinar e salvar</button>
          </div>
        </div>
      </div>
    </div>`);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  const pad = setupSignaturePad(overlay.querySelector('#sg-pad'));
  let imageConsent = null;
  const close = () => { overlay.remove(); document.body.style.overflow = ''; };

  overlay.querySelectorAll('[data-img]').forEach((b) => b.addEventListener('click', () => {
    imageConsent = b.dataset.img === '1';
    overlay.querySelectorAll('[data-img]').forEach((x) => x.classList.remove('mp-yesno-btn--active-yes', 'mp-yesno-btn--active-no'));
    b.classList.add(imageConsent ? 'mp-yesno-btn--active-yes' : 'mp-yesno-btn--active-no');
  }));
  overlay.querySelector('#sg-role').addEventListener('change', (e) => {
    const nameInput = overlay.querySelector('#sg-name');
    nameInput.value = e.target.value === 'aluno' ? student.name : '';
    if (e.target.value === 'responsavel') nameInput.focus();
  });
  overlay.querySelectorAll('[data-sg="cancel"]').forEach((b) => b.addEventListener('click', close));
  overlay.querySelector('[data-sg="clear"]').addEventListener('click', () => pad.clear());
  overlay.querySelector('[data-sg="save"]').addEventListener('click', async () => {
    if (!isParq && imageConsent === null) { Utils.toast('Marque se autoriza ou não o uso de imagem.', 'error'); return; }
    if (!overlay.querySelector('#sg-agree').checked) { Utils.toast('Marque a declaração de concordância antes de assinar.', 'error'); return; }
    const signerName = overlay.querySelector('#sg-name').value.trim();
    if (!signerName) { Utils.toast('Informe o nome de quem está assinando.', 'error'); return; }
    if (pad.isEmpty()) { Utils.toast('A assinatura está em branco.', 'error'); return; }
    const record = {
      id: dbUuid(),
      type,
      title,
      text: body,
      declaration,
      hash: docHash(body),
      signedAt: new Date().toISOString(),
      signerRole: overlay.querySelector('#sg-role').value,
      signerName,
      imageConsent: isParq ? null : imageConsent,
      signature: pad.toDataURL(),
      professional: Profile.signatureLine(),
      parqDate: isParq ? parq.date : null,
    };
    const docs = [...(student.signedDocs || []), record];
    await updateCurrentStudent({ signedDocs: docs, ...(isParq ? {} : { imageConsent }) });
    if (typeof invalidateAdminData === 'function') invalidateAdminData();
    close();
    render();
    askShareAfterSign(student, record);
  });
}

function askShareAfterSign(student, record) {
  const overlay = Utils.el(`
    <div class="modal-overlay">
      <div class="modal">
        <p class="modal__message"><strong>Documento assinado ✓</strong><br>Deseja enviar o PDF assinado para ${Utils.escapeHtml(student.name.split(' ')[0])} como comprovante?</p>
        <div class="modal__actions">
          <button class="mp-btn mp-btn-ghost" data-a="no" type="button">Agora não</button>
          <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-a="yes" type="button">📤 Enviar PDF</button>
        </div>
      </div>
    </div>`);
  overlay.addEventListener('click', (e) => {
    const a = e.target.dataset.a;
    if (a || e.target === overlay) overlay.remove();
    if (a === 'yes') shareSignedPdf(student, record);
  });
  document.body.appendChild(overlay);
}

// ---------- PDF ----------
function loadJsPdf() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jspdf.umd.min.js';
    s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('gerador de PDF inválido')));
    s.onerror = () => reject(new Error('arquivo js/vendor/jspdf.umd.min.js não encontrado — envie-o ao GitHub'));
    document.head.appendChild(s);
  });
}

// As fontes padrão do PDF cobrem os acentos do português, mas não travessão, aspas curvas etc.
function pdfSafe(t) {
  return String(t ?? '')
    .replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, '...').replace(/[•·]/g, '·').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g, '');
}

function imageToDataUrl(src) {
  if (!src) return Promise.resolve(null);
  if (src.startsWith('data:')) return Promise.resolve(src);
  return fetch(src).then((r) => r.blob()).then((b) => new Promise((res) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b);
  })).catch(() => null);
}

function imageSize(dataUrl) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.onerror = () => res(null); i.src = dataUrl; });
}

// record: documento assinado (ou null para a versão "para leitura", sem assinatura).
async function buildDocPdf(student, { title, text, declaration, record }) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 18, CW = W - M * 2, BOTTOM = 280;
  const GOLD = [184, 146, 74], DARK = [22, 36, 29], MUTED = [110, 110, 110];
  let y = M;

  // Cabeçalho
  const logo = await imageToDataUrl(Profile.logoSrc());
  let textX = M;
  if (logo) {
    const sz = await imageSize(logo);
    if (sz) {
      const h = 16, w = Math.min(40, (sz.w / sz.h) * h);
      try { doc.addImage(logo, logo.includes('image/png') ? 'PNG' : 'JPEG', M, y, w, h); textX = M + w + 5; } catch (e) { /* logo inválida: segue sem */ }
    }
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...GOLD);
  doc.text(pdfSafe(Profile.brandLine()).toUpperCase(), textX, y + 3.5);
  doc.setFontSize(14); doc.setTextColor(...DARK);
  const titleLines = doc.splitTextToSize(pdfSafe(title), W - M - textX);
  doc.text(titleLines, textX, y + 9.5);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  const profLine = [Profile.signatureLine(), Profile.contactLine()].filter(Boolean).join(' · ');
  const profY = y + 9.5 + titleLines.length * 5.6;
  if (profLine) doc.text(doc.splitTextToSize(pdfSafe(profLine), W - M - textX), textX, profY);
  y = Math.max(y + 18, profY + 3);
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.7); doc.line(M, y, W - M, y);
  y += 7;

  doc.setFontSize(10); doc.setTextColor(...DARK);
  const studentLine = `Aluno(a): ${student.name}${student.cpf ? ` · CPF ${student.cpf}` : ''}`;
  doc.setFont('helvetica', 'bold'); doc.text(pdfSafe(studentLine), M, y);
  doc.setFont('helvetica', 'normal');
  doc.text(pdfSafe(record ? `Assinado em ${fmtDateTimeBR(record.signedAt)}` : `Emitido em ${Utils.formatDateBR(Utils.todayISO())}`), W - M, y, { align: 'right' });
  y += 8;

  const ensure = (h) => { if (y + h > BOTTOM) { doc.addPage(); y = M; } };

  // Corpo
  parseDocText(text).forEach((b) => {
    if (b.type === 'h') {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(pdfSafe(b.text), CW);
      ensure(lines.length * 5 + 6); y += 2.5;
      doc.text(lines, M, y); y += lines.length * 5 + 1;
    } else if (b.type === 'li') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(pdfSafe(b.text), CW - 5);
      ensure(lines.length * 4.6 + 1.5);
      doc.text('-', M + 1, y); doc.text(lines, M + 5, y); y += lines.length * 4.6 + 1.5;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(pdfSafe(b.text), CW);
      ensure(lines.length * 4.6 + 3);
      doc.text(lines, M, y); y += lines.length * 4.6 + 3;
    }
  });

  // Declaração + assinatura
  y += 4;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK);
  const decl = doc.splitTextToSize(pdfSafe(declaration), CW);
  ensure(decl.length * 4.8 + 52);
  doc.text(decl, M, y); y += decl.length * 4.8 + 3;
  if (record && record.imageConsent !== null && record.imageConsent !== undefined) {
    doc.setFont('helvetica', 'normal');
    doc.text(pdfSafe(`Uso de imagem: ${record.imageConsent ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}`), M, y); y += 6;
  } else if (!record && declaration === ORIENTATIONS_DECLARATION) {
    doc.setFont('helvetica', 'normal');
    doc.text('Uso de imagem:  (   ) Autorizo     (   ) Não autorizo', M, y); y += 6;
  }

  y += 4;
  const sigW = 70, sigH = 24;
  if (record?.signature) {
    try { doc.addImage(record.signature, 'PNG', M, y, sigW, sigH); } catch (e) { /* ignora */ }
  }
  y += sigH;
  doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3);
  doc.line(M, y, M + 80, y); doc.line(W - M - 70, y, W - M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...DARK);
  const signer = record ? `${record.signerName}${record.signerRole === 'responsavel' ? ` (responsável por ${student.name})` : ''}` : `${student.name}`;
  doc.text(doc.splitTextToSize(pdfSafe(signer), 80), M, y);
  doc.text(doc.splitTextToSize(pdfSafe(Profile.signatureLine() || 'Profissional responsável'), 70), W - M - 70, y);
  y += 4.5;
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(record ? pdfSafe(`Assinatura eletrônica colhida no app em ${fmtDateTimeBR(record.signedAt)}`) : 'Assinatura do(a) aluno(a) / Data: ____/____/______', M, y);
  doc.text('Profissional responsável', W - M - 70, y);

  // Rodapé com código de verificação e paginação
  const pages = doc.getNumberOfPages();
  const hash = record ? record.hash : docHash(text);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text(pdfSafe(`Documento gerado pelo app Método Pleno · código de verificação do texto: ${hash}`), M, 290);
    doc.text(`Página ${i} de ${pages}`, W - M, 290, { align: 'right' });
  }
  return doc.output('blob');
}

function fileSlug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function sharePdfBlob(blob, filename, message) {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename, text: message });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  Utils.toast('PDF baixado ✓ — anexe o arquivo na conversa do aluno no WhatsApp.', 'success');
}

async function withPdfBusy(fn) {
  Utils.toast('Gerando PDF…', 'info');
  try { await fn(); } catch (e) { console.error(e); Utils.toast('Não foi possível gerar o PDF: ' + (e.message || e), 'error'); }
}

function shareSignedPdf(student, record) {
  return withPdfBusy(async () => {
    const blob = await buildDocPdf(student, { title: record.title, text: record.text, declaration: record.declaration, record });
    const kind = record.type === 'parq' ? 'par-q' : 'orientacoes';
    await sharePdfBlob(blob, `${kind}-assinado-${fileSlug(student.name)}-${record.signedAt.slice(0, 10)}.pdf`,
      `Olá, ${student.name.split(' ')[0]}! Segue o documento "${record.title}" assinado, para o seu controle.`);
  });
}

function shareOrientationsForReading(student) {
  return withPdfBusy(async () => {
    const title = orientationsTitle();
    const blob = await buildDocPdf(student, { title, text: renderOrientationsText(), declaration: ORIENTATIONS_DECLARATION, record: null });
    await sharePdfBlob(blob, `orientacoes-${fileSlug(student.name)}.pdf`,
      `Olá, ${student.name.split(' ')[0]}! Seguem as orientações e regras do nosso acompanhamento. Leia com calma; na próxima aula colhemos sua assinatura no app.`);
  });
}

// ---------- Cadastro do Aluno: card "Documentos do aluno" ----------
function statusPill(st) { return `<span class="mp-pill mp-pill-${st.level}">${Utils.escapeHtml(st.text)}</span>`; }

function registrationCardHtml(student) {
  const esc = Utils.escapeHtml;
  const ori = orientationsStatus(student);
  const pq = parqSignStatus(student);
  const history = [...(student.signedDocs || [])].sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  const btn = (attrs, label, primary) => `<button type="button" class="mp-btn ${primary ? 'mp-btn-gold' : 'mp-btn-ghost'} mp-btn-sm" ${attrs} style="${primary ? 'background:var(--verde-principal);color:#fff;' : 'border-color:var(--verde-suave);color:var(--verde-principal);'}">${label}</button>`;
  return `
  <div class="mp-card" style="margin-top:20px;" id="mp-docs-card">
    <h3>📄 Documentos do aluno</h3>
    <div class="mp-sub" style="margin-top:10px;">Assinatura com o dedo, na tela deste aparelho. Cada assinatura guarda o texto assinado, a data e a hora, e fica salva só aqui (entra no backup).</div>

    <div class="mp-doc-row">
      <div class="mp-doc-row__info">
        <div class="mp-doc-row__title">${esc(orientationsTitle())}</div>
        ${statusPill(ori)}
        ${ori.last && ori.last.imageConsent !== null ? `<div class="mp-doc-row__meta">Uso de imagem: <strong>${ori.last.imageConsent ? 'autorizado' : 'não autorizado'}</strong> · assinado por ${esc(ori.last.signerName)}</div>` : ''}
      </div>
      <div class="mp-doc-row__actions">
        ${btn('data-doc-sign="orientacoes"', ori.code === 'assinada' ? '✍️ Assinar de novo' : '✍️ Colher assinatura', ori.code !== 'assinada')}
        ${btn('data-doc-read="orientacoes"', '📤 Enviar para leitura')}
        ${ori.last ? btn(`data-doc-pdf="${ori.last.id}"`, '📄 PDF assinado') : ''}
      </div>
    </div>

    <div class="mp-doc-row">
      <div class="mp-doc-row__info">
        <div class="mp-doc-row__title">Triagem PAR-Q</div>
        ${statusPill(pq)}
      </div>
      <div class="mp-doc-row__actions">
        ${pq.code === 'sem_parq' ? btn('data-doc-goto="anamnese"', 'Abrir Anamnese', true) : btn('data-doc-sign="parq"', pq.code === 'assinada' ? '✍️ Assinar de novo' : '✍️ Colher assinatura', pq.code !== 'assinada')}
        ${pq.last ? btn(`data-doc-pdf="${pq.last.id}"`, '📄 PDF assinado') : ''}
      </div>
    </div>

    ${history.length ? `
    <details class="mp-doc-history">
      <summary>Histórico de assinaturas (${history.length})</summary>
      ${history.map((d) => `
        <div class="mp-doc-hist-row">
          <span>${esc(DOC_TYPES[d.type] || d.title)} · ${fmtDateTimeBR(d.signedAt)} · ${esc(d.signerName)}${d.signerRole === 'responsavel' ? ' (responsável)' : ''}</span>
          <button type="button" class="mp-link-btn" data-doc-pdf="${d.id}">PDF</button>
        </div>`).join('')}
    </details>` : ''}
  </div>`;
}

function registrationBind(container, student) {
  container.querySelectorAll('[data-doc-sign]').forEach((b) => b.addEventListener('click', () => openSignModal(student, b.dataset.docSign)));
  container.querySelectorAll('[data-doc-read]').forEach((b) => b.addEventListener('click', () => shareOrientationsForReading(student)));
  container.querySelectorAll('[data-doc-pdf]').forEach((b) => b.addEventListener('click', () => {
    const rec = (student.signedDocs || []).find((d) => d.id === b.dataset.docPdf);
    if (rec) shareSignedPdf(student, rec);
  }));
  container.querySelectorAll('[data-doc-goto]').forEach((b) => b.addEventListener('click', () => { AppState.activeTab = b.dataset.docGoto; render(); }));
}

// ---------- Anamnese: linha de assinatura do PAR-Q ----------
function parqSignRowHtml(student) {
  const st = parqSignStatus(student);
  if (st.code === 'sem_parq') return `<div class="mp-sub" style="margin:0 0 12px;">Depois de salvar a triagem, colha a assinatura do aluno aqui mesmo.</div>`;
  return `
    <div class="mp-doc-row" style="margin:0 0 14px;">
      <div class="mp-doc-row__info">${statusPill(st)}</div>
      <div class="mp-doc-row__actions">
        <button type="button" class="mp-btn ${st.code === 'assinada' ? 'mp-btn-ghost' : 'mp-btn-gold'} mp-btn-sm" data-parq-sign style="${st.code === 'assinada' ? 'border-color:var(--verde-suave);color:var(--verde-principal);' : 'background:var(--verde-principal);color:#fff;'}">✍️ ${st.code === 'assinada' ? 'Assinar de novo' : 'Assinar PAR-Q'}</button>
        ${st.last ? `<button type="button" class="mp-btn mp-btn-ghost mp-btn-sm" data-parq-pdf style="border-color:var(--verde-suave);color:var(--verde-principal);">📄 PDF assinado</button>` : ''}
      </div>
    </div>`;
}

function parqSignBind(container, student) {
  container.querySelector('[data-parq-sign]')?.addEventListener('click', () => openSignModal(student, 'parq'));
  container.querySelector('[data-parq-pdf]')?.addEventListener('click', () => {
    const last = signedDocsOf(student, 'parq')[0];
    if (last) shareSignedPdf(student, last);
  });
}

// ---------- Configurações: editor das Orientações ----------
function settingsCardHtml(s) {
  const esc = Utils.escapeHtml;
  const custom = !!(s.orientationsTemplate || '').trim();
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>📄 Orientações e regras para o aluno</h3>
    <div class="mp-sub" style="margin-top:10px;">Texto que o aluno lê e assina (Cadastro do Aluno → Documentos). Os marcadores entre chaves são preenchidos com as regras de desmarcação, reposição e férias acima, então o texto nunca fica diferente do cálculo do Controle de Pagamento.</div>
    <div class="mp-field"><label>Título do documento</label><input type="text" id="cfg-ori-title" value="${esc(orientationsTitle(s))}"></div>
    <div class="mp-field">
      <label>Texto ${custom ? '(personalizado)' : '(padrão)'}</label>
      <textarea id="cfg-ori-text" rows="16" style="font-size:13px;line-height:1.5;">${esc(orientationsTemplate(s))}</textarea>
    </div>
    <div class="mp-sub" style="margin:4px 0 10px;">Formatação: linha começando com <strong>## </strong> vira título de seção; com <strong>- </strong> vira item de lista. Marcadores disponíveis: ${ORIENTATION_PLACEHOLDERS.map((p) => `<code>{${p.key}}</code> (${esc(p.help)})`).join(', ')}.</div>
    <div class="mp-sub" style="margin:0 0 12px;color:var(--texto);">Ao mudar o texto (ou as regras), os alunos que já assinaram passam a aparecer como <strong>"colher nova assinatura"</strong>. As assinaturas antigas continuam guardadas no histórico.</div>
    <div class="mp-form-actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
      <button type="button" class="mp-btn mp-btn-ghost" id="cfg-ori-reset">Restaurar texto padrão</button>
      <button type="button" class="mp-btn mp-btn-ghost" id="cfg-ori-preview" style="border-color:var(--verde-suave);color:var(--verde-principal);">Pré-visualizar</button>
      <button type="button" class="mp-btn mp-btn-gold" id="cfg-ori-save" style="background:var(--verde-principal);color:#fff;">Salvar orientações</button>
    </div>
    <div id="cfg-ori-preview-box" class="mp-sign-doc" style="display:none;margin-top:14px;max-height:none;"></div>
  </div>`;
}

function settingsBind(container) {
  const ta = container.querySelector('#cfg-ori-text');
  if (!ta) return;
  container.querySelector('#cfg-ori-reset').addEventListener('click', () => { ta.value = DEFAULT_ORIENTATIONS_TEMPLATE; Utils.toast('Texto padrão restaurado — clique em Salvar para confirmar.', 'info'); });
  container.querySelector('#cfg-ori-preview').addEventListener('click', () => {
    const box = container.querySelector('#cfg-ori-preview-box');
    box.innerHTML = `<h4 class="mp-doc-h" style="font-size:16px;">${Utils.escapeHtml(container.querySelector('#cfg-ori-title').value || DEFAULT_ORIENTATIONS_TITLE)}</h4>` + docTextHtml(renderOrientationsText(AppState.settings, ta.value));
    box.style.display = '';
  });
  container.querySelector('#cfg-ori-save').addEventListener('click', async () => {
    const text = ta.value.trim();
    const title = container.querySelector('#cfg-ori-title').value.trim();
    await saveSettingsPatch({
      orientationsTemplate: text === DEFAULT_ORIENTATIONS_TEMPLATE.trim() ? '' : text,
      orientationsTitle: title === DEFAULT_ORIENTATIONS_TITLE ? '' : title,
    });
    if (typeof invalidateAdminData === 'function') invalidateAdminData();
    Utils.toast('Orientações salvas ✓', 'success');
    render();
  });
}

// ---------- Administrativo: documentos pendentes ----------
function adminCardHtml(students) {
  const esc = Utils.escapeHtml;
  const rows = students.map((s) => ({ s, ori: orientationsStatus(s), pq: parqSignStatus(s) }))
    .filter((r) => r.ori.code !== 'assinada' || (r.pq.code !== 'assinada' && r.pq.code !== 'sem_parq'))
    .sort((a, b) => a.s.name.localeCompare(b.s.name, 'pt-BR'));
  const label = (st) => {
    const map = { assinada: ['leve', 'Assinado'], pendente: ['alto', 'Pendente'], desatualizada: ['moderado', 'Nova assinatura'], sem_parq: ['moderado', 'Sem triagem'] };
    const [lvl, txt] = map[st.code] || ['moderado', st.code];
    return `<span class="mp-pill mp-pill-${lvl}">${txt}</span>`;
  };
  return `
  <div class="mp-card" style="margin-top:20px;">
    <h3>📄 Documentos pendentes de assinatura</h3>
    <div class="mp-sub" style="margin-top:10px;">Alunos que ainda não assinaram as orientações vigentes ou o PAR-Q atual. Para colher a assinatura, abra o aluno em Cadastro do Aluno → Documentos.</div>
    ${rows.length ? `
    <div class="mp-table-scroll" style="margin-top:14px;">
    <table class="mp-table">
      <thead><tr><th>Aluno</th><th>Orientações</th><th>PAR-Q</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td><button type="button" class="mp-link-btn" data-doc-student="${r.s.id}">${esc(r.s.name)}</button></td><td>${label(r.ori)}</td><td>${label(r.pq)}</td></tr>`).join('')}</tbody>
    </table>
    </div>` : '<div class="mp-sub" style="margin:14px 0 0;">Todos os documentos estão assinados. ✓</div>'}
  </div>`;
}

function adminBind(container) {
  container.querySelectorAll('[data-doc-student]').forEach((b) => b.addEventListener('click', async () => {
    AppState.activeTab = 'cadastro';
    await switchStudent(b.dataset.docStudent);
    setTimeout(() => document.getElementById('mp-docs-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }));
}

window.StudentDocs = {
  DEFAULT_ORIENTATIONS_TEMPLATE,
  renderOrientationsText,
  orientationsStatus,
  parqSignStatus,
  openSignModal,
  registrationCardHtml,
  registrationBind,
  parqSignRowHtml,
  parqSignBind,
  settingsCardHtml,
  settingsBind,
  adminCardHtml,
  adminBind,
  buildDocPdf,
};

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['documents.js'] = 'v1.17.0';
