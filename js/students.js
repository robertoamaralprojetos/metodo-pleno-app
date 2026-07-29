// Dados de Alunos — CRUD básico. A edição completa do cadastro vive na
// aba "Cadastro do Aluno" (registration.js).

async function listStudents({ activeOnly = true } = {}) {
  const all = await DB.getAll(DB.STORES.students);
  const filtered = activeOnly ? all.filter((s) => s.active !== false) : all;
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

async function createStudent({ name, birthDate = null, sex = 'F', notes = '' }) {
  const record = {
    id: dbUuid(),
    name,
    birthDate,
    sex,
    notes,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await DB.put(DB.STORES.students, record);
  return record;
}

async function updateStudent(record) {
  record.updatedAt = new Date().toISOString();
  await DB.put(DB.STORES.students, record);
  return record;
}

window.StudentsData = { listStudents, createStudent, updateStudent };
