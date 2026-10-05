const fs = require('fs');
const { execFileSync } = require('child_process');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const reportFile = 'Review.md';
const previous = fs.readFileSync(reportFile, 'utf8');
const rows = read('postman/review-endpoints.json');
const http = read('postman/review-http-results.json');
const newman = read('postman/review-newman-results.json');
const startup = read('postman/review-startup-results.json');
const database = read('postman/review-database-results.json');
const collection = read('postman/proyecto1-simple.postman_collection.json');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const normalize = route => route.split('?')[0].replace(/:\w+/g, ':id').replace(/\{\{\w+Id\}\}/g, ':id').replace(/\/$/, '');
const requests = [];
function walk(items) { for(const i of items)if(i.item)walk(i.item);else requests.push(i); }
walk(collection.item);
const fixes = {
  'REV-001':['Puerto obtenido desde ConfigService.PORT validado.','Arranque real en puerto dinámico + health 200.'],
  'REV-002':['RolesGuard registrado globalmente después de JwtAuthGuard.','HTTP 403 para estudiante/docente sin rol; 98 rutas protegidas rechazan sesión ausente.'],
  'REV-003':['Docente se verifica contra teacher del grupo; otros roles se rechazan.','Regresiones + notas/evaluaciones/planilla ajenas devuelven 403.'],
  'REV-004':['expiresIn recibe segundos numéricos.','JWT real: exp - iat = 3600, verificado al login HTTP.'],
  'REV-005':['changePassword persiste con save.','Login con nueva contraseña 200; antigua 401; regresión de persistencia.'],
  'REV-006':['JWT vinculado a passwordChangedAt en milisegundos.','Token previo del mismo segundo rechazado; nuevo aceptado; reset revoca sesión.'],
  'REV-007':['Login admite mínimo 8, igual que creación.','Regresión de contraseña válida de 8 caracteres.'],
  'REV-008':['Creación de usuarios devuelve 201; GET me precede GET :id.','HTTP creación 201, perfil propio 200.'],
  'REV-009':['GET groups/mine precede ruta dinámica.','HTTP docente 200.'],
  'REV-010':['Prefijo evaluations y creación 201.','GET/POST/PATCH/DELETE con fixtures; contradicción resuelta con ruta DELETE y colección existentes.'],
  'REV-011':['Se rechaza solo estado distinto de activa.','Matrícula nueva/reactivada devuelve 201 y persiste.'],
  'REV-012':['Cancelación condicionada a activa y decremento de cupo en la misma transacción.','Cancela y libera cupo una vez; segundo intento 400; rematrícula reutiliza ID.'],
  'REV-013':['mine requiere estudiante.','Mis matrículas 200 para estudiante; docente rechazado.'],
  'REV-014':['Máximo del DTO 5.0 y aprobación >= 3.0.','Notas 5.0 admitidas, 5.01 rechazadas; final 3.0 aprobada.'],
  'REV-015':['markRead guarda read=true y fecha.','Lectura 200 con read=true; dueño ajeno 403.'],
  'REV-016':['UpdateUserDto usa name.','PATCH name 200 y regresión de whitelist.'],
  'REV-017':['Transform compartido conserva texto inválido para rechazarlo.','active/read inválidos 400; false preservado.'],
  'REV-018':['Jest configurado; pretest compila; colección ampliada y sincronizada.','186 tests aprobados; 100 endpoints con éxito HTTP; 60 solicitudes/180 assertions Newman.'],
  'REV-019':['Inventario /api/v1 y /api/doc; crea carpeta docs; README actualizado.','docs:endpoints genera 100 rutas; coincide con Swagger.'],
  'REV-024':['ReportsService restaurado en import/providers.','Nest inicia; 8 reportes HTTP 200; arranque real probado.'],
  'REV-025':['Se rechaza abierto → planificado.','Regresión y HTTP 400; cierre normal/forzado 200.'],
  'REV-026':['Edición comprueba periodo cerrado.','Regresión + edición de evaluación cerrada 400.'],
  'REV-027':['findMine incluye filtro evaluation además del alcance propio.','Regresión verifica ambos filtros.'],
  'REV-028':['Health requiere readyState conectado y db antes de ping.','Dos regresiones de conexión incompleta; health real 200 con ping.'],
};
const extra = [
  ['REV-029','Medium','Database','universidad.enrollments','Una clave student+group duplicada (grupo de duplicados), medida con agregación de lectura. La unicidad de matrícula no está garantizada.','Resolver duplicado con respaldo antes de crear índice único.'],
  ['REV-030','Medium','Database','universidad.programs','Un code duplicado (grupo de duplicados), medido con lectura. Los programas no cumplen la unicidad declarada.','Determinar programa canónico y consumidores antes de sanear.'],
  ['REV-031','Medium','Database','universidad.faculties','Un dean referencia un docente inexistente. El populate no puede resolver al decano.','Asignar referencia correcta solo con criterio de negocio y respaldo.'],
  ['REV-032','Medium','Database','universidad.students','Un program referencia un programa inexistente. Historial/progreso pueden fallar por relaciones nulas.','Determinar programa correcto; saneamiento autorizado, sin inferir destino.'],
];
const parsed = new Map();
for(const line of previous.split(/\r?\n/)){
  if(!/^\| REV-\d+ \|/.test(line))continue;
  const fields=line.split('|').slice(1,-1).map(s=>s.trim());
  if(!parsed.has(fields[0]))parsed.set(fields[0],fields);
}
for(const x of extra)parsed.set(x[0],[x[0],x[1],x[2],x[3],x[4],x[5]]);
const pendingActions = {
  'REV-020':'Recalcular contadores desde matrículas verificadas, con respaldo y autorización de saneamiento.',
  'REV-021':'La lectura confirmó que ambas referencias existen, pero 1 nota cruza grupos distintos. Determinar evaluación/matrícula correctas antes de corregir.',
  'REV-022':'Respaldar la base y planificar montaje persistente sin recrear contenedor con pérdida de datos.',
  'REV-023':'Resolver duplicados REV-029/030 antes de crear índices declarados; decidir validación del servidor separadamente.',
  ...Object.fromEntries(extra.map(x=>[x[0],x[5]])),
};
const initial = previous.slice(0,previous.indexOf('## Problemas encontrados'))
  .replace('TypeScript 5.7, Mongoose 8','TypeScript declarado ^5.7 (instalado 5.9.3), Mongoose 8')
  .replace('se verificará con lectura del driver local','se verificó con mongosh de solo lectura en el contenedor local');
