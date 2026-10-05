# Revisión de MongoDB

Fecha: 2026-10-05 (America/La_Paz). Base revisada: `universidad`, MongoDB local en `localhost:27017`, replica set `rs0`.

Revisión de datos completada mediante MongoDB MCP 3.0.5 por stdio, iniciado con `--readOnly` y `MDB_MCP_READ_ONLY=true`. Se comprobaron las 13 colecciones y sus 1.542 documentos: referencias, claves duplicadas, campos obligatorios, tipos BSON, rangos y enums de los schemas del backend. Se revisaron además contadores, notas y matrículas entre grupos, fechas, porcentajes y los horarios de los 100 grupos. Los hashes, correos y nombres personales no se exportaron.

La herramienta MCP `collection-indexes` falló porque ejecuta `$listSearchIndexes`, incompatible con este MongoDB local. Los índices y validadores se comprobaron mediante `listCollections` y `listIndexes` del driver local, exclusivamente de lectura. Los volúmenes se comprobaron mediante `docker inspect`, sin recrear el contenedor.

## Errores confirmados actualmente

| ID | Severidad | Colección | Evidencia | Impacto / acción recomendada |
|---|---|---|---|---|
| DB-001 | Alta | periods | `6abf0b8bfead57fb41c12a35`, periodo `2026-2`, tiene `status: "Abierto"`; el enum exige `abierto`. La consulta del periodo abierto devuelve cero documentos. | El backend no encuentra ese periodo como abierto. Confirmar su estado y normalizarlo. |
| DB-002 | Alta | users | `6abf0b8bfead57fb41c12a90` tiene `role: "Docente"`; el enum exige `docente`. | El valor no coincide con las comprobaciones de rol. Normalizar con criterio de negocio. |
| DB-003 | Media | users | `6abf0b8bfead57fb41c12a38` tiene nombre vacío. | Incumple el campo requerido del modelo. Completar con el nombre correcto. |
| DB-004 | Alta | grades | `6abf0b8bfead57fb41c12df0` y `6abf0b8bfead57fb41c12dfc` tienen `value: 5.7`; `6abf0b8bfead57fb41c12e1b` tiene el texto `"4,2"`. El schema exige número entre 0 y 5. | Cálculos y reportes pueden excluir o procesar incorrectamente estas notas. Recuperar el valor académico correcto, sin truncarlo por inferencia. |
| DB-005 | Alta | groups | `6abf0b8bfead57fb41c12c3a`: enrolled=35, matrículas no canceladas=9, capacity=32. `6abf0b8bfead57fb41c12c3e`: enrolled=42, matrículas no canceladas=10, capacity=39. | Ambos contadores exceden el cupo y no coinciden con las matrículas. Recalcular después de resolver duplicados. |
| DB-006 | Alta | enrollments | Dos documentos para el mismo estudiante y grupo: `6abf0b8bfead57fb41c12dfb` y `6ac057b232f78f9b9e14f3c2`. | Matrícula duplicada. Revisar notas y estado antes de decidir qué registro conservar. |
| DB-007 | Alta | programs | `code: DERE` aparece en `6abf0b8bfead57fb41c1292d` y `6ac03d4229a649e6df069ebb`. | Código ambiguo; impide crear el índice único. Elegir programa canónico revisando referencias. |
| DB-008 | Alta | grades | `6abf0b8bfead57fb41c12dfd`: matrícula del grupo `6abf0b8bfead57fb41c12c3e`, evaluación del grupo `6abf0b8bfead57fb41c12c73`. | Nota asignada entre grupos distintos. Determinar la matrícula/evaluación correcta. |
| DB-009 | Alta | enrollments | `6abf0b8bfead57fb41c12dfb`: subject=`6abf0b8bfead57fb41c129c0`, pero su grupo tiene subject=`6abf0b8bfead57fb41c1299d`. `6abf0b8bfead57fb41c12e1a`: period=`6abf0b8bfead57fb41c12a34`, pero su grupo tiene period=`6abf0b8bfead57fb41c12a35`. | Los campos copiados del grupo no coinciden; afecta historial, créditos y filtros por periodo. Contrastar con el registro académico. |
| DB-010 | Media | students | `6abf0b8bfead57fb41c12b9c` apunta al programa inexistente `6ac057b232f78f9b9e14f3c4`. | `populate` no resuelve el programa. Asignar el programa real, sin inferirlo. |
| DB-011 | Media | faculties | `6abf0b8bfead57fb41c12b0a` apunta al decano inexistente `6ac057b232f78f9b9e14f3c3`. | Referencia rota. Confirmar el decano o si corresponde dejar el campo opcional vacío. |
| DB-012 | Media | subjects | Materia `ODON105`, `6abf0b8bfead57fb41c1299d`, tiene credits=0; mínimo=1. | Créditos inválidos para matrículas y progreso académico. Confirmar el número correcto. |
| DB-013 | Alta | evaluations | Evaluaciones del grupo `6abf0b8bfead57fb41c12c3a` suman 110 %, en cuatro documentos. | El plan excede el 100 %. Revisar ponderaciones antes de finalizar/calcular notas. |
| DB-014 | Media | groups | `6abf0b8bfead57fb41c12c3a` usa day=`Miércoles`, pero el enum exige `miercoles`. `6abf0b8bfead57fb41c12c64` tiene inicio=09:00 y fin=07:00. | El día no coincide en consultas y existe una franja invertida. Confirmar y corregir horarios. |
| DB-015 | Media | notifications | `6abf0b8bfead57fb41c12eb7` usa type=`aviso_urgente`, ausente del enum. `6abf0b8bfead57fb41c12ec0` tiene createdAt=`ayer` en vez de BSON Date. | Tipo incompatible y orden cronológico incorrecto. Confirmar categoría y fecha real. |
| DB-016 | Alta | programs / enrollments | Faltan los índices únicos `programs(code)` y `enrollments(student, group)` declarados en los modelos. El resto de claves únicas revisadas sí tiene índices únicos. | Los duplicados DB-006/007 impiden crear estos índices. Sanear antes de construirlos. |
| DB-017 | Media | Las 13 colecciones | Todas carecen de validador MongoDB. | Las escrituras que omiten Mongoose pueden persistir tipos/rangos/enums inválidos. Diseñar validadores tras sanear; no equivalen a integridad referencial entre colecciones. |
| DB-018 | Media | Infraestructura | Compose declara `mongo_data`, pero no lo monta. Docker monta un volumen anónimo en `/data/db`. | Los datos tienen volumen actual, pero no quedan vinculados al volumen declarado de Compose. Respaldar y migrar el volumen de forma planificada antes de recrear el contenedor. |

