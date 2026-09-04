// Aba: Cadastro do Aluno — ficha completa (dados pessoais, contato, plano de
// aulas/cobrança, atestado médico, estágio de treino). Único lugar de edição
// do perfil do aluno.

function certificateStatus(certDateISO) {
  if (!certDateISO) return null;
  const validUntil = Utils.addYearsISO(certDateISO, 1);
  const days = Utils.daysUntil(validUntil);
  if (days < 0) {
    return { level: 'alto', text: `Atestado vencido há ${Math.abs(days)} dia(s) (validade era ${Utils.formatDateBR(validUntil)})` };
  }
  if (days <= 30) {
    return { level: 'moderado', text: `Atestado vence em ${days} dia(s) — ${Utils.formatDateBR(validUntil)}` };
  }
  return { level: 'leve', text: `Atestado válido até ${Utils.formatDateBR(validUntil)}` };
}

function scheduleRowsHtml(student) {
  const schedule = student.schedule || {};
  const selectedDays = student.weekDays || [];
  return WEEKDAYS.map((d) => {
    const checked = selectedDays.includes(d.key);
    const time = schedule[d.key] || '';
    return `
      <div class="mp-schedule-row">
        <label class="mp-schedule-check">
          <input type="checkbox" class="in-weekday" data-day="${d.key}" ${checked ? 'checked' : ''}>
          ${d.label}
        </label>
        <input type="time" class="in-daytime" data-day="${d.key}" value="${time}" ${checked ? '' : 'disabled'}>
      </div>
    `;
  }).join('');
}

function regRenderHtml() {
  const student = currentStudent();
  if (!student) return '<div class="mp-empty">Selecione ou cadastre um aluno.</div>';

  const age = student.birthDate ? Utils.calcAgeFromBirthDate(student.birthDate) : null;
  const monthlyTotal = (Number(student.hourlyRate) || 0) * (Number(student.monthlySessionsCount) || 0);
  const certStatus = certificateStatus(student.medicalCertificateDate);

  return `
  <div class="mp-card">
    <h3>Dados pessoais</h3>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Data do preenchimento</label><input type="date" id="r-filldate" value="${student.fillDate || Utils.todayISO()}"></div>
      <div class="mp-field"><label>Nome completo</label><input id="r-name" value="${Utils.escapeHtml(student.name || '')}"></div>
    </div>
    <div class="mp-form-row mp-row3">
      <div class="mp-field"><label>Data de nascimento</label><input type="date" id="r-birth" value="${student.birthDate || ''}"></div>
      <div class="mp-field"><label>Idade</label><input id="r-age-display" value="${age != null ? age + ' anos' : '—'}" disabled></div>
      <div class="mp-field"><label>Sexo</label>
        <select id="r-sex">
          <option value="F" ${student.sex === 'F' ? 'selected' : ''}>Feminino</option>
          <option value="M" ${student.sex === 'M' ? 'selected' : ''}>Masculino</option>
        </select>
      </div>
    </div>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>CPF</label><input id="r-cpf" value="${Utils.escapeHtml(student.cpf || '')}" placeholder="000.000.000-00"></div>
      <div class="mp-field"><label>Telefone / WhatsApp</label><input id="r-phone" value="${Utils.escapeHtml(student.phone || '')}" placeholder="(00) 00000-0000"></div>
    </div>
    <div class="mp-field"><label>E-mail</label><input type="email" id="r-email" value="${Utils.escapeHtml(student.email || '')}"></div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Contato de emergência</h3>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Nome</label><input id="r-ec-name" value="${Utils.escapeHtml(student.emergencyContactName || '')}"></div>
      <div class="mp-field"><label>Telefone</label><input id="r-ec-phone" value="${Utils.escapeHtml(student.emergencyContactPhone || '')}" placeholder="(00) 00000-0000"></div>
    </div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Plano de aulas e cobrança</h3>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Atividade</label>
        <select id="r-activity">
          <option value="">Não definida</option>
          ${ACTIVITY_TYPE_OPTIONS.map((a) => `<option value="${a.value}" ${student.activityType === a.value ? 'selected' : ''}>${a.label}</option>`).join('')}
        </select>
      </div>
      <div class="mp-field" id="r-activity-custom-wrap" style="${student.activityType === 'custom' ? '' : 'display:none;'}">
        <label>Qual atividade?</label>
        <input id="r-activity-custom" value="${Utils.escapeHtml(student.activityTypeCustom || '')}" placeholder="Ex: Alongamento terapêutico">
      </div>
    </div>
    <div class="mp-form-row mp-row2">
      <div class="mp-field"><label>Valor da hora/aula (R$)</label><input type="number" min="0" step="0.01" id="r-rate" value="${student.hourlyRate ?? ''}"></div>
      <div class="mp-field"><label>Aulas contratadas por mês</label><input type="number" min="0" step="1" id="r-sessions" value="${student.monthlySessionsCount ?? ''}"></div>
    </div>
    <label style="display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--verde-suave);margin-bottom:6px;">Dias e horários das aulas</label>
    <div id="r-schedule">${scheduleRowsHtml(student)}</div>
    <div class="mp-field" style="margin-top:14px;">
      <label>Valor total a pagar por mês</label>
      <input value="${Utils.formatBRL(monthlyTotal)}" disabled id="r-monthly-total-display">
    </div>
  </div>

  <div class="mp-card" style="margin-top:20px;">
    <h3>Saúde e treino</h3>
    <div class="mp-sub" style="margin-top:10px;">O estágio de treino (adaptação/intermediário/avançado) agora é editado na aba "Planejar Aula", junto com a ficha do dia.</div>
    <div class="mp-field"><label>Data do atestado médico</label><input type="date" id="r-cert" value="${student.medicalCertificateDate || ''}"></div>
    <div id="r-cert-status" style="margin:10px 0 14px;">${certStatus ? `<span class="mp-pill mp-pill-${certStatus.level}">${Utils.escapeHtml(certStatus.text)}</span>` : ''}</div>
    <div class="mp-field">
      <label>Observações de saúde / restrições</label>
      <textarea id="r-notes" rows="3">${Utils.escapeHtml(student.notes || '')}</textarea>
    </div>
  </div>

  <div class="btn-row-wrap" style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;flex-wrap:wrap;">
    <button class="mp-btn mp-btn-danger" id="r-delete" type="button">Remover aluno</button>
    <button class="mp-btn mp-btn-gold" id="r-save" type="button" style="background:var(--verde-principal);color:#fff;">Salvar cadastro</button>
  </div>
  `;
}

