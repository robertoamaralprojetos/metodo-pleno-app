// Backup completo (todos os alunos e dados) em JSON — para não perder tudo
// se o aparelho for trocado ou perdido. Local, sem servidor.
// DB.exportAll() já percorre TODAS as stores (incluindo "students"), então o arquivo gerado
// sempre inclui todos os alunos cadastrados de uma vez — não só o aluno selecionado no momento.

// Pergunta se as fotos posturais entram no backup (aumentam bastante o arquivo).
// Devolve 'com', 'sem' ou null (cancelou).
function askBackupPhotoChoice() {
  return new Promise((resolve) => {
    const overlay = Utils.el(`
      <div class="modal-overlay">
        <div class="modal">
          <p class="modal__message">Há fotos posturais salvas. Incluí-las no backup deixa o arquivo bem maior. Sem elas, as fotos <strong>não voltam</strong> se você restaurar este backup em outro aparelho.</p>
          <div class="modal__actions">
            <button class="mp-btn mp-btn-ghost" data-choice="cancel" type="button">Cancelar</button>
            <button class="mp-btn mp-btn-outline" data-choice="sem" type="button">Sem as fotos</button>
            <button class="mp-btn mp-btn-gold" style="background:var(--verde-principal);color:#fff;" data-choice="com" type="button">Incluir fotos</button>
          </div>
        </div>
      </div>`);
    overlay.addEventListener('click', (e) => {
      const c = e.target.dataset.choice;
      if (c) { overlay.remove(); resolve(c === 'cancel' ? null : c); }
      else if (e.target === overlay) { overlay.remove(); resolve(null); }
    });
    document.body.appendChild(overlay);
  });
}

async function exportBackup() {
  try {
    const data = await DB.exportAll();
    const withPhotos = (data.posturalEvaluations || []).some((ev) => ev.photos && Object.values(ev.photos).some(Boolean));
    if (withPhotos) {
      const choice = await askBackupPhotoChoice();
      if (choice === null) return;
      if (choice === 'sem') {
        data.posturalEvaluations = data.posturalEvaluations.map((ev) => ({ ...ev, photos: {}, photosOmitted: true }));
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = Utils.todayISO();
    a.href = url;
    a.download = `metodo-pleno-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    await saveSettingsPatch({ lastBackupAt: Utils.todayISO() });
    render();
    Utils.toast('Backup exportado ✓ — guarde este arquivo em local seguro.', 'success');
  } catch (e) {
    Utils.toast('Não foi possível gerar o backup: ' + (e.message || 'erro desconhecido'), 'error');
  }
}

// Dias desde o último backup (null se nunca foi feito).
function daysSinceBackup(lastBackupAt) {
  if (!lastBackupAt) return null;
  return -Utils.daysUntil(lastBackupAt);
}

// Verdadeiro se nunca houve backup, ou se já se passaram mais de 7 dias desde o último.
function needsBackupReminder(settings) {
  if (!settings) return false;
  if (!settings.lastBackupAt) return true;
  return daysSinceBackup(settings.lastBackupAt) > 7;
}

async function importBackup(file) {
  const ok = await Utils.confirmDialog('Restaurar este backup substitui TODOS os dados atuais do painel (alunos, planos, sessões e avaliações). Deseja continuar?');
  if (!ok) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await DB.importAll(data);
    Utils.toast('Backup restaurado ✓', 'success');
    AppState.students = await StudentsData.listStudents();
    await switchStudent(AppState.students[0]?.id || null);
  } catch (e) {
    Utils.toast('Arquivo de backup inválido: ' + (e.message || 'erro ao ler o arquivo'), 'error');
  }
}

window.BackupModule = { exportBackup, importBackup, daysSinceBackup, needsBackupReminder };
