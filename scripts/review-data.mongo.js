// Run with mongosh against the already verified local deployment; read-only.
const reviewDb = db.getSiblingDB('universidad');
const relations = {
  students: { user: 'users', program: 'programs' }, teachers: { user: 'users', faculty: 'faculties' },
  programs: { faculty: 'faculties' }, subjects: { program: 'programs' }, groups: { subject: 'subjects', teacher: 'teachers', period: 'periods' },
  enrollments: { student: 'students', group: 'groups', subject: 'subjects', period: 'periods' },
  evaluations: { group: 'groups' }, grades: { enrollment: 'enrollments', evaluation: 'evaluations' },
  notifications: { user: 'users' }, faculties: { dean: 'teachers' },
};
const unique = {
  users: [['email']], programs: [['code']], subjects: [['code']], periods: [['code']],
  students: [['user'], ['code']], teachers: [['user'], ['code']], faculties: [['code']], classrooms: [['code']],
  groups: [['subject', 'period', 'number']], enrollments: [['student', 'group']],
  evaluations: [['group', 'name']], grades: [['enrollment', 'evaluation']],
};
const result = { database: 'universidad', runner: 'mongosh read-only', collections: [] };
for (const info of reviewDb.getCollectionInfos()) {
  const collection = reviewDb.getCollection(info.name);
  const count = collection.countDocuments({});
  const entry = { name: info.name, count, validator: info.options.validator || null, indexes: collection.getIndexes().map(i=>({name:i.name,key:i.key,unique:i.unique===true})), brokenReferences: {}, duplicateKeys: {} };
  // Bound analysis rather than perform unbounded joins on an unknown large database.
  if (count <= 10000) {
    for (const [field, target] of Object.entries(relations[info.name] || {})) {
      const rows = collection.aggregate([
        { $match: { [field]: { $exists: true, $ne: null } } },
        { $lookup: { from: target, localField: field, foreignField: '_id', as: 'resolved' } },
        { $match: { resolved: { $size: 0 } } }, { $count: 'total' },
      ]).toArray();
      entry.brokenReferences[field] = rows[0]?.total || 0;
    }
    for (const fields of unique[info.name] || []) {
      const rows = collection.aggregate([
        { $group: { _id: Object.fromEntries(fields.map(field=>[field,'$'+field])), n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } }, { $count: 'total' },
      ]).toArray();
      entry.duplicateKeys[fields.join('+')] = rows[0]?.total || 0;
    }
  } else entry.limit = 'Integrity checks omitted above 10000 documents';
  result.collections.push(entry);
}
print(JSON.stringify(result));
