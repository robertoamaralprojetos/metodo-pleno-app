// Estado central do app — Método Pleno
// Um aluno "ativo" por vez (igual ao protótipo), dados carregados em memória
// e persistidos no IndexedDB a cada alteração.

const AppState = {
  students: [],
  currentId: null,
  data: { sessions: [], plans: [], evaluations: [] },
  activeTab: 'plano',
  loading: true,
  planDate: null,
  execDate: null,
};

async function loadStudentData(id) {
  const [sessions, plans, evaluations] = await Promise.all([
    DB.getAllByIndex(DB.STORES.sessions, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.lessonPlans, 'byStudent', id),
    DB.getAllByIndex(DB.STORES.functionalEvaluations, 'byStudent', id),
  ]);
  return { sessions, plans, evaluations };
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
  AppState.data = id ? await loadStudentData(id) : { sessions: [], plans: [], evaluations: [] };
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

function exerciseList() {
  const set = new Set(AppState.data.sessions.map((s) => s.exerciseName));
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
