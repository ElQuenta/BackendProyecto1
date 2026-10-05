// Reconstruye las colecciones con datos de ejemplo coherentes (100 por coleccion).
// Uso: npm run db:seed        ATENCION: borra el contenido actual de estas colecciones.
// Es determinista: cada ejecucion genera exactamente los mismos datos.
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const PASSWORD = 'Secret123!';
const COUNT = 100;

/* ---------- generador pseudoaleatorio con semilla (resultados repetibles) ---------- */
let state = 2026;
const rnd = () => {
  state |= 0; state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
const pick = (arr) => arr[int(0, arr.length - 1)];
const chance = (p) => rnd() < p;
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = (n, len) => String(n).padStart(len, '0');
const randomPastDate = () => new Date(Date.now() - int(30, 700) * 86400000);

/* ---------- catalogos base ---------- */
const FIRST = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Laura', 'Andrés', 'Camila', 'Jorge', 'Valentina', 'Diego', 'Sofía', 'Santiago', 'Daniela', 'Felipe', 'Paula', 'Mateo', 'Isabella', 'Sebastián', 'Natalia', 'David', 'Carolina', 'Nicolás', 'Mariana', 'Alejandro', 'Juliana', 'Daniel', 'Andrea', 'Miguel', 'Luisa', 'Esteban', 'Manuela', 'Julián', 'Gabriela', 'Camilo', 'Sara', 'Tomás', 'Lucía', 'Ricardo', 'Paola', 'Fernando', 'Diana', 'Sergio', 'Catalina', 'Héctor', 'Viviana', 'Óscar', 'Ángela', 'Pablo', 'Melissa', 'Iván', 'Karen', 'Gustavo', 'Alejandra', 'Raúl', 'Lina', 'Mauricio', 'Tatiana', 'Rafael', 'Verónica'];
const LAST = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Gutiérrez', 'Chávez', 'Ramos', 'Mendoza', 'Vargas', 'Castillo', 'Jiménez', 'Moreno', 'Romero', 'Herrera', 'Medina', 'Aguilar', 'Castro', 'Rojas', 'Silva', 'Vega', 'Navarro', 'Salazar', 'Cárdenas', 'Ríos', 'Peña', 'Ospina', 'Restrepo', 'Zapata', 'Arango', 'Giraldo', 'Montoya', 'Londoño', 'Quintero', 'Cardona', 'Duque', 'Marín', 'Osorio', 'Parra', 'Cortés', 'Suárez', 'Acosta', 'Bernal', 'Pardo', 'Franco', 'Mejía', 'Lozano', 'Trujillo'];
const AREAS = [
  ['Ingeniería de Sistemas', 'ISIS'], ['Ingeniería Civil', 'ICIV'], ['Ingeniería Industrial', 'IIND'], ['Ingeniería Electrónica', 'IELE'],
  ['Ingeniería Mecánica', 'IMEC'], ['Ingeniería Ambiental', 'IAMB'], ['Ingeniería Química', 'IQUI'], ['Medicina', 'MEDI'],
  ['Enfermería', 'ENFE'], ['Odontología', 'ODON'], ['Psicología', 'PSIC'], ['Derecho', 'DERE'], ['Administración de Empresas', 'ADMI'],
  ['Contaduría Pública', 'CONT'], ['Economía', 'ECON'], ['Mercadeo', 'MERC'], ['Arquitectura', 'ARQU'], ['Diseño Gráfico', 'DGRA'],
  ['Comunicación Social', 'CSOC'], ['Biología', 'BIOL'], ['Química', 'QUIM'], ['Física', 'FISI'], ['Matemáticas', 'MATE'],
  ['Nutrición y Dietética', 'NUTR'], ['Fisioterapia', 'FISO'], ['Trabajo Social', 'TSOC'], ['Educación Infantil', 'LEIN'], ['Filosofía', 'FILO'],
  ['Historia', 'HIST'], ['Lenguas Modernas', 'LMOD'], ['Ciencias Políticas', 'CPOL'], ['Música', 'MUSI'], ['Veterinaria', 'VETE'],
];
const SUBJECT_TEMPLATES = [
  (a) => `Introducción a ${a}`,
  (a) => `Matemáticas para ${a}`,
  (a) => `Fundamentos de ${a}`,
  (a) => `Metodología de la Investigación en ${a}`,
  (a) => `Taller Integrador de ${a}`,
];

(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();
  const base = (extra) => ({ _id: new ObjectId(), ...extra, createdAt: randomPastDate(), updatedAt: now, __v: 0 });

  /* ===== PROGRAMAS (100): 33 areas x (pregrado, especializacion, maestria) + 1 tecnologia ===== */
  const programs = [];
  for (const [area, code] of AREAS) {
    programs.push(base({ code, name: area, totalCredits: code === 'ISIS' ? 160 : int(140, 180), active: true, _area: area, _level: 'pregrado' }));
    programs.push(base({ code: code + 'E', name: `Especialización en ${area}`, totalCredits: int(24, 30), active: chance(0.95), _area: area, _level: 'esp' }));
    programs.push(base({ code: code + 'M', name: `Maestría en ${area}`, totalCredits: int(40, 60), active: chance(0.95), _area: area, _level: 'maestria' }));
  }
  programs.push(base({ code: 'TDES', name: 'Tecnología en Desarrollo de Software', totalCredits: 110, active: true, _area: 'Desarrollo de Software', _level: 'tec' }));

  /* ===== MATERIAS (100): 5 por programa en los 20 primeros pregrados, encadenadas por prerrequisitos ===== */
  const subjects = [];
  const pregrados = programs.filter((p) => p._level === 'pregrado').slice(0, 20);
  for (const prog of pregrados) {
    const chain = [];
    for (let sem = 1; sem <= 5; sem++) {
      const isIsis = prog.code === 'ISIS';
      let code = prog.code + sem + pad(int(1, 99), 2);
      let name = SUBJECT_TEMPLATES[sem - 1](prog._area);
      let credits = int(2, 5);
      if (isIsis && sem === 1) { code = 'MAT101'; name = 'Cálculo 1'; credits = 4; }
      if (isIsis && sem === 2) { code = 'MAT201'; name = 'Cálculo 2'; credits = 4; }
      const prerequisites = [];
      if (sem >= 2) prerequisites.push(chain[sem - 2]._id);                 // requiere la del semestre anterior
      if (sem === 5) prerequisites.push(chain[2]._id);                      // y la del semestre 3
      const s = base({ code, name, credits, program: prog._id, semester: sem, prerequisites, active: true });
      chain.push(s);
      subjects.push(s);
    }
  }

  /* ===== PERIODOS (100): 1978-1 .. 2027-2 ===== */
  const periods = [];
  for (let year = 1978; year <= 2027; year++) {
    for (const term of [1, 2]) {
      const code = `${year}-${term}`;
      const startDate = term === 1 ? new Date(Date.UTC(year, 1, 2)) : new Date(Date.UTC(year, 7, 3));
      const endDate = term === 1 ? new Date(Date.UTC(year, 5, 20)) : new Date(Date.UTC(year, 11, 12));
      const status = code === '2026-2' ? 'abierto' : year > 2026 || (year === 2026 && term > 2) ? 'planificado' : 'cerrado';
      periods.push(base({ code, startDate, endDate, status }));
    }
  }

  /* ===== USUARIOS: 1 admin + 100 docentes + 100 estudiantes ===== */
  const users = [];
  const usedEmails = new Set(['admin@universidad.edu', 'gomez@universidad.edu', 'ana@universidad.edu']);
  const makeUser = (role, fixed) => {
    const first = pick(FIRST), l1 = pick(LAST), l2 = pick(LAST);
    let email = fixed?.email;
    if (!email) {
      let n = users.length + 1;
      do { email = `${plain(first)}.${plain(l1)}${n++}@universidad.edu`; } while (usedEmails.has(email));
      usedEmails.add(email);
    }
    const u = base({ name: fixed?.name ?? `${first} ${l1} ${l2}`, email, passwordHash: hash, role, active: chance(0.97) });
    if (fixed) u.active = true;
    users.push(u);
    return u;
  };
  makeUser('admin', { email: 'admin@universidad.edu', name: 'Administrador' });
  const teacherUsers = [makeUser('docente', { email: 'gomez@universidad.edu', name: 'Prof Gomez' })];
  while (teacherUsers.length < COUNT) teacherUsers.push(makeUser('docente'));
  const studentUsers = [makeUser('estudiante', { email: 'ana@universidad.edu', name: 'Ana Perez' })];
  while (studentUsers.length < COUNT) studentUsers.push(makeUser('estudiante'));

  /* ===== FACULTADES (10): una por area del conocimiento. El decano se asigna despues, cuando ya hay docentes por facultad ===== */
  const FACULTY_LIST = [
    ['Ingeniería', 'ING', 'Bogotá'], ['Ciencias de la Salud', 'SAL', 'Bogotá'], ['Ciencias Económicas y Administrativas', 'ECO', 'Bogotá'],
    ['Derecho y Ciencias Políticas', 'DER', 'Bogotá'], ['Humanidades', 'HUM', 'Bogotá'], ['Educación', 'EDU', 'Medellín'],
    ['Arquitectura y Diseño', 'ARQ', 'Medellín'], ['Artes', 'ART', 'Medellín'], ['Ciencias Naturales', 'CNA', 'Cali'], ['Comunicación', 'COM', 'Cali'],
  ];
  const faculties = FACULTY_LIST.map(([typeName, typeCode, campus]) => base({
    code: `FAC-${typeCode}`,
    name: `Facultad de ${typeName}`,
    campus,
    email: `${plain(typeName)}@universidad.edu`,
    active: true,
  }));

  /* ===== DOCENTES (100) y ESTUDIANTES (100) ===== */
  const teachers = teacherUsers.map((u, i) =>
    base({ user: u._id, code: i === 0 ? 'DOC-001' : `DOC-${pad(i + 1, 3)}`, faculty: i === 0 ? faculties.find((f) => f.code === 'FAC-ING')._id : pick(faculties)._id, active: u.active }),
  );
  const activeProgs = programs.filter((p) => p.active);
  const students = studentUsers.map((u, i) => {
    const prog = i === 0 ? programs.find((p) => p.code === 'ISIS') : chance(0.8) ? pick(activeProgs.filter((p) => p._level === 'pregrado' || p._level === 'tec')) : pick(activeProgs);
    return base({ user: u._id, code: i === 0 ? '2026001' : `E${int(2019, 2026)}${pad(i + 1, 4)}`, program: prog._id, active: u.active });
  });

  /* ===== SALONES (100): 4 edificios x 5 pisos x 5 salones. Los horarios de los grupos usan estos codigos ===== */
  const classrooms = [];
  for (const building of ['A', 'B', 'C', 'D']) {
    for (let floor = 1; floor <= 5; floor++) {
      for (let n = 1; n <= 5; n++) {
        const roll = rnd();
        const type = roll < 0.7 ? 'aula' : roll < 0.82 ? 'laboratorio' : roll < 0.94 ? 'sala de computo' : 'auditorio';
        const capacity = type === 'aula' ? int(30, 60) : type === 'laboratorio' ? int(20, 35) : type === 'sala de computo' ? int(20, 40) : int(80, 150);
        classrooms.push(base({ code: `${building}-${floor}${pad(n, 2)}`, building, floor, capacity, type, hasProjector: chance(0.85), active: true }));
      }
    }
  }
  classrooms[int(0, 99)].active = false;                                             // un par de salones en mantenimiento
  classrooms[int(0, 99)].active = false;

  /* ===== GRUPOS (100): materia + docente + periodo + cupo + horario, sin cruces de docente ni de salon ===== */
  const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const SLOTS = [['07:00', '09:00'], ['09:00', '11:00'], ['11:00', '13:00'], ['14:00', '16:00'], ['16:00', '18:00'], ['18:00', '20:00']];
  const groupPeriods = ['2025-1', '2025-2', '2026-1', '2026-2', '2027-1'].map((c) => periods.find((p) => p.code === c));
  const activeTeachers = teachers.filter((t) => t.active);
  const busy = new Set();
  const groups = [];
  for (let guard = 0; groups.length < COUNT && guard < 20000; guard++) {
    const subject = pick(subjects);
    const period = pick(groupPeriods);
    const teacher = pick(activeTeachers);
    const capacity = int(20, 45);
    const roomDoc = pick(classrooms.filter((r) => r.active && r.type !== 'auditorio' && r.capacity >= capacity));   // el salon debe caber el grupo
    const days = chance(0.5) ? [pick(DAYS)] : [...new Set([pick(DAYS), pick(DAYS)])];
    const slotIdx = int(0, SLOTS.length - 1);

    const keys = days.flatMap((d) => [`${period._id}|t|${teacher._id}|${d}|${slotIdx}`, `${period._id}|r|${roomDoc._id}|${d}|${slotIdx}`]);
    if (keys.some((k) => busy.has(k))) continue;                              // docente o salon ocupado
    keys.forEach((k) => busy.add(k));

    const number = groups.filter((g) => g.subject === subject._id && g.period === period._id).length + 1;
    groups.push(base({
      subject: subject._id, teacher: teacher._id, period: period._id, number,
      capacity, enrolled: 0,
      schedule: days.map((day) => ({ day, startTime: SLOTS[slotIdx][0], endTime: SLOTS[slotIdx][1], classroom: roomDoc._id })),
      active: true,
    }));
  }

  /* ===== MATRICULAS, EVALUACIONES y NOTAS: se generan periodo por periodo (historial coherente) ===== */
  const MAX_CREDITS = 20;
  const PASSING = 3.0;
  const PLAN = [['Parcial 1', 25], ['Parcial 2', 25], ['Taller', 20], ['Examen final', 30]];
  const QUOTAS = [['2025-1', 5], ['2025-2', 7], ['2026-1', 7], ['2026-2', 6]];     // grupos con estudiantes por periodo (25 en total)
  const TARGET = 5;                                                                // estudiantes por grupo (ideal)
  const TARGET_FIRST_SEMESTER = 9;                                                 // los de primer semestre son mas grandes: alimentan los prerrequisitos
  const MIN_PER_GROUP = 3;                                                         // minimo para abrir el grupo con matriculas
  const enrollments = [];
  const evaluations = [];
  const grades = [];
  const shuffled = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const overlap = (a, b) => a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime;
  const subjectById = new Map(subjects.map((s) => [String(s._id), s]));
  const activeStudents = students.filter((s) => s.active);
  const approved = new Map(students.map((s) => [String(s._id), new Set()]));       // materias aprobadas en periodos anteriores
  const skill = new Map(students.map((s) => [String(s._id), 2.6 + rnd() * 1.9]));   // "nivel" de cada estudiante

  for (const [code, quota] of QUOTAS) {
    const period = periods.find((p) => p.code === code);
    const closed = period.status === 'cerrado';
    const used = new Map();                                                         // carga del estudiante dentro de este periodo
    const newlyApproved = [];
    let taken = 0;

    for (const group of shuffled(groups.filter((g) => String(g.period) === String(period._id)))) {
      if (taken >= quota) break;
      const subject = subjectById.get(String(group.subject));
      const chosen = [];
      for (const st of shuffled(activeStudents)) {
        if (chosen.length === (subject.semester === 1 ? TARGET_FIRST_SEMESTER : TARGET)) break;
        const id = String(st._id);
        const load = used.get(id) ?? { credits: 0, slots: [], subjects: new Set() };
        const appr = approved.get(id);
        const eligible =
          !appr.has(String(subject._id)) &&                                         // no la ha aprobado
          subject.prerequisites.every((p) => appr.has(String(p))) &&                // tiene los prerrequisitos aprobados
          !load.subjects.has(String(subject._id)) &&                                // no la cursa ya este periodo
          load.credits + subject.credits <= MAX_CREDITS &&                          // limite de creditos
          !group.schedule.some((a) => load.slots.some((b) => overlap(a, b)));       // sin cruce de horario
        if (eligible) chosen.push(st);
      }
      if (chosen.length < MIN_PER_GROUP) continue;                                  // grupo sin suficientes elegibles: se omite
      taken++;

      const evs = PLAN.map(([name, weight]) => base({ group: group._id, name, weight }));
      evaluations.push(...evs);

      let seats = 0;
      for (const st of chosen) {
        const id = String(st._id);
        const load = used.get(id) ?? { credits: 0, slots: [], subjects: new Set() };
        const cancelled = chance(0.05);
        const createdAt = new Date(period.startDate.getTime() - int(1, 20) * 86400000);
        const enr = { ...base({ student: st._id, group: group._id, subject: subject._id, period: period._id, status: 'activa' }), createdAt };

        if (cancelled) {
          enr.status = 'cancelada';
        } else {
          seats++;
          load.credits += subject.credits; load.subjects.add(String(subject._id)); load.slots.push(...group.schedule);
          const level = skill.get(id);
          const graded = closed ? evs : evs.slice(0, 2);                            // periodo abierto: solo los 2 primeros parciales
          const values = graded.map((e) => ({ e, value: round(clamp(level + (rnd() - 0.5) * 1.4, 0, 5), 1) }));
          values.forEach(({ e, value }) => grades.push({ ...base({ enrollment: enr._id, evaluation: e._id, value }), createdAt: new Date(period.startDate.getTime() + int(20, 100) * 86400000) }));
          if (closed) {
            enr.finalGrade = round(values.reduce((sum, { e, value }) => sum + value * (e.weight / 100), 0), 2);
            enr.status = enr.finalGrade >= PASSING ? 'aprobada' : 'reprobada';
            if (enr.status === 'aprobada') newlyApproved.push([id, String(subject._id)]);
          }
        }
        used.set(id, load);
        enrollments.push(enr);
      }
      group.enrolled = seats;                                                       // cupos ocupados = matriculas no canceladas
    }
    newlyApproved.forEach(([id, subjectId]) => approved.get(id).add(subjectId));    // cuentan como aprobadas desde el periodo siguiente
  }

  // Los docentes ya definieron el plan de evaluacion de otros grupos del periodo abierto y del planificado (aun sin notas)
  const withPlan = new Set(evaluations.map((e) => String(e.group)));
  const openOrPlanned = new Set(periods.filter((p) => p.status !== 'cerrado').map((p) => String(p._id)));
  for (const g of groups) {
    if (evaluations.length >= COUNT) break;
    if (withPlan.has(String(g._id)) || !openOrPlanned.has(String(g.period))) continue;
    evaluations.push(...PLAN.map(([name, weight]) => base({ group: g._id, name, weight })));
  }

  /* ===== Decanos (un docente activo de la misma facultad) y facultad de cada programa ===== */
  const AREA_FACULTY = {
    ISIS: 'ING', ICIV: 'ING', IIND: 'ING', IELE: 'ING', IMEC: 'ING', IAMB: 'ING', IQUI: 'ING', TDES: 'ING',
    MEDI: 'SAL', ENFE: 'SAL', ODON: 'SAL', NUTR: 'SAL', FISO: 'SAL', VETE: 'SAL',
    ADMI: 'ECO', CONT: 'ECO', ECON: 'ECO', MERC: 'ECO', DERE: 'DER', CPOL: 'DER',
    PSIC: 'HUM', FILO: 'HUM', HIST: 'HUM', LMOD: 'HUM', TSOC: 'HUM', LEIN: 'EDU',
    ARQU: 'ARQ', DGRA: 'ARQ', MUSI: 'ART', BIOL: 'CNA', QUIM: 'CNA', FISI: 'CNA', MATE: 'CNA', CSOC: 'COM',
  };
  for (const f of faculties) {
    const candidates = teachers.filter((t) => t.active && String(t.faculty) === String(f._id));
    let dean = candidates.length ? pick(candidates) : null;
    if (!dean) { dean = pick(teachers.filter((t) => t.active)); dean.faculty = f._id; }   // facultad sin docentes activos: se traslada uno
    f.dean = dean._id;
  }
  for (const program of programs) {
    const baseCode = program.code.length === 5 ? program.code.slice(0, 4) : program.code;   // ISISE / ISISM -> ISIS
    program.faculty = faculties.find((f) => f.code === 'FAC-' + AREA_FACULTY[baseCode])._id;
  }

  /* ===== NOTIFICACIONES (100): derivadas de matriculas, grupos y notas que ya existen ===== */
  const studentById = new Map(students.map((s) => [String(s._id), s]));
  const teacherById = new Map(teachers.map((t) => [String(t._id), t]));
  const groupById = new Map(groups.map((g) => [String(g._id), g]));
  const periodById = new Map(periods.map((p) => [String(p._id), p]));
  const openPeriod = periods.find((p) => p.status === 'abierto');
  const notif = (user, type, title, message, createdAt, relatedModel, relatedId) =>
    ({ ...base({ user, type, title, message, read: false }), createdAt, relatedModel, relatedId });
  const label = (enr) => { const s = subjectById.get(String(enr.subject)); return `${s.name} (${s.code}), grupo ${groupById.get(String(enr.group)).number}`; };

  const notifications = [
    ...enrollments.filter((e) => e.status === 'activa' && String(e.period) === String(openPeriod._id))
      .map((e) => notif(studentById.get(String(e.student)).user, 'matricula_confirmada', 'Matrícula confirmada', `Tu matrícula en ${label(e)} fue confirmada.`, e.createdAt, 'Enrollment', e._id)),
    ...enrollments.filter((e) => e.status === 'cancelada')
      .map((e) => notif(studentById.get(String(e.student)).user, 'matricula_cancelada', 'Matrícula cancelada', `Tu matrícula en ${label(e)} fue cancelada.`, e.createdAt, 'Enrollment', e._id)),
    ...groups.filter((g) => String(g.period) === String(openPeriod._id))
      .map((g) => { const s = subjectById.get(String(g.subject)); return notif(teacherById.get(String(g.teacher)).user, 'grupo_asignado', 'Nuevo grupo asignado', `Se te asignó el grupo ${g.number} de ${s.name} (${s.code}) para el periodo ${openPeriod.code}.`, g.createdAt, 'Group', g._id); }),
  ];
  for (const e of shuffled(enrollments.filter((x) => x.status === 'aprobada' || x.status === 'reprobada'))) {
    if (notifications.length >= COUNT) break;
    const s = subjectById.get(String(e.subject));
    notifications.push(notif(studentById.get(String(e.student)).user, 'nota_final', 'Nota final publicada', `Tu nota final en ${s.name} (${s.code}) fue ${e.finalGrade.toFixed(1)}: ${e.status}.`, periodById.get(String(e.period)).endDate, 'Enrollment', e._id));
  }
  notifications.length = Math.min(notifications.length, COUNT);
  notifications.forEach((n) => { if (chance(0.6)) { n.read = true; n.readAt = new Date(n.createdAt.getTime() + int(1, 72) * 3600000); } });

  /* ---------- limpiar campos auxiliares y escribir ---------- */
  programs.forEach((p) => { delete p._area; delete p._level; });

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();
  const data = { users, programs, subjects, periods, students, teachers, groups, enrollments, evaluations, grades, classrooms, faculties, notifications };
  for (const [name, docs] of Object.entries(data)) {
    await db.collection(name).deleteMany({});
    await db.collection(name).insertMany(docs);
    console.log(name.padEnd(10), String(docs.length).padStart(4), 'documentos');
  }
  await client.close();
  console.log(`\nListo. Todos los usuarios entran con la clave: ${PASSWORD}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
