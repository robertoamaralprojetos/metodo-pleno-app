// Dados e edição de Alunos (o cadastro básico vive na barra do cabeçalho,
// igual ao protótipo; aqui ficam os helpers de CRUD e o modal de edição).

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

function openEditStudentModal(student, onSaved) {
  const overlay = Utils.el(`
    <div class="modal-overlay">
      <div class="modal" style="max-width:420px;">
        <h3 style="font-family:'Fraunces',serif;">Dados do aluno</h3>
        <div class="mp-field"><label>Nome completo</label><input id="es-name" value="${Utils.escapeHtml(student.name)}"></div>
        <div class="mp-form-row mp-row2">
          <div class="mp-field"><label>Data de nascimento</label><input type="date" id="es-birth" value="${student.birthDate || ''}"></div>
          <div class="mp-field"><label>Sexo</label>
            <select id="es-sex">
              <option value="F" ${student.sex === 'F' ? 'selected' : ''}>Feminino</option>
              <option value="M" ${student.sex === 'M' ? 'selected' : ''}>Masculino</option>
            </select>
          </div>
        </div>
        <div class="mp-field"><label>Observações de saúde / restrições</label><textarea id="es-notes" rows="3">${Utils.escapeHtml(student.notes || '')}</textarea></div>
        <div class="modal__actions">
          <button class="mp-btn mp-btn-danger" id="es-delete" type="button" style="margin-right:auto;">Remover aluno</button>
          <button class="mp-btn mp-btn-ghost" id="es-cancel" type="button">Cancelar</button>
          <button class="mp-btn mp-btn-gold" id="es-save" type="button" style="background:var(--verde-principal);color:#fff;">Salvar</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(overlay);

  overlay.querySelector('#es-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#es-save').addEventListener('click', async () => {
    const name = overlay.querySelector('#es-name').value.trim();
    if (!name) { Utils.toast('Informe o nome do aluno.', 'error'); return; }
    student.name = name;
    student.birthDate = overlay.querySelector('#es-birth').value || null;
    student.sex = overlay.querySelector('#es-sex').value;
    student.notes = overlay.querySelector('#es-notes').value.trim();
    await updateStudent(student);
    overlay.remove();
    Utils.toast('Dados do aluno atualizados.', 'success');
    if (onSaved) onSaved();
  });

  overlay.querySelector('#es-delete').addEventListener('click', async () => {
    const ok = await Utils.confirmDialog(`Remover "${student.name}" da lista de alunos? O histórico não é apagado.`);
    if (!ok) return;
    student.active = false;
    await updateStudent(student);
    overlay.remove();
    Utils.toast('Aluno removido da lista.', 'info');
    if (onSaved) onSaved(true);
  });
}

window.StudentsData = { listStudents, createStudent, updateStudent, openEditStudentModal };
