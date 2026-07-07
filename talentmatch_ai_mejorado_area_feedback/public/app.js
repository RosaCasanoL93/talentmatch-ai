const state = {
  token: localStorage.getItem('tm_token') || '',
  user: JSON.parse(localStorage.getItem('tm_user') || 'null'),
  jobs: [],
  candidates: [],
  publicJobs: [],
  audit: [],
  currentView: 'dashboard'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const viewTitles = {
  dashboard: 'Panel ejecutivo',
  jobs: 'Gestión de ofertas',
  candidates: 'Gestión de candidatos',
  ranking: 'Ranking IA explicable',
  reports: 'Reportes y auditoría',
  settings: 'Configuración del sistema'
};

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase();
}

function badge(text, type = '') {
  return `<span class="badge ${type}">${text}</span>`;
}

function scoreType(score) {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function uniqueAreas(rows) {
  return [...new Set(rows.map(j => String(j.area || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function feedbackBlock(feedback = {}) {
  const tech = feedback.technical_to_improve || [];
  const soft = feedback.soft_to_improve || [];
  const techTips = feedback.technical_suggestions || [];
  const softTips = feedback.soft_suggestions || [];
  return `
    <div class="feedback-panel">
      <div>
        <p class="eyebrow">Feedback formativo</p>
        <h4>Recomendaciones para fortalecer tu perfil</h4>
        <p class="hint">${escapeHtml(feedback.summary || 'El sistema generó recomendaciones iniciales con base en el puesto y la información registrada.')}</p>
      </div>
      <div class="grid cols-2 feedback-grid">
        <div class="feedback-card">
          <h5>Competencias técnicas</h5>
          <div class="tags">${tech.length ? tech.map(s => `<span class="tag warning-tag">${escapeHtml(s)}</span>`).join('') : '<span class="tag success-tag">Sin brechas críticas detectadas</span>'}</div>
          <ul>${techTips.slice(0,4).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
        <div class="feedback-card">
          <h5>Habilidades blandas</h5>
          <div class="tags">${soft.length ? soft.map(s => `<span class="tag warning-tag">${escapeHtml(s)}</span>`).join('') : '<span class="tag success-tag">Evidencia aceptable</span>'}</div>
          <ul>${softTips.slice(0,4).map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>`;
}

function maskDni(dni) {
  const clean = String(dni || '').replace(/\D/g, '');
  return clean.length >= 8 ? `${clean.slice(0,2)}****${clean.slice(-2)}` : 'no registrado';
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && path !== '/api/auth/login') {
    logout(false);
    throw new Error('La sesión venció. Inicie sesión nuevamente.');
  }
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch {}
    throw new Error(payload.error || 'Ocurrió un error en la operación.');
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res.text();
}

async function publicApi(path, options = {}) {
  const headers = options.headers || {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let payload = {};
    try { payload = await res.json(); } catch {}
    throw new Error(payload.error || 'No se pudo completar la operación.');
  }
  const type = res.headers.get('content-type') || '';
  return type.includes('application/json') ? res.json() : res.text();
}

function showApp() {
  if (state.token && state.user) {
    $('#loginPanel').classList.add('hidden');
    $('#appContent').classList.remove('hidden');
    $('#csvLink').classList.remove('hidden');
    $('#sessionName').textContent = state.user.name || state.user.email;
    $('#sessionRole').textContent = state.user.role === 'admin' ? 'Administrador' : state.user.role === 'auditor' ? 'Auditor' : 'Reclutador';
    $('#csvLink').href = `/api/reports/export-csv?token=${encodeURIComponent(state.token)}`;
    $('#viewTitle').textContent = viewTitles[state.currentView] || 'Panel ejecutivo';
    loadData().then(() => renderCurrentView()).catch(err => toast(err.message));
  } else {
    $('#loginPanel').classList.remove('hidden');
    $('#appContent').classList.add('hidden');
    $('#csvLink').classList.add('hidden');
    $('#sessionName').textContent = 'No conectado';
    $('#sessionRole').textContent = 'Administrador / Reclutador';
    $('#viewTitle').textContent = 'Portal de acceso y postulación';
    renderPublicPortal().catch(err => toast(err.message));
  }
}

async function loadData() {
  [state.jobs, state.candidates] = await Promise.all([
    api('/api/jobs'),
    api('/api/candidates')
  ]);
}

function setView(view) {
  state.currentView = view;
  $('#viewTitle').textContent = viewTitles[view] || 'Panel';
  $$('.nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${view}`).classList.remove('hidden');
  renderCurrentView();
  $('#sidebar').classList.remove('open');
}

function renderCurrentView() {
  const view = state.currentView;
  if (view === 'dashboard') return renderDashboard();
  if (view === 'jobs') return renderJobs();
  if (view === 'candidates') return renderCandidates();
  if (view === 'ranking') return renderRanking();
  if (view === 'reports') return renderReports();
  if (view === 'settings') return renderSettings();
}


async function renderPublicPortal() {
  const list = $('#publicJobList');
  const select = $('#publicJobSelect');
  const form = $('#publicApplyForm');
  if (!list || !select || !form) return;
  state.publicJobs = await publicApi('/api/public/jobs');
  const areas = uniqueAreas(state.publicJobs);
  $('#publicJobCount').textContent = `${state.publicJobs.length} activas`;
  const toolbar = list.closest('.card')?.querySelector('.toolbar');
  if (toolbar && !$('#publicAreaFilter')) {
    toolbar.insertAdjacentHTML('beforeend', `
      <select id="publicAreaFilter" class="compact-select" aria-label="Filtrar por área">
        <option value="">Todas las áreas</option>
        ${areas.map(area => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}
      </select>`);
  } else if ($('#publicAreaFilter')) {
    $('#publicAreaFilter').innerHTML = `<option value="">Todas las áreas</option>${areas.map(area => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}`;
  }
  select.innerHTML = state.publicJobs.map(j => `<option value="${j.id}">${escapeHtml(j.title)} · ${escapeHtml(j.area)}</option>`).join('');
  renderPublicJobCards();
  const areaFilter = $('#publicAreaFilter');
  if (areaFilter && !areaFilter.dataset.bound) {
    areaFilter.addEventListener('change', renderPublicJobCards);
    areaFilter.dataset.bound = '1';
  }
  if (!form.dataset.bound) {
    form.addEventListener('submit', savePublicApplication);
    form.dataset.bound = '1';
  }
  const rankForm = $('#publicRankForm');
  if (rankForm && !rankForm.dataset.bound) {
    rankForm.addEventListener('submit', lookupPublicRanking);
    rankForm.dataset.bound = '1';
  }
}

function renderPublicJobCards() {
  const list = $('#publicJobList');
  const area = $('#publicAreaFilter')?.value || '';
  const rows = area ? state.publicJobs.filter(j => j.area === area) : state.publicJobs;
  list.innerHTML = rows.length ? rows.map(j => `
    <article class="public-job-card">
      <div>
        <div class="job-card-head">
          <h4>${escapeHtml(j.title)}</h4>
          <span class="badge primary">${escapeHtml(j.area || 'Sin área')}</span>
        </div>
        <p class="hint">Peso técnico ${j.technical_weight}% / conductual ${j.soft_weight}%</p>
        <p>${escapeHtml(j.description)}</p>
        <div class="tags">${String(j.technical_skills || '').split(',').slice(0,7).map(s => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('')}</div>
      </div>
      <button class="secondary" type="button" onclick="selectPublicJob(${j.id})">Postular</button>
    </article>`).join('') : '<p class="hint">No hay puestos activos para el área seleccionada.</p>';
}

window.selectPublicJob = function(jobId) {
  const select = $('#publicJobSelect');
  if (select) select.value = String(jobId);
  $('#publicApplyForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

async function savePublicApplication(event) {
  event.preventDefault();
  const result = $('#publicApplyResult');
  result.classList.remove('hidden');
  result.innerHTML = '<p class="hint">Enviando postulación y analizando CV...</p>';
  try {
    const data = await publicApi('/api/public/apply', { method: 'POST', body: new FormData(event.target) });
    result.innerHTML = `
      <h3>Postulación enviada</h3>
      <p>${escapeHtml(data.message)}</p>
      <p class="hint">Guarde su DNI registrado para consultar posteriormente su posición en el ranking.</p>
      <div class="grid cols-3" style="margin-top:12px">
        <div class="mini-metric"><span>Global</span><strong>${data.global_score}</strong></div>
        <div class="mini-metric"><span>Técnico</span><strong>${data.technical_score}</strong></div>
        <div class="mini-metric"><span>Conductual</span><strong>${data.soft_score}</strong></div>
      </div>
      <p><strong>Resultado inicial:</strong> ${escapeHtml(data.recommendation)}</p>
      <p class="hint">${escapeHtml(data.explanation)}</p>
      <div class="tags">${(data.detected_skills || []).slice(0,10).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      ${feedbackBlock(data.improvement_feedback)}`;
    event.target.reset();
    toast('Postulación registrada correctamente.');
  } catch (err) {
    result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function lookupPublicRanking(event) {
  event.preventDefault();
  const result = $('#publicRankResult');
  const dni = String(new FormData(event.target).get('dni') || '').trim();
  result.classList.remove('hidden');
  result.innerHTML = '<p class="hint">Consultando ranking...</p>';
  try {
    const payload = await publicApi(`/api/public/ranking?dni=${encodeURIComponent(dni)}`);
    result.innerHTML = `
      <h3>Resultado de ranking</h3>
      <p class="hint">${payload.total_applications} postulación(es) asociada(s) al DNI consultado.</p>
      <div class="grid rank-result-grid">
        ${payload.applications.map(item => `
          <article class="ranking-card public-rank-card">
            <div class="rank-num">${item.rank}</div>
            <div>
              <strong>${escapeHtml(item.job_title)}</strong>
              <p class="hint" style="margin:4px 0">${escapeHtml(item.area)} · ${escapeHtml(item.candidate_name)} · ${escapeHtml(item.status)}</p>
              <div class="progress"><span style="width:${item.global_score}%"></span></div>
              <p class="hint" style="margin-top:8px">Posición ${item.rank} de ${item.total_candidates} postulantes para esta oferta.</p>
              ${feedbackBlock(item.improvement_feedback)}
            </div>
            <div style="text-align:right"><div class="score">${item.global_score}</div><span class="badge ${scoreType(item.global_score)}">${escapeHtml(item.recommendation)}</span></div>
          </article>`).join('')}
      </div>`;
  } catch (err) {
    result.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function renderDashboard() {
  const target = $('#view-dashboard');
  const summary = await api('/api/summary');
  const top = summary.top || [];
  const activeJobs = state.jobs.filter(j => j.status === 'Activa').length;
  target.innerHTML = `
    <div class="grid cols-4">
      <div class="card metric"><span>Ofertas activas</span><strong>${activeJobs}</strong></div>
      <div class="card metric"><span>Candidatos registrados</span><strong>${summary.candidates}</strong></div>
      <div class="card metric"><span>Candidatos activos</span><strong>${summary.activeCandidates}</strong></div>
      <div class="card metric"><span>Promedio global</span><strong>${summary.avgScore}</strong></div>
    </div>
    <div class="grid cols-2" style="margin-top:18px">
      <div class="card">
        <h2>Prioridad del MVP</h2>
        <p class="hint">La plataforma cubre el flujo base del proyecto: publicación de ofertas, análisis curricular, entrevista asincrónica, ranking explicable, reportes y auditoría.</p>
        <div class="kpi-chart">
          ${[70,85,80,99].map((v,i) => `<div class="bar" style="height:${Math.max(20,v*2)}px"><span>${['-70%','85%','80%','99.9%'][i]}</span></div>`).join('')}
        </div>
        <div class="tags" style="margin-top:14px">
          <span class="tag">Reducción de filtrado</span><span class="tag">Emparejamiento IA</span><span class="tag">Automatización</span><span class="tag">Alta disponibilidad</span>
        </div>
      </div>
      <div class="card">
        <div class="toolbar"><h2>Top candidatos</h2><button class="secondary" onclick="setView('ranking')">Ver ranking</button></div>
        ${top.length ? top.map((c, idx) => `
          <div class="ranking-card" style="margin-bottom:10px">
            <div class="rank-num">${idx+1}</div>
            <div><strong>${escapeHtml(c.full_name)}</strong><p class="hint" style="margin:4px 0 0">${escapeHtml(c.job_title)} · ${escapeHtml(c.recommendation)}</p><div class="progress"><span style="width:${c.global_score}%"></span></div></div>
            <div class="score small">${c.global_score}</div>
          </div>`).join('') : '<p class="hint">Aún no se han registrado candidatos analizados.</p>'}
      </div>
    </div>
    <div class="grid cols-3" style="margin-top:18px">
      <div class="card"><h3>IA explicable</h3><p class="hint">Cada recomendación genera una justificación textual basada en coincidencias técnicas, experiencia y habilidades blandas.</p></div>
      <div class="card"><h3>Protección de datos</h3><p class="hint">El sistema incorpora trazabilidad de acciones, archivo de candidatos y auditoría para control interno.</p></div>
      <div class="card"><h3>Decisión gerencial</h3><p class="hint">Los reportes permiten exportar resultados, evaluar candidatos y sustentar decisiones de selección.</p></div>
    </div>`;
}

function jobOptions(selected = '') {
  return state.jobs.map(j => `<option value="${j.id}" ${String(selected) === String(j.id) ? 'selected' : ''}>${escapeHtml(j.title)} — ${escapeHtml(j.area)}</option>`).join('');
}

function renderJobs() {
  const target = $('#view-jobs');
  const isAdmin = state.user?.role === 'admin';
  const areas = uniqueAreas(state.jobs);
  target.innerHTML = `
    <div class="grid ${isAdmin ? 'cols-2' : ''}">
      ${isAdmin ? `<form class="card" id="jobForm">
        <div class="toolbar">
          <div>
            <p class="eyebrow" id="jobFormMode">Nueva publicación</p>
            <h2 id="jobFormTitle">Crear puesto de trabajo</h2>
          </div>
          <button class="secondary hidden" id="cancelJobEdit" type="button" onclick="resetJobForm()">Cancelar edición</button>
        </div>
        <input type="hidden" name="id" id="jobId">
        <div class="form-grid">
          <div><label>Título del puesto</label><input name="title" placeholder="Ej. Analista de datos" required></div>
          <div><label>Área</label><input name="area" list="areaOptions" placeholder="Ej. Tecnología" required><datalist id="areaOptions">${['Tecnología','Recursos Humanos','Operaciones','Finanzas','Comercial','Administración','Mantenimiento','Logística', ...areas].map(a => `<option value="${escapeHtml(a)}"></option>`).join('')}</datalist></div>
          <div class="span-2"><label>Descripción</label><textarea name="description" placeholder="Resumen del perfil y responsabilidades" required></textarea></div>
          <div class="span-2"><label>Competencias técnicas requeridas</label><input name="technical_skills" value="JavaScript,React,Node.js,SQL,API REST,Git"></div>
          <div class="span-2"><label>Habilidades blandas requeridas</label><input name="soft_skills" value="Comunicación,Liderazgo,Trabajo en equipo,Resolución de conflictos,Adaptabilidad"></div>
          <div><label>Peso técnico (%)</label><input type="number" name="technical_weight" min="0" max="100" value="65"></div>
          <div><label>Peso conductual (%)</label><input type="number" name="soft_weight" min="0" max="100" value="35"></div>
          <div class="span-2"><label>Estado</label><select name="status"><option value="Activa">Activa</option><option value="Pausada">Pausada</option><option value="Cerrada">Cerrada</option></select></div>
        </div>
        <button class="primary" style="margin-top:16px" id="jobSubmitBtn">Guardar oferta</button>
      </form>` : ''}
      <div class="card">
        <div class="toolbar">
          <div><h2>Ofertas publicadas</h2><p class="hint">${areas.length} área(s) clasificadas · ${state.jobs.length} total</p></div>
          <select id="jobAreaFilter" class="compact-select"><option value="">Todas las áreas</option>${areas.map(area => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`).join('')}</select>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Puesto</th><th>Área</th><th>Competencias</th><th>Peso</th><th>Estado</th>${isAdmin ? '<th>Acciones</th>' : ''}</tr></thead><tbody id="jobRows">
        ${jobRows(state.jobs, isAdmin)}
        </tbody></table></div>
      </div>
    </div>`;
  if (isAdmin) $('#jobForm').addEventListener('submit', saveJob);
  $('#jobAreaFilter').addEventListener('change', event => {
    const area = event.target.value;
    const rows = area ? state.jobs.filter(j => j.area === area) : state.jobs;
    $('#jobRows').innerHTML = jobRows(rows, isAdmin);
  });
}

function jobRows(rows, isAdmin) {
  if (!rows.length) return `<tr><td colspan="${isAdmin ? 6 : 5}"><p class="hint">No hay ofertas registradas para mostrar.</p></td></tr>`;
  return rows.map(j => `<tr>
    <td><strong>${escapeHtml(j.title)}</strong><br><span class="hint">${escapeHtml(j.description || '').slice(0, 90)}${String(j.description || '').length > 90 ? '...' : ''}</span></td>
    <td>${badge(escapeHtml(j.area || 'Sin área'), 'primary')}</td>
    <td>${escapeHtml(j.technical_skills)}</td>
    <td>${j.technical_weight}% / ${j.soft_weight}%</td>
    <td>${badge(j.status, j.status === 'Activa' ? 'success' : 'warning')}</td>
    ${isAdmin ? `<td><div class="action-row"><button class="secondary" onclick="editJob(${j.id})">Editar</button><button class="danger" onclick="deleteJob(${j.id})">Eliminar</button></div></td>` : ''}
  </tr>`).join('');
}

function fillJobForm(job) {
  const form = $('#jobForm');
  if (!form) return;
  form.elements.id.value = job.id || '';
  form.elements.title.value = job.title || '';
  form.elements.area.value = job.area || '';
  form.elements.description.value = job.description || '';
  form.elements.technical_skills.value = job.technical_skills || '';
  form.elements.soft_skills.value = job.soft_skills || '';
  form.elements.technical_weight.value = job.technical_weight || 65;
  form.elements.soft_weight.value = job.soft_weight || 35;
  form.elements.status.value = job.status || 'Activa';
  $('#jobFormMode').textContent = job.id ? 'Edición de publicación' : 'Nueva publicación';
  $('#jobFormTitle').textContent = job.id ? 'Editar puesto de trabajo' : 'Crear puesto de trabajo';
  $('#jobSubmitBtn').textContent = job.id ? 'Actualizar oferta' : 'Guardar oferta';
  $('#cancelJobEdit').classList.toggle('hidden', !job.id);
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.editJob = function(id) {
  const job = state.jobs.find(j => Number(j.id) === Number(id));
  if (!job) return toast('No se encontró la oferta seleccionada.');
  fillJobForm(job);
}

window.resetJobForm = function() {
  fillJobForm({
    technical_skills: 'JavaScript,React,Node.js,SQL,API REST,Git',
    soft_skills: 'Comunicación,Liderazgo,Trabajo en equipo,Resolución de conflictos,Adaptabilidad',
    technical_weight: 65,
    soft_weight: 35,
    status: 'Activa'
  });
}

window.deleteJob = async function(id) {
  const job = state.jobs.find(j => Number(j.id) === Number(id));
  const linked = state.candidates.filter(c => Number(c.job_id) === Number(id)).length;
  const detail = linked ? ` También se eliminarán ${linked} postulación(es) vinculada(s).` : '';
  if (!confirm(`¿Eliminar definitivamente la oferta "${job?.title || ''}"?${detail}`)) return;
  await api(`/api/jobs/${id}`, { method: 'DELETE' });
  toast('Oferta eliminada correctamente.');
  await loadData();
  renderJobs();
}

async function saveJob(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target));
  const id = payload.id;
  delete payload.id;
  payload.technical_weight = Number(payload.technical_weight || 65);
  payload.soft_weight = Number(payload.soft_weight || 35);
  await api(id ? `/api/jobs/${id}` : '/api/jobs', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  toast(id ? 'Oferta actualizada correctamente.' : 'Oferta registrada correctamente.');
  event.target.reset();
  await loadData();
  renderJobs();
}

function renderCandidates() {
  const target = $('#view-candidates');
  const rows = state.candidates;
  target.innerHTML = `
    <div class="grid cols-2">
      <form class="card" id="candidateForm">
        <h2>Registrar candidato</h2>
        <div class="form-grid">
          <div class="span-2"><label>Oferta vinculada</label><select name="job_id" required>${jobOptions()}</select></div>
          <div><label>Nombre completo</label><input name="full_name" placeholder="Nombre del candidato" required></div>
          <div><label>DNI</label><input name="dni" placeholder="8 dígitos" inputmode="numeric" maxlength="8" pattern="\d{8}" required></div>
          <div><label>Correo</label><input name="email" type="email" placeholder="correo@dominio.com"></div>
          <div><label>Teléfono</label><input name="phone" placeholder="Ej. 999 999 999"></div>
          <div class="span-2"><label>Subir CV (.txt, .pdf o .docx)</label><input name="cv_file" type="file" accept=".txt,.pdf,.docx"></div>
          <div class="span-2"><label>Texto del CV o extracto curricular</label><textarea name="cv_text" placeholder="Pegue aquí el contenido del CV para mejorar el análisis. Ejemplo: 5 años de experiencia en React, Node.js, SQL..."></textarea></div>
          <div class="span-2"><label>Respuesta de entrevista asincrónica</label><textarea name="interview_text" placeholder="Pegue la respuesta del candidato a preguntas de comunicación, liderazgo, conflictos y trabajo en equipo."></textarea></div>
        </div>
        <button class="primary" style="margin-top:16px">Registrar y analizar</button>
      </form>
      <div class="card">
        <div class="toolbar"><h2>Candidatos</h2><input class="search" id="candidateSearch" placeholder="Buscar candidato"></div>
        <div class="table-wrap"><table><thead><tr><th>Candidato</th><th>Oferta</th><th>Score</th><th>Estado</th><th></th></tr></thead><tbody id="candidateRows">
          ${candidateRows(rows)}
        </tbody></table></div>
      </div>
    </div>`;
  $('#candidateForm').addEventListener('submit', saveCandidate);
  $('#candidateSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = state.candidates.filter(c => `${c.full_name} ${c.email} ${c.dni || ''} ${c.job_title}`.toLowerCase().includes(q));
    $('#candidateRows').innerHTML = candidateRows(filtered);
  });
}

function candidateRows(rows) {
  if (!rows.length) return '<tr><td colspan="5"><p class="hint">Aún no existen candidatos registrados.</p></td></tr>';
  return rows.map(c => `<tr>
    <td><div class="candidate-row"><div class="avatar">${initials(c.full_name)}</div><div><strong>${escapeHtml(c.full_name)}</strong><br><span class="hint">${escapeHtml(c.email || 'Sin correo')} · DNI ${escapeHtml(maskDni(c.dni))}</span></div></div></td>
    <td>${escapeHtml(c.job_title)}</td>
    <td><div class="score small">${c.global_score}</div></td>
    <td>${badge(c.recommendation || 'Pendiente', scoreType(c.global_score))}<br><span class="hint">${escapeHtml(c.status)}</span></td>
    <td><button class="secondary" onclick="openCandidate(${c.id})">Ver</button></td>
  </tr>`).join('');
}

async function saveCandidate(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  await api('/api/candidates', { method: 'POST', body: formData });
  toast('Candidato registrado y analizado.');
  event.target.reset();
  await loadData();
  renderCandidates();
}

window.openCandidate = async function(id) {
  const c = await api(`/api/candidates/${id}`);
  const detail = $('#candidateDetail');
  detail.innerHTML = `
    <p class="eyebrow">Ficha de candidato</p>
    <h2>${escapeHtml(c.full_name)}</h2>
    <div class="grid cols-4" style="margin:16px 0">
      <div class="card metric"><span>Global</span><strong>${c.global_score}</strong></div>
      <div class="card metric"><span>Técnico</span><strong>${c.technical_score}</strong></div>
      <div class="card metric"><span>Conductual</span><strong>${c.soft_score}</strong></div>
      <div class="card metric"><span>Experiencia</span><strong>${c.years_experience}</strong></div>
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Información</h3><p><strong>Oferta:</strong> ${escapeHtml(c.job_title)}</p><p><strong>DNI:</strong> ${escapeHtml(c.dni || 'No registrado')}</p><p><strong>Correo:</strong> ${escapeHtml(c.email || 'No detectado')}</p><p><strong>Teléfono:</strong> ${escapeHtml(c.phone || 'No detectado')}</p><p><strong>Estado:</strong> ${escapeHtml(c.status)}</p></div>
      <div class="card"><h3>Recomendación IA</h3><p>${badge(c.recommendation, scoreType(c.global_score))}</p><p class="hint">${escapeHtml(c.explanation)}</p><div class="tags">${(c.detected_skills || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div></div>
    </div>
    ${feedbackBlock(c.improvement_feedback)}
    <form id="editCandidateForm" class="card" style="margin-top:18px">
      <h3>Actualizar entrevista o CV</h3>
      <input type="hidden" name="job_id" value="${c.job_id}">
      <input type="hidden" name="full_name" value="${escapeHtml(c.full_name)}">
      <input type="hidden" name="dni" value="${escapeHtml(c.dni || '')}">
      <label>Texto del CV</label><textarea name="cv_text">${escapeHtml(c.cv_text || '')}</textarea>
      <label>Respuesta de entrevista</label><textarea name="interview_text">${escapeHtml(c.interview_text || '')}</textarea>
      <div class="action-row" style="margin-top:14px">
        <button class="primary">Actualizar análisis</button>
        <button type="button" class="secondary" onclick="archiveCandidate(${c.id}, ${c.status === 'Archivado'})">${c.status === 'Archivado' ? 'Restaurar' : 'Archivar'}</button>
        ${state.user.role === 'admin' ? `<button type="button" class="danger" onclick="deleteCandidate(${c.id})">Eliminar</button>` : ''}
      </div>
    </form>`;
  $('#editCandidateForm').addEventListener('submit', async e => {
    e.preventDefault();
    await api(`/api/candidates/${id}`, { method: 'PUT', body: new FormData(e.target) });
    toast('Candidato actualizado.');
    await loadData();
    $('#candidateModal').classList.add('hidden');
    renderCurrentView();
  });
  $('#candidateModal').classList.remove('hidden');
}

window.archiveCandidate = async function(id, restore) {
  await api(`/api/candidates/${id}/archive`, { method: 'POST', body: JSON.stringify({ restore, reason: restore ? 'Restauración manual' : 'Archivado por reclutador' }) });
  toast(restore ? 'Candidato restaurado.' : 'Candidato archivado.');
  await loadData();
  $('#candidateModal').classList.add('hidden');
  renderCurrentView();
}

window.deleteCandidate = async function(id) {
  if (!confirm('¿Eliminar definitivamente este candidato?')) return;
  await api(`/api/candidates/${id}`, { method: 'DELETE' });
  toast('Candidato eliminado.');
  await loadData();
  $('#candidateModal').classList.add('hidden');
  renderCurrentView();
}

function renderRanking() {
  const target = $('#view-ranking');
  const ranked = [...state.candidates].sort((a,b) => b.global_score - a.global_score);
  target.innerHTML = `
    <div class="card">
      <div class="toolbar"><div><h2>Ranking de compatibilidad</h2><p class="hint">Ordenado por puntaje global calculado con competencias técnicas y habilidades blandas.</p></div><button class="secondary" onclick="refreshAnalyses()">Recalcular todo</button></div>
      <div class="grid">
      ${ranked.length ? ranked.map((c, idx) => `<div class="ranking-card">
        <div class="rank-num">${idx + 1}</div>
        <div>
          <strong>${escapeHtml(c.full_name)}</strong>
          <p class="hint" style="margin:4px 0">${escapeHtml(c.job_title)} · ${escapeHtml(c.recommendation)}</p>
          <div class="progress"><span style="width:${c.global_score}%"></span></div>
          <div class="tags" style="margin-top:10px">${(c.detected_skills || []).slice(0,6).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
        </div>
        <div style="text-align:right"><div class="score">${c.global_score}</div><button class="secondary" style="margin-top:10px" onclick="openCandidate(${c.id})">Detalle</button></div>
      </div>`).join('') : '<p class="hint">No hay candidatos para mostrar.</p>'}
      </div>
    </div>`;
}

window.refreshAnalyses = async function() {
  for (const c of state.candidates) await api(`/api/candidates/${c.id}/analyze`, { method: 'POST' });
  toast('Ranking recalculado.');
  await loadData();
  renderRanking();
}

async function renderReports() {
  const target = $('#view-reports');
  const audit = await api('/api/reports/audit');
  const bias = await api('/api/audit/bias');
  target.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <h2>Auditoría de sesgos</h2>
        <p class="hint">Simulación de comparación entre ranking original y ranking ciego. Una diferencia superior a 15 puntos genera alerta.</p>
        <p>${badge(`${bias.alerts} alertas`, bias.alerts ? 'warning' : 'success')}</p>
        <div class="table-wrap"><table><thead><tr><th>Candidato</th><th>Original</th><th>Ciego</th><th>Diferencia</th></tr></thead><tbody>
          ${bias.results.map(r => `<tr><td>${escapeHtml(r.candidate)}<br><span class="hint">${escapeHtml(r.job)}</span></td><td>${r.originalScore}</td><td>${r.blindScore}</td><td>${r.alert ? badge(r.difference, 'warning') : badge(r.difference, 'success')}</td></tr>`).join('') || '<tr><td colspan="4">Sin datos</td></tr>'}
        </tbody></table></div>
      </div>
      <div class="card">
        <div class="toolbar"><h2>Exportación</h2><a class="primary" href="/api/reports/export-csv">Descargar CSV</a></div>
        <p class="hint">El reporte CSV incluye candidato, correo, oferta, puntaje técnico, puntaje conductual, puntaje global, recomendación, estado y fecha de registro.</p>
        <h3>Actividad reciente</h3>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead><tbody>
          ${audit.slice(0,10).map(a => `<tr><td>${new Date(a.created_at).toLocaleString()}</td><td>${escapeHtml(a.user_name || 'Sistema')}</td><td>${escapeHtml(a.action)}</td></tr>`).join('') || '<tr><td colspan="3">Sin actividad</td></tr>'}
        </tbody></table></div>
      </div>
    </div>`;
}

function renderSettings() {
  const target = $('#view-settings');
  target.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <h2>Parámetros operativos</h2>
        <p class="hint">Configuración recomendada para uso real del MVP.</p>
        <div class="tags"><span class="tag">SLA objetivo 99.9%</span><span class="tag">Cifrado recomendado AES-256</span><span class="tag">Retención de videos 12 meses</span><span class="tag">Cumplimiento Ley 29733</span><span class="tag">GDPR</span></div>
      </div>
      <div class="card">
        <h2>Usuarios</h2>
        ${state.user.role === 'admin' ? `<form id="userForm"><div class="form-grid"><div><label>Nombre</label><input name="name" required></div><div><label>Correo</label><input type="email" name="email" required></div><div><label>Contraseña</label><input name="password" required></div><div><label>Rol</label><select name="role"><option value="recruiter">Reclutador</option><option value="auditor">Auditor</option><option value="admin">Administrador</option></select></div></div><button class="primary" style="margin-top:14px">Crear usuario</button></form>` : `<p class="hint">Solo el administrador puede crear usuarios.</p>`}
      </div>
      <div class="card span-2">
        <h2>Estado del producto</h2>
        <p>Esta versión es una aplicación full-stack funcional: cuenta con backend, base de datos JSON persistente, autenticación, gestión de ofertas, portal público de candidatos, carga de CV, análisis curricular, análisis de entrevista, ranking, reportes CSV y auditoría.</p>
      </div>
    </div>`;
  const form = $('#userForm');
  if (form) form.addEventListener('submit', createUser);
}

async function createUser(event) {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.target));
  await api('/api/users', { method: 'POST', body: JSON.stringify(payload) });
  toast('Usuario creado.');
  event.target.reset();
}

function logout(message = true) {
  state.token = '';
  state.user = null;
  localStorage.removeItem('tm_token');
  localStorage.removeItem('tm_user');
  if (message) toast('Sesión cerrada.');
  showApp();
}

$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('#loginError').textContent = '';
  try {
    const payload = Object.fromEntries(new FormData(event.target));
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('tm_token', state.token);
    localStorage.setItem('tm_user', JSON.stringify(state.user));
    showApp();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', () => logout());
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('tm_dark', document.body.classList.contains('dark') ? '1' : '0');
});
$$('.nav button').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
$$('[data-close]').forEach(btn => btn.addEventListener('click', () => $(`#${btn.dataset.close}`).classList.add('hidden')));

if (localStorage.getItem('tm_dark') === '1') document.body.classList.add('dark');
showApp();
