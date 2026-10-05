# Revisión del backend

Fecha: 2026-10-05 (America/La_Paz). Commit inicial: `edd8a7da558f934002124ee5fc202dfde60afb87`. Estado inicial de Git: limpio.

## Alcance y evidencia inicial

Proyecto `proyecto1-api` (package.json), API Gestión Académica (README). NestJS 11, TypeScript declarado ^5.7 (instalado 5.9.3), Mongoose 8, MongoDB 7, npm/package-lock.json. Arquitectura por módulos y capas abiertas: controllers → services → modelos Mongoose; consultas cruzadas en servicios académicos/reportes. No se impone repositorio ni migración arquitectónica. El frontend está fuera de esta raíz y no se revisa aquí.

MongoDB MCP: conexión local `preconfigured`, database `universidad`, 13 colecciones. Muestras de estructura de 5 documentos por colección; son inferencias, no validadores. La herramienta collection_indexes falla porque invoca $listSearchIndexes, exclusivo de Atlas; se verificó con mongosh de solo lectura en el contenedor local.

Postman MCP: colección inequívoca `Proyecto1 - Simple`, UID `37710633-dedaf5f5-b26d-498f-b310-6dfa5825750d`, workspace relacionado `1869ba32-59c1-44b6-8067-61a1051bf7f4`. Se conservarán IDs y requests existentes, con respaldo sanitizado antes de sincronizar. Nombre conservado por solicitud; nombre npm distinto documentado.

Build inicial: `npm run build`, aprobado (exit 0). Tests iniciales: `npm test`, fallido (exit 1, No tests found). No configuración ESLint detectada. No se ejecutan import/seed/export ni arranque contra datos existentes. Secretos y .env fuera de cambios.

## Resultado y límites

24 hallazgos corregidos y verificados; 8 pendientes de datos/infraestructura. Build aprobado, 186 tests (22 unitarios y 164 casos de API), 292 solicitudes HTTP aprobadas, 60 solicitudes Newman y 180 assertions aprobadas. Las 100 rutas tienen al menos un caso de éxito HTTP; la ejecución de scripts Postman cubre 54 lecturas y seis negativos, no las 46 operaciones mutables.

Commit presente al cierre: `80b36c7c6b87f1f77f6f93a527ff4c22a63c7a9b`. Se observó un commit externo durante la revisión; se preservó. Esta revisión no creó commits ni hizo push.

Los tests arrancan Nest con credenciales sintéticas en memoria y databases proyecto1_review_ aleatorias; usan MongoDB real con replica set. Se limpian todos los documentos exclusivamente de la base generada. Permanecen metadatos de bases vacías (no se ejecutó drop). Se detuvieron los procesos propios. universidad no recibió escrituras, índices nuevos ni migraciones.

Limpieza final comprobada con mongosh: 8 bases de fixtures, 0 documentos restantes. Artefactos JSON válidos; scripts auxiliares pasan node --check. El diff final no tiene errores de whitespace ni secretos detectados en los artefactos de la revisión.

Los modelos Mongoose y queries fueron revisados por módulo. La arquitectura observada es por capas abiertas: transporte delega servicios; servicios aplican negocio y acceden al ODM. Inyección directa de modelos para consultas cruzadas evita ciclos entre servicios. No se encontraron motivos para imponer repositorios ni refactor general. ReportsService ausente era un defecto comprobado de composición. El frontend referenciado en README no está disponible en la ruta vecina; no se acredita compatibilidad del frontend.

## Problemas encontrados

