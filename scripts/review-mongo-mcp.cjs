// Read-only audit using the actual MongoDB MCP server over stdio.
const fs = require('node:fs');
const path = require('node:path');
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installs = fs.readdirSync(cache).map(dir => path.join(cache, dir, 'node_modules'));
const root = installs.find(dir => {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'mongodb-mcp-server/package.json'))).version === '3.0.5'; }
  catch { return false; }
});
if (!root) throw new Error('MongoDB MCP server 3.0.5 not found in local npm cache');
const { Client } = require(path.join(root, '@modelcontextprotocol/sdk/dist/cjs/client/index.js'));
const { StdioClientTransport } = require(path.join(root, '@modelcontextprotocol/sdk/dist/cjs/client/stdio.js'));
const client = new Client({ name: 'proyecto1-readonly-audit', version: '1.0.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, 'mongodb-mcp-server/dist/esm/index.js'), '--readOnly'],
  env: { ...process.env, MDB_MCP_CONNECTION_STRING: 'mongodb://localhost:27017/universidad?replicaSet=rs0&directConnection=true', MDB_MCP_READ_ONLY: 'true', MDB_MCP_TELEMETRY: 'disabled' },
  stderr: 'pipe',
});
transport.stderr?.on('data', () => {});
async function main() {
  await client.connect(transport);
  const listing = await client.listTools();
  if (process.argv.includes('--discover')) {
    console.log(JSON.stringify(listing.tools.filter(t => ['count', 'list-connections', 'list-collections'].includes(t.name)), null, 2));
    return;
  }
  const base = { connectionId: 'preconfigured', database: 'universidad' };
  const output = { date: '2026-10-05', database: 'universidad', transport: 'MongoDB MCP 3.0.5 stdio --readOnly', checks: [], errors: [] };
  async function call(name, args, label) {
    const response = await client.callTool({ name, arguments: { ...base, ...args } });
    if (response.isError) {
      output.errors.push({ label, content: response.content });
      return null;
    }
    const result = response.structuredContent || response.content;
    output.checks.push({ label, result });
    console.log(label + ': OK');
    return result;
  }
  if (process.argv.includes('--details')) {
    const queries = {
      users: { filter: { $or: [{ name: '' }, { role: { $nin: ['admin', 'docente', 'estudiante'] } }] }, projection: { _id: 1, role: 1, nameType: { $type: '$name' }, emptyName: { $eq: ['$name', ''] } } },
      subjects: { filter: { $or: [{ credits: { $lt: 1 } }, { credits: { $gt: 10 } }] }, projection: { _id: 1, code: 1, credits: 1 } },
      grades: { filter: { $or: [{ value: { $lt: 0 } }, { value: { $gt: 5 } }, { value: { $not: { $type: 'number' } } }] }, projection: { _id: 1, value: 1 } },
      periods: { filter: { status: { $nin: ['planificado', 'abierto', 'cerrado'] } }, projection: { _id: 1, code: 1, status: 1 } },
      notifications: { filter: { $or: [{ type: { $nin: ['matricula_confirmada', 'matricula_cancelada', 'nota_final', 'grupo_asignado', 'aviso'] } }, { createdAt: { $exists: true, $not: { $type: 'date' } } }] }, projection: { _id: 1, type: 1, createdAt: 1 } },
      groups: { filter: {}, projection: { _id: 1, teacher: 1, period: 1, active: 1, schedule: 1 } },
    };
    for (const [collection, query] of Object.entries(queries)) await call('find', { collection, ...query, limit: 1000, responseBytesLimit: 300000 }, collection + '_details');
    const groups = output.checks.find(c => c.label === 'groups_details')?.result.documents;
    const baseline = JSON.parse(fs.readFileSync('review-mongo-mcp-results.json', 'utf8'));
    const expectedCount = baseline.checks.find(c => c.label === 'groups_integrity').result.documents[0].total[0]?.count || 0;
    if (!groups || groups.length !== expectedCount) throw new Error('Incomplete group schedule results; refusing to infer absence of conflicts');
    const id = value => value?.$oid || String(value);
    const overlaps = (a, b) => a.day === b.day && a.startTime < b.endTime && b.startTime < a.endTime;
    output.scheduleChecks = { groups: groups.length, invalid: [], conflicts: [] };
    for (const group of groups) {
      const slots = group.schedule || [];
      for (const slot of slots) {
        if (!['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].includes(slot.day) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime) || slot.endTime <= slot.startTime)
          output.scheduleChecks.invalid.push({ group: id(group._id), slot });
      }
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++)
        if (overlaps(slots[i], slots[j])) output.scheduleChecks.invalid.push({ group: id(group._id), overlappingSlots: [i, j] });
    }
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (!a.active || !b.active || id(a.period) !== id(b.period)) continue;
      for (const x of a.schedule || []) for (const y of b.schedule || [])
        if (overlaps(x, y) && (id(a.teacher) === id(b.teacher) || id(x.classroom) === id(y.classroom)))
          output.scheduleChecks.conflicts.push({ groups: [id(a._id), id(b._id)], teacher: id(a.teacher) === id(b.teacher), room: id(x.classroom) === id(y.classroom), day: x.day });
    }
    const { MongoClient } = require('mongodb');
    const mongo = new MongoClient('mongodb://localhost:27017/universidad?replicaSet=rs0&directConnection=true', { serverSelectionTimeoutMS: 10000 });
    try {
      await mongo.connect();
      const db = mongo.db('universidad');
      const metadata = await db.listCollections({}, { nameOnly: false }).toArray();
      output.metadataSupplement = [];
      for (const info of metadata) output.metadataSupplement.push({ name: info.name, validator: info.options?.validator || null, indexes: await db.collection(info.name).listIndexes().toArray() });
    } finally { await mongo.close(); }
    fs.writeFileSync('review-mongo-mcp-details.json', JSON.stringify(output, null, 2) + '\n');
    return;
  }
  await call('list-collections', {}, 'collections');
  const relations = {
    students: { user: 'users', program: 'programs' }, teachers: { user: 'users', faculty: 'faculties' },
    programs: { faculty: 'faculties' }, subjects: { program: 'programs', prerequisites: 'subjects' },
    groups: { subject: 'subjects', teacher: 'teachers', period: 'periods', 'schedule.classroom': 'classrooms' },
    enrollments: { student: 'students', group: 'groups', subject: 'subjects', period: 'periods' },
    evaluations: { group: 'groups' }, grades: { enrollment: 'enrollments', evaluation: 'evaluations' },
    notifications: { user: 'users' }, faculties: { dean: 'teachers' },
  };
  const entities = { users: 'User', students: 'Student', teachers: 'Teacher', faculties: 'Faculty', programs: 'Program', subjects: 'Subject', groups: 'Group', enrollments: 'Enrollment', evaluations: 'Evaluation', grades: 'Grade', notifications: 'Notification', classrooms: 'Classroom', periods: 'Period' };
  const count = [{ $count: 'count' }];
  for (const [collection, entity] of Object.entries(entities)) {
    const schema = require(path.resolve('dist', collection, 'schemas', entity.toLowerCase() + '.schema.js'))[entity + 'Schema'];
    const facets = { total: count };
    for (const [field, target] of Object.entries(relations[collection] || {})) {
      facets['reference_' + field.replaceAll('.', '_')] = [
        { $match: { [field]: { $exists: true, $ne: null } } },
        ...(field === 'prerequisites' || field === 'schedule.classroom' ? [{ $unwind: '$' + field.split('.')[0] }] : []),
        { $lookup: { from: target, localField: field, foreignField: '_id', as: 'resolved' } },
        { $match: { resolved: { $size: 0 } } },
        { $project: { _id: 1, reference: '$' + field } },
      ];
    }
    for (const [keys, options] of schema.indexes()) {
      if (!options.unique) continue;
      const fields = Object.keys(keys);
      facets['duplicate_' + fields.join('_')] = [
        { $group: { _id: Object.fromEntries(fields.map(f => [f, '$' + f])), count: { $sum: 1 }, documents: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
        ...(collection === 'users' ? [{ $project: { _id: 0, count: 1, documents: 1 } }] : []),
      ];
    }
    for (const [field, schemaType] of Object.entries(schema.paths)) {
      if (field === '__v') continue;
      const options = schemaType.options;
      const types = { String: ['string'], Number: ['double', 'int', 'long', 'decimal'], Boolean: ['bool'], Date: ['date'], ObjectId: ['objectId'], Array: ['array'] }[schemaType.instance];
      if (!types) continue;
      const checks = [{ $not: [{ $in: [{ $type: '$' + field }, types] }] }];
      if (schemaType.instance === 'String' && options.required) checks.push({ $eq: ['$' + field, ''] });
      if (options.min !== undefined) checks.push({ $lt: ['$' + field, options.min] });
      if (options.max !== undefined) checks.push({ $gt: ['$' + field, options.max] });
      if (schemaType.enumValues?.length) checks.push({ $not: [{ $in: ['$' + field, schemaType.enumValues] }] });
      facets['invalid_' + field] = [{ $match: {
        ...(options.required ? {} : { [field]: { $exists: true, $ne: null } }),
        $expr: { $or: checks },
      } }, { $project: { _id: 1 } }];
    }
    await call('aggregate', { collection, pipeline: [{ $facet: facets }], responseBytesLimit: 100000 }, collection + '_integrity');
  }
  const aggregate = (collection, label, pipeline) => call('aggregate', { collection, pipeline, responseBytesLimit: 100000 }, label);
  await aggregate('groups', 'seat_counters', [
    { $lookup: { from: 'enrollments', let: { group: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$group', '$$group'] }, { $ne: ['$status', 'cancelada'] }] } } }, { $count: 'n' }], as: 'actual' } },
    { $set: { actual: { $ifNull: [{ $arrayElemAt: ['$actual.n', 0] }, 0] } } },
    { $match: { $expr: { $ne: ['$enrolled', '$actual'] } } }, { $project: { _id: 1, enrolled: 1, actual: 1, capacity: 1 } },
  ]);
  await aggregate('grades', 'grade_group_mismatch', [
    { $lookup: { from: 'enrollments', localField: 'enrollment', foreignField: '_id', as: 'enrollmentDoc' } },
    { $lookup: { from: 'evaluations', localField: 'evaluation', foreignField: '_id', as: 'evaluationDoc' } },
    { $unwind: '$enrollmentDoc' }, { $unwind: '$evaluationDoc' },
    { $match: { $expr: { $ne: ['$enrollmentDoc.group', '$evaluationDoc.group'] } } },
    { $project: { _id: 1, enrollment: 1, evaluation: 1, enrollmentGroup: '$enrollmentDoc.group', evaluationGroup: '$evaluationDoc.group' } },
  ]);
  await aggregate('enrollments', 'copied_group_fields', [
    { $lookup: { from: 'groups', localField: 'group', foreignField: '_id', as: 'g' } }, { $unwind: '$g' },
    { $match: { $expr: { $or: [{ $ne: ['$subject', '$g.subject'] }, { $ne: ['$period', '$g.period'] }] } } },
    { $project: { _id: 1, group: 1, subject: 1, period: 1, expectedSubject: '$g.subject', expectedPeriod: '$g.period' } },
  ]);
  await aggregate('enrollments', 'final_status', [
    { $match: { $or: [{ status: 'aprobada', $or: [{ finalGrade: { $lt: 3 } }, { finalGrade: null }] }, { status: 'reprobada', $or: [{ finalGrade: { $gte: 3 } }, { finalGrade: null }] }] } },
    { $project: { _id: 1, status: 1, finalGrade: 1 } },
  ]);
  await aggregate('periods', 'period_dates', [{ $match: { $expr: { $gte: ['$startDate', '$endDate'] } } }, { $project: { _id: 1, startDate: 1, endDate: 1 } }]);
  await aggregate('periods', 'open_periods', [{ $match: { status: 'abierto' } }, { $project: { _id: 1, code: 1 } }]);
  await aggregate('evaluations', 'evaluation_weight_totals', [{ $group: { _id: '$group', weight: { $sum: '$weight' }, evaluations: { $sum: 1 } } }, { $match: { weight: { $ne: 100 } } }]);
  await call('collection-indexes', { collection: 'enrollments' }, 'enrollment_indexes');
  fs.writeFileSync('review-mongo-mcp-results.json', JSON.stringify(output, null, 2) + '\n');
  console.log('Saved review-mongo-mcp-results.json; tool errors: ' + output.errors.length);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => client.close());
