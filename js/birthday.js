// Aniversariantes do dia — banner visível no topo + mensagem de parabéns pronta para WhatsApp.
// Funciona com ou sem aula marcada no dia. Tudo local, nada sai do aparelho sem uma ação sua.
// Quem nasceu em 29/02 é celebrado em 28/02 nos anos não bissextos.

function bdIsLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

// Retorna [{ student, age }] dos alunos que fazem aniversário em `todayISO`.
function bdTodayList(students, todayISO) {
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const out = [];
  (students || []).forEach((s) => {
    if (!s || !s.birthDate) return;
    const [by, bm, bd] = String(s.birthDate).split('-').map(Number);
    if (!by || !bm || !bd) return;
    let m = bm, d = bd;
    if (m === 2 && d === 29 && !bdIsLeap(ty)) d = 28;
    if (m === tm && d === td) {
      const age = ty - by;
      if (age >= 0 && age < 130) out.push({ student: s, age });
    }
  });
  return out.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'pt-BR'));
}

function bdFirstName(s) { return ((s && s.name) || '').trim().split(/\s+/)[0] || 'Aluno(a)'; }

// Alguns navegadores/WhatsApp Web corrompem emojis "grandes" (🎂🎉💪…) quando vão dentro do link
// wa.me — viram "�". Para o LINK uso só símbolos simples (✨ ❤), que passam sempre. A mensagem
// copiada (botão "Copiar mensagem") mantém os emojis completos.
function bdMessage(student, age, safe) {
  const who = (window.Profile && Profile.signatureLine && Profile.signatureLine()) || '';
  return [
    `${safe ? '✨' : '🎂🎉'} Parabéns, ${bdFirstName(student)}!`,
    '',
    `Hoje é o seu dia, e comemorar ${age} anos com tanta disposição é motivo de muita alegria!${safe ? ' ✨' : ' 🥳'}`,
    'Que este novo ciclo traga saúde, energia, paz e muitos momentos bons ao lado de quem você ama.',
    'Tenho muito orgulho da sua dedicação e é uma honra acompanhar a sua evolução.' + (safe ? ' ❤' : ' 💪💛'),
    '',
    'Um grande abraço e feliz aniversário!',
    who ? `— ${who}` : '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
}

function bdWaUrl(student, age) {
  const digits = String(student.phone || '').replace(/\D/g, '');
  const phone = digits.length >= 10 ? (digits.length <= 11 ? '55' + digits : digits) : '';
  return `https://wa.me/${phone}?text=${encodeURIComponent(bdMessage(student, age, true))}`;
}

function bdBannerHtml() {
  if (!window.AppState || !AppState.students || !AppState.students.length) return '';
  const list = bdTodayList(AppState.students, Utils.todayISO());
  if (!list.length) return '';
  const esc = Utils.escapeHtml;
  return list.map(({ student, age }) => `
    <div class="mp-birthday-banner" role="status">
      <div class="mp-birthday-icon">🎂</div>
      <div class="mp-birthday-text">
        <div class="mp-birthday-title">Hoje é aniversário de <strong>${esc(student.name)}</strong>!</div>
        <div class="mp-birthday-sub">Completa <strong>${age} anos</strong> hoje. Que tal dar os parabéns na aula? 🎉</div>
      </div>
      <button type="button" class="mp-btn mp-btn-gold mp-btn-sm" data-bday-wa="${esc(student.id)}">💬 Enviar parabéns</button>
      <button type="button" class="mp-btn mp-btn-outline mp-btn-sm" data-bday-copy="${esc(student.id)}">📋 Copiar mensagem</button>
    </div>`).join('');
}

function bdBindEvents() {
  const find = (id) => bdTodayList(AppState.students, Utils.todayISO()).find((x) => String(x.student.id) === String(id));
  document.querySelectorAll('[data-bday-wa]').forEach((btn) => btn.addEventListener('click', () => {
    const it = find(btn.dataset.bdayWa);
    if (!it) return;
    window.open(bdWaUrl(it.student, it.age), '_blank');
  }));
  document.querySelectorAll('[data-bday-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const it = find(btn.dataset.bdayCopy);
    if (!it) return;
    try { await navigator.clipboard.writeText(bdMessage(it.student, it.age)); Utils.toast('Mensagem copiada ✓', 'success'); }
    catch (e) { Utils.toast('Não foi possível copiar neste aparelho.', 'error'); }
  }));
}

window.Birthday = { todayList: bdTodayList, message: bdMessage, waUrl: bdWaUrl, bannerHtml: bdBannerHtml, bindEvents: bdBindEvents };

// Carimbo de versão (verificação de integridade do app — ver app.js)
(window.MP_BUILD = window.MP_BUILD || {})['birthday.js'] = 'v1.20.1';
