# LexCode · Backend

API REST de **LexCode** con **Next.js 16 (route handlers)**, **TypeScript**, **Supabase** (Auth, PostgreSQL, Storage) y **Zod**. El frontend la consume por HTTP con `Authorization: Bearer <accessToken>`.

La base de datos vive en el repositorio **LexCode-BD** (migraciones de Supabase). Este backend no crea tablas: usa las funciones, vistas y políticas RLS que están ahí.

## Arquitectura

Monolito modular por capas:

```
src/
  app/api/v1/<módulo>/…/route.ts   Capa HTTP: valida la entrada (Zod), revisa la sesión y llama al servicio
  modules/<módulo>/             Lógica de negocio: schemas.ts (validación) y service.ts (casos de uso)
  lib/                          Piezas comunes (Etapa 0)
    auth.ts         requireAuth / requireAdmin: valida el token, carga el perfil, revisa rol y estado
    supabase.ts     anonClient (Auth), userClient (como el usuario, con RLS), serviceClient (omite RLS)
    errors.ts       AppError y traducción de errores de PostgreSQL / Supabase Auth / Zod
    http.ts         handler(): formato único de respuesta y manejo de errores
    validation.ts   parseBody / parseQuery / parseParam, paginación
    crypto.ts       Tokens firmados (enlace del tutor) y huella de IP
    mailer.ts       Correos con Resend (o consola en desarrollo)
  proxy.ts          CORS para el frontend
tests/              Pruebas de integración contra la API real
```

**Regla de oro:** casi todo se hace con `userClient` (la sesión del usuario), así la base aplica RLS y las funciones saben quién es (`auth.uid()`). `serviceClient` (llave `service_role`) solo se usa después de revisar permisos en el backend: registro, autorización del tutor, suspensión de cuentas y cerrar sesión.

### Formato de respuesta

```jsonc
// Éxito
{ "data": { … } }
// Error
{ "error": { "code": "username_taken", "message": "Ese nombre de usuario ya está en uso", "details": { "fields": { … } } } }
```

| HTTP | Cuándo | Ejemplos de `code` |
|---|---|---|
| 400 | Datos inválidos | `invalid_request` (con `details.fields`), `wrong_password`, `invalid_token` |
| 401 | Sin sesión o sesión vencida | `unauthorized`, `session_expired`, `invalid_credentials` |
| 403 | Sin permiso o cuenta no activa | `forbidden`, `account_pending_guardian`, `account_suspended`, `account_deleted`, `recovery_required` |
| 404 | No existe | `not_found` |
| 409 | Duplicado | `username_taken`, `user_already_exists` |
| 422 | Regla de negocio (mensajes de la base) | `business_rule`, `underage` |
| 429 | Demasiados intentos | `over_request_rate_limit` |

## Configuración (Windows)

```bash
npm install
copy .env.example .env.local      # y llena los valores
npm run dev                       # http://localhost:4000/api/v1/health
```

Variables (`.env.local`):

| Variable | Dónde se obtiene |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Misma página. **Secreta**: solo en el servidor, nunca en el frontend ni en Git |
| `FRONTEND_URL` | URL del frontend (enlaces de los correos) |
| `CORS_ORIGINS` | Orígenes que pueden llamar a la API, separados por coma |
| `APP_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `RESEND_API_KEY`, `MAIL_FROM` | Resend. Sin llave, los correos se imprimen en la consola |

En **Supabase → Authentication → URL Configuration** agrega a *Redirect URLs*: `<FRONTEND_URL>/auth/confirmado` y `<FRONTEND_URL>/auth/restablecer`.

## Flujo de sesión para el frontend

1. `POST /api/v1/auth/login` → guarda `session.accessToken` y `session.refreshToken`.
2. Cada petición lleva `Authorization: Bearer <accessToken>`.
3. Si recibes `401 session_expired`, llama `POST /api/v1/auth/refresh` con el `refreshToken` y repite la petición.
4. `GET /api/v1/auth/me` dice el rol y el estado: `pending_guardian` → pantalla "esperando a tu tutor"; `deleted` → pantalla "recuperar cuenta".
5. Recuperar contraseña: el enlace del correo abre `<FRONTEND_URL>/auth/restablecer#access_token=…`. El frontend manda ese token a `POST /api/v1/auth/password/reset`.
6. Autorización del tutor: el correo abre `<FRONTEND_URL>/autorizar-tutor?token=…`. El frontend manda el token a `POST /api/v1/auth/guardian/confirm`.

## Endpoints (Persona A)

Todos bajo `/api/v1` (versión 1 de la API; un cambio incompatible iría en `/api/v2`). 🔓 = sin sesión, 👤 = cualquier usuario activo, 🛡️ = admin.