const out=[initial.trimEnd(),'','## Resultado y límites','',
  `24 hallazgos corregidos y verificados; 8 pendientes de datos/infraestructura. Build aprobado, 186 tests (22 unitarios y 164 casos de API), ${http.results.length} solicitudes HTTP aprobadas, ${newman.requests.total} solicitudes Newman y ${newman.assertions.total} assertions aprobadas. Las 100 rutas tienen al menos un caso de éxito HTTP; la ejecución de scripts Postman cubre 54 lecturas y seis negativos, no las 46 operaciones mutables.`,
  '',`Commit presente al cierre: \`${commit}\`. Se observó un commit externo durante la revisión; se preservó. Esta revisión no creó commits ni hizo push.`,
  '', 'Los tests arrancan Nest con credenciales sintéticas en memoria y databases proyecto1_review_ aleatorias; usan MongoDB real con replica set. Se limpian todos los documentos exclusivamente de la base generada. Permanecen metadatos de bases vacías (no se ejecutó drop). Se detuvieron los procesos propios. universidad no recibió escrituras, índices nuevos ni migraciones.',
  '', 'Los modelos Mongoose y queries fueron revisados por módulo. La arquitectura observada es por capas abiertas: transporte delega servicios; servicios aplican negocio y acceden al ODM. Inyección directa de modelos para consultas cruzadas evita ciclos entre servicios. No se encontraron motivos para imponer repositorios ni refactor general. ReportsService ausente era un defecto comprobado de composición. El frontend referenciado en README no está disponible en la ruta vecina; no se acredita compatibilidad del frontend.',
  '', '## Problemas encontrados','',
  '| ID | Severidad | Categoría | Ubicación aproximada | Descripción / evidencia / regla / impacto | Solución aplicada | Estado / verificación |',
  '|---|---|---|---|---|---|---|'];
