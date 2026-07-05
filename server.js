require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'CAMBIAR_ESTA_CLAVE_EN_PRODUCCION';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'talentmatch.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const initialDb = { users: [], jobs: [], candidates: [], audit_logs: [], counters: { users: 0, jobs: 0, candidates: 0, audit_logs: 0 } };
let db = loadDb();

function loadDb() {
  if (!fs.existsSync(DB_PATH)) return structuredClone(initialDb);
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return { ...structuredClone(initialDb), ...parsed, counters: { ...initialDb.counters, ...(parsed.counters || {}) } };
  } catch {
    return structuredClone(initialDb);
  }
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nextId(table) {
  db.counters[table] = Number(db.counters[table] || 0) + 1;
  return db.counters[table];
}

function now() { return new Date().toISOString(); }
function clone(data) { return JSON.parse(JSON.stringify(data)); }
function clamp(num, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(num || 0))); }
function asArray(csv) { return String(csv || '').split(',').map(x => x.trim()).filter(Boolean); }
function normalize(text) { return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function normalizeDni(value) { return String(value || '').replace(/\D/g, '').slice(0, 8); }
function validDni(value) { return /^\d{8}$/.test(normalizeDni(value)); }
function maskDni(value) { const d = normalizeDni(value); return d ? `${d.slice(0,2)}****${d.slice(-2)}` : ''; }
function detectEmail(text) { const m = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m ? m[0] : ''; }
function detectPhone(text) { const m = String(text || '').match(/(?:\+?51\s*)?(?:9\d{2}|\d{3})[\s-]?\d{3}[\s-]?\d{3}/); return m ? m[0] : ''; }
function detectYears(text) {
  const n = normalize(text);
  const matches = [...n.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:anos|años|year|years)\s+(?:de\s+)?(?:experiencia|experience)/g)];
  if (matches.length) return Math.max(...matches.map(m => Number(String(m[1]).replace(',', '.')) || 0));
  if (n.includes('senior')) return 5;
  if (n.includes('semi senior') || n.includes('mid level')) return 3;
  if (n.includes('junior')) return 1;
  return 0;
}

async function initDb() {
  if (db.users.length === 0) {
    db.users.push({ id: nextId('users'), name: 'Administrador Demo', email: 'admin@talentmatch.ai', password_hash: await bcrypt.hash('Admin2026!', 10), role: 'admin', created_at: now() });
    db.users.push({ id: nextId('users'), name: 'Reclutador RRHH', email: 'rrhh@empresa.pe', password_hash: await bcrypt.hash('Recruiter2026!', 10), role: 'recruiter', created_at: now() });
  }
  if (db.jobs.length === 0) {
    db.jobs.push({
      id: nextId('jobs'),
      title: 'Desarrollador Full Stack',
      area: 'Tecnología',
      description: 'Perfil orientado al desarrollo de aplicaciones web, API REST, bases de datos y trabajo colaborativo en equipos ágiles.',
      technical_skills: 'JavaScript,React,Node.js,SQL,API REST,Git,TypeScript,Python',
      soft_skills: 'Comunicación,Liderazgo,Trabajo en equipo,Resolución de conflictos,Adaptabilidad,Responsabilidad',
      technical_weight: 65,
      soft_weight: 35,
      status: 'Activa',
      created_by: 1,
      created_at: now(),
      updated_at: now()
    });
  }
  saveDb();
}