### Autenticación
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/health` | 🔓 | Estado del servicio |
| POST | `/auth/register` | 🔓 | `{ fullName, username, email, password, birthDate, guardianEmail?, acceptPrivacy, acceptTerms, secondaryPurposes? }` |
| GET | `/auth/username-available?username=` | 🔓 | Validación del formulario |
| POST | `/auth/login` | 🔓 | `{ email, password }` → `{ session, profile }` |
| POST | `/auth/refresh` | 🔓 | `{ refreshToken }` |
| POST | `/auth/logout` | 👤 | Cierra la sesión actual |
| GET | `/auth/me` | 👤 | Perfil de la sesión (también si está pendiente o eliminada) |
| POST | `/auth/password/forgot` | 🔓 | `{ email }` |
| POST | `/auth/password/reset` | Token del correo | `{ password }` |
| POST | `/auth/guardian/confirm` | 🔓 | `{ token }` del correo al tutor |
| POST | `/auth/guardian/resend` | Pendiente | Reenvía el correo al tutor |

### Perfil
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/profile` | 👤 | Perfil completo (el avatar llega como URL firmada por 1 hora) |
| PATCH | `/profile` | 👤 | `{ fullName?, username?, major?, semester?, studentNumber?, interestArea?, untimedMode? }` |
| POST | `/profile/avatar` | 👤 | `multipart/form-data`, campo `avatar` (JPG/PNG/WebP, 2 MB) |
| DELETE | `/profile/avatar` | 👤 | Quita la foto |
| PATCH | `/profile/password` | 👤 | `{ currentPassword, newPassword }` |

### Privacidad y ARCO
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/privacy/documents` | 🔓 | Aviso y Términos vigentes e historial |
| GET / POST | `/privacy/consents` | 👤 | Consentimientos; `{ type: "secondary_purposes" \| "public_rankings" \| …, granted }` |
| GET / POST | `/privacy/arco` | 👤 | Mis solicitudes; `{ right, description, contactEmail? }` → folio y fecha límite |
| GET | `/privacy/export` | 👤 | Descarga `lexcode-mis-datos-AAAA-MM-DD.json` |
| DELETE | `/privacy/account` | 👤 | Elimina la cuenta (30 días para recuperarla) |
| POST | `/privacy/account/restore` | Eliminada | Recupera la cuenta |

### Lexis
| Método | Ruta | | Descripción |
|---|---|---|---|
| POST | `/lexis/ask` | 👤 | `{ text, moduleId? }` → `{ messageId, found, expression, body, legalReference, glossarySlug, suggestions }` |
| GET | `/lexis/suggestions?moduleId=` | 👤 | Preguntas sugeridas |
| GET / DELETE | `/lexis/history` | 👤 | Historial paginado / borrarlo |
| POST | `/lexis/messages/:id/feedback` | 👤 | `{ helpful }` |

### Glosario y búsqueda
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/glossary?q=&category=&letter=` | 👤 | Términos (búsqueda sin acentos, tolera errores de dedo) + letras disponibles |
| GET | `/glossary/categories` | 👤 | Categorías con conteo |
| GET | `/glossary/:slug` | 👤 | Detalle con referencia legal |
| GET | `/search?q=&limit=` | 👤 | Glosario, módulos, dilemas y temas de Lexis |

