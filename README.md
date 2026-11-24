# LexCode · Backend

API REST de **LexCode** con **Next.js 16 (route handlers)**, **TypeScript**, **Supabase** (Auth, PostgreSQL, Storage) y **Zod**. El frontend la consume por HTTP con `Authorization: Bearer <accessToken>`.

La base de datos vive en el repositorio **LexCode-BD** (migraciones de Supabase). Este backend no crea tablas: usa las funciones, vistas y políticas RLS que están ahí.

## Arquitectura

Monolito modular por capas:

```
src/
  app/api/<módulo>/…/route.ts   Capa HTTP: valida la entrada (Zod), revisa la sesión y llama al servicio
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
npm run dev                       # http://localhost:4000/api/health
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

1. `POST /api/auth/login` → guarda `session.accessToken` y `session.refreshToken`.
2. Cada petición lleva `Authorization: Bearer <accessToken>`.
3. Si recibes `401 session_expired`, llama `POST /api/auth/refresh` con el `refreshToken` y repite la petición.
4. `GET /api/auth/me` dice el rol y el estado: `pending_guardian` → pantalla "esperando a tu tutor"; `deleted` → pantalla "recuperar cuenta".
5. Recuperar contraseña: el enlace del correo abre `<FRONTEND_URL>/auth/restablecer#access_token=…`. El frontend manda ese token a `POST /api/auth/password/reset`.
6. Autorización del tutor: el correo abre `<FRONTEND_URL>/autorizar-tutor?token=…`. El frontend manda el token a `POST /api/auth/guardian/confirm`.

## Endpoints (Persona A)

Todos bajo `/api`. 🔓 = sin sesión, 👤 = cualquier usuario activo, 🛡️ = admin.

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

## Cómo agregar un módulo (Persona B)

1. `src/modules/<módulo>/schemas.ts`: esquemas Zod de entrada.
2. `src/modules/<módulo>/service.ts`: funciones que reciben el `AuthContext` y usan `ctx.db` (RLS) o las funciones RPC de la base (`ctx.db.rpc('start_attempt', …)`).
3. `src/app/api/<ruta>/route.ts`:

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

Importa el repositorio en Vercel, configura las mismas variables de `.env.local` y agrega la URL del frontend en `CORS_ORIGINS` y `FRONTEND_URL`.