for(const [id,fields] of [...parsed].sort(([a],[b])=>a.localeCompare(b))){
  const fix=fixes[id];const desc=id==='REV-021'?'Una nota une evaluación y matrícula de grupos diferentes; ambas referencias existen. Contradice la validación de upsert y puede atribuir notas a otro grupo.':fields[4];
  out.push(`| ${fields.slice(0,4).join(' | ')} | ${desc} | ${fix?fix[0]:'No aplicada: '+pendingActions[id]} | ${fix?'Corregido verificado: '+fix[1]:'Pendiente; datos históricos o infraestructura fuera de corrección automática.'} |`);
}
out.push('','## Problemas corregidos','','| IDs | Cambio / comprobación |','|---|---|');
for(const [id,[change,verification]] of Object.entries(fixes))out.push(`| ${id} | ${change} ${verification} |`);
out.push('','## Problemas que no pudieron corregirse automáticamente','','| ID | Motivo / riesgo / evidencia faltante / acción mínima |','|---|---|');
for(const [id,action] of Object.entries(pendingActions))out.push(`| ${id} | ${action} Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |`);
out.push('','ESLint queda bloqueado: falta eslint.config.js/mjs/cjs. Se ejecutó eslint src --no-fix, exit 1, sin modificar archivos. No se añadió configuración arbitraria ni dependencias. Cobertura porcentual no medida; no se inventa un porcentaje. Las muestras MCP no demuestran validez universal de los datos. No se ejecutaron seeds, importación, exportación masiva ni pruebas contra servicios de correo/cobro/colas (no detectados en el código).',
  '', '## MongoDB: evidencia de lectura','', 'Destino verificado contra configuración del proyecto: localhost:27017/universidad, rs0. Se inspeccionaron 13 colecciones mediante MCP (5 muestras estructurales por colección) y metadatos/relaciones/unicidad con mongosh. Los campos de referencia observados son ObjectId y las fechas BSON Date; detalle agregado sin documentos personales en postman/review-database-results.json. Todas las colecciones existentes solo tienen índice _id y ningún validador de servidor. La ausencia de validadores se distingue de validación Mongoose, que sí aplica en el código.',
  '', '| Colección | Documentos | Referencias inexistentes (campo: cantidad) | Claves duplicadas (grupos) |','|---|---:|---|---|');
for(const c of database.collections)out.push(`| ${c.name} | ${c.count} | ${Object.entries(c.brokenReferences).filter(([,n])=>n).map(([k,n])=>k+': '+n).join(', ')||'0 en campos revisados'} | ${Object.entries(c.duplicateKeys).filter(([,n])=>n).map(([k,n])=>k+': '+n).join(', ')||'0 en claves revisadas'} |`);
out.push('','MCP también midió 2 contadores de cupos inconsistentes, 1 relación de nota entre grupos diferentes, ningún prerrequisito inexistente y ningún estado final contradictorio con el umbral 3.0 en la consulta ejecutada. No se saneó ninguno.',
  '', '## Postman: sincronización y ejecución','',
  `Colección vigente: [Proyecto1 - Simple](https://www.postman.com/collections/${collection.info._postman_id}), UID \`${collection.info.uid}\`, workspace \`1869ba32-59c1-44b6-8067-61a1051bf7f4\`. La colección original dedaf5f5 fue sustituida externamente durante la revisión; se redescubrió la nueva e50c8a3c por nombre y rutas. Respaldos sanitizados: review-original.sanitized.json y review-current.sanitized.json.`,
  '', 'Las 27 solicitudes existentes se actualizaron con herramientas parciales, conservando sus IDs. Se añadieron 73 endpoints y seis negativos. La herramienta disponible no expone creación de carpetas: se actualizó la estructura conservando IDs; la actualización global no conservó events/auth bearer, por lo que se completaron con 106 actualizaciones por solicitud. Tras un timeout se leyó el estado antes de reintentar. La lectura final confirma 106 solicitudes, 106 scripts de tests, IDs existentes conservados y valores secretos vacíos. El archivo local es la exportación final verificada.',
  '', 'Autenticación mediante {{token}}; contraseñas y correos de login mediante variables vacías; URLs/IDs parametrizados. Roles requeridos y status de éxito en la descripción. Los tests son status exacto, estructura y coherencia del contrato, tres por request. Los tests existentes útiles se conservaron. No se publicaron ni tunelizaron servicios. Newman se ejecutó localmente para alcanzar localhost; el servidor MCP remoto se utilizó para sincronizar y verificar la colección.',
  '', 'Newman 6.2.2: 60 requests, 180 assertions, 0 errores. Se probaron las lecturas con tokens de cada rol y seis negativos. Las mutaciones se verificaron mediante HTTP/Jest en el destino temporal, sin ejecutar la colección CRUD completa contra universidad. Escenarios críticos adicionales: competencia concurrente por último cupo (un 201 y un 409), límite de 20 créditos, prerrequisitos, horarios incompatibles, porcentajes >100, cierre forzado, finalización de grupo y DELETE sin dependencias.',
  '', '## Comandos y resultados','', '| Comando / herramienta | Inicial | Final | Límite |','|---|---|---|---|',
  '| npm run build / pretest | Aprobado, exit 0 | Aprobado, exit 0 | No prueba arranque por sí solo |',
  '| npm test | Fallido, exit 1: no tests | Aprobado, exit 0: 186 tests, 2 suites | Requiere MongoDB local rs0 |',
  '| Regresiones iniciales agregadas | 10 fallidas / 8 aprobadas | 22 unitarias aprobadas | Un caso de biblioteca redundante se retiró; TTL se verifica con JWT real |',
  '| Regresiones adicionales | 5 fallidas / 18 aprobadas antes de segunda corrección | Aprobadas | No acreditan integración por sí solas |',
  '| Arranque Nest aislado | Fallido: ReportsService no registrado | Aprobado, proceso propio detenido | Datos sintéticos |',
  `| node scripts/review-startup.cjs | PORT incoherente en fuente | Aprobado: PORT respetado, health ok/database up, Swagger ${startup.endpoints} rutas | Puerto dinámico; proceso propio |`,
  `| HTTP/Jest | Bloqueado inicialmente por composición de módulo | ${http.results.length} solicitudes aprobadas, 100 rutas con éxito | Matriz abajo; casos finitos, no prueba exhaustiva de concurrencia |`,
  '| node scripts/review-newman.cjs | Colección incompleta, sin tests | Aprobado, exit 0: 60 solicitudes / 180 assertions | Mutaciones se ejecutaron mediante Jest, no Newman |',
  '| npm run docs:endpoints | Prefijo/docs erróneos y carpeta no creada | Aprobado, exit 0: 100 rutas | docs/ ignorado por regla existente del repo |',
  '| npm exec -- eslint src --no-fix | Configuración ausente | Bloqueado, exit 1 | Falta configuración del proyecto |',
  '| npm ls --depth=0 | Dependencias existentes | Aprobado, exit 0 | No reinstalación ni cambios de lockfile |',
  '| MongoDB MCP + mongosh | Conexión comprobada | Lecturas completadas, 8 pendientes | Sin cambios en datos/infraestructura |',
  '| Postman MCP get/update/put | 27 requests | 106 requests y 106 scripts verificados | UID redescubierto tras cambio externo |',
  '| git diff --check | Estado inicial limpio | Verificado al cierre | No commits ni push propios |',
  '', '## Matriz endpoint / escenario → request → status → resultado','',
  'Inventario preparado: 100/100 endpoints; éxito HTTP ejecutado: 100/100; scripts Newman ejecutados: 54 GET y seis negativos. Archivo fuente/auth/handler/status en review-endpoints.json. Registros sanitizados completos en review-http-results.json y review-newman-results.json.',
  '', '| Método / endpoint | Request Postman (ID) | Éxito esperado | HTTP éxito / negativos medidos | Scripts Newman |','|---|---|---:|---|---|');
