# Gara

On-demand booking and trust platform for hairstyling, nail and makeup services in Cebu City.
Customers book verified beauty professionals; professionals manage their bookings in one place;
the Gara team verifies professionals and deposits.

Monorepo with two separate apps:

- [`/server`](server/README.md): Node.js, Express, Prisma, MySQL
- [`/client`](client/README.md): React, Vite, Tailwind CSS

Features not built yet are listed in [ROADMAP.md](ROADMAP.md).

## What it does

| Role | Can do |
| --- | --- |
| **Customer** | Search verified pros (category, date, area, price, home service), view portfolios and reviews, book one or more services from one pro (home service or in-store), see the full price before confirming, pay the deposit by GCash, track bookings, leave a review after the appointment |
| **Professional** | Register, build a profile with services and portfolio, set weekly hours and blocked dates, submit an ID for verification, accept or decline requests, mark bookings completed or no-show, see earnings (gross, commission, net) |
| **Admin** | Verify professionals and GCash deposits, see all bookings and refunds needed, watch the key metrics, edit deposit %, commission % and the GCash details |

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
| Admin | `admin@gara.test` | Queues, metrics, settings |
| Customer | `ana@gara.test` | Has completed, upcoming and awaiting bookings |
| Customer | `ben@gara.test` | Has a deposit waiting for admin verification |
| Customer | `carla@gara.test` | Has a booking waiting for the pro |
| Pro (hair) | `mara@gara.test` | Mara Reyes Hair Studio: 1 request to accept, 1 confirmed booking |
| Pro (hair) | `jun@gara.test` | In-store only |
| Pro (nails) | `lia@gara.test` | Home service only |
| Pro (nails) | `chelsea@gara.test` | In-store only |
| Pro (makeup) | `bea@gara.test` | Bridal and debut makeup |
| Pro (makeup) | `kiko@gara.test` | Home service only |
| Pro (all three) | `tin@gara.test` | Hair, makeup and nails: book several categories at once |
| Pro (hair + makeup) | `sofia@gara.test` | |
| Pro (pending) | `dani@gara.test` | Waiting in the admin verification queue |

The seed also leaves one declined booking that needs a refund (admin: Bookings, filter "Refund needed").

## Try the full flow

1. **Pro:** register at `/register?role=professional`, fill in Profile, Services, Portfolio and
   Availability, then upload an ID on Verification and submit. Log in as `admin@gara.test`, open
   **Verifications** and approve.
2. **Customer:** log in as `ana@gara.test`, search, open a pro, tap **Book**. Pick two services and
   **Home service**, enter an address, pick a date and time. The price breakdown shows services +
   travel fee = total, the deposit and the balance. Confirm, then on the payment screen enter a
   GCash reference number and upload any image as the screenshot.
3. **Admin:** **Deposits**, check the payment, **Verify deposit**. **Pro:** **Bookings**, **Accept**,
   then **Mark completed**.
4. **Customer:** open the booking and leave a review. It appears on the pro's profile as a
   "Verified booking".
5. **Pro:** **Earnings** shows gross, the 10% commission and net. **Admin:** the Overview metrics
   include the commission.

> A pro can normally mark a booking completed only after the appointment starts. For demos,
> `ALLOW_EARLY_COMPLETE=true` in `server/.env` lifts that so step 3 works without waiting. It is
> `false` in `.env.example`.

## Tests

```bash
npm test                   # all server tests (needs MySQL running)
npm run lint               # client lint (catches undefined variables and hook mistakes)
```

The server suite covers slot calculation, deposit and commission math, the booking status machine,
the review-only-after-completion rule, and (against the real `gara_test` MySQL database)
**double-booking prevention under concurrent requests**, the full booking flow, ratings, scheduled
jobs and metrics. The integration tests wipe `gara_test` and refuse to run against any database
whose name does not contain "test". If MySQL is unreachable they are skipped with a message and the
unit tests still run.

## How it is built

- **Double-booking prevention.** Creating a booking runs in a database transaction that first
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