| ID | Severidad | Categoría | Ubicación aproximada | Descripción / evidencia / regla / impacto | Solución aplicada | Estado / verificación |
|---|---|---|---|---|---|---|
| REV-001 | High | API | src/main.ts | Arranque lee APP_PORT/3001 aunque valida PORT/3000; cliente y configuración no coinciden. | Puerto obtenido desde ConfigService.PORT validado. | Corregido verificado: Arranque real en puerto dinámico + health 200. |
| REV-002 | High | Security | src/auth/auth.module.ts | RolesGuard definido pero no registrado como guard global; roles declarados no se aplican. | RolesGuard registrado globalmente después de JwtAuthGuard. | Corregido verificado: HTTP 403 para estudiante/docente sin rol; 98 rutas protegidas rechazan sesión ausente. |
| REV-003 | High | Security | src/groups/groups.service.ts:assertCanManage | Verifica docente solo cuando rol es estudiante; docentes pueden gestionar grupos ajenos. | Docente se verifica contra teacher del grupo; otros roles se rechazan. | Corregido verificado: Regresiones + notas/evaluaciones/planilla ajenas devuelven 403. |
| REV-004 | High | API | src/auth/auth.module.ts | expiresIn recibe string de segundos sin unidad; TTL no representa JWT_EXPIRES_IN_SECONDS. | expiresIn recibe segundos numéricos. | Corregido verificado: JWT real: exp - iat = 3600, verificado al login HTTP. |
| REV-005 | High | API | src/users/users.service.ts:changePassword | Cambia hash en memoria sin save; nueva contraseña no persiste. | changePassword persiste con save. | Corregido verificado: Login con nueva contraseña 200; antigua 401; regresión de persistencia. |
| REV-006 | Medium | Security | src/auth/strategies/jwt.strategy.ts | Comparación por segundos no revoca tokens emitidos en el mismo segundo que el cambio de contraseña. | JWT vinculado a passwordChangedAt en milisegundos. | Corregido verificado: Token previo del mismo segundo rechazado; nuevo aceptado; reset revoca sesión. |
| REV-007 | Medium | API | src/auth/dto/login.dto.ts | Login exige 12 caracteres, creación admite 8; cuentas válidas no pueden entrar. | Login admite mínimo 8, igual que creación. | Corregido verificado: Regresión de contraseña válida de 8 caracteres. |
| REV-008 | Medium | API | src/users/users.controller.ts | Crear devuelve HTTP 400; GET me registrado después de :id. | Creación de usuarios devuelve 201; GET me precede GET :id. | Corregido verificado: HTTP creación 201, perfil propio 200. |
| REV-009 | Medium | API | src/groups/groups.controller.ts | GET mine registrado después de :id. | GET groups/mine precede ruta dinámica. | Corregido verificado: HTTP docente 200. |
| REV-010 | Medium | API | src/evaluations/evaluations.controller.ts | Prefijo evaluationslalala difiere de delete/colección; creación devuelve 400. | Prefijo evaluations y creación 201. | Corregido verificado: GET/POST/PATCH/DELETE con fixtures; contradicción resuelta con ruta DELETE y colección existentes. |
| REV-011 | High | API | src/enrollments/enrollments.service.ts:enroll | Rechaza matrícula activa luego de confirmar y persistir; cliente recibe fallo tras escritura. | Se rechaza solo estado distinto de activa. | Corregido verificado: Matrícula nueva/reactivada devuelve 201 y persiste. |
| REV-012 | High | Database | src/enrollments/enrollments.service.ts:cancel | Cancela matrícula sin liberar contador de cupos del grupo. | Cancelación condicionada a activa y decremento de cupo en la misma transacción. | Corregido verificado: Cancela y libera cupo una vez; segundo intento 400; rematrícula reutiliza ID. |
| REV-013 | Medium | API | src/enrollments/enrollments.controller.ts:mine | Exige docente para operación que resuelve perfil estudiante. | mine requiere estudiante. | Corregido verificado: Mis matrículas 200 para estudiante; docente rechazado. |
| REV-014 | Medium | API | src/grades/dto/grade.dto.ts; src/grades/grades.service.ts | DTO limita 4.5 frente a escala 5.0; nota 3.0 se reprueba pese a umbral mínimo 3.0. | Máximo del DTO 5.0 y aprobación >= 3.0. | Corregido verificado: Notas 5.0 admitidas, 5.01 rechazadas; final 3.0 aprobada. |
| REV-015 | Medium | API | src/notifications/notifications.service.ts:markRead | No asigna read=true; aviso sigue sin leer. | markRead guarda read=true y fecha. | Corregido verificado: Lectura 200 con read=true; dueño ajeno 403. |
| REV-016 | Medium | API | src/users/dto/user.dto.ts | UpdateUserDto admite namesssss y rechaza name. | UpdateUserDto usa name. | Corregido verificado: PATCH name 200 y regresión de whitelist. |
| REV-017 | Medium | API | DTOs users/notifications | Boolean transform convierte cualquier texto inválido a false y lo acepta. | Transform compartido conserva texto inválido para rechazarlo. | Corregido verificado: active/read inválidos 400; false preservado. |
| REV-018 | Medium | Testing | package.json; postman/proyecto1-simple.postman_collection.json | No tests; colección omite endpoints y usa /api frente a /api/v1. | Jest configurado; pretest compila; colección ampliada y sincronizada. | Corregido verificado: 186 tests aprobados; 100 endpoints con éxito HTTP; 60 solicitudes/180 assertions Newman. |
| REV-019 | Low | Code Quality | scripts/list-endpoints.js; README.md | Inventario usa prefijo/docs distintos; script no crea docs antes de escribir. | Inventario /api/v1 y /api/doc; crea carpeta docs; README actualizado. | Corregido verificado: docs:endpoints genera 100 rutas; coincide con Swagger. |
| REV-020 | Medium | Database | universidad.groups | MCP: 2 contadores enrolled distintos de las matrículas no canceladas; cupos incorrectos. | No aplicada: Recalcular contadores desde matrículas verificadas, con respaldo y autorización de saneamiento. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-021 | Medium | Database | universidad.grades | Una nota une evaluación y matrícula de grupos diferentes; ambas referencias existen. Contradice la validación de upsert y puede atribuir notas a otro grupo. | No aplicada: La lectura confirmó que ambas referencias existen, pero 1 nota cruza grupos distintos. Determinar evaluación/matrícula correctas antes de corregir. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-022 | Medium | Database | docker-compose.yml | Volumen mongo_data declarado pero no montado en /data/db; recrear contenedor puede perder datos. | No aplicada: Respaldar la base y planificar montaje persistente sin recrear contenedor con pérdida de datos. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-023 | Medium | Database | universidad (13 colecciones) | mongosh de solo lectura: únicamente índice _id, sin validadores; índices únicos del código no existen en este destino. | No aplicada: Resolver duplicados REV-029/030 antes de crear índices declarados; decidir validación del servidor separadamente. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-024 | High | Build | src/reports/reports.module.ts | Arranque real de Nest falla: ReportsController no resuelve ReportsService; import/provider están comentados. | ReportsService restaurado en import/providers. | Corregido verificado: Nest inicia; 8 reportes HTTP 200; arranque real probado. |
| REV-025 | Medium | API | src/periods/periods.service.ts:update | Acepta abierto → planificado pese al ciclo documentado; permite retroceder el periodo. | Se rechaza abierto → planificado. | Corregido verificado: Regresión y HTTP 400; cierre normal/forzado 200. |
| REV-026 | Medium | API | src/evaluations/evaluations.service.ts:update | Edición omite la comprobación de periodo cerrado aplicada a creación. | Edición comprueba periodo cerrado. | Corregido verificado: Regresión + edición de evaluación cerrada 400. |
| REV-027 | Medium | API | src/grades/grades.service.ts:findMine | Ignora query.evaluation aunque el DTO lo admite. | findMine incluye filtro evaluation además del alcance propio. | Corregido verificado: Regresión verifica ambos filtros. |
| REV-028 | Medium | API | src/health/health.controller.ts | db?.admin().ping() no comprueba conexión/db: puede responder up sin base disponible. | Health requiere readyState conectado y db antes de ping. | Corregido verificado: Dos regresiones de conexión incompleta; health real 200 con ping. |
| REV-029 | Medium | Database | universidad.enrollments | Una clave student+group duplicada (grupo de duplicados), medida con agregación de lectura. La unicidad de matrícula no está garantizada. | No aplicada: Resolver duplicado con respaldo antes de crear índice único. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-030 | Medium | Database | universidad.programs | Un code duplicado (grupo de duplicados), medido con lectura. Los programas no cumplen la unicidad declarada. | No aplicada: Determinar programa canónico y consumidores antes de sanear. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-031 | Medium | Database | universidad.faculties | Un dean referencia un docente inexistente. El populate no puede resolver al decano. | No aplicada: Asignar referencia correcta solo con criterio de negocio y respaldo. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |
| REV-032 | Medium | Database | universidad.students | Un program referencia un programa inexistente. Historial/progreso pueden fallar por relaciones nulas. | No aplicada: Determinar programa correcto; saneamiento autorizado, sin inferir destino. | Pendiente; datos históricos o infraestructura fuera de corrección automática. |

