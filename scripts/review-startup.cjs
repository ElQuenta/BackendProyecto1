const net = require('net');
const { spawn } = require('child_process');
const { once } = require('events');
const fs = require('fs');
const { openFixture } = require('../test/support/api-fixture.cjs');
async function main() {
  const f = await openFixture();
  let child;
  try {
    const probe = net.createServer();
    await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});
    const port=probe.address().port;
    await new Promise(resolve=>probe.close(resolve));
    child=spawn(process.execPath,['dist/main.js'],{env:{...process.env,PORT:String(port)},stdio:'ignore',windowsHide:true});
    const stopped=once(child,'exit');
    let health;
    for(let i=0;i<100;i++){
      if(child.exitCode!==null)throw new Error('El arranque real terminó antes de estar disponible');
      try{const r=await fetch(`http://127.0.0.1:${port}/api/v1/health`);if(r.status===200){health=await r.json();break;}}catch{}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!health)throw new Error('El arranque real no respondió dentro del límite');
    const r=await fetch(`http://127.0.0.1:${port}/api/doc-json`);
    const swagger=await r.json();
    const endpoints=Object.values(swagger.paths).reduce((n,methods)=>n+Object.keys(methods).length,0);
    if(r.status!==200||endpoints!==100)throw new Error('Swagger del arranque real no coincide con el inventario');
    const result={runner:'node dist/main.js, proceso propio aislado',configuredPortRespected:true,healthStatus:health.status,database:health.database,swaggerStatus:r.status,endpoints};
    fs.writeFileSync('postman/review-startup-results.json',JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
    child.kill();await stopped;child=undefined;
  }finally{if(child&&child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}await f.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