function regBindEvents(container) {
  const student = currentStudent();
  if (!student) return;

  const birthInput = container.querySelector('#r-birth');
  const ageDisplay = container.querySelector('#r-age-display');
  if (birthInput) {
    birthInput.addEventListener('change', () => {
      const age = birthInput.value ? Utils.calcAgeFromBirthDate(birthInput.value) : null;
      if (ageDisplay) ageDisplay.value = age != null ? age + ' anos' : '—';
    });
  }

  const activitySelect = container.querySelector('#r-activity');
  const activityCustomWrap = container.querySelector('#r-activity-custom-wrap');
  activitySelect?.addEventListener('change', () => {
    activityCustomWrap.style.display = activitySelect.value === 'custom' ? '' : 'none';
  });

  const rateInput = container.querySelector('#r-rate');
  const sessionsInput = container.querySelector('#r-sessions');
  const totalDisplay = container.querySelector('#r-monthly-total-display');
  function recomputeTotal() {
    const total = (Number(rateInput.value) || 0) * (Number(sessionsInput.value) || 0);
    totalDisplay.value = Utils.formatBRL(total);
  }
  rateInput?.addEventListener('input', recomputeTotal);
  sessionsInput?.addEventListener('input', recomputeTotal);

  const certInput = container.querySelector('#r-cert');
  const certStatusEl = container.querySelector('#r-cert-status');
  certInput?.addEventListener('input', () => {
    const status = certificateStatus(certInput.value);
    certStatusEl.innerHTML = status ? `<span class="mp-pill mp-pill-${status.level}">${Utils.escapeHtml(status.text)}</span>` : '';
  });

  container.querySelectorAll('.in-weekday').forEach((chk) => {
    chk.addEventListener('change', () => {
      const day = chk.dataset.day;
      const timeInput = container.querySelector(`.in-daytime[data-day="${day}"]`);
      timeInput.disabled = !chk.checked;
      if (chk.checked && !timeInput.value) timeInput.value = '08:00';
    });
  });

  container.querySelector('#r-save').addEventListener('click', async () => {
    const name = container.querySelector('#r-name').value.trim();
    if (!name) { Utils.toast('Informe o nome do aluno.', 'error'); return; }

    const weekDays = [];
    const schedule = {};
    container.querySelectorAll('.in-weekday').forEach((chk) => {
      if (chk.checked) {
        const day = chk.dataset.day;
        weekDays.push(day);
        const timeInput = container.querySelector(`.in-daytime[data-day="${day}"]`);
        schedule[day] = timeInput.value || '';
      }
    });

    await updateCurrentStudent({
      fillDate: container.querySelector('#r-filldate').value || Utils.todayISO(),
      name,
      birthDate: container.querySelector('#r-birth').value || null,
      sex: container.querySelector('#r-sex').value,
      cpf: container.querySelector('#r-cpf').value.trim(),
      phone: container.querySelector('#r-phone').value.trim(),
      email: container.querySelector('#r-email').value.trim(),
      emergencyContactName: container.querySelector('#r-ec-name').value.trim(),
      emergencyContactPhone: container.querySelector('#r-ec-phone').value.trim(),
      activityType: container.querySelector('#r-activity').value,
      activityTypeCustom: container.querySelector('#r-activity-custom')?.value.trim() || '',
      hourlyRate: Number(container.querySelector('#r-rate').value) || 0,
      monthlySessionsCount: Number(container.querySelector('#r-sessions').value) || 0,
      weekDays,
      schedule,
      medicalCertificateDate: container.querySelector('#r-cert').value || null,
      notes: container.querySelector('#r-notes').value.trim(),
    });
    AppState.students = await StudentsData.listStudents();
    Utils.toast('Cadastro do aluno salvo ✓', 'success');
    render();
  });

  container.querySelector('#r-delete').addEventListener('click', async () => {
    const ok = await Utils.confirmDialog(`Remover "${student.name}" da lista de alunos? O histórico não é apagado.`);
    if (!ok) return;
    student.active = false;
    await StudentsData.updateStudent(student);
    Utils.toast('Aluno removido da lista.', 'info');
    AppState.students = await StudentsData.listStudents();
    await switchStudent(AppState.students[0]?.id || null);
  });
}

window.RegistrationView = { renderHtml: regRenderHtml, bindEvents: regBindEvents };