## Problemas corregidos

| IDs | Cambio / comprobación |
|---|---|
| REV-001 | Puerto obtenido desde ConfigService.PORT validado. Arranque real en puerto dinámico + health 200. |
| REV-002 | RolesGuard registrado globalmente después de JwtAuthGuard. HTTP 403 para estudiante/docente sin rol; 98 rutas protegidas rechazan sesión ausente. |
| REV-003 | Docente se verifica contra teacher del grupo; otros roles se rechazan. Regresiones + notas/evaluaciones/planilla ajenas devuelven 403. |
| REV-004 | expiresIn recibe segundos numéricos. JWT real: exp - iat = 3600, verificado al login HTTP. |
| REV-005 | changePassword persiste con save. Login con nueva contraseña 200; antigua 401; regresión de persistencia. |
| REV-006 | JWT vinculado a passwordChangedAt en milisegundos. Token previo del mismo segundo rechazado; nuevo aceptado; reset revoca sesión. |
| REV-007 | Login admite mínimo 8, igual que creación. Regresión de contraseña válida de 8 caracteres. |
| REV-008 | Creación de usuarios devuelve 201; GET me precede GET :id. HTTP creación 201, perfil propio 200. |
| REV-009 | GET groups/mine precede ruta dinámica. HTTP docente 200. |
| REV-010 | Prefijo evaluations y creación 201. GET/POST/PATCH/DELETE con fixtures; contradicción resuelta con ruta DELETE y colección existentes. |
| REV-011 | Se rechaza solo estado distinto de activa. Matrícula nueva/reactivada devuelve 201 y persiste. |
| REV-012 | Cancelación condicionada a activa y decremento de cupo en la misma transacción. Cancela y libera cupo una vez; segundo intento 400; rematrícula reutiliza ID. |
| REV-013 | mine requiere estudiante. Mis matrículas 200 para estudiante; docente rechazado. |
| REV-014 | Máximo del DTO 5.0 y aprobación >= 3.0. Notas 5.0 admitidas, 5.01 rechazadas; final 3.0 aprobada. |
| REV-015 | markRead guarda read=true y fecha. Lectura 200 con read=true; dueño ajeno 403. |
| REV-016 | UpdateUserDto usa name. PATCH name 200 y regresión de whitelist. |
| REV-017 | Transform compartido conserva texto inválido para rechazarlo. active/read inválidos 400; false preservado. |
| REV-018 | Jest configurado; pretest compila; colección ampliada y sincronizada. 186 tests aprobados; 100 endpoints con éxito HTTP; 60 solicitudes/180 assertions Newman. |
| REV-019 | Inventario /api/v1 y /api/doc; crea carpeta docs; README actualizado. docs:endpoints genera 100 rutas; coincide con Swagger. |
| REV-024 | ReportsService restaurado en import/providers. Nest inicia; 8 reportes HTTP 200; arranque real probado. |
| REV-025 | Se rechaza abierto → planificado. Regresión y HTTP 400; cierre normal/forzado 200. |
| REV-026 | Edición comprueba periodo cerrado. Regresión + edición de evaluación cerrada 400. |
| REV-027 | findMine incluye filtro evaluation además del alcance propio. Regresión verifica ambos filtros. |
| REV-028 | Health requiere readyState conectado y db antes de ping. Dos regresiones de conexión incompleta; health real 200 con ping. |

