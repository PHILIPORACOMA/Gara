# Gara

Discovery and connection platform for hairstyling, nail and makeup professionals in Cebu City
(team workbook v3). Customers find verified pros by service, area, date and price, compare
portfolios, prices, home-service fees and availability, then contact the pro in one tap on
Messenger, by call or by SMS. **Gara does not handle bookings or payments**: customers and pros
agree on the details directly.

> The earlier booking version (GCash deposits, commission, reviews) is still in the code, switched
> off by `FEATURE_BOOKINGS=false` / `VITE_FEATURE_BOOKINGS=false`. Git tag `booking-mvp` holds it
> as it was before the pivot.

Monorepo with two separate apps:

- [`/server`](server/README.md): Node.js, Express, Prisma, MySQL
- [`/client`](client/README.md): React, Vite, Tailwind CSS

Features not built yet are listed in [ROADMAP.md](ROADMAP.md).

## What it does

| Role | Can do |
| --- | --- |
| **Visitor** | Search verified pros (category, area, date, price, home service), open a profile: portfolio, services and prices, home-service fee, areas served, weekly availability and blocked dates |
| **Customer** (signed in) | Everything a visitor can, plus tap **Messenger**, **Call** or **SMS** on a profile. Contact links are only revealed to signed-in customers, and every tap is counted |
| **Professional** | Register, set up a profile (services, prices, areas, home-service fee, portfolio, availability, Messenger link and/or mobile number), submit an ID for verification, see profile views and contact taps for the last 7 and 30 days |
| **Admin** | Verify professionals, and watch the workbook metrics: verified pros per service, searches, profile views, contacts by channel, search-to-contact rate, pros updating availability weekly, returning customers |

## Requirements

- Node.js 20.19 or newer
- MySQL 8 running locally (or in Docker)

## Setup

### 1. Install

```bash
npm install                # root only: the `concurrently` helper for `npm run dev`
npm run install:all        # installs /server and /client
```

### 2. Create the database

Open a MySQL shell (`mysql -u root -p`, or MySQL Workbench) and run:

```sql
CREATE DATABASE gara CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

The integration tests use a second database, `gara_test`. The test run creates it for you if the
`DATABASE_URL_TEST` user is allowed to, or you can create it the same way.

`prisma migrate dev` creates a temporary "shadow" database, so the MySQL user in `DATABASE_URL`
must be allowed to `CREATE DATABASE` (the local `root` user is).

No local MySQL? Run one in Docker:

```bash
docker run --name gara-mysql -e MYSQL_ROOT_PASSWORD=gara -e MYSQL_DATABASE=gara -p 3306:3306 -d mysql:8
```

### 3. Configure

```bash
cp server/.env.example server/.env     # then set DATABASE_URL and JWT_SECRET
cp client/.env.example client/.env     # the defaults work for local development
```

On Windows PowerShell use `Copy-Item` instead of `cp`. **Never commit `.env` files.**
Generate a `JWT_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
If your MySQL password contains `@ : / # ?`, URL-encode those characters in `DATABASE_URL`.

### 4. Migrate and seed

```bash
npm run db:migrate         # creates all tables
npm run db:seed            # demo admin, customers, verified pros, bookings and reviews
```

> **The seed wipes every table first**, so it always starts from the same state. Use it on a
> development database only (it refuses to run when `NODE_ENV=production`).

### 5. Run both apps

```bash
npm run dev                # API on http://localhost:4310, client on http://localhost:5310
```

Open **http://localhost:5310**. Or in two terminals: `npm --prefix server run dev` and
`npm --prefix client run dev`.

Gara deliberately uses uncommon ports so it does not collide with other local projects (the usual
Vite ports 5173-5175 are often taken). The client uses `strictPort`, so it fails loudly instead of
silently moving. To change ports, edit `PORT` and `CLIENT_ORIGIN` in `server/.env`, `VITE_API_URL`
and `VITE_UPLOADS_URL` in `client/.env`, and `server.port` in `client/vite.config.js`.

## Demo logins

Every demo account uses the password **`Gara1234!`**

