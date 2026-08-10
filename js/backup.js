// Backup completo (todos os alunos e dados) em JSON — para não perder tudo
// se o aparelho for trocado ou perdido. Local, sem servidor.
// DB.exportAll() já percorre TODAS as stores (incluindo "students"), então o arquivo gerado
// sempre inclui todos os alunos cadastrados de uma vez — não só o aluno selecionado no momento.

async function exportBackup() {
  try {
    const data = await DB.exportAll();
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
