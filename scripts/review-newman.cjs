const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');
const { openFixture } = require('../test/support/api-fixture.cjs');
const { inventory } = require('./review-contract.cjs');
function loadNewman() {
  try { return require('newman'); } catch {}
  const cache = process.env.npm_config_cache || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'npm-cache') : path.join(os.homedir(), '.npm'));
  const root = path.join(cache, '_npx');
  if (fs.existsSync(root)) for (const dir of fs.readdirSync(root)) {
    const location = path.join(root, dir, 'node_modules', 'newman');
    if (fs.existsSync(path.join(location, 'package.json'))) return require(location);
  }
  throw new Error('Newman no instalado. Ejecuta npm exec --yes --package=newman -- newman --version y repite.');
}
async function main() {
  const newman = loadNewman();
  const f = await openFixture();
  try {
    const connection = f.connection;
    await Promise.all(connection.modelNames().map(n=>connection.model(n).init()));
    const model = name => connection.model(name);
    const hash = await bcrypt.hash(f.password, 4);
    const admin = await model('User').findOne({role:'admin'});
    const teacherUser = await model('User').create({name:'Review Teacher',email:'teacher-fixture@example.invalid',passwordHash:hash,role:'docente'});
    const studentUser = await model('User').create({name:'Review Student',email:'student-fixture@example.invalid',passwordHash:hash,role:'estudiante'});
    const faculty = await model('Faculty').create({code:'REV-F',name:'Review Faculty',campus:'Fixture'});
    const program = await model('Program').create({code:'REV-P',name:'Review Program',totalCredits:20,faculty:faculty._id});
    const subject = await model('Subject').create({code:'REV-S',name:'Review Subject',credits:3,semester:1,program:program._id});
    const period = await model('Period').create({code:'REV-PER',startDate:new Date('2026-01-01'),endDate:new Date('2026-12-31'),status:'abierto'});
    const student = await model('Student').create({code:'REV-ST',user:studentUser._id,program:program._id});
    const teacher = await model('Teacher').create({code:'REV-TE',user:teacherUser._id,faculty:faculty._id});
    const classroom = await model('Classroom').create({code:'REV-R',building:'R',floor:1,capacity:30});
    const group = await model('Group').create({subject:subject._id,period:period._id,teacher:teacher._id,number:1,capacity:10,enrolled:1,schedule:[{day:'lunes',startTime:'08:00',endTime:'10:00',classroom:classroom._id}]});
    const enrollment = await model('Enrollment').create({student:student._id,subject:subject._id,period:period._id,group:group._id});
    const evaluation = await model('Evaluation').create({group:group._id,name:'Review Final',weight:100});
    const grade = await model('Grade').create({enrollment:enrollment._id,evaluation:evaluation._id,value:3});
    const auth = f.app.get(require('../dist/auth/auth.service').AuthService);
    const tokens = {};
    for(const [role,user] of Object.entries({admin,docente:teacherUser,estudiante:studentUser}))tokens[role]=(await auth.login({email:user.email,password:f.password})).accessToken;
    const vars = {baseUrl:f.baseUrl,token:tokens.admin,email:admin.email,password:f.password,userId:admin.id,facultyId:faculty.id,programId:program.id,subjectId:subject.id,periodId:period.id,studentId:student.id,teacherId:teacher.id,classroomId:classroom.id,groupId:group.id,enrollmentId:enrollment.id,evaluationId:evaluation.id,gradeId:grade.id};
    const rows = inventory();
    const collection=JSON.parse(fs.readFileSync('postman/proyecto1-simple.postman_collection.json','utf8'));
    const items=[];
    function walk(list,negative=false){for(const item of list){if(item.item)walk(item.item,item.name==='Escenarios negativos');else if(item.request.method==='GET'||negative){
      const route=(typeof item.request.url==='string'?item.request.url:item.request.url.raw).replace('{{baseUrl}}','').split('?')[0].replace(/\{\{\w+Id\}\}/g,':id');
      const row=rows.find(r=>r.method==='GET'&&r.route===route);
      const role=row?.roles.length===1&&row.roles[0]!=='admin'?row.roles[0]:'admin';
      if(item.request.auth?.type!=='noauth') item.request.auth={type:'bearer',bearer:[{key:'token',value:tokens[role],type:'string'}]};
      items.push(item);
    }}}
    walk(collection.item);
    collection.item=items;
    // Ephemeral values stay in memory, never in the exported collection/report.
    const summary=await new Promise((resolve,reject)=>newman.run({collection,environment:{values:Object.entries(vars).map(([key,value])=>({key,value,enabled:true}))},reporters:[],timeoutRequest:15000},(error,summary)=>error?reject(error):resolve(summary)));
    const result={runner:'Newman '+require(findNewmanPackage()).version,requests:summary.run.stats.requests,assertions:summary.run.stats.assertions,failures:summary.run.failures.map(x=>({name:x.error.name,test:x.error.test||x.error.message,request:x.source?.name})),cases:summary.run.executions.map(e=>({name:e.item.name,method:e.request.method,route:e.request.url.getPath().replace(/[a-f\d]{24}/g,':fixtureId'),status:e.response?.code,assertions:e.assertions.map(a=>({name:a.assertion,passed:!a.error}))}))};
    fs.writeFileSync('postman/review-newman-results.json',JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({requests:result.requests,assertions:result.assertions,failures:result.failures}));
    if(result.failures.length)process.exitCode=1;
  }finally{await f.close();}
}
// Resolve version without exposing request data or credentials.
function findNewmanPackage(){const cache=process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'npm-cache','_npx'):path.join(os.homedir(),'.npm','_npx');for(const dir of fs.readdirSync(cache)){const p=path.join(cache,dir,'node_modules','newman','package.json');if(fs.existsSync(p))return p;}return 'newman/package.json';}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
