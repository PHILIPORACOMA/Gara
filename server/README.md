# Gara server

Node.js + Express 5 API with Prisma (MySQL), JWT auth (bcrypt), Multer uploads, Zod validation
and Vitest tests. Plain JavaScript (ES modules).

## Structure

```
prisma/        schema.prisma, migrations/, seed.js (demo data)
src/
  config/      env (Zod-validated), constants (timezone, areas, statuses)
  routes/      thin: path -> middleware -> controller
  controllers/ read the request, call a service, send the response
  services/    ALL business logic
                 slots.js          pure scheduling (opening hours, conflicts, holds)
                 slots.service.js  loads the day's data for slots.js
                 pricing.js        deposit and commission math (centavos)
                 bookingStatus.js  the booking status machine
                 booking.service.js          create (transaction + row lock), deposit, cancel
                 bookingWorkflow.service.js  admin verify/reject, pro accept/decline/complete
                 review.service.js, notification.service.js, metrics.service.js,
                 maintenance.service.js (reminders, hold expiry), verification.service.js, ...
  middleware/  auth (JWT + roles), validate (Zod), upload (Multer), errorHandler, notFound
  validators/  Zod schemas
  jobs/        scheduler.js: node-cron, every 5 minutes
  utils/       ApiError, time (Asia/Manila), money (centavos), files
tests/         Vitest (unit + integration against a real MySQL test database)
uploads/       public/ (portfolio, QR)   private/ (ID images, GCash screenshots)
```

## Setup

```bash
npm install
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm run db:migrate          # creates the tables
npm run db:seed             # demo data (wipes the database first)
npm run dev                 # http://localhost:4310
```

See the root README for creating the MySQL database and the demo logins.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API with auto-reload (nodemon) |
| `npm start` | API, no reload |
| `npm test` | Vitest: unit tests plus integration tests on `DATABASE_URL_TEST` |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:migrate` | Create/apply migrations in development |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:seed` | Demo data. **Wipes all tables first.** Refuses to run in production |
| `npm run db:reset` | Drop everything, re-migrate, re-seed |

## Environment variables

See `.env.example`:

- `DATABASE_URL`: MySQL connection string.
- `DATABASE_URL_TEST`: a separate database used only by the integration tests (they wipe it, and
  refuse to run unless its name contains "test").
- `JWT_SECRET`, `JWT_EXPIRES_IN`: token signing.
- `CLIENT_ORIGIN`: allowed browser origin(s), comma separated.
- `UPLOAD_DIR`: where uploads are stored.
- `ALLOW_EARLY_COMPLETE`: demo switch. When `true`, a pro can mark a booking completed or no-show
  before the appointment starts. Keep `false` in production.

## API overview

Every error is `{ "error": { "code": "SLOT_TAKEN", "message": "...", "details": [...] } }`.
Throw an `ApiError` anywhere; `middleware/errorHandler.js` formats it.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Public | `GET /meta`, `GET /settings/public`, `GET /professionals`, `GET /professionals/:id`, `GET /professionals/:id/reviews`, `GET /professionals/:id/slots` |
| Customer | `POST /bookings/quote`, `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `POST /bookings/:id/deposit`, `POST /bookings/:id/cancel`, `POST /bookings/:id/review` |
| Professional | `/pro/profile`, `/pro/services`, `/pro/portfolio`, `/pro/availability`, `/pro/blocked-dates`, `/pro/verification`, `/pro/bookings` (+ `accept`, `decline`, `complete`, `no-show`), `/pro/calendar`, `/pro/dashboard`, `/pro/earnings` |
| Admin | `/admin/verifications` (+ `approve`, `reject`), `/admin/deposits`, `/admin/bookings` (+ `deposit/verify`, `deposit/reject`, `refund-resolved`), `/admin/metrics`, `/admin/settings`, `/admin/settings/qr` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all` |
| Files | `GET /files/private/id/:name`, `GET /files/private/deposit/:name` (role-checked) |

## Booking status flow

```
PENDING_DEPOSIT -> DEPOSIT_SUBMITTED -> DEPOSIT_VERIFIED -> CONFIRMED -> COMPLETED
                                                                      \-> NO_SHOW
(any active status) -> CANCELLED        DEPOSIT_VERIFIED -> DECLINED (refund needed)
```

Every change goes through `assertTransition()` in `services/bookingStatus.js`.