function audit(userId, action, entity, entityId, metadata = {}) {
  db.audit_logs.unshift({ id: nextId('audit_logs'), user_id: userId || null, action, entity, entity_id: entityId || null, metadata, created_at: now() });
  db.audit_logs = db.audit_logs.slice(0, 1000);
  saveDb();
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname || '').toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_, file, cb) => cb(null, ['.txt', '.pdf', '.docx'].includes(path.extname(file.originalname || '').toLowerCase()))
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function makeToken(user) { return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' }); }
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'Sesión requerida.' });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Sesión inválida o vencida.' }); }
}
function adminOnly(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administrador.' }); next(); }

function jobOf(candidate) { return db.jobs.find(j => Number(j.id) === Number(candidate.job_id)); }
function decorateCandidate(candidate) {
  const job = jobOf(candidate) || {};
  return { ...clone(candidate), job_title: job.title || '', job_area: job.area || '', detected_skills: Array.isArray(candidate.detected_skills) ? candidate.detected_skills : [] };
}

function analyzeCv(cvText, job) {
  const required = asArray(job.technical_skills);
  const n = normalize(cvText);
  const detected = required.filter(skill => n.includes(normalize(skill)));
  const genericTech = ['javascript','typescript','react','angular','vue','node','express','sql','postgresql','mysql','python','java','c#','docker','aws','azure','git','api','rest','scrum','html','css','figma','power bi'];
  for (const tech of genericTech) if (n.includes(normalize(tech)) && !detected.some(d => normalize(d) === normalize(tech))) detected.push(tech);
  const matchRatio = required.length ? detected.filter(d => required.some(r => normalize(r) === normalize(d))).length / required.length : 0;
  const years = detectYears(cvText);
  const experienceScore = Math.min(100, years * 18 + 15);
  const densityScore = Math.min(100, Math.log10(Math.max(20, String(cvText || '').length)) * 35);
  const technicalScore = clamp((matchRatio * 65) + (experienceScore * 0.25) + (densityScore * 0.10));
  return { technicalScore, detectedSkills: [...new Set(detected)].slice(0, 18), yearsExperience: years };
}

function analyzeInterview(text) {
  const n = normalize(text);
  const dimensions = [
    ['comunicación', ['comunique','comunicacion','escuchar','claridad','explicar','presentar','feedback','retroalimentacion']],
    ['liderazgo', ['lider','liderazgo','coordine','motivar','guiar','decision','priorizar','responsable']],
    ['trabajo en equipo', ['equipo','colaborar','apoyar','integrar','compañero','coordinacion','scrum']],
    ['resolución de conflictos', ['conflicto','problema','resolver','negociar','acuerdo','solucion','riesgo','impedimento']],
    ['adaptabilidad', ['adaptar','cambio','aprendi','mejora','flexible','nuevo','reto']]
  ];
  const hits = dimensions.map(([, words]) => words.some(w => n.includes(normalize(w))) ? 1 : 0).reduce((a,b) => a + b, 0);
  const lengthScore = Math.min(45, String(text || '').split(/\s+/).filter(Boolean).length * 0.7);
  const dimensionScore = (hits / dimensions.length) * 45;
  const structureScore = /primero|segundo|finalmente|por ello|ademas|sin embargo/.test(n) ? 10 : 3;
  return { softScore: clamp(lengthScore + dimensionScore + structureScore) };
}

function recommendation(globalScore) {
  if (globalScore >= 85) return 'Altamente recomendado';
  if (globalScore >= 72) return 'Recomendado';
  if (globalScore >= 58) return 'En evaluación';
  return 'No priorizado';
}

function recalcCandidate(candidateId, userId = null) {
  const candidate = db.candidates.find(c => Number(c.id) === Number(candidateId));
  if (!candidate) throw new Error('Candidato no encontrado');
  const job = jobOf(candidate);
  if (!job) throw new Error('Oferta no encontrada');
  const cvAnalysis = analyzeCv(candidate.cv_text || '', job);
  const softAnalysis = analyzeInterview(candidate.interview_text || '');
  const totalWeight = Math.max(1, Number(job.technical_weight || 65) + Number(job.soft_weight || 35));
  const globalScore = clamp((cvAnalysis.technicalScore * Number(job.technical_weight || 65) + softAnalysis.softScore * Number(job.soft_weight || 35)) / totalWeight);
  candidate.years_experience = cvAnalysis.yearsExperience;
  candidate.detected_skills = cvAnalysis.detectedSkills;
  candidate.technical_score = cvAnalysis.technicalScore;
  candidate.soft_score = softAnalysis.softScore;
  candidate.global_score = globalScore;
  candidate.recommendation = recommendation(globalScore);
  candidate.explanation = `Coincidencias técnicas detectadas: ${cvAnalysis.detectedSkills.length ? cvAnalysis.detectedSkills.slice(0, 8).join(', ') : 'sin coincidencias técnicas suficientes'}. Se identificó ${cvAnalysis.yearsExperience ? cvAnalysis.yearsExperience + ' años de experiencia declarada' : 'experiencia no especificada'}. El puntaje técnico fue ${cvAnalysis.technicalScore}/100 y el puntaje conductual fue ${softAnalysis.softScore}/100. La recomendación pondera ${job.technical_weight}% competencias técnicas y ${job.soft_weight}% habilidades blandas.`;
  candidate.updated_at = now();
  saveDb();
  audit(userId, 'ANALYZE_CANDIDATE', 'candidate', candidate.id, { globalScore, recommendation: candidate.recommendation });
  return decorateCandidate(candidate);
}

async function parseUploadedFile(file) {
  if (!file) return '';
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext === '.txt') return fs.readFileSync(file.path, 'utf8');
  if (ext === '.pdf') {
    try { const pdfParse = require('pdf-parse'); const data = await pdfParse(fs.readFileSync(file.path)); return data.text || ''; }
    catch { return ''; }
  }
  if (ext === '.docx') {
    try { const mammoth = require('mammoth'); const result = await mammoth.extractRawText({ path: file.path }); return result.value || ''; }
    catch { return ''; }
  }
  return '';
}

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'TalentMatch AI', time: now() }));

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = db.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  audit(user.id, 'LOGIN', 'user', user.id, { email: user.email });
  res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
