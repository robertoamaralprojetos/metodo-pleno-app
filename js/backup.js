// Backup completo (todos os alunos e dados) em JSON — para não perder tudo
// se o aparelho for trocado ou perdido. Local, sem servidor.

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
    Utils.toast('Backup exportado ✓ — guarde este arquivo em local seguro.', 'success');
  } catch (e) {
    Utils.toast('Não foi possível gerar o backup: ' + (e.message || 'erro desconhecido'), 'error');
  }
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

window.BackupModule = { exportBackup, importBackup };
