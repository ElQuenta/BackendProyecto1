const fs = require('fs');
const { inventory } = require('./review-contract.cjs');
const file = 'postman/proyecto1-simple.postman_collection.json';
const variables = new Set(['baseUrl', 'token', 'email', 'password', 'currentPassword', 'newPassword', 'fixtureName', 'fixtureEmail', 'fixtureCode']);
const singular = { users: 'user', faculties: 'faculty', programs: 'program', subjects: 'subject', periods: 'period', students: 'student', teachers: 'teacher', classrooms: 'classroom', groups: 'group', enrollments: 'enrollment', evaluations: 'evaluation', grades: 'grade', notifications: 'notification' };
const v = name => { variables.add(name); return `{{${name}}}`; };
const bodies = {
  users: { name: v('fixtureName'), email: v('fixtureEmail'), password: v('password'), role: 'estudiante' },
  faculties: { code: v('fixtureCode'), name: v('fixtureName'), campus: 'Fixture' },
  programs: { code: v('fixtureCode'), name: v('fixtureName'), totalCredits: 20, faculty: v('facultyId') },
  subjects: { code: v('fixtureCode'), name: v('fixtureName'), credits: 3, program: v('programId'), semester: 1, prerequisites: [] },
  periods: { code: v('fixtureCode'), startDate: '2026-01-01', endDate: '2026-12-31' },
  students: { user: v('userId'), code: v('fixtureCode'), program: v('programId') },
  teachers: { user: v('userId'), code: v('fixtureCode'), faculty: v('facultyId') },
  classrooms: { code: v('fixtureCode'), building: 'R', floor: 1, capacity: 30 },
  groups: { subject: v('subjectId'), teacher: v('teacherId'), period: v('periodId'), capacity: 10, schedule: [{ day: 'lunes', startTime: '08:00', endTime: '10:00', classroom: v('classroomId') }] },
  enrollments: { groupId: v('groupId'), student: v('studentId') },
  evaluations: { group: v('groupId'), name: v('fixtureName'), weight: 100 },
  notifications: { user: v('userId'), title: 'Review Notice', message: 'Synthetic fixture' },
  grades: { enrollment: v('enrollmentId'), evaluation: v('evaluationId'), value: 3 },
};
function bodyFor(row) {
  const resource = row.route.split('/')[3];
  if (row.handler === 'login') return { email: v('email'), password: v('password') };
  if (row.handler === 'changePassword') return { currentPassword: v('currentPassword'), newPassword: v('newPassword') };
  if (row.handler === 'resetPassword') return { newPassword: v('newPassword') };
  if (row.handler === 'upsert') return bodies.grades;
  if (row.handler === 'bulk') return { items: [bodies.grades] };
  if (row.method === 'POST' && ['create', 'enroll'].includes(row.handler)) return bodies[resource];
  if (row.method === 'PATCH' && ['update', 'updateMe'].includes(row.handler)) {
    return resource === 'groups' || resource === 'classrooms' ? { capacity: 30 }
      : resource === 'periods' ? { code: v('fixtureCode') }
      : resource === 'students' || resource === 'teachers' ? { code: v('fixtureCode') }
      : { name: v('fixtureName') };
  }
}
function checks(row) {
  const resource = row.route.split('/')[3];
  if (row.method === 'DELETE') return ['pm.expect(b.deleted).to.eql(true); pm.expect(b.resource).to.be.a("string");', 'pm.expect(b.id).to.match(/^[a-f\\d]{24}$/i);'];
  if (['login', 'changePassword'].includes(row.handler)) return ['pm.expect(b.accessToken).to.be.a("string");', 'pm.expect(b.accessToken.split(".")).to.have.lengthOf(3);'];
  if (row.handler === 'getHealth') return ['pm.expect(b).to.include({status:"ok",database:"up"});', 'pm.expect(Number.isNaN(Date.parse(b.timestamp))).to.eql(false);'];
  if (row.handler === 'findAll' || row.handler === 'mine') return ['pm.expect(b.data).to.be.an("array"); pm.expect(b.meta).to.be.an("object");', 'pm.expect(b.meta.total).to.be.a("number"); pm.expect(b.meta.page).to.be.at.least(1);'];
  if (row.handler === 'me' && resource === 'auth') return ['pm.expect(b.id).to.be.a("string"); pm.expect(b.email).to.be.a("string");', 'pm.expect(b.role).to.be.oneOf(["admin","docente","estudiante"]);'];
  if (row.handler === 'bulk') return ['pm.expect(b.failed).to.be.an("array"); pm.expect(b.saved).to.be.a("number");', 'pm.expect(b.total).to.eql(b.saved+b.failed.length);'];
  if (row.handler === 'finalize') return ['pm.expect(b.finalGrade).to.be.within(0,5);', 'pm.expect(b.status).to.eql(b.finalGrade>=3?"aprobada":"reprobada");'];
  if (row.handler === 'finalizeGroup') return ['pm.expect(b.details.finalized).to.be.an("array"); pm.expect(b.details.skipped).to.be.an("array");', 'pm.expect(b.finalized).to.eql(b.passed+b.failed);'];
  if (row.handler === 'readAll') return ['pm.expect(b.updated).to.be.a("number");', 'pm.expect(b.updated).to.be.at.least(0);'];
  if (row.handler === 'read') return ['pm.expect(b.read).to.eql(true);', 'pm.expect(Number.isNaN(Date.parse(b.readAt))).to.eql(false);'];
  if (row.handler === 'resetPassword') return ['pm.expect(b.message).to.eql("Contrasena restablecida");', 'pm.expect(b).not.to.have.property("passwordHash");'];
  if (row.handler === 'close') return ['pm.expect(b.closed).to.eql(true); pm.expect(b.period.status).to.eql("cerrado");', 'pm.expect(b.cancelledPending).to.be.a("number");'];
  if (row.handler === 'closeCheck') return ['pm.expect(b.canClose).to.be.a("boolean"); pm.expect(b.groups).to.be.an("array");', 'pm.expect(b.pendingEnrollments).to.be.at.least(0);'];
  if (row.handler === 'roster') return ['pm.expect(b.students).to.be.an("array");', 'pm.expect(b.total).to.eql(b.students.length);'];
  if (row.handler === 'gradeSheet') return ['pm.expect(b.rows).to.be.an("array"); pm.expect(b.evaluations).to.be.an("array");', 'pm.expect(b.summary.students).to.eql(b.rows.length);'];
  if (/Schedule/.test(row.handler) || ['studentSchedule', 'teacherSchedule'].includes(row.handler)) return ['pm.expect(b.slots).to.be.an("array"); pm.expect(b.byDay).to.be.an("object");', 'pm.expect(b.period.id).to.be.a("string");'];
  if (['availableForMe'].includes(row.handler)) return ['pm.expect(b.groups).to.be.an("array");', 'pm.expect(b.total).to.eql(b.groups.length);'];
  if (['myHistory', 'studentHistory'].includes(row.handler)) return ['pm.expect(b.periods).to.be.an("array"); pm.expect(b.summary).to.be.an("object");', 'pm.expect(b.summary.creditsApproved).to.be.at.least(0);'];
  if (['myProgress', 'studentProgress'].includes(row.handler)) return ['pm.expect(b.subjects).to.be.an("array");', 'pm.expect(b.summary.subjects).to.eql(b.subjects.length);'];
  if (row.handler === 'curriculum') return ['pm.expect(b.semesters).to.be.an("array");', 'pm.expect(b.subjects).to.be.a("number");'];
  if (resource === 'reports') return row.handler === 'dashboard' ? ['pm.expect(b.users).to.be.an("object"); pm.expect(b.active).to.be.an("object");', 'pm.expect(b.faculties).to.be.a("number");'] : ['pm.expect(b.rows).to.be.an("array");', row.handler === 'facultySummary' ? 'b.rows.forEach(r=>pm.expect(r.faculty.id).to.be.a("string"));' : 'pm.expect(b.period.id).to.be.a("string");'];
  if (row.handler === 'create' && resource === 'users') return ['pm.expect(b.id).to.match(/^[a-f\\d]{24}$/i);', 'pm.expect(b).not.to.have.property("passwordHash"); pm.expect(b.role).to.be.a("string");'];
  return ['pm.expect(b._id).to.match(/^[a-f\\d]{24}$/i);', 'pm.expect(b).not.to.have.property("passwordHash");'];
}
function tests(row) {
  return { listen: 'test', script: { type: 'text/javascript', exec: [
    `pm.test("Status ${row.status}",()=>pm.response.to.have.status(${row.status}));`,
    `const b=pm.response.json();`,
    ...checks(row).map((check,i)=>`pm.test("${i===0?'Estructura':'Coherencia'} del contrato",()=>{${check}});`),
  ] } };
}
function build() {
  const snapshot = fs.existsSync('postman/review-current.sanitized.json') ? 'postman/review-current.sanitized.json' : 'postman/review-original.sanitized.json';
  const c = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  const rows = inventory();
  const existing = new Map();
  function walk(items) { for (const i of items) if(i.item) walk(i.item); else {
    const url=typeof i.request.url==='string'?i.request.url:i.request.url.raw;
    existing.set(i.request.method+' '+url.replace(/^\{\{baseUrl\}\}/,'').split('?')[0].replace(/^\/api\//,'/api/v1/'),i);
  } }
  walk(c.item);
  for (const row of rows) {
    const key=row.method+' '+row.route;
    let item=existing.get(key);
    if(!item){ let folder=c.item.find(i=>i.name===row.tag);if(!folder){folder={name:row.tag,item:[]};c.item.push(folder);}item={name:row.summary,request:{},response:[]};folder.item.push(item); }
    const resource=row.route.split('/')[3];
    let url='{{baseUrl}}'+row.route.replace(':enrollmentId',v('enrollmentId')).replace(':id',v((singular[resource]||resource)+'Id'));
    if(row.route==='/api/v1/grades')url+='?enrollment='+v('enrollmentId');
    item.request.method=row.method;
    item.request.url=url;
    item.request.description=`${row.summary}. Fuente: src/${row.source}. Roles: ${row.public?'público':row.roles.join(', ')||'sesión autenticada'}. Éxito esperado: ${row.status}. Las operaciones mutables requieren fixtures propios en un entorno de prueba.`;
    if(row.public)item.request.auth={type:'noauth'};
    else if(!item.request.auth)item.request.auth={type:'bearer',bearer:[{key:'token',value:v('token'),type:'string'}]};
    const body=bodyFor(row);
    if(body){item.request.header=(item.request.header||[]).filter(h=>h.key.toLowerCase()!=='content-type');item.request.header.push({key:'Content-Type',value:'application/json'});item.request.body={mode:'raw',raw:JSON.stringify(body,null,2),options:{raw:{language:'json'}}};}
    item.event=[...(item.event||[]),tests(row)];
  }
  const errors=[['Sin sesión','GET','/api/v1/users',401],['ID inválido','GET','/api/v1/users/invalid',400],['Inexistente','GET','/api/v1/users/000000000000000000000000',404],['Booleano inválido','GET','/api/v1/notifications/mine?read=invalid',400],['Paginación inválida','GET','/api/v1/subjects?page=0',400],['Login incompleto','POST','/api/v1/auth/login',400]];
  c.item.push({name:'Escenarios negativos',item:errors.map(([name,method,route,status])=>({name,request:{method,url:'{{baseUrl}}'+route,auth:name==='Sin sesión'||name==='Login incompleto'?{type:'noauth'}:{type:'bearer',bearer:[{key:'token',value:v('token'),type:'string'}]},...(method==='POST'?{header:[{key:'Content-Type',value:'application/json'}],body:{mode:'raw',raw:'{}'}}:{})},event:[{listen:'test',script:{type:'text/javascript',exec:[`pm.test("Status ${status}",()=>pm.response.to.have.status(${status}));`,'const b=pm.response.json();',`pm.test("Error del contrato",()=>pm.expect(b.statusCode).to.eql(${status}));`,'pm.test("Mensaje y ruta",()=>{pm.expect(b.message).to.exist;pm.expect(b.path).to.be.a("string");});']}}]}))});
  c.auth=c.auth||{type:'bearer',bearer:[{key:'token',value:v('token'),type:'string'}]};
  c.variable=Array.from(variables).map(key=>({key,value:key==='baseUrl'?'http://localhost:3000':key==='fixtureName'?'Review Fixture':key==='fixtureCode'?'REV-FIXTURE':key==='fixtureEmail'?'review-fixture@example.invalid':'',type:'string'}));
  c.info.description=`API proyecto1-api. ${rows.length} endpoints registrados y 6 escenarios negativos. Prefijo /api/v1; Swagger /api/doc. Configure baseUrl, token e IDs de fixtures. Contraseñas y tokens permanecen vacíos; use un entorno local privado. No ejecute CRUD en bloque sobre universidad.`;
  fs.writeFileSync(file,JSON.stringify(c,null,2)+'\n');
  fs.writeFileSync('postman/review-endpoints.json',JSON.stringify(rows,null,2)+'\n');
  console.log(JSON.stringify({endpoints:rows.length,existing:existing.size,added:rows.length-existing.size,negative:6}));
  return {collection:c,rows};
}
if(require.main===module)build();
module.exports={build,checks,tests};
