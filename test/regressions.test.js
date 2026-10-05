require('reflect-metadata');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');
const { GroupsService } = require('../dist/groups/groups.service');
const { UsersService } = require('../dist/users/users.service');
const { NotificationsService } = require('../dist/notifications/notifications.service');
const { JwtStrategy } = require('../dist/auth/strategies/jwt.strategy');
const { LoginDto } = require('../dist/auth/dto/login.dto');
const { UpdateUserDto, UsersQueryDto } = require('../dist/users/dto/user.dto');
const { NotificationsQueryDto } = require('../dist/notifications/dto/notification.dto');
const { UpsertGradeDto } = require('../dist/grades/dto/grade.dto');
const bcrypt = require('bcrypt');
const { PeriodsService } = require('../dist/periods/periods.service');
const { EvaluationsService } = require('../dist/evaluations/evaluations.service');
const { GradesService } = require('../dist/grades/grades.service');
const { HealthController } = require('../dist/health/health.controller');
const config = { getOrThrow: () => 'regression-fixture-signing-key' };
const oid = '0123456789abcdef01234567';

test('docente ajeno no puede gestionar un grupo', async () => {
  const service = new GroupsService({}, {}, { findByUserId: async () => ({ id: 'other' }) });
  service.findRaw = async () => ({ teacher: 'owner' });
  await expect(service.assertCanManage(oid, { id: oid, role: 'docente' })).rejects.toThrow();
});

test('estudiante no puede gestionar grupos aunque invoque el servicio directamente', async () => {
  const service = new GroupsService({}, {}, { findByUserId: async () => ({ id: 'owner' }) });
  service.findRaw = async () => ({ teacher: 'owner' });
  await expect(service.assertCanManage(oid, { id: oid, role: 'estudiante' })).rejects.toThrow();
});

test('contraseña nueva se guarda', async () => {
  const doc = { passwordHash: await bcrypt.hash('FixtureOld8', 4), save: jest.fn(async function () { return this; }) };
  const model = { findById: () => ({ select: () => ({ exec: async () => doc }) }) };
  const service = new UsersService(model);
  await service.changePassword(oid, 'FixtureOld8', 'FixtureNew9');
  expect(doc.save).toHaveBeenCalledTimes(1);
  expect(await bcrypt.compare('FixtureNew9', doc.passwordHash)).toBe(true);
});

test('marcar notificación cambia estado y persiste', async () => {
  const doc = { user: oid, read: false, save: jest.fn(async function () { return this; }) };
  const service = new NotificationsService({ findById: () => ({ exec: async () => doc }) });
  await service.markRead(oid, oid);
  expect(doc.read).toBe(true);
  expect(doc.readAt).toBeInstanceOf(Date);
  expect(doc.save).toHaveBeenCalledTimes(1);
});

test('login acepta contraseña de ocho caracteres admitida al crear cuenta', async () => {
  expect(await validate(plainToInstance(LoginDto, { email: 'fixture@example.invalid', password: 'Fixture8' }))).toHaveLength(0);
});

test.each([0, 3, 4.5, 5])('escala admite nota %s', async value => {
  expect(await validate(plainToInstance(UpsertGradeDto, { enrollment: oid, evaluation: oid, value }))).toHaveLength(0);
});
test.each([-0.1, 5.01, 3.001])('escala rechaza nota %s', async value => {
  expect((await validate(plainToInstance(UpsertGradeDto, { enrollment: oid, evaluation: oid, value }))).length).toBeGreaterThan(0);
});

test('actualización admite name y rechaza campo alterado', async () => {
  expect(await validate(plainToInstance(UpdateUserDto, { name: 'Fixture' }), { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  expect((await validate(plainToInstance(UpdateUserDto, { namesssss: 'Fixture' }), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
});

test.each([[UsersQueryDto, 'active'], [NotificationsQueryDto, 'read']])('booleanos de consulta rechazan texto inválido (%s)', async (Dto, field) => {
  expect((await validate(plainToInstance(Dto, { [field]: 'invalid' }))).length).toBeGreaterThan(0);
  expect(plainToInstance(Dto, { [field]: 'false' })[field]).toBe(false);
});

test('token previo al cambio de contraseña en el mismo segundo es rechazado', async () => {
  const changed = new Date(1750000000900);
  const strategy = new JwtStrategy(config, { findById: async () => ({ active: true, passwordChangedAt: changed }) });
  await expect(strategy.validate({ sub: oid, iat: 1750000000 })).rejects.toThrow();
});

test('token nuevo vinculado al cambio de contraseña es aceptado', async () => {
  const changed = new Date(1750000000900);
  const strategy = new JwtStrategy(config, { findById: async () => ({ active: true, passwordChangedAt: changed, email: 'fixture@example.invalid', role: 'admin' }) });
  await expect(strategy.validate({ sub: oid, iat: 1750000000, passwordChangedAt: changed.getTime() })).resolves.toMatchObject({ id: oid });
});

test('periodo abierto no puede volver a planificado', async () => {
  const service = new PeriodsService({});
  service.findOne = async () => ({ status: 'abierto', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), set() {}, save: async () => ({}) });
  await expect(service.update(oid, { status: 'planificado' })).rejects.toThrow();
});

test('evaluación de periodo cerrado no puede editarse', async () => {
  const service = new EvaluationsService({}, {}, { assertCanManage: async () => ({ period: oid }) }, { findOne: async () => ({ status: 'cerrado' }) });
  service.findOne = async () => ({ group: oid, set() {}, save: async () => ({}) });
  await expect(service.update(oid, { name: 'Changed' }, { role: 'admin' })).rejects.toThrow();
});

test('mis notas filtra evaluación además de pertenencia', async () => {
  const service = new GradesService({}, { find: () => ({ distinct: async () => [oid] }) }, {}, {}, { findByUserId: async () => ({ id: oid }) });
  service.list = jest.fn(async () => ({}));
  await service.findMine(oid, { evaluation: oid });
  expect(service.list.mock.calls[0][0]).toMatchObject({ evaluation: oid, enrollment: { $in: [oid] } });
});

test.each([{ readyState: 0 }, { readyState: 1 }])('health rechaza conexión incompleta %s', async connection => {
  await expect(new HealthController(connection).getHealth()).rejects.toThrow();
});