## Problemas que no pudieron corregirse automáticamente

| ID | Motivo / riesgo / evidencia faltante / acción mínima |
|---|---|
| REV-020 | Recalcular contadores desde matrículas verificadas, con respaldo y autorización de saneamiento. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-021 | La lectura confirmó que ambas referencias existen, pero 1 nota cruza grupos distintos. Determinar evaluación/matrícula correctas antes de corregir. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-022 | Respaldar la base y planificar montaje persistente sin recrear contenedor con pérdida de datos. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-023 | Resolver duplicados REV-029/030 antes de crear índices declarados; decidir validación del servidor separadamente. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-029 | Resolver duplicado con respaldo antes de crear índice único. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-030 | Determinar programa canónico y consumidores antes de sanear. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-031 | Asignar referencia correcta solo con criterio de negocio y respaldo. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |
| REV-032 | Determinar programa correcto; saneamiento autorizado, sin inferir destino. Sin escritura sobre datos existentes ni cambio de infraestructura en esta revisión. |

ESLint queda bloqueado: falta eslint.config.js/mjs/cjs. Se ejecutó eslint src --no-fix, exit 1, sin modificar archivos. No se añadió configuración arbitraria ni dependencias. Cobertura porcentual no medida; no se inventa un porcentaje. Las muestras MCP no demuestran validez universal de los datos. No se ejecutaron seeds, importación, exportación masiva ni pruebas contra servicios de correo/cobro/colas (no detectados en el código).

## MongoDB: evidencia de lectura

Destino verificado contra configuración del proyecto: localhost:27017/universidad, rs0. Se inspeccionaron 13 colecciones mediante MCP (5 muestras estructurales por colección) y metadatos/relaciones/unicidad con mongosh. Los campos de referencia observados son ObjectId y las fechas BSON Date; detalle agregado sin documentos personales en postman/review-database-results.json. Todas las colecciones existentes solo tienen índice _id y ningún validador de servidor. La ausencia de validadores se distingue de validación Mongoose, que sí aplica en el código.

| Colección | Documentos | Referencias inexistentes (campo: cantidad) | Claves duplicadas (grupos) |
|---|---:|---|---|
| enrollments | 110 | 0 en campos revisados | student+group: 1 |
| groups | 100 | 0 en campos revisados | 0 en claves revisadas |
| grades | 320 | 0 en campos revisados | 0 en claves revisadas |
| programs | 101 | 0 en campos revisados | code: 1 |
| notifications | 100 | 0 en campos revisados | 0 en claves revisadas |
| evaluations | 100 | 0 en campos revisados | 0 en claves revisadas |
| faculties | 10 | dean: 1 | 0 en claves revisadas |
| students | 100 | program: 1 | 0 en claves revisadas |
| users | 201 | 0 en campos revisados | 0 en claves revisadas |
| classrooms | 100 | 0 en campos revisados | 0 en claves revisadas |
| teachers | 100 | 0 en campos revisados | 0 en claves revisadas |
| periods | 100 | 0 en campos revisados | 0 en claves revisadas |
| subjects | 100 | 0 en campos revisados | 0 en claves revisadas |

MCP también midió 2 contadores de cupos inconsistentes, 1 relación de nota entre grupos diferentes, ningún prerrequisito inexistente y ningún estado final contradictorio con el umbral 3.0 en la consulta ejecutada. No se saneó ninguno.

## Postman: sincronización y ejecución