## Comprobaciones sin errores adicionales

No aparecieron otras claves duplicadas ni referencias rotas en las relaciones revisadas, incluidos salones y prerrequisitos. Las notas finales de las matrículas aprobadas/reprobadas coinciden con el umbral de 3.0; no se encontraron fechas de periodo invertidas. Las comparaciones ejecutadas no detectaron solapamientos de docente o salón entre grupos activos del mismo periodo, ni solapamientos internos. Esto no certifica ausencia de conflictos después de corregir días inválidos. Un plan incompleto puede ser válido durante su preparación; el hallazgo DB-013 supera el máximo de 100 %.

## Evidencia y reproducción

- `review-mongo-mcp-results.json`: agregaciones MCP completas, conteos por colección e IDs de anomalías; también registra el fallo de la herramienta de índices.
- `review-mongo-mcp-details.json`: valores problemáticos, horarios y metadatos complementarios de índices/validadores obtenidos por el driver local.
- `scripts/review-mongo-mcp.cjs`: cliente MCP reproducible; ejecutar `node scripts/review-mongo-mcp.cjs` y después `node scripts/review-mongo-mcp.cjs --details`. Usa la instalación 3.0.5 existente en la caché local de npm y los schemas compilados de `dist`; si cambian los schemas, compilar antes de repetir. No instala dependencias ni contiene operaciones de escritura a MongoDB.

No se modificaron datos, índices, validadores, configuración ni contenedores. La revisión está terminada; el saneamiento es trabajo separado porque requiere identificar valores académicos correctos. Durante la ejecución el repositorio cambió externamente a `edd8a7d` y desapareció el informe previo; este archivo documenta exclusivamente la comprobación actual y no restaura cambios de código ajenos.
