const fs = require('fs');
const { Types } = require('mongoose');
const { openFixture } = require('./support/api-fixture.cjs');
let f, token, studentToken, ids = {}, results = [];
async function call(method, route, expected, body, auth = token) {
  const response = await fetch(f.baseUrl + route, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  results.push({ method, route: route.replace(/[a-f\d]{24}/gi, ':fixtureId'), expected, actual: response.status, passed: response.status === expected });
  expect({ status: response.status, message: data.message }).toMatchObject({ status: expected });
  return data;
}
beforeAll(async () => {
  f = await openFixture();
  await Promise.all(f.connection.modelNames().map(n => f.connection.model(n).init()));
  token = (await call('POST', '/api/v1/auth/login', 200, { email: 'review-admin@example.invalid', password: f.password })).accessToken;
  ids.admin = (await call('GET', '/api/v1/auth/me', 200)).id;
  const faculty = await call('POST', '/api/v1/faculties', 201, { code: 'SCAN-F', name: 'Fixture', campus: 'Fixture' });
  ids.program = (await call('POST', '/api/v1/programs', 201, { code: 'SCAN-P', name: 'Fixture', totalCredits: 20, faculty: faculty._id }))._id;
  for (const role of ['docente', 'estudiante']) {
    const user = await call('POST', '/api/v1/users', 201, { name: 'Fixture', email: `scan-${role}@example.invalid`, password: f.password, role });
    ids[role] = user.id;
  }
  ids.teacher = (await call('POST', '/api/v1/teachers', 201, { user: ids.docente, code: 'SCAN-T', faculty: faculty._id }))._id;
  ids.student = (await call('POST', '/api/v1/students', 201, { user: ids.estudiante, code: 'SCAN-ST', program: ids.program }))._id;
  ids.subject = (await call('POST', '/api/v1/subjects', 201, { code: 'SCAN-S', name: 'Fixture', credits: 3, program: ids.program }))._id;
  ids.period = (await call('POST', '/api/v1/periods', 201, { code: 'SCAN-PER', startDate: '2026-01-01', endDate: '2026-12-31' }))._id;
  await call('PATCH', `/api/v1/periods/${ids.period}`, 200, { status: 'abierto' });
  ids.room = (await call('POST', '/api/v1/classrooms', 201, { code: 'SCAN-R', building: 'R', floor: 1, capacity: 30 }))._id;
  ids.group = (await call('POST', '/api/v1/groups', 201, groupBody()))._id;
}, 90000);
function groupBody(day = 'lunes') {
  return { subject: ids.subject, teacher: ids.teacher, period: ids.period, capacity: 10, schedule: [{ day, startTime: '08:00', endTime: '09:00', classroom: ids.room }] };
}
afterAll(async () => {
  try { fs.writeFileSync('postman/review-backend-http-results.json', JSON.stringify({ runner: 'Jest + HTTP fetch, isolated MongoDB fixtures', results }, null, 2)); }
  finally { if (f) await f.close(); }
});

test('REV-033: matricula rechazada por materia inactiva conserva cupos', async () => {
  await call('PATCH', `/api/v1/subjects/${ids.subject}`, 200, { active: false });
  await call('POST', '/api/v1/enrollments', 400, { groupId: ids.group, student: ids.student });
  expect((await call('GET', `/api/v1/groups/${ids.group}`, 200)).enrolled).toBe(0);
  await call('PATCH', `/api/v1/subjects/${ids.subject}`, 200, { active: true });
});
test('REV-034: reactivacion rechaza horario ocupado y admite horario liberado', async () => {
  await call('PATCH', `/api/v1/groups/${ids.group}`, 200, { active: false });
  const blocker = await call('POST', '/api/v1/groups', 201, groupBody());
  await call('PATCH', `/api/v1/groups/${ids.group}`, 409, { active: true });
  expect((await call('GET', `/api/v1/groups/${ids.group}`, 200)).active).toBe(false);
  await call('DELETE', `/api/v1/groups/${blocker._id}`, 200);
  await call('PATCH', `/api/v1/groups/${ids.group}`, 200, { active: true });
});
test('REV-038: ObjectIds en mayusculas preservan autoproteccion, ciclos y cruces', async () => {
  await call('PATCH', `/api/v1/users/${ids.admin.toUpperCase()}`, 400, { active: false });
  await call('PATCH', `/api/v1/users/${ids.admin.toUpperCase()}`, 400, { role: 'estudiante' });
  await call('DELETE', `/api/v1/users/${ids.admin.toUpperCase()}`, 409);
  await call('PATCH', `/api/v1/subjects/${ids.subject}`, 400, { prerequisites: [ids.subject.toUpperCase()] });
  await call('POST', '/api/v1/groups', 409, { ...groupBody(), teacher: ids.teacher.toUpperCase() });
});
test('REV-039: nota de otro grupo no completa ni resta pendientes del plan', async () => {
  ids.enrollment = (await call('POST', '/api/v1/enrollments', 201, { groupId: ids.group, student: ids.student }))._id;
  ids.evaluation = (await call('POST', '/api/v1/evaluations', 201, { group: ids.group, name: 'Fixture Final', weight: 100 }))._id;
  const foreignGroup = await call('POST', '/api/v1/groups', 201, groupBody('martes'));
  const foreignEvaluation = await call('POST', '/api/v1/evaluations', 201, { group: foreignGroup._id, name: 'Fixture Foreign', weight: 100 });
  // An intentionally inconsistent document belongs exclusively to this random test database.
  await f.connection.model('Grade').create({ enrollment: ids.enrollment, evaluation: foreignEvaluation._id, value: 5 });
  let sheet = await call('GET', `/api/v1/groups/${ids.group}/grade-sheet`, 200);
  expect(sheet.rows[0]).toMatchObject({ pendingEvaluations: 1, readyToFinalize: false });
  await call('PUT', '/api/v1/grades', 200, { enrollment: ids.enrollment, evaluation: ids.evaluation, value: 3 });
  sheet = await call('GET', `/api/v1/groups/${ids.group}/grade-sheet`, 200);
  expect(sheet.rows[0]).toMatchObject({ pendingEvaluations: 0, readyToFinalize: true });
});
test('REV-040: consultas academicas responden 404 con programa inexistente', async () => {
  studentToken = (await call('POST', '/api/v1/auth/login', 200, { email: 'scan-estudiante@example.invalid', password: f.password })).accessToken;
  await f.connection.model('Student').updateOne({ _id: ids.student }, { $set: { program: new Types.ObjectId() } });
  await call('GET', `/api/v1/students/${ids.student}/history`, 404);
  await call('GET', `/api/v1/students/${ids.student}/progress`, 404);
  await call('GET', '/api/v1/students/me/available-groups', 404, undefined, studentToken);
  await f.connection.model('Student').updateOne({ _id: ids.student }, { $set: { program: ids.program } });
});
test('REV-036/035: pendientes sin referencias bloquean cierre y plan cerrado rechaza DELETE', async () => {
  await call('POST', `/api/v1/enrollments/${ids.enrollment}/cancel`, 201);
  const orphan = await f.connection.model('Enrollment').create({ student: ids.student, group: new Types.ObjectId(), subject: ids.subject, period: ids.period, status: 'activa' });
  const check = await call('GET', `/api/v1/periods/${ids.period}/close-check`, 200);
  expect(check).toMatchObject({ pendingEnrollments: 1, canClose: false });
  await call('POST', `/api/v1/periods/${ids.period}/close`, 409);
  await call('POST', `/api/v1/periods/${ids.period}/close?cancelPending=true`, 200);
  expect((await f.connection.model('Enrollment').findById(orphan._id)).status).toBe('cancelada');
  const evaluation = await f.connection.model('Evaluation').findOne({ name: 'Fixture Foreign' });
  await f.connection.model('Grade').deleteMany({ evaluation: evaluation._id });
  await call('DELETE', `/api/v1/evaluations/${evaluation._id}`, 400);
  expect(await f.connection.model('Evaluation').exists({ _id: evaluation._id })).toBeTruthy();
});