| Role | Email | Notes |
| --- | --- | --- |
| Admin | `admin@gara.test` | Verification queue and discovery metrics |
| Customer | `ana@gara.test`, `ben@gara.test`, `carla@gara.test` | Can tap Messenger, Call and SMS on profiles |
| Pro (hair) | `mara@gara.test`, `jun@gara.test` | |
| Pro (nails) | `lia@gara.test`, `chelsea@gara.test` | |
| Pro (makeup) | `bea@gara.test`, `kiko@gara.test` | Kiko's availability is "overdue", so his dashboard shows the reminder |
| Pro (all three) | `tin@gara.test` | Hair, makeup and nails |
| Pro (hair + makeup) | `sofia@gara.test` | |
| Pro (pending) | `dani@gara.test` | Waiting in the admin verification queue |

The seed also adds 30 days of demo searches, profile views and contact taps so the dashboards are
not empty. **The seeded Messenger links (`m.me/gara.demo.*`) and phone numbers (`+63900000000x`)
are fictional: do not tap Call or SMS on a real phone with demo data.**

## Try the flow (matches the workbook usability tests)

1. **Pro onboarding (Test 3):** register at `/register?role=professional`. Fill in Profile
   (including a Messenger link and/or mobile number), Services, Portfolio and Availability, upload
   an ID on Verification and submit. The Overview checklist shows what is left. Log in as
   `admin@gara.test`, open **Verifications** and approve.
2. **Find and contact (Test 1):** open **Find a pro**, filter by service, area, date and budget,
   open a pro, then tap **Messenger**, **Call** or **SMS**. Visitors are asked to log in first.
3. **Proof of value:** the pro's Overview shows profile views and contact taps for the last 7 and
   30 days. The admin Overview shows searches, views, contacts and the search-to-contact rate.

## Tests

```bash
npm test                   # all server tests (needs MySQL running)
npm run lint               # client lint (catches undefined variables and hook mistakes)
```

The server suite covers contact-link validation, the contact rules (signed-in customers only,
links never in public responses, only channels the pro set up), view and search tracking, the
discovery metrics, the onboarding checklist, and slot and availability logic. The booking code
that is switched off keeps its tests too (pricing, status machine, review rule, and
**double-booking prevention under concurrent requests** on a real MySQL database), so it stays
correct if bookings are turned back on. Integration tests use the separate `gara_test` database,
wipe it, and refuse to run against any database whose name does not contain "test".

## Turning bookings back on

Set `FEATURE_BOOKINGS=true` in `server/.env` and `VITE_FEATURE_BOOKINGS=true` in
`client/.env`, then restart both apps. That brings back the booking flow, GCash deposits,
commission, reviews, the deposit and booking admin pages, and the scheduled jobs. Set
`ALLOW_EARLY_COMPLETE=true` for demos so a pro can complete a booking before its start time.

## How it is built

- **Contact without middlemen.** Profiles say which buttons exist; the Messenger link or number is
  returned only by `POST /api/professionals/:id/contact` to a signed-in customer, which also logs
  the tap. Profile views and Find-a-pro searches are logged for the metrics.
- **Double-booking prevention** (bookings version). Creating a booking runs in a database transaction that first
  locks the professional's row (`SELECT ... FOR UPDATE`), re-checks the time against opening
  hours, blocked dates and other bookings, then inserts. Concurrent requests queue on the lock,
  so exactly one wins (proved by the integration test).
- **Slots are calculated on the server** from weekly hours minus blocked dates minus active
  bookings, for the total duration of the chosen services. An unpaid booking holds its slot for
  2 hours (a setting), then the slot opens again.
- **Money** is `DECIMAL(10,2)` in MySQL and integer centavos in code. Deposit and commission rates
  are copied onto each booking, so changing a setting never rewrites agreed bookings. The travel
  fee is never commissioned.
- **Time** is stored in UTC and always interpreted and displayed in Asia/Manila.
- **Privacy.** ID images and GCash screenshots live in `server/uploads/private` and are served only
  through a role-checked route (never statically).
- **Business logic** lives in `server/src/services`, not in routes or controllers.
- **Branding.** All colors, fonts and radii are in `client/src/theme/theme.css`.

## Troubleshooting

- **`Authentication failed` from Prisma.** `DATABASE_URL` in `server/.env` has the wrong password
  (URL-encode special characters).
- **Port already in use.** See the port note above.
- **Windows: `EPERM ... query_engine-windows.dll.node`** when running `prisma generate`. A running
  API holds the file. Stop `npm run dev`, run the command, start it again.
- **`prisma migrate dev` says the environment is non-interactive.** Run it from `server/`, in a
  normal terminal. Apply existing migrations with `npm run db:deploy`.
