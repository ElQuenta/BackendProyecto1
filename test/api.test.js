const fs = require('fs');
const { openFixture } = require('./support/api-fixture.cjs');
const { inventory } = require('../scripts/review-contract.cjs');
const rows = inventory();
let f, ids = {}, tokens = {}, results = [];
const missingId = '000000000000000000000000';
async function call(method, route, expected, body, role = 'admin') {
  const response = await fetch(f.baseUrl + route, {
    method, headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  results.push({ method, route: route.replace(/[a-f\d]{24}/g, ':fixtureId'), expected, actual: response.status, passed: response.status === expected });
  expect({ status: response.status, message: data.message }).toMatchObject({ status: expected });
  return data;
}
function fill(row) {
  const resource = row.route.split('/')[3];
  return row.route.replace(':id', ids[resource]).replace(':enrollmentId', ids.enrollments);
}
beforeAll(async () => {
  f = await openFixture();
  await Promise.all(f.connection.modelNames().map(n => f.connection.model(n).init()));
  tokens.admin = (await call('POST', '/api/v1/auth/login', 200, { email: 'review-admin@example.invalid', password: f.password }, 'none')).accessToken;
  const jwt = JSON.parse(Buffer.from(tokens.admin.split('.')[1], 'base64url').toString());
  expect(jwt.exp - jwt.iat).toBe(3600);
  const admin = await call('GET', '/api/v1/auth/me', 200);
  ids.admin = admin.id;
  for (const role of ['docente', 'estudiante', 'other']) {
    const user = await call('POST', '/api/v1/users', 201, { name: `Review ${role}`, email: `review-${role}@example.invalid`, password: f.password, role: role === 'other' ? 'docente' : role });
    ids[role] = user.id;
    expect(user).not.toHaveProperty('passwordHash');
    tokens[role] = (await call('POST', '/api/v1/auth/login', 200, { email: `review-${role}@example.invalid`, password: f.password }, 'none')).accessToken;
  }
  ids.users = ids.estudiante;
  ids.faculties = (await call('POST', '/api/v1/faculties', 201, { code: 'REV-FAC', name: 'Review Faculty', campus: 'Fixture' }))._id;
  ids.programs = (await call('POST', '/api/v1/programs', 201, { code: 'REV-PR', name: 'Review Program', totalCredits: 20, faculty: ids.faculties }))._id;
  ids.subjects = (await call('POST', '/api/v1/subjects', 201, { code: 'REV-SUB', name: 'Review Subject', credits: 3, semester: 1, program: ids.programs }))._id;
  ids.periods = (await call('POST', '/api/v1/periods', 201, { code: 'REV-PER', startDate: '2026-01-01', endDate: '2026-12-31' }))._id;
  await call('PATCH', `/api/v1/periods/${ids.periods}`, 200, { status: 'abierto' });
  ids.students = (await call('POST', '/api/v1/students', 201, { user: ids.estudiante, code: 'REV-ST', program: ids.programs }))._id;
  ids.teachers = (await call('POST', '/api/v1/teachers', 201, { user: ids.docente, code: 'REV-TE', faculty: ids.faculties }))._id;
  ids.otherTeacher = (await call('POST', '/api/v1/teachers', 201, { user: ids.other, code: 'REV-OT', faculty: ids.faculties }))._id;
  ids.classrooms = (await call('POST', '/api/v1/classrooms', 201, { code: 'REV-ROOM', building: 'R', floor: 1, capacity: 30 }))._id;
  ids.groups = (await call('POST', '/api/v1/groups', 201, { subject: ids.subjects, teacher: ids.teachers, period: ids.periods, capacity: 10, schedule: [{ day: 'lunes', startTime: '08:00', endTime: '10:00', classroom: ids.classrooms }] }))._id;
  ids.enrollments = (await call('POST', '/api/v1/enrollments', 201, { groupId: ids.groups }, 'estudiante'))._id;
  ids.evaluations = (await call('POST', '/api/v1/evaluations', 201, { group: ids.groups, name: 'Review Final', weight: 100 }, 'docente'))._id;
  ids.grades = (await call('PUT', '/api/v1/grades', 200, { enrollment: ids.enrollments, evaluation: ids.evaluations, value: 3 }, 'docente'))._id;
  ids.notifications = (await call('POST', '/api/v1/notifications', 201, { user: ids.admin, title: 'Review Notice', message: 'Synthetic fixture' }))._id;
}, 90000);
afterAll(async () => {
  try { fs.writeFileSync('postman/review-http-results.json', JSON.stringify({ runner: 'Jest + HTTP fetch, isolated MongoDB fixtures', results }, null, 2)); }
  finally { if (f) await f.close(); }
});

test.each(rows.filter(r => r.method === 'GET'))('$method $route responde con fixture y rol permitido', async row => {
  const role = row.roles.length === 1 && row.roles[0] !== 'admin' ? row.roles[0] : 'admin';
  const query = row.route === '/api/v1/grades' ? `?enrollment=${ids.enrollments}` : '';
  const data = await call('GET', fill(row) + query, row.status, undefined, role);
  expect(typeof data).toBe('object');
  expect(data).not.toBeNull();
  if (data.meta) { expect(Array.isArray(data.data)).toBe(true); expect(data.meta.page).toBe(1); }
  expect(JSON.stringify(data)).not.toContain('passwordHash');
});

test.each(rows.filter(r => !r.public))('$method $route rechaza sesión ausente', async row => {
  const data = await call(row.method, fill(row), 401, undefined, 'none');
  expect(data.statusCode).toBe(401);
});

test('roles y pertenencia impiden acceso y escritura ajenos', async () => {
  await call('GET', '/api/v1/users', 403, undefined, 'estudiante');
  await call('GET', '/api/v1/reports/dashboard', 403, undefined, 'docente');
  await call('POST', '/api/v1/evaluations', 403, { group: ids.groups, name: 'Unauthorized', weight: 1 }, 'other');
  await call('GET', `/api/v1/groups/${ids.groups}/grade-sheet`, 403, undefined, 'other');
  await call('PUT', '/api/v1/grades', 403, { enrollment: ids.enrollments, evaluation: ids.evaluations, value: 5 }, 'other');
  await call('GET', `/api/v1/enrollments/${ids.enrollments}`, 403, undefined, 'docente');
});

test('validación, inexistencia y duplicados tienen status exacto', async () => {
  await call('GET', '/api/v1/users?active=invalid', 400);
  await call('GET', '/api/v1/notifications/mine?read=invalid', 400);
  await call('GET', '/api/v1/subjects?page=0', 400);
  await call('GET', '/api/v1/users/invalid', 400);
  await call('GET', `/api/v1/users/${missingId}`, 404);
  await call('POST', '/api/v1/users', 409, { name: 'Duplicate', email: 'review-estudiante@example.invalid', password: f.password });
  await call('POST', '/api/v1/auth/login', 400, {}, 'none');
  await call('PUT', '/api/v1/grades', 400, { enrollment: ids.enrollments, evaluation: ids.evaluations, value: 5.01 });
});

test('actualizaciones de cada recurso respetan contrato', async () => {
  for (const [resource, body] of Object.entries({ users: { name: 'Review Updated' }, faculties: { campus: 'Updated' }, programs: { name: 'Review Updated' }, subjects: { name: 'Review Updated' }, periods: { code: 'REV-UPDATED' }, students: { code: 'REV-ST-UPDATED' }, teachers: { code: 'REV-TE-UPDATED' }, classrooms: { capacity: 35 }, groups: { capacity: 11 }, evaluations: { name: 'Review Updated' } })) {
    await call('PATCH', `/api/v1/${resource}/${ids[resource]}`, 200, body);
  }
  const own = await call('PATCH', '/api/v1/users/me', 200, { name: 'Review Own' }, 'estudiante');
  expect(own.name).toBe('Review Own');
});

test('cancelación libera cupo una sola vez y permite rematricular', async () => {
  expect((await call('GET', `/api/v1/groups/${ids.groups}`, 200)).enrolled).toBe(1);
  expect((await call('POST', `/api/v1/enrollments/${ids.enrollments}/cancel`, 201, undefined, 'estudiante')).status).toBe('cancelada');
  expect((await call('GET', `/api/v1/groups/${ids.groups}`, 200)).enrolled).toBe(0);
  await call('POST', `/api/v1/enrollments/${ids.enrollments}/cancel`, 400, undefined, 'estudiante');
  expect((await call('POST', '/api/v1/enrollments', 201, { groupId: ids.groups }, 'estudiante'))._id).toBe(ids.enrollments);
  expect((await call('GET', `/api/v1/groups/${ids.groups}`, 200)).enrolled).toBe(1);
});

test('notificaciones se marcan y no pueden ser alteradas por otro dueño', async () => {
  await call('PATCH', `/api/v1/notifications/${ids.notifications}/read`, 403, undefined, 'estudiante');
  expect((await call('PATCH', `/api/v1/notifications/${ids.notifications}/read`, 200)).read).toBe(true);
  expect((await call('PATCH', '/api/v1/notifications/read-all', 200, undefined, 'docente')).updated).toBeGreaterThan(0);
});

test('notas idempotentes, bulk, eliminación y límite aprobado 3.0', async () => {
  const grade = await call('PUT', '/api/v1/grades', 200, { enrollment: ids.enrollments, evaluation: ids.evaluations, value: 5 }, 'docente');
  expect(grade._id).toBe(ids.grades);
  expect(grade.value).toBe(5);
  await call('DELETE', `/api/v1/grades/${ids.grades}`, 200, undefined, 'docente');
  const bulk = await call('PUT', '/api/v1/grades/bulk', 200, { items: [{ enrollment: ids.enrollments, evaluation: ids.evaluations, value: 3 }] }, 'docente');
  expect(bulk.saved).toBe(1); expect(bulk.failed).toHaveLength(0);
  await call('DELETE', `/api/v1/evaluations/${ids.evaluations}`, 409);
  await call('POST', `/api/v1/periods/${ids.periods}/close`, 409);
  const finished = await call('POST', `/api/v1/grades/finalize/${ids.enrollments}`, 200, undefined, 'docente');
  expect(finished).toMatchObject({ finalGrade: 3, status: 'aprobada' });
  await call('POST', `/api/v1/grades/finalize/${ids.enrollments}`, 400, undefined, 'docente');
  await call('POST', `/api/v1/groups/${ids.groups}/finalize`, 400, undefined, 'docente');
  expect((await call('POST', `/api/v1/periods/${ids.periods}/close`, 200)).closed).toBe(true);
});

test('capacidad final se reserva de forma atómica entre estudiantes distintos', async () => {
  // This period is closed by the previous scenario: create a fresh, isolated open period.
  const period = await call('POST', '/api/v1/periods', 201, { code: 'REV-CONCURRENCY', startDate: '2027-01-01', endDate: '2027-12-31' });
  await call('PATCH', `/api/v1/periods/${period._id}`, 200, { status: 'abierto' });
  const user = await call('POST', '/api/v1/users', 201, { name: 'Review Second Student', email: 'review-second@example.invalid', password: f.password, role: 'estudiante' });
  const student = await call('POST', '/api/v1/students', 201, { user: user.id, code: 'REV-SECOND', program: ids.programs });
  const subject = await call('POST', '/api/v1/subjects', 201, { code: 'REV-CONC', name: 'Review Concurrent', credits: 3, program: ids.programs });
  const group = await call('POST', '/api/v1/groups', 201, { subject: subject._id, teacher: ids.teachers, period: period._id, capacity: 1, schedule: [{day:'martes',startTime:'08:00',endTime:'10:00',classroom:ids.classrooms}] });
  const enroll = async studentId => {
    const response = await fetch(f.baseUrl + '/api/v1/enrollments', { method: 'POST', headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tokens.admin}` }, body: JSON.stringify({groupId:group._id,student:studentId}) });
    results.push({method:'POST',route:'/api/v1/enrollments',scenario:'last seat concurrency',expected:'one 201, one 409',actual:response.status,passed:[201,409].includes(response.status)});
    return {status:response.status,body:await response.json()};
  };
  const responses = await Promise.all([enroll(ids.students),enroll(student._id)]);
  expect(responses.map(r=>r.status).sort()).toEqual([201,409]);
  const active = responses.find(r=>r.status===201).body;
  expect((await call('GET', `/api/v1/groups/${group._id}`, 200)).enrolled).toBe(1);
  await call('POST', `/api/v1/enrollments/${active._id}/cancel`, 201);
  expect((await call('GET', `/api/v1/groups/${group._id}`, 200)).enrolled).toBe(0);
  // No active seats remain: also exercise successful finalization of a group and forced period closure.
  const nextEnrollment = await call('POST', '/api/v1/enrollments', 201, {groupId:group._id,student:student._id});
  const evaluation = await call('POST', '/api/v1/evaluations', 201, {group:group._id,name:'Review Concurrent Final',weight:100});
  await call('PUT', '/api/v1/grades', 200, {enrollment:nextEnrollment._id,evaluation:evaluation._id,value:4});
  expect((await call('POST', `/api/v1/groups/${group._id}/finalize`, 200)).finalized).toBe(1);
  await call('POST', `/api/v1/periods/${period._id}/close`, 200);
  await call('PATCH', `/api/v1/evaluations/${evaluation._id}`, 400, {name:'Closed cannot change'});
});

test('reglas de prerrequisitos, créditos, porcentajes y horarios se verifican antes de guardar', async () => {
  const period = await call('POST', '/api/v1/periods', 201, {code:'REV-RULES',startDate:'2028-01-01',endDate:'2028-12-31'});
  await call('PATCH', `/api/v1/periods/${period._id}`, 200, {status:'abierto'});
  await call('PATCH', `/api/v1/periods/${period._id}`, 400, {status:'planificado'});
  const base = {teacher:ids.teachers,period:period._id,capacity:10};
  const subjects=[];
  for(let n=0;n<3;n++)subjects.push(await call('POST','/api/v1/subjects',201,{code:`REV-CREDIT-${n}`,name:'Review Credits',credits:10,program:ids.programs}));
  for(let n=0;n<3;n++){
    const group=await call('POST','/api/v1/groups',201,{...base,subject:subjects[n]._id,schedule:[{day:'miercoles',startTime:`${10+n}:00`,endTime:`${11+n}:00`,classroom:ids.classrooms}]});
    await call('POST','/api/v1/enrollments',n<2?201:400,{groupId:group._id,student:ids.students});
  }
  const prereq=await call('POST','/api/v1/subjects',201,{code:'REV-PREREQ',name:'Review Prerequisite',credits:1,program:ids.programs,prerequisites:[subjects[2]._id]});
  const gated=await call('POST','/api/v1/groups',201,{...base,subject:prereq._id,schedule:[{day:'jueves',startTime:'08:00',endTime:'09:00',classroom:ids.classrooms}]});
  await call('POST','/api/v1/enrollments',400,{groupId:gated._id,student:ids.students});
  await call('POST','/api/v1/groups',400,{...base,subject:prereq._id,schedule:[{day:'viernes',startTime:'10:00',endTime:'09:00',classroom:ids.classrooms}]});
  await call('POST','/api/v1/groups',409,{...base,subject:prereq._id,schedule:[{day:'jueves',startTime:'08:30',endTime:'09:30',classroom:ids.classrooms}]});
  await call('POST','/api/v1/evaluations',201,{group:gated._id,name:'Half',weight:60});
  await call('POST','/api/v1/evaluations',400,{group:gated._id,name:'Overflow',weight:50});
  expect((await call('POST', `/api/v1/periods/${period._id}/close?cancelPending=true`, 200)).cancelledPending).toBe(2);
});

test('DELETE devuelve contrato de éxito para cada recurso sin dependencias', async () => {
  const faculty=await call('POST','/api/v1/faculties',201,{code:'REV-FREE-F',name:'Review Free',campus:'Fixture'});
  const program=await call('POST','/api/v1/programs',201,{code:'REV-FREE-P',name:'Review Free',totalCredits:10,faculty:faculty._id});
  const subject=await call('POST','/api/v1/subjects',201,{code:'REV-FREE-S',name:'Review Free',credits:1,program:program._id});
  const period=await call('POST','/api/v1/periods',201,{code:'REV-FREE-PER',startDate:'2029-01-01',endDate:'2029-12-31'});
  const room=await call('POST','/api/v1/classrooms',201,{code:'REV-FREE-R',building:'R',floor:1,capacity:10});
  const group=await call('POST','/api/v1/groups',201,{subject:subject._id,teacher:ids.teachers,period:period._id,capacity:5,schedule:[{day:'viernes',startTime:'08:00',endTime:'09:00',classroom:room._id}]});
  const evaluation=await call('POST','/api/v1/evaluations',201,{group:group._id,name:'Review Free',weight:100});
  const user=await call('POST','/api/v1/users',201,{name:'Review Free',email:'review-free@example.invalid',password:f.password,role:'estudiante'});
  const student=await call('POST','/api/v1/students',201,{code:'REV-FREE-ST',user:user.id,program:program._id});
  for(const [resource,id] of [['evaluations',evaluation._id],['groups',group._id],['students',student._id],['users',user.id],['subjects',subject._id],['programs',program._id],['faculties',faculty._id],['classrooms',room._id],['periods',period._id]]){
    expect(await call('DELETE',`/api/v1/${resource}/${id}`,200)).toMatchObject({deleted:true,resource,id});
  }
});

test('contraseña persiste, revoca token anterior y permite token nuevo', async () => {
  const old = tokens.estudiante;
  const next = f.password + 'Next9';
  const changed = await call('PATCH', '/api/v1/auth/change-password', 200, { currentPassword: f.password, newPassword: next }, 'estudiante');
  await call('GET', '/api/v1/auth/me', 401, undefined, 'estudiante');
  tokens.estudiante = changed.accessToken;
  await call('GET', '/api/v1/auth/me', 200, undefined, 'estudiante');
  await call('POST', '/api/v1/auth/login', 401, { email: 'review-estudiante@example.invalid', password: f.password }, 'none');
  const login = await call('POST', '/api/v1/auth/login', 200, { email: 'review-estudiante@example.invalid', password: next }, 'none');
  expect(login.accessToken).not.toBe(old);
  await call('POST', `/api/v1/users/${ids.estudiante}/reset-password`, 200, { newPassword: f.password });
  await call('GET', '/api/v1/auth/me', 401, undefined, 'estudiante');
});

test('eliminaciones preservan dependencias y eliminan fixtures libres', async () => {
  await call('DELETE', `/api/v1/groups/${ids.groups}`, 409);
  await call('DELETE', `/api/v1/programs/${ids.programs}`, 409);
  await call('DELETE', `/api/v1/subjects/${ids.subjects}`, 409);
  await call('DELETE', `/api/v1/classrooms/${ids.classrooms}`, 409);
  await call('DELETE', `/api/v1/students/${ids.students}`, 409);
  await call('DELETE', `/api/v1/faculties/${ids.faculties}`, 409);
  await call('DELETE', `/api/v1/teachers/${ids.teachers}`, 409);
  await call('DELETE', `/api/v1/users/${ids.admin}`, 409);
  expect((await call('DELETE', `/api/v1/notifications/${ids.notifications}`, 200)).deleted).toBe(true);
  expect((await call('DELETE', `/api/v1/teachers/${ids.otherTeacher}`, 200)).deleted).toBe(true);
  expect((await call('DELETE', `/api/v1/users/${ids.other}`, 200)).deleted).toBe(true);
  const planned = await call('POST', '/api/v1/periods', 201, { code: 'REV-DELETE', startDate: '2027-01-01', endDate: '2027-12-31' });
  expect((await call('DELETE', `/api/v1/periods/${planned._id}`, 200)).deleted).toBe(true);
});

test('Swagger inventaría todos los métodos y rutas registrados', () => {
  const spec = new Set(Object.entries(f.swagger.paths).flatMap(([route, methods]) => Object.keys(methods).map(method => `${method.toUpperCase()} ${route.replace(/\{(\w+)\}/g, ':$1')}`)));
  expect(spec.size).toBe(rows.length);
  for (const row of rows) expect(spec.has(`${row.method} ${row.route}`)).toBe(true);
  fs.writeFileSync('postman/review-endpoints.json', JSON.stringify(rows, null, 2));
});