for(const row of rows){
  const route=normalize(row.route);
  const matches=http.results.filter(r=>r.method===row.method&&normalize(r.route)===route);
  const success=matches.some(r=>r.passed&&r.actual===row.status);
  const statuses=[...new Set(matches.map(r=>r.actual))].sort((a,b)=>a-b).join(', ');
  const item=requests.find(i=>{const url=typeof i.request.url==='string'?i.request.url:i.request.url.raw;return i.request.method===row.method&&normalize(url.replace('{{baseUrl}}',''))===route;});
  const executed=newman.cases.some(c=>c.method===row.method&&normalize(c.route)===route&&c.status===row.status);
  out.push(`| ${row.method} \`${row.route}\` | ${item?item.name+' ('+item.id+')':'Preparado en colección'} | ${row.status} | ${success?'Aprobado':'Éxito pendiente'}; status: ${statuses||'no enviado'} | ${executed?'Aprobado':'No ejecutado con Newman'} |`);
}
out.push('', '| Escenario negativo Newman | Status esperado / medido | Resultado |','|---|---|---|');
for(const c of newman.cases.slice(-6))out.push(`| ${c.name} | ${c.status} | ${c.assertions.every(a=>a.passed)?'Aprobado (3 assertions)':'Fallido'} |`);
out.push('');
fs.writeFileSync(reportFile,out.join('\n'));
console.log(JSON.stringify({issues:parsed.size,corrected:Object.keys(fixes).length,pending:Object.keys(pendingActions).length,httpRequests:http.results.length,endpointsSucceeded:rows.filter(row=>http.results.some(r=>r.passed&&r.actual===row.status&&r.method===row.method&&normalize(r.route)===normalize(row.route))).length}));
