require('reflect-metadata');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { EnrollmentsService } = require('../dist/enrollments/enrollments.service');
const { GroupsService } = require('../dist/groups/groups.service');
const { DeletionsService } = require('../dist/deletions/deletions.service');
const { PeriodsService } = require('../dist/periods/periods.service');
const { ReportsService } = require('../dist/reports/reports.service');
const { AcademicService } = require('../dist/academic/academic.service');
const { SubjectsService } = require('../dist/subjects/subjects.service');
const { ParseObjectIdPipe } = require('../dist/common/pipes/parse-object-id.pipe');
const id = 'abcdefabcdefabcdefabcdef';
const admin = { id, role: 'admin' };
const exec = value => ({ exec: async () => value });
const query = value => ({ select() { return this; }, sort() { return this; }, lean: async () => value, exec: async () => value });

test('REV-033: materia inactiva no admite nuevas matriculas ni reserva cupo', async () => {
  const service = new EnrollmentsService({}, {}, {}, {},
    { findRaw: async () => ({ active: true, period: id, subject: id }) },
    { findOne: async () => ({ active: false }) }, { findOne: async () => ({ status: 'abierto' }) });
  service.resolveStudent = async () => ({ active: true, id });
  service.assertNotDuplicated = jest.fn(async () => null);
  service.assertPrerequisites = async () => {};
  service.assertNoScheduleConflict = async () => {};
  service.assertCreditLimit = async () => {};
  service.reserveSeat = jest.fn(async () => ({ status: 'activa' }));
  service.notificationsService = { notify: async () => {} };
  await expect(service.enroll({ groupId: id }, admin)).rejects.toBeInstanceOf(BadRequestException);
  expect(service.assertNotDuplicated).not.toHaveBeenCalled();
  expect(service.reserveSeat).not.toHaveBeenCalled();
});

test('REV-034: reactivar grupo vuelve a verificar conflictos antes de guardar', async () => {
  const group = { active: false, enrolled: 0, teacher: id, period: id, schedule: [], set: jest.fn(), save: jest.fn() };
  const service = new GroupsService({ findById: () => exec(group) }, {}, {}, {}, { assertActive: async () => {} });
  service.assertTeacherActive = async () => ({});
  service.assertNoConflicts = jest.fn(async () => { throw new BadRequestException('Conflicto'); });
  service.findOne = async () => group;
  await expect(service.update(id, { active: true })).rejects.toThrow('Conflicto');
  expect(group.save).not.toHaveBeenCalled();
});

test('REV-035: borrar evaluacion no permite modificar plan de periodo cerrado', async () => {
  const evaluationModel = { findById: () => exec({ group: id }), deleteOne: jest.fn() };
  const args = Array(15).fill({});
  args[2] = evaluationModel;
  args[3] = { countDocuments: async () => 0 };
  args[13] = { assertCanManage: async () => ({ period: id }) };
  args[14] = { findOne: async () => ({ status: 'cerrado' }) };
  const service = new DeletionsService(...args);
  await expect(service.removeEvaluation(id, admin)).rejects.toBeInstanceOf(BadRequestException);
  expect(evaluationModel.deleteOne).not.toHaveBeenCalled();
});

test('REV-036: cierre cuenta matriculas activas aunque un join no encuentre referencias', async () => {
  const service = new PeriodsService({}, { aggregate: async () => [], countDocuments: () => exec(1) }, { collection: { name: 'groups' } });
  service.findOne = async () => ({ _id: id, id, code: 'Fixture', status: 'abierto' });
  expect(await service.closeCheck(id)).toMatchObject({ pendingEnrollments: 1, canClose: false });
});

function reports(periods) {
  const model = { aggregate: async () => [], countDocuments: async () => 0 };
  return new ReportsService(...Array(9).fill(model), periods);
}
test('REV-037: dashboard propaga errores de base de datos', async () => {
  await expect(reports({ findCurrent: async () => { throw new Error('Fixture database failure'); } }).dashboard()).rejects.toThrow('Fixture database failure');
});
test('REV-037: dashboard permite ausencia legitima de periodo abierto', async () => {
  expect(await reports({ findCurrent: async () => { throw new NotFoundException(); } }).dashboard()).toMatchObject({ currentPeriod: null });
});

test('REV-038: pipe canoniza ObjectId valido en mayusculas', () => {
  expect(new ParseObjectIdPipe().transform(id.toUpperCase())).toBe(id);
});
test('REV-038: prerrequisito propio en mayusculas no evade deteccion de ciclos', async () => {
  const service = new SubjectsService({ find: () => exec([]) });
  await expect(service.assertNoCycle(id, [id.toUpperCase()])).rejects.toBeInstanceOf(BadRequestException);
});
test('REV-038: salon en mayusculas no evade conflicto de horario', async () => {
  const service = new GroupsService({ find: () => exec([{ teacher: 'other', schedule: [{ day: 'lunes', startTime: '08:00', endTime: '10:00', classroom: id }] }]) }, {}, {}, {}, { codeOf: async () => 'Fixture' });
  await expect(service.assertNoConflicts(id, 'different', [{ day: 'lunes', startTime: '09:00', endTime: '11:00', classroom: id.toUpperCase() }])).rejects.toThrow('ocupado');
});

test.each([false, true])('REV-039: planilla cuenta solo notas de su plan (nota legitima: %s)', async hasOwn => {
  const service = new AcademicService({}, {}, { find: () => query([
    { enrollment: id, evaluation: 'foreign', value: 5 },
    ...(hasOwn ? [{ enrollment: id, evaluation: 'own', value: 3 }] : []),
  ]) }, { find: () => query([{ _id: 'own', weight: 100, name: 'Fixture' }]) }, {}, {}, {}, {}, {}, {}, {});
  service.groupsService = { assertCanManage: async () => ({}) };
  service.loadGroup = async () => ({});
  service.groupHeader = () => ({});
  service.groupEnrollments = async () => [{ _id: id, status: 'activa', student: {} }];
  const result = await service.gradeSheet(id, admin);
  expect(result.rows[0]).toMatchObject({ pendingEvaluations: hasOwn ? 0 : 1, readyToFinalize: hasOwn });
});

test.each(['history', 'progress', 'availableGroups'])('REV-040: %s maneja referencia de programa inexistente', async method => {
  const args = Array(11).fill({});
  args[8] = { findByUserId: async () => ({ toObject: () => ({ _id: id, program: null }) }) };
  args[10] = { findCurrent: async () => ({ id }) };
  const service = new AcademicService(...args);
  await expect(service[method](...(method === 'availableGroups' ? [id, false] : [null, id]))).rejects.toBeInstanceOf(NotFoundException);
});