app.get('/api/users', auth, adminOnly, (_, res) => res.json(db.users.map(({ password_hash, ...u }) => clone(u))));
app.post('/api/users', auth, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Datos incompletos.' });
  const normalizedEmail = String(email).toLowerCase().trim();
  if (db.users.some(u => u.email === normalizedEmail)) return res.status(400).json({ error: 'El correo ya existe.' });
  const user = { id: nextId('users'), name, email: normalizedEmail, password_hash: await bcrypt.hash(String(password), 10), role, created_at: now() };
  db.users.push(user); saveDb(); audit(req.user.id, 'CREATE_USER', 'user', user.id, { email: normalizedEmail, role });
  const { password_hash, ...publicUser } = user;
  res.status(201).json(publicUser);
});

app.get('/api/summary', auth, (_, res) => {
  const activeCandidates = db.candidates.filter(c => c.status === 'Activo').length;
  const avg = db.candidates.filter(c => c.global_score > 0).reduce((a,c) => a + c.global_score, 0) / Math.max(1, db.candidates.filter(c => c.global_score > 0).length);
  const top = db.candidates.map(decorateCandidate).sort((a,b) => b.global_score - a.global_score).slice(0,5).map(c => ({ id: c.id, full_name: c.full_name, global_score: c.global_score, recommendation: c.recommendation, job_title: c.job_title }));
  res.json({ jobs: db.jobs.length, candidates: db.candidates.length, activeCandidates, avgScore: Math.round(avg * 10) / 10, top });
});


app.get('/api/public/jobs', (_, res) => {
  const rows = clone(db.jobs)
    .filter(j => String(j.status || '').toLowerCase() === 'activa')
    .sort((a,b) => b.created_at.localeCompare(a.created_at));
  res.json(rows.map(j => ({
    id: j.id,
    title: j.title,
    area: j.area,
    description: j.description,
    technical_skills: j.technical_skills,
    soft_skills: j.soft_skills,
    technical_weight: j.technical_weight,
    soft_weight: j.soft_weight,
    status: j.status
  })));
});

