// Estado central do app — Método Pleno
// Um aluno "ativo" por vez (igual ao protótipo), dados carregados em memória
// e persistidos no IndexedDB a cada alteração.

const EMPTY_STUDENT_DATA = { sessions: [], plans: [], evaluations: [], payments: [], cancellations: [], physicalEvaluations: [], dailyMeta: [] };

const AppState = {
  students: [],
  currentId: null,
  data: { ...EMPTY_STUDENT_DATA },
  activeTab: 'plano',
  loading: true,
  planDate: null,
  execDate: null,
  adminData: null,
};

async function loadStudentData(id) {
  const [sessions, plans, evaluations, payments, cancellations, physicalEvaluations, dailyMeta] = await Promise.all([
    DB.getAllByIndex(DB.STORES.sessions, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.lessonPlans, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.functionalEvaluations, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.payments, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.cancellations, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.physicalEvaluations, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.dailySessionMeta, 'byStudent', id),
  ]);
  return { sessions, plans, evaluations, payments, cancellations, physicalEvaluations, dailyMeta };
}

async function stateInit() {
  AppState.students = await StudentsData.listStudents();
  if (AppState.students.length) {
    AppState.currentId = AppState.students[0].id;
    AppState.data = await loadStudentData(AppState.currentId);
  }
  AppState.loading = false;
  render();
}

async function switchStudent(id) {
  AppState.currentId = id;
  AppState.planDate = null;
  AppState.execDate = null;
  AppState.data = id ? await loadStudentData(id) : { ...EMPTY_STUDENT_DATA };
  render();
}

async function addStudentQuick(name) {
  const clean = (name || '').trim();
  if (!clean) return;
  const student = await StudentsData.createStudent({ name: clean });
  AppState.students = await StudentsData.listStudents();
  await switchStudent(student.id);
}

function currentStudent() {
  return AppState.students.find((s) => s.id === AppState.currentId) || null;
}

// Atualiza campos do aluno atual em memória e persiste no IndexedDB.
async function updateCurrentStudent(patch) {
  const student = currentStudent();
  if (!student) return null;
  Object.assign(student, patch);
  await StudentsData.updateStudent(student);
  return student;
}

function getPlanByDate(date) {
  return AppState.data.plans.find((p) => p.date === date) || null;
}

function ensurePlan(date) {
  let plan = getPlanByDate(date);
  if (!plan) {
    plan = { id: dbUuid(), studentId: AppState.currentId, date, items: [] };
    AppState.data.plans.push(plan);
  }
  return plan;
}

async function persistPlan(plan) {
  await DB.put(DB.STORES.lessonPlans, plan);
}

function dailyMetaId(studentId, date) { return `${studentId}__${date}`; }

function getDailyMeta(date) {
  return AppState.data.dailyMeta.find((m) => m.date === date) || null;
}

// Retorna (criando em memória se preciso) a "ficha do dia" do aluno atual. Não persiste
// sozinha — quem chamar deve salvar via persistDailyMeta() após ajustar os campos.
function ensureDailyMeta(date) {
  let meta = getDailyMeta(date);
  if (!meta) {
    meta = { id: dailyMetaId(AppState.currentId, date), studentId: AppState.currentId, date, borgMode: 'perExercise', overallBorg: null, updatedAt: new Date().toISOString() };
    AppState.data.dailyMeta.push(meta);
  }
  return meta;
}

async function persistDailyMeta(meta) {
  meta.updatedAt = new Date().toISOString();
  await DB.put(DB.STORES.dailySessionMeta, meta);
}

// Borg efetivo de um dia: nota única (modo "treino geral") ou média dos Borgs individuais
// daquele dia (modo "por exercício" — inclui dias antigos, sem ficha registrada).
function computeDailyBorg(sessions, dailyMeta, date) {
  const meta = dailyMeta.find((m) => m.date === date);
  if (meta && meta.borgMode === 'overall') {
    return meta.overallBorg != null ? meta.overallBorg : null;
  }
  const values = sessions.filter((s) => s.date === date && s.borg != null).map((s) => s.borg);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function exerciseList() {
  const set = new Set(AppState.data.sessions.map((s) => s.exerciseName));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Cores de elástico já usadas por este aluno (sessões + itens de plano), para autocomplete.
function elasticColorList() {
  const set = new Set();
  AppState.data.sessions.forEach((s) => { if (s.unit === 'elastico' && s.unitDetail) set.add(s.unitDetail); });
  AppState.data.plans.forEach((p) => p.items.forEach((it) => { if (it.unit === 'elastico' && it.unitDetail) set.add(it.unitDetail); }));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

window.AppState = AppState;
window.stateInit = stateInit;
window.switchStudent = switchStudent;
window.addStudentQuick = addStudentQuick;
window.currentStudent = currentStudent;
window.updateCurrentStudent = updateCurrentStudent;
window.getPlanByDate = getPlanByDate;
window.ensurePlan = ensurePlan;
window.persistPlan = persistPlan;
window.exerciseList = exerciseList;
window.elasticColorList = elasticColorList;
window.dailyMetaId = dailyMetaId;
window.getDailyMeta = getDailyMeta;
window.ensureDailyMeta = ensureDailyMeta;
window.persistDailyMeta = persistDailyMeta;
window.computeDailyBorg = computeDailyBorg;