### Administración 🛡️
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/admin/users?role=&status=&q=&page=&pageSize=` | Usuarios |
| GET | `/admin/users/:id` | Detalle y consentimientos |
| PATCH | `/admin/users/:id/role` | `{ role }`: así se crean docentes y admins |
| PATCH | `/admin/users/:id/status` | `{ status: "active" \| "suspended" }`: también bloquea el login |
| GET / PATCH | `/admin/reports`, `/admin/reports/:id` | Reportes de contenido o conducta |
| GET / PATCH | `/admin/arco`, `/admin/arco/:id` | Atender solicitudes ARCO `{ status, response }` |
| POST / PATCH / DELETE | `/admin/glossary`, `/admin/glossary/:id` | Glosario |
| GET / POST / PATCH / DELETE | `/admin/lexis/topics`, `/admin/lexis/topics/:id` | Temas de Lexis |
| POST | `/admin/lexis/topics/:id/answers` | Nueva versión de la respuesta (la anterior queda en el historial) |
| GET | `/admin/lexis/unanswered` | Preguntas sin respuesta (agregadas, sin autor) |
| POST | `/admin/legal-documents` | Nueva versión del Aviso o de los Términos |
| GET | `/admin/audit?table=&action=&actorId=&recordId=` | Bitácora |

## Endpoints (Persona B)

Mismas convenciones que arriba. 🎓 = estudiante, 👩‍🏫 = docente (o admin).

### Contenido
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/paths` | 👤 | Rutas publicadas con módulos y estado (`locked` · `available` · `in_progress` · `completed`) |
| GET | `/modules/:id` | 👤 | Módulo con su contenido JSON; `403 module_locked` si falta el requisito |
| GET | `/dilemmas`, `/dilemmas/:id` | 👤 | Dilemas con estado `active`/`locked`/`completed`; el detalle no revela la opción esperada |
| GET | `/quizzes?moduleId=&groupId=`, `/quizzes/:id` | 👤 | Quizzes y preguntas **sin** la respuesta correcta |
| POST | `/quizzes` | 👩‍🏫 🛡️ | Docente: `{ groupId, … }` para su grupo. Admin: `{ moduleId, … }` oficial. Incluye `questions[]` con `options[]` y `isCorrect` |
| GET | `/quizzes/:id/edit` | 👩‍🏫 🛡️ | Quiz con respuestas correctas |
| PATCH / DELETE | `/quizzes/:id` | 👩‍🏫 🛡️ | Editar (si envía `questions`, las reemplaza; `409 quiz_has_attempts` si ya hay intentos) / borrar |
| GET / POST | `/admin/paths` · PATCH / DELETE `/admin/paths/:id` | 🛡️ | Rutas; `isPublished` publica |
| PUT | `/admin/paths/:id/modules/order` | 🛡️ | `{ moduleIds: [...] }` en el orden deseado |
| POST · PATCH / DELETE | `/admin/modules` · `/admin/modules/:id` | 🛡️ | Módulos: contenido, `prerequisiteId`, publicación |
| GET / POST | `/admin/dilemmas` · GET / PATCH / DELETE `/admin/dilemmas/:id` | 🛡️ | Dilemas con `options[]` (consecuencia, sanción, referencia legal) |
| PUT | `/admin/dilemmas/weekly` | 🛡️ | `{ dilemmaId, weekStart }` |

### Grupos y aula
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET / POST | `/groups` | 👤 / 👩‍🏫 | Mis grupos / crear grupo (devuelve `invite_code` de 8 caracteres) |
| POST | `/groups/join` | 🎓 | `{ inviteCode }` |
| GET / PATCH | `/groups/:id` | 👤 / 👩‍🏫 | Detalle con alumnos y progreso / editar o cerrar con `{ isActive: false }` |
| DELETE | `/groups/:id/members/me` | 🎓 | Salir del grupo |
| DELETE | `/groups/:id/members/:studentId` | 👩‍🏫 | Quitar a un alumno |
| POST | `/groups/:id/comments` · GET `/comments` | 👩‍🏫 / 👤 | Comentarios del docente |

### Evaluación (quiz, dilema, memorama, completar frases)
Flujo: `POST /attempts` → `POST /attempts/:id/answers` (varias veces) → `POST /attempts/:id/finish`.

| Método | Ruta | | Descripción |
|---|---|---|---|
| POST | `/attempts` | 🎓 | `{ activity, targetId }`. Valida intentos, fecha límite y desbloqueo. Si hay uno abierto, lo **retoma** (`resumed`, `answered`, `timer`) |
| GET | `/attempts`, `/attempts/:id` | 🎓 | Historial / estado de un intento |
| POST | `/attempts/:id/answers` | 🎓 | Quiz `{ questionId, optionId\|null, timeMs }` · dilema `{ optionId, justification?, timeMs }` · completar frases `{ itemId, text, timeMs }` · memorama `{ matches: [{ concept, definition }], timeMs }` |
| POST | `/attempts/:id/finish` | 🎓 | `{ score, correct, total, xpEarned, xpTotal, level, currentStreak, newBadges, certificateFolio }` |
| GET | `/admin/cheats` | 🛡️ | Quizzes con calificación ≥ 90 y menos de 1.5 s por respuesta (solo marca) |
| POST | `/admin/cheats/:attemptId/confirm` | 🛡️ | Una persona confirma: anula el XP del intento y revoca la constancia de la ruta |