app.post('/api/public/apply', upload.single('cv_file'), async (req, res) => {
  const job = db.jobs.find(j => Number(j.id) === Number(req.body.job_id) && String(j.status || '').toLowerCase() === 'activa');
  if (!job) return res.status(400).json({ error: 'Seleccione una oferta disponible.' });
  if (!req.body.full_name) return res.status(400).json({ error: 'Ingrese su nombre completo.' });
  const dni = normalizeDni(req.body.dni);
  if (!validDni(dni)) return res.status(400).json({ error: 'Ingrese un DNI válido de 8 dígitos.' });
  if (db.candidates.some(c => Number(c.job_id) === Number(job.id) && normalizeDni(c.dni) === dni)) return res.status(400).json({ error: 'Ya existe una postulación registrada con este DNI para la oferta seleccionada.' });
  if (!req.body.email && !detectEmail(req.body.cv_text || '')) return res.status(400).json({ error: 'Ingrese un correo de contacto válido.' });
  const fileText = await parseUploadedFile(req.file);
  const cvText = [fileText, req.body.cv_text || ''].filter(Boolean).join('\n\n').trim();
  if (!req.file && !cvText) return res.status(400).json({ error: 'Debe subir un CV o pegar el texto curricular.' });

  const candidate = {
    id: nextId('candidates'),
    job_id: Number(req.body.job_id),
    full_name: req.body.full_name,
    dni,
    email: req.body.email || detectEmail(cvText),
    phone: req.body.phone || detectPhone(cvText),
    cv_filename: req.file ? req.file.filename : '',
    cv_originalname: req.file ? req.file.originalname : '',
    cv_text: cvText,
    interview_text: req.body.interview_text || '',
    years_experience: 0,
    detected_skills: [],
    technical_score: 0,
    soft_score: 0,
    global_score: 0,
    recommendation: 'Pendiente',
    explanation: '',
    status: 'Postulación recibida',
    source: 'portal_candidato',
    consent: Boolean(req.body.consent),
    created_at: now(),
    updated_at: now()
  };
  db.candidates.push(candidate);
  saveDb();
  audit(null, 'PUBLIC_APPLICATION_CREATED', 'candidate', candidate.id, { full_name: candidate.full_name, dni: maskDni(candidate.dni), job: job.title });
  const analyzed = recalcCandidate(candidate.id, null);
  res.status(201).json({
    id: analyzed.id,
    full_name: analyzed.full_name,
    job_title: analyzed.job_title,
    dni_mask: maskDni(analyzed.dni),
    global_score: analyzed.global_score,
    technical_score: analyzed.technical_score,
    soft_score: analyzed.soft_score,
    recommendation: analyzed.recommendation,
    detected_skills: analyzed.detected_skills,
    explanation: analyzed.explanation,
    status: analyzed.status,
    message: 'Postulación recibida y analizada correctamente.'
  });
});

app.get('/api/public/ranking', (req, res) => {
  const dni = normalizeDni(req.query.dni);
  if (!validDni(dni)) return res.status(400).json({ error: 'Ingrese un DNI válido de 8 dígitos.' });
  const applications = db.candidates
    .filter(c => normalizeDni(c.dni) === dni)
    .map(decorateCandidate)
    .sort((a,b) => b.created_at.localeCompare(a.created_at));
  if (!applications.length) return res.status(404).json({ error: 'No se encontraron postulaciones asociadas al DNI ingresado.' });

  const result = applications.map(appCandidate => {
    const ranked = db.candidates
      .filter(c => Number(c.job_id) === Number(appCandidate.job_id) && c.status !== 'Archivado')
      .map(decorateCandidate)
      .sort((a,b) => (b.global_score - a.global_score) || a.created_at.localeCompare(b.created_at));
    const rank = ranked.findIndex(c => Number(c.id) === Number(appCandidate.id)) + 1;
    return {
      candidate_name: appCandidate.full_name,
      dni_mask: maskDni(appCandidate.dni),
      job_title: appCandidate.job_title,
      area: appCandidate.job_area,
      rank: rank || null,
      total_candidates: ranked.length,
      global_score: appCandidate.global_score,
      technical_score: appCandidate.technical_score,
      soft_score: appCandidate.soft_score,
      recommendation: appCandidate.recommendation,
      status: appCandidate.status,
      applied_at: appCandidate.created_at
    };
  });
  audit(null, 'PUBLIC_RANKING_LOOKUP', 'candidate', null, { dni: maskDni(dni), applications: result.length });
  res.json({ dni_mask: maskDni(dni), total_applications: result.length, applications: result });
});