Colección vigente: [Proyecto1 - Simple](https://www.postman.com/collections/e50c8a3c-5078-4406-8ef4-33ac92982d96), UID `37710633-e50c8a3c-5078-4406-8ef4-33ac92982d96`, workspace `1869ba32-59c1-44b6-8067-61a1051bf7f4`. La colección original dedaf5f5 fue sustituida externamente durante la revisión; se redescubrió la nueva e50c8a3c por nombre y rutas. Respaldos sanitizados: review-original.sanitized.json y review-current.sanitized.json.

Las 27 solicitudes existentes se actualizaron con herramientas parciales, conservando sus IDs. Se añadieron 73 endpoints y seis negativos. La herramienta disponible no expone creación de carpetas: se actualizó la estructura conservando IDs; la actualización global no conservó events/auth bearer, por lo que se completaron con 106 actualizaciones por solicitud. Tras un timeout se leyó el estado antes de reintentar. La lectura final confirma 106 solicitudes, 106 scripts de tests, IDs existentes conservados y valores secretos vacíos. El archivo local es la exportación final verificada.

Autenticación mediante {{token}}; contraseñas y correos de login mediante variables vacías; URLs/IDs parametrizados. Roles requeridos y status de éxito en la descripción. Los tests son status exacto, estructura y coherencia del contrato, tres por request. Los tests existentes útiles se conservaron. No se publicaron ni tunelizaron servicios. Newman se ejecutó localmente para alcanzar localhost; el servidor MCP remoto se utilizó para sincronizar y verificar la colección.

Newman 6.2.2: 60 requests, 180 assertions, 0 errores. Se probaron las lecturas con tokens de cada rol y seis negativos. Las mutaciones se verificaron mediante HTTP/Jest en el destino temporal, sin ejecutar la colección CRUD completa contra universidad. Escenarios críticos adicionales: competencia concurrente por último cupo (un 201 y un 409), límite de 20 créditos, prerrequisitos, horarios incompatibles, porcentajes >100, cierre forzado, finalización de grupo y DELETE sin dependencias.

## Comandos y resultados

| Comando / herramienta | Inicial | Final | Límite |
|---|---|---|---|
| npm run build / pretest | Aprobado, exit 0 | Aprobado, exit 0 | No prueba arranque por sí solo |
| npm test | Fallido, exit 1: no tests | Aprobado, exit 0: 186 tests, 2 suites | Requiere MongoDB local rs0 |
| Regresiones iniciales agregadas | 10 fallidas / 8 aprobadas | 22 unitarias aprobadas | Un caso de biblioteca redundante se retiró; TTL se verifica con JWT real |
| Regresiones adicionales | 5 fallidas / 18 aprobadas antes de segunda corrección | Aprobadas | No acreditan integración por sí solas |
| Arranque Nest aislado | Fallido: ReportsService no registrado | Aprobado, proceso propio detenido | Datos sintéticos |
| node scripts/review-startup.cjs | PORT incoherente en fuente | Aprobado: PORT respetado, health ok/database up, Swagger 100 rutas | Puerto dinámico; proceso propio |
| HTTP/Jest | Bloqueado inicialmente por composición de módulo | 292 solicitudes aprobadas, 100 rutas con éxito | Matriz abajo; casos finitos, no prueba exhaustiva de concurrencia |
| node scripts/review-newman.cjs | Colección incompleta, sin tests | Aprobado, exit 0: 60 solicitudes / 180 assertions | Mutaciones se ejecutaron mediante Jest, no Newman |
| npm run docs:endpoints | Prefijo/docs erróneos y carpeta no creada | Aprobado, exit 0: 100 rutas | docs/ ignorado por regla existente del repo |
| npm exec -- eslint src --no-fix | Configuración ausente | Bloqueado, exit 1 | Falta configuración del proyecto |
| npm ls --depth=0 | Dependencias existentes | Aprobado, exit 0 | No reinstalación ni cambios de lockfile |
| MongoDB MCP + mongosh | Conexión comprobada | Lecturas completadas, 8 pendientes | Sin cambios en datos/infraestructura |
| Postman MCP get/update/put | 27 requests | 106 requests y 106 scripts verificados | UID redescubierto tras cambio externo |
| git diff --check | Estado inicial limpio | Verificado al cierre | No commits ni push propios |

## Matriz endpoint / escenario → request → status → resultado

Inventario preparado: 100/100 endpoints; éxito HTTP ejecutado: 100/100; scripts Newman ejecutados: 54 GET y seis negativos. Archivo fuente/auth/handler/status en review-endpoints.json. Registros sanitizados completos en review-http-results.json y review-newman-results.json.

| Método / endpoint | Request Postman (ID) | Éxito esperado | HTTP éxito / negativos medidos | Scripts Newman |
|---|---|---:|---|---|
| GET `/api/v1/groups/:id/roster` | Lista de estudiantes matriculados en un grupo (154fd946-2aa9-4885-846d-b2f6f32817ff) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/groups/:id/grade-sheet` | Planilla de notas del grupo: evaluaciones x estudiantes, con promedio parcial (f8e1b4fb-d78c-40e3-bbb3-299acf6b0def) | 200 | Aprobado; status: 200, 401, 403 | Aprobado |
| POST `/api/v1/groups/:id/finalize` | Finaliza en bloque las matriculas activas del grupo (calcula nota final y aprueba/reprueba) (8d298cd1-3073-4dc7-aac4-13b5a41e3d09) | 200 | Aprobado; status: 200, 400, 401 | No ejecutado con Newman |
| GET `/api/v1/students/me/schedule` | Mi horario semanal en un periodo (por defecto el abierto) (35631ee0-24e9-46ed-8993-996680f9c131) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/me/available-groups` | Grupos del periodo abierto que puedo matricular (cupo, prerrequisitos y materia pendiente) (153a5640-1bf0-46d7-a89b-6b0045806717) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/me/progress` | Mi malla curricular: que aprobe, que cursa y que puedo matricular (95cd2e11-aacb-498e-92e3-1445306c272d) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/:id/progress` | Malla curricular y avance de un estudiante (04e41af7-8b03-4b83-9a8b-ed2e812ffe1e) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/programs/:id/curriculum` | Malla curricular de un programa: materias por semestre con prerrequisitos (9bc51edf-1290-49cc-991d-22009a52ecda) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/me/history` | Mi historial academico: materias por periodo, promedio y avance de la carrera (8cb68dae-5601-4bd7-8ee6-b52b19fc17d3) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/:id/schedule` | Horario semanal de un estudiante (008ed5e9-f8a2-418b-af45-5888054035f4) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/:id/history` | Historial academico de un estudiante (45fecc72-5e41-46b8-bbc5-2f7d4cea5d0a) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/teachers/me/schedule` | Mi horario de clases en un periodo (por defecto el abierto) (84e7ec84-1b97-485c-9061-8a505a634f41) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/teachers/:id/schedule` | Horario de clases de un docente (f43bd4c0-e08e-4b48-bf53-88abb5946b81) | 200 | Aprobado; status: 200, 401 | Aprobado |
| POST `/api/v1/auth/login` | Login (209aa1b5-ae88-437a-9a9e-fb76f8129ea3) | 200 | Aprobado; status: 200, 400, 401 | No ejecutado con Newman |
| GET `/api/v1/auth/me` | Me (6e6d7b39-b189-475a-8b42-88f4b08de89f) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/auth/change-password` | Cambiar mi contrasena (devuelve un token nuevo) (78fd4420-1b76-480c-9f4f-0545193ab628) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| POST `/api/v1/classrooms` | Crear un salon (ea618a89-56ae-4a15-9e29-56ddccedcc57) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/classrooms` | Listar salones (58914479-d02a-4730-b1a7-bd53ef1b2776) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/classrooms/:id` | Ver un salon por ID (a790cccd-3c7f-4042-9536-7816fd97dee2) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/classrooms/:id` | Editar un salon (8fe8004d-eea8-4aa8-bbea-bd9658fea8d8) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| DELETE `/api/v1/groups/:id` | Elimina un grupo sin matriculas ni evaluaciones (79de849e-05e6-4ed4-9feb-6f396224ab53) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/evaluations/:id` | Elimina una evaluacion sin notas registradas (55212a8a-1196-43e6-ac95-834792ddaf72) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/grades/:id` | Elimina una nota puesta por error (matricula activa) (c3c6c0d6-aa2a-46ff-970f-2546e5b283ba) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| DELETE `/api/v1/notifications/:id` | Elimina una de mis notificaciones (7c9919b7-e4e6-4f65-91a3-951a0d145ef0) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| DELETE `/api/v1/classrooms/:id` | Elimina un salon que no este en ningun horario (6b89ed01-c4b7-4aa5-b2c3-61a572beb65f) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/faculties/:id` | Elimina una facultad sin programas ni docentes (5013cb66-8b53-4f3e-b291-b607cca7558c) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/programs/:id` | Elimina un programa sin materias ni estudiantes (6ddcf6b5-29c1-40bb-88bb-18697caf7467) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/subjects/:id` | Elimina una materia sin grupos, matriculas ni dependientes (37cb66e5-e136-417d-8119-bcd7fd775c8d) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/periods/:id` | Elimina un periodo planificado sin grupos (0b50058e-0a4b-4d06-b6b5-8662780ab58b) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| DELETE `/api/v1/students/:id` | Elimina un estudiante sin matriculas (f7d56a31-c13b-4ff1-8d96-dfb18173efdf) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/teachers/:id` | Elimina un docente sin grupos (08d963c4-1a03-4492-afc0-58ebc94d2592) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| DELETE `/api/v1/users/:id` | Elimina un usuario sin perfil de estudiante/docente (778749c6-d4d1-4f71-9e9b-6aa00b6025aa) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| POST `/api/v1/enrollments` | Matricular en un grupo (valida cupo, prerrequisitos, cruces de horario y creditos) (02bc9d02-7804-4666-9dc4-5b58a93b38fa) | 201 | Aprobado; status: 201, 400, 401, 409 | No ejecutado con Newman |
| GET `/api/v1/enrollments` | Listar matriculas (1899f663-3d21-4125-8bcb-86b2bcf10489) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/enrollments/mine` | Mis matriculas (95550f17-c309-4e61-afd4-b7c68c693cb8) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/enrollments/:id` | Ver una matricula por ID (02666605-adbd-4f76-8659-95f36ea004d3) | 200 | Aprobado; status: 200, 401, 403 | Aprobado |
| POST `/api/v1/enrollments/:id/cancel` | Cancelar una matricula activa (libera el cupo) (28970afd-1930-4dd0-ab0a-5c1258d3ab8c) | 201 | Aprobado; status: 201, 400, 401 | No ejecutado con Newman |
| POST `/api/v1/evaluations` | Crear una evaluacion (f4431c41-f76c-427f-baab-b1725c3f17f6) | 201 | Aprobado; status: 201, 400, 401, 403 | No ejecutado con Newman |
| GET `/api/v1/evaluations` | Listar evaluaciones (143a81f5-abba-47e4-b285-2611889936b0) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/evaluations/:id` | Ver una evaluacion por ID (257497a3-bc8a-4169-9f5e-7a2e82ae39d2) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/evaluations/:id` | Editar una evaluacion (7cc7b3bc-9edc-45a2-b819-50239638b1dc) | 200 | Aprobado; status: 200, 400, 401 | No ejecutado con Newman |
| POST `/api/v1/faculties` | Crear una facultad (7259273b-f18b-4d0e-baa5-8aba29173501) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/faculties` | Listar facultades (062e8b38-7dc0-47fc-aa81-09cef37343f4) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/faculties/:id` | Ver una facultad por ID (eac3dce1-f886-4898-96f7-995cea23c6eb) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/faculties/:id` | Editar una facultad (fcaf6289-6e63-4e9c-a11d-a3b720fb9eda) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| PUT `/api/v1/grades` | Registrar o corregir una nota (idempotente) (fc84ef3a-b244-4702-b8c3-392850968f5e) | 200 | Aprobado; status: 200, 400, 401, 403 | No ejecutado con Newman |
| PUT `/api/v1/grades/bulk` | Registrar varias notas a la vez (planilla); informa las que fallaron (cbd13623-bad3-44a1-a502-35011de771ec) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| GET `/api/v1/grades` | Consultar notas de una matricula o de una evaluacion (d94c78a7-ab8b-4357-a03d-cdd1721b1f85) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/grades/mine` | Mis notas (21147b59-dc8d-4c0e-aafe-ccdf61324709) | 200 | Aprobado; status: 200, 401 | Aprobado |
| POST `/api/v1/grades/finalize/:enrollmentId` | Calcular la nota final de una matricula y marcarla aprobada/reprobada (10d811eb-2d6d-4095-8032-a66d5756a862) | 200 | Aprobado; status: 200, 400, 401 | No ejecutado con Newman |
| POST `/api/v1/groups` | Crear un grupo (7b3e6593-83c4-4e79-b85e-8dd5395cceaf) | 201 | Aprobado; status: 201, 400, 401, 409 | No ejecutado con Newman |
| GET `/api/v1/groups` | Listar grupos (filtros: period, subject, teacher, day, available, active) (af318358-c3c9-4e8c-a19b-263dcc031b6e) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/groups/mine` | Mis grupos (docente) (f5fbfbdf-e727-49a8-b514-6049e47982e9) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/groups/:id` | Ver un grupo por ID (d1240b0d-8f99-4bcf-828e-3eafa204468e) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/groups/:id` | Editar un grupo (99b7282a-d7fc-464c-b0ae-1aaa346015f2) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| GET `/api/v1/health` | Health (f42d2f4b-6962-44cf-aa1d-5070648adf8c) | 200 | Aprobado; status: 200 | Aprobado |
| POST `/api/v1/notifications` | Enviar un aviso a un usuario (4673a231-86b3-4362-8cc7-a4e15d7127f6) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/notifications/mine` | Mis notificaciones (con contador de no leidas) (740ed733-766c-47c0-8c69-9ab92978d9fb) | 200 | Aprobado; status: 200, 400, 401 | Aprobado |
| PATCH `/api/v1/notifications/read-all` | Marcar todas mis notificaciones como leidas (2c7e7cb8-19e5-4cc3-8246-ef4f3eb3252f) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| PATCH `/api/v1/notifications/:id/read` | Marcar una notificacion como leida (9b86b6a2-41db-48df-81a5-5aa2012a996e) | 200 | Aprobado; status: 200, 401, 403 | No ejecutado con Newman |
| POST `/api/v1/periods` | Crear (ff08146c-1867-41fa-8b31-b102a232dcd7) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/periods` | Listar (569be232-39c3-4f58-9405-4fbbf8aec426) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/periods/current` | Periodo abierto actual (01084ddb-4a1d-4ca3-9792-91da95a35bed) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/periods/:id` | Obtener (3b940cc7-1a65-4f6a-b480-2bf275047d4a) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/periods/:id/close-check` | Revision previa al cierre: matriculas activas pendientes por grupo (9a3fe519-8d91-4b4f-9fca-855ab2daa9bf) | 200 | Aprobado; status: 200, 401 | Aprobado |
| POST `/api/v1/periods/:id/close` | Cierra el periodo (abierto -> cerrado). Es irreversible (eb996a28-470f-4889-bfcd-3a60b8244fe4) | 200 | Aprobado; status: 200, 401, 409 | No ejecutado con Newman |
| PATCH `/api/v1/periods/:id` | Actualizar (323c1d39-9059-4777-90cb-f245b42fe03f) | 200 | Aprobado; status: 200, 400, 401 | No ejecutado con Newman |
| POST `/api/v1/programs` | Crear (e68551ac-2040-43a8-80ca-202a2f8304d2) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/programs` | Listar (76f54700-4e79-4900-a439-a481c043dea3) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/programs/:id` | Obtener (ac083108-c76d-45e4-8c26-6ee5c1408ab5) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/programs/:id` | Actualizar (c13f40b2-e5b8-4ff3-bc6d-4685a3592ba2) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| GET `/api/v1/reports/dashboard` | Tablero general: conteos del sistema y estado del periodo abierto (c90a4f1a-0d18-40af-8c63-59136997d457) | 200 | Aprobado; status: 200, 401, 403 | Aprobado |
| GET `/api/v1/reports/enrollments-by-program` | Matriculas y estudiantes por programa en un periodo (1d4bd03d-40c3-4337-88bf-7abe39922de1) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/group-occupancy` | Ocupacion de los grupos (los mas llenos primero) (b87f3073-6359-4876-b057-d5dc21e24e30) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/subject-performance` | Aprobacion y promedio por materia (las de menor aprobacion primero) (d2cb1378-58c3-46fb-b281-89d9e1a502e1) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/top-students` | Mejores promedios del periodo (ponderados por creditos) (385d3908-840d-430c-9cee-d37b62714828) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/at-risk-students` | Estudiantes con materias reprobadas en el periodo (a0c639bb-067e-40f8-bc3e-2e55541394de) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/teacher-load` | Carga docente: grupos, estudiantes y creditos por docente (eab9344a-81ca-4821-997a-dc4c719314e9) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/reports/faculty-summary` | Programas, docentes y estudiantes por facultad (f9a7bff0-fff7-4fcf-b3c1-db138139c07f) | 200 | Aprobado; status: 200, 401 | Aprobado |
| POST `/api/v1/students` | Crear (59227aef-57c5-494c-bab4-1468f5814f7f) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/students` | Listar (863f3532-8a9f-494c-b234-00d8abc96f46) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/me` | Mi perfil (5494397f-8e8f-44ef-b57e-2afb538c4e31) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/students/:id` | Obtener (ea76c63e-754f-4eb2-a60f-8ae62eea5b92) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/students/:id` | Actualizar (22a0992b-b1d6-4681-a62b-9c2332221325) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| POST `/api/v1/subjects` | Crear (11e80ccd-248a-490e-93f4-3541f7a8a1bb) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/subjects` | Listar (252ef5e7-6664-453a-a03e-f1441b83e29b) | 200 | Aprobado; status: 200, 400, 401 | Aprobado |
| GET `/api/v1/subjects/:id` | Obtener (9b171601-72e1-403a-84da-d30f06a5a4fb) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/subjects/:id` | Actualizar (fc84ac58-9c61-4bd3-b3fc-6488161673e2) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| POST `/api/v1/teachers` | Crear (6a04257c-07c5-4edb-8a2d-8379dcc52422) | 201 | Aprobado; status: 201, 401 | No ejecutado con Newman |
| GET `/api/v1/teachers` | Listar (cb00d4d4-787c-48c4-8bd4-9df56a4e8ca8) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/teachers/me` | Mi perfil (121b9df2-a8ba-41bd-bc83-a6ecd2e898f1) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/teachers/:id` | Obtener (875a360a-7fe2-42ef-832a-6f762d3261bd) | 200 | Aprobado; status: 200, 401 | Aprobado |
| PATCH `/api/v1/teachers/:id` | Actualizar (7c68256b-342a-4f45-b5e2-29e54d92f7c5) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| GET `/api/v1/users` | Listar (e5446f6f-d80b-481c-a821-12841ed09cda) | 200 | Aprobado; status: 200, 400, 401, 403 | Aprobado |
| POST `/api/v1/users` | Crear (4f20c49f-03f0-4a9b-a0dd-9fb516aa8f02) | 201 | Aprobado; status: 201, 401, 409 | No ejecutado con Newman |
| PATCH `/api/v1/users/me` | Editar mi nombre (082bd66c-0b23-4e4b-bba7-101cf39de053) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| GET `/api/v1/users/me` | Mi perfil de usuario (799bf993-ad26-43c1-9e86-1a14d1b085b0) | 200 | Aprobado; status: 200, 401 | Aprobado |
| GET `/api/v1/users/:id` | Ver un usuario por ID (246922c9-1498-4302-b3ce-5c9b01475d70) | 200 | Aprobado; status: 200, 401, 404 | Aprobado |
| PATCH `/api/v1/users/:id` | Editar un usuario (6fde3c94-e513-4e61-9bd3-53d6e4e76e09) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |
| POST `/api/v1/users/:id/reset-password` | Restablecer la contrasena de un usuario (ddb3ebd1-fc99-44da-8eb1-bc77be20e562) | 200 | Aprobado; status: 200, 401 | No ejecutado con Newman |

| Escenario negativo Newman | Status esperado / medido | Resultado |
|---|---|---|
| Sin sesión | 401 | Aprobado (3 assertions) |
| ID inválido | 400 | Aprobado (3 assertions) |
| Inexistente | 404 | Aprobado (3 assertions) |
| Booleano inválido | 400 | Aprobado (3 assertions) |
| Paginación inválida | 400 | Aprobado (3 assertions) |
| Login incompleto | 400 | Aprobado (3 assertions) |
