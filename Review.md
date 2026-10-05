# Revisión del backend

Fecha: 2026-10-05 (America/La_Paz). Commit inicial: `edd8a7da558f934002124ee5fc202dfde60afb87`. Estado inicial de Git: limpio.

## Alcance y evidencia inicial

Proyecto `proyecto1-api` (package.json), API Gestión Académica (README). NestJS 11, TypeScript 5.7, Mongoose 8, MongoDB 7, npm/package-lock.json. Arquitectura por módulos y capas abiertas: controllers → services → modelos Mongoose; consultas cruzadas en servicios académicos/reportes. No se impone repositorio ni migración arquitectónica. El frontend está fuera de esta raíz y no se revisa aquí.

MongoDB MCP: conexión local `preconfigured`, database `universidad`, 13 colecciones. Muestras de estructura de 5 documentos por colección; son inferencias, no validadores. La herramienta collection_indexes falla porque invoca $listSearchIndexes, exclusivo de Atlas; se verificará con lectura del driver local.

Postman MCP: colección inequívoca `Proyecto1 - Simple`, UID `37710633-dedaf5f5-b26d-498f-b310-6dfa5825750d`, workspace relacionado `1869ba32-59c1-44b6-8067-61a1051bf7f4`. Se conservarán IDs y requests existentes, con respaldo sanitizado antes de sincronizar. Nombre conservado por solicitud; nombre npm distinto documentado.

Build inicial: `npm run build`, aprobado (exit 0). Tests iniciales: `npm test`, fallido (exit 1, No tests found). No configuración ESLint detectada. No se ejecutan import/seed/export ni arranque contra datos existentes. Secretos y .env fuera de cambios.

## Problemas encontrados

| ID | Severidad | Categoría | Ubicación | Evidencia / regla / impacto | Solución / estado |
|---|---|---|---|---|---|
| REV-001 | High | API | src/main.ts | Arranque lee APP_PORT/3001 aunque valida PORT/3000; cliente y configuración no coinciden. | Detectado |
| REV-002 | High | Security | src/auth/auth.module.ts | RolesGuard definido pero no registrado como guard global; roles declarados no se aplican. | Detectado |
| REV-003 | High | Security | src/groups/groups.service.ts:assertCanManage | Verifica docente solo cuando rol es estudiante; docentes pueden gestionar grupos ajenos. | Detectado |
| REV-004 | High | API | src/auth/auth.module.ts | expiresIn recibe string de segundos sin unidad; TTL no representa JWT_EXPIRES_IN_SECONDS. | Detectado; comprobar duración del JWT |
| REV-005 | High | API | src/users/users.service.ts:changePassword | Cambia hash en memoria sin save; nueva contraseña no persiste. | Detectado |
| REV-006 | Medium | Security | src/auth/strategies/jwt.strategy.ts | Comparación por segundos no revoca tokens emitidos en el mismo segundo que el cambio de contraseña. | Detectado |
| REV-007 | Medium | API | src/auth/dto/login.dto.ts | Login exige 12 caracteres, creación admite 8; cuentas válidas no pueden entrar. | Detectado |
| REV-008 | Medium | API | src/users/users.controller.ts | Crear devuelve HTTP 400; GET me registrado después de :id. | Detectado |
| REV-009 | Medium | API | src/groups/groups.controller.ts | GET mine registrado después de :id. | Detectado |
| REV-010 | Medium | API | src/evaluations/evaluations.controller.ts | Prefijo evaluationslalala difiere de delete/colección; creación devuelve 400. | Detectado; contrastar consumidores |
| REV-011 | High | API | src/enrollments/enrollments.service.ts:enroll | Rechaza matrícula activa luego de confirmar y persistir; cliente recibe fallo tras escritura. | Detectado |
| REV-012 | High | Database | src/enrollments/enrollments.service.ts:cancel | Cancela matrícula sin liberar contador de cupos del grupo. | Detectado |
| REV-013 | Medium | API | src/enrollments/enrollments.controller.ts:mine | Exige docente para operación que resuelve perfil estudiante. | Detectado |
| REV-014 | Medium | API | src/grades/dto/grade.dto.ts; src/grades/grades.service.ts | DTO limita 4.5 frente a escala 5.0; nota 3.0 se reprueba pese a umbral mínimo 3.0. | Detectado |
| REV-015 | Medium | API | src/notifications/notifications.service.ts:markRead | No asigna read=true; aviso sigue sin leer. | Detectado |
| REV-016 | Medium | API | src/users/dto/user.dto.ts | UpdateUserDto admite namesssss y rechaza name. | Detectado |
| REV-017 | Medium | API | DTOs users/notifications | Boolean transform convierte cualquier texto inválido a false y lo acepta. | Detectado |
| REV-018 | Medium | Testing | package.json; postman/proyecto1-simple.postman_collection.json | No tests; colección omite endpoints y usa /api frente a /api/v1. | Detectado |
| REV-019 | Low | Code Quality | scripts/list-endpoints.js; README.md | Inventario usa prefijo/docs distintos; script no crea docs antes de escribir. | Detectado |
| REV-024 | High | Build | src/reports/reports.module.ts | Arranque real de Nest falla: ReportsController no resuelve ReportsService; import/provider están comentados. | Detectado con suite HTTP antes de corregir |
| REV-025 | Medium | API | src/periods/periods.service.ts:update | Acepta abierto → planificado pese al ciclo documentado; permite retroceder el periodo. | Detectado |
| REV-026 | Medium | API | src/evaluations/evaluations.service.ts:update | Edición omite la comprobación de periodo cerrado aplicada a creación. | Detectado |
| REV-027 | Medium | API | src/grades/grades.service.ts:findMine | Ignora query.evaluation aunque el DTO lo admite. | Detectado |
| REV-028 | Medium | API | src/health/health.controller.ts | db?.admin().ping() no comprueba conexión/db: puede responder up sin base disponible. | Detectado |

## Problemas corregidos

Primer grupo aplicado: REV-001 a REV-019. Regresiones iniciales: 18 casos, 10 fallidos y 8 aprobados antes de modificar. Se repetirán después del build. Las escrituras HTTP usarán únicamente databases proyecto1_review_ generadas, credenciales sintéticas en memoria y limpieza limitada a esos documentos.

## Problemas que no pudieron corregirse automáticamente

Revisión en curso. No se ejecutan saneamientos de datos históricos ni cambios de infraestructura.

| ID | Severidad | Categoría | Ubicación | Evidencia / impacto | Acción mínima / estado |
|---|---|---|---|---|---|
| REV-020 | Medium | Database | universidad.groups | MCP: 2 contadores enrolled distintos de las matrículas no canceladas; cupos incorrectos. | Saneamiento autorizado con respaldo; pendiente |
| REV-021 | Medium | Database | universidad.grades | MCP: 1 nota con referencia faltante o grupos diferentes entre evaluación y matrícula. | Determinar relación correcta y saneamiento; pendiente |
| REV-022 | Medium | Database | docker-compose.yml | Volumen mongo_data declarado pero no montado en /data/db; recrear contenedor puede perder datos. | Respaldo y plan de infraestructura; no aplicado por límites del skill |
| REV-023 | Medium | Database | universidad (13 colecciones) | mongosh de solo lectura: únicamente índice _id, sin validadores; índices únicos del código no existen en este destino. | Auditar duplicados antes de crear índices; cambio de infraestructura pendiente |

## Verificación

La matriz endpoint/escenario y resultados finales se agregarán tras ejecución. No se declara validación completa durante la revisión.