### Centro de entrenamiento
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/activities` | 👤 | Auditoría rápida (quizzes oficiales), memorama y código incompleto |
| GET | `/activities/memory-match/:moduleId` | 👤 | `concepts` y `definitions` mezclados por separado |
| GET | `/activities/fill-blank/:moduleId` | 👤 | Frases con hueco y opciones, sin la respuesta |
| GET / PUT | `/modules/:id/memory-pairs`, `/modules/:id/fill-blank-items` | 👩‍🏫 🛡️ | Editar el juego (docente: solo módulos de su grupo) |

### Progreso, gamificación, constancias y dashboards
| Método | Ruta | | Descripción |
|---|---|---|---|
| GET | `/progress?studentId=` | 👤 | Avance por ruta y módulo (docente: de un alumno suyo) |
| GET | `/progress/modules/:id` | 🎓 | ¿Desbloqueado?, estado y porcentaje |
| GET | `/badges` | 👤 | Insignias obtenidas y bloqueadas con su requisito |
| GET | `/gamification/summary`, `/gamification/xp` | 👤 / 🎓 | XP, nivel, rachas, actividad diaria / movimientos de XP |
| GET | `/rankings/group/:groupId`, `/rankings/public` | 👤 | Ranking semanal del grupo / ranking de quienes lo activaron |
| GET | `/certificates` | 🎓 | Mis constancias |
| GET | `/certificates/:id/download` | 🎓 | `{ url }` firmada (5 min); el PDF se genera la primera vez |
| GET | `/certificates/verify/:folio` | 🔓 | Verificación pública por folio |
| GET · PATCH | `/admin/certificates` · `/admin/certificates/:id` | 🛡️ | Listar / `{ revoked }` |
| GET | `/dashboard/student` | 🎓 | XP, nivel, racha, misiones, dilema recomendado, rutas, actividad y logros |
| GET | `/dashboard/teacher?groupId=` | 👩‍🏫 | Alumnos, promedio con tendencia, simulaciones por revisar, gráfica y últimas entregas |
| GET | `/dashboard/stats/questions?quizId=`, `/dashboard/stats/paths` | 👩‍🏫 | Estadísticas anonimizadas |
| GET | `/reminders` | 🎓 | Racha por vencer y dilema de la semana (vacío sin consentimiento de usos opcionales) |

**Notas de diseño**
- XP, rachas, insignias, desbloqueo de módulos, cierre de ruta y emisión de constancias viven en la base (`finish_attempt`); el backend solo las llama. Por eso no hay endpoints para escribir progreso o XP.
- `timeMs` lo manda el cliente. En quizzes con tiempo límite se corrige con el reloj del servidor (se tolera 30 s de lectura de retroalimentación entre respuestas), y el modo sin límite de tiempo se respeta.
- En el memorama, concepto y definición de una pareja comparten id (así valida la base), por lo que un cliente malicioso podría emparejar sin jugar. Por eso las anomalías pasan a la cola de `/admin/cheats` y nada se anula sin que una persona lo confirme.
- Este backend **no requiere migraciones nuevas**. Lo que `authenticated` no puede escribir (rutas, dilemas y sus opciones) o leer (respuestas agregadas, opción correcta al editar) se hace con `serviceClient()`, siempre tras `requireAdmin` o una verificación de permiso en el servicio.
- La cola de trampas se calcula al vuelo y no guarda decisiones: al confirmar, el intento queda con `xp_earned = 0` y sale de la lista. «Descartar» no se persiste.

## Cómo agregar un módulo (Persona B)

1. `src/modules/<módulo>/schemas.ts`: esquemas Zod de entrada.
2. `src/modules/<módulo>/service.ts`: funciones que reciben el `AuthContext` y usan `ctx.db` (RLS) o las funciones RPC de la base (`ctx.db.rpc('start_attempt', …)`).
3. `src/app/api/v1/<ruta>/route.ts`:

```ts
import { requireAuth } from '@/lib/auth';
import { handler } from '@/lib/http';
import { parseBody } from '@/lib/validation';
import { startSchema } from '@/modules/assessment/schemas';
import { start } from '@/modules/assessment/service';

export const POST = handler(async (req) => {
  const ctx = await requireAuth(req, { roles: ['student'] });
  return start(ctx, await parseBody(req, startSchema));
});
```

Los errores de la base (`P0001`, `42501`…) se traducen solos al formato estándar, así que no hace falta atraparlos.

## Pruebas

Son pruebas de integración contra la API real. Necesitan un Supabase **local o de pruebas** con `supabase/seed.sql` del repositorio BD, porque crean usuarios y cambian roles. **Nunca contra producción**: por eso solo corren contra `localhost`.

```bash
# En LexCode-BD (requiere Docker):  npx supabase start  &&  npx supabase db reset
# En este repo, con .env.local apuntando al Supabase local:
npm run dev
npm test
```

También: `npm run typecheck`, `npm run lint`, `npm run build`.

## Despliegue (Vercel)

Importa el repositorio en Vercel, configura las mismas variables de `.env.local` y agrega la URL del frontend en `CORS_ORIGINS` y `FRONTEND_URL`. Comprueba el despliegue en `https://<backend>.vercel.app/api/v1/health`.