app.get('/api/jobs', auth, (_, res) => res.json(clone(db.jobs).sort((a,b) => b.created_at.localeCompare(a.created_at))));
app.get('/api/jobs/:id', auth, (req, res) => {
  const job = db.jobs.find(j => Number(j.id) === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Oferta no encontrada.' });
  res.json(clone(job));
});
app.post('/api/jobs', auth, (req, res) => {
  const { title, area, description, technical_skills, soft_skills, technical_weight, soft_weight, status } = req.body;
  if (!title || !area || !description) return res.status(400).json({ error: 'Título, área y descripción son obligatorios.' });
  const job = { id: nextId('jobs'), title, area, description, technical_skills: technical_skills || '', soft_skills: soft_skills || '', technical_weight: Number(technical_weight || 65), soft_weight: Number(soft_weight || 35), status: status || 'Activa', created_by: req.user.id, created_at: now(), updated_at: now() };
  db.jobs.push(job); saveDb(); audit(req.user.id, 'CREATE_JOB', 'job', job.id, { title });
  res.status(201).json(clone(job));
});
app.put('/api/jobs/:id', auth, (req, res) => {
  const job = db.jobs.find(j => Number(j.id) === Number(req.params.id));
  if (!job) return res.status(404).json({ error: 'Oferta no encontrada.' });
  Object.assign(job, ['title','area','description','technical_skills','soft_skills','technical_weight','soft_weight','status'].reduce((acc, key) => {
    if (req.body[key] !== undefined) acc[key] = ['technical_weight','soft_weight'].includes(key) ? Number(req.body[key]) : req.body[key];
    return acc;
  }, {}), { updated_at: now() });
  saveDb(); audit(req.user.id, 'UPDATE_JOB', 'job', job.id, { title: job.title });
  res.json(clone(job));
});
app.delete('/api/jobs/:id', auth, adminOnly, (req, res) => {
  db.jobs = db.jobs.filter(j => Number(j.id) !== Number(req.params.id));
  db.candidates = db.candidates.filter(c => Number(c.job_id) !== Number(req.params.id));
  saveDb(); audit(req.user.id, 'DELETE_JOB', 'job', req.params.id);
  res.json({ ok: true });
});

app.get('/api/candidates', auth, (req, res) => {
  let rows = db.candidates.map(decorateCandidate);
  if (req.query.jobId) rows = rows.filter(c => Number(c.job_id) === Number(req.query.jobId));
  if (req.query.status) rows = rows.filter(c => c.status === req.query.status);
  if (req.query.q) {
    const q = normalize(req.query.q);
    rows = rows.filter(c => normalize(`${c.full_name} ${c.email} ${c.dni || ''} ${c.job_title}`).includes(q));
  }
  rows.sort((a,b) => (b.global_score - a.global_score) || b.created_at.localeCompare(a.created_at));
  res.json(rows);
});
app.get('/api/candidates/:id', auth, (req, res) => {
  const candidate = db.candidates.find(c => Number(c.id) === Number(req.params.id));
  if (!candidate) return res.status(404).json({ error: 'Candidato no encontrado.' });
  res.json(decorateCandidate(candidate));
});
app.post('/api/candidates', auth, upload.single('cv_file'), async (req, res) => {
  const job = db.jobs.find(j => Number(j.id) === Number(req.body.job_id));
  if (!job) return res.status(400).json({ error: 'Seleccione una oferta válida.' });
  if (!req.body.full_name) return res.status(400).json({ error: 'Nombre del candidato requerido.' });
  const dni = normalizeDni(req.body.dni);
  if (!validDni(dni)) return res.status(400).json({ error: 'DNI válido de 8 dígitos requerido.' });
  if (db.candidates.some(c => Number(c.job_id) === Number(job.id) && normalizeDni(c.dni) === dni)) return res.status(400).json({ error: 'Ya existe un candidato con este DNI para la oferta seleccionada.' });
  const fileText = await parseUploadedFile(req.file);
  const cvText = [fileText, req.body.cv_text || ''].filter(Boolean).join('\n\n').trim();
  const candidate = {
    id: nextId('candidates'), job_id: Number(req.body.job_id), full_name: req.body.full_name, dni, email: req.body.email || detectEmail(cvText), phone: req.body.phone || detectPhone(cvText),
    cv_filename: req.file ? req.file.filename : '', cv_text: cvText, interview_text: req.body.interview_text || '', years_experience: 0, detected_skills: [], technical_score: 0, soft_score: 0, global_score: 0, recommendation: 'Pendiente', explanation: '', status: 'Activo', created_at: now(), updated_at: now()
  };
  db.candidates.push(candidate); saveDb(); audit(req.user.id, 'CREATE_CANDIDATE', 'candidate', candidate.id, { full_name: candidate.full_name });
  res.status(201).json(recalcCandidate(candidate.id, req.user.id));
});
app.put('/api/candidates/:id', auth, upload.single('cv_file'), async (req, res) => {
  const candidate = db.candidates.find(c => Number(c.id) === Number(req.params.id));
  if (!candidate) return res.status(404).json({ error: 'Candidato no encontrado.' });
  const fileText = await parseUploadedFile(req.file);
  if (req.body.job_id) candidate.job_id = Number(req.body.job_id);
  if (req.body.full_name) candidate.full_name = req.body.full_name;
  if (req.body.dni !== undefined) {
    const dni = normalizeDni(req.body.dni);
    if (!validDni(dni)) return res.status(400).json({ error: 'DNI válido de 8 dígitos requerido.' });
    candidate.dni = dni;
  }
  if (req.body.email !== undefined) candidate.email = req.body.email;
  if (req.body.phone !== undefined) candidate.phone = req.body.phone;
  if (fileText || req.body.cv_text !== undefined) candidate.cv_text = fileText || req.body.cv_text;
  if (req.file) candidate.cv_filename = req.file.filename;
  if (req.body.interview_text !== undefined) candidate.interview_text = req.body.interview_text;
  if (req.body.status) candidate.status = req.body.status;
  candidate.updated_at = now(); saveDb(); audit(req.user.id, 'UPDATE_CANDIDATE', 'candidate', candidate.id);
  res.json(recalcCandidate(candidate.id, req.user.id));
});
app.post('/api/candidates/:id/analyze', auth, (req, res) => {
  try { res.json(recalcCandidate(req.params.id, req.user.id)); }
  catch (err) { res.status(404).json({ error: err.message || 'No se pudo analizar.' }); }
});
app.post('/api/candidates/:id/archive', auth, (req, res) => {
  const candidate = db.candidates.find(c => Number(c.id) === Number(req.params.id));
  if (!candidate) return res.status(404).json({ error: 'Candidato no encontrado.' });
  candidate.status = req.body.restore ? 'Activo' : 'Archivado'; candidate.updated_at = now(); saveDb(); audit(req.user.id, candidate.status === 'Activo' ? 'RESTORE_CANDIDATE' : 'ARCHIVE_CANDIDATE', 'candidate', candidate.id, { reason: req.body.reason || '' });
  res.json(decorateCandidate(candidate));
});
app.delete('/api/candidates/:id', auth, adminOnly, (req, res) => {
  db.candidates = db.candidates.filter(c => Number(c.id) !== Number(req.params.id)); saveDb(); audit(req.user.id, 'DELETE_CANDIDATE', 'candidate', req.params.id); res.json({ ok: true });
});

app.get('/api/reports/export-csv', auth, (_, res) => {
  const rows = db.candidates.map(decorateCandidate).sort((a,b) => b.global_score - a.global_score);
  const header = ['Candidato','DNI','Email','Oferta','Puntaje técnico','Puntaje conductual','Puntaje global','Recomendación','Estado','Fecha'];
  const csv = [header, ...rows.map(r => [r.full_name,r.dni,r.email,r.job_title,r.technical_score,r.soft_score,r.global_score,r.recommendation,r.status,r.created_at])].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="talentmatch_reporte.csv"');
  res.send('\ufeff' + csv);
});
app.get('/api/reports/audit', auth, (_, res) => {
  const rows = db.audit_logs.slice(0, 300).map(a => ({ ...clone(a), user_name: (db.users.find(u => u.id === a.user_id) || {}).name || 'Sistema', user_email: (db.users.find(u => u.id === a.user_id) || {}).email || '' }));
  res.json(rows);
});
app.get('/api/audit/bias', auth, (req, res) => {
  let rows = db.candidates.map(decorateCandidate);
  if (req.query.jobId) rows = rows.filter(c => Number(c.job_id) === Number(req.query.jobId));
  rows.sort((a,b) => b.global_score - a.global_score);
  const results = rows.map((r, idx) => {
    const blindScore = clamp((r.technical_score * 0.68) + (r.soft_score * 0.32));
    return { candidate: r.full_name, job: r.job_title, originalRank: idx + 1, originalScore: r.global_score, blindScore, difference: Math.abs((r.global_score || 0) - blindScore), alert: Math.abs((r.global_score || 0) - blindScore) > 15 };
  });
  audit(req.user.id, 'RUN_BIAS_AUDIT', 'report', null, { jobId: req.query.jobId || 'all' });
  res.json({ generated_at: now(), alerts: results.filter(x => x.alert).length, results });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => {
  if (process.argv.includes('--seed-only')) { console.log('Base de datos inicializada.'); process.exit(0); }
  app.listen(PORT, () => console.log(`TalentMatch AI ejecutándose en http://localhost:${PORT}`));
}).catch(err => { console.error('Error al iniciar aplicación:', err); process.exit(1); });
