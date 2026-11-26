# Gara roadmap

Gara is a **discovery and contact** platform (team workbook v3): customers find verified
hairstylists, nail technicians and makeup artists in Cebu and contact them directly on Messenger,
by call or by SMS. Gara does not handle bookings or payments.

Built now: search (service, area, date, price, home service), verified profiles (ID check by the
Gara team), portfolio, services and prices, home-service fees, service areas, availability,
one-tap contact for signed-in customers, profile-view and contact tracking, pro insights, and the
admin verification queue and metrics.

## Year 1, from the workbook timeline

### Q1: Test and launch
- Usability tests (pro onboarding, customer find-and-contact, Gara vs Facebook), then fix issues.
- Contact-click tracking: **done** (contact taps, profile views and searches are logged).
- Launch with 30 verified pros. Free listing, face-to-face recruitment, team-assisted setup.

### Q2: Grow supply (60 pros, 1,500 contacts)
- **Weekly reminders** to pros whose availability is more than 7 days old (email/SMS). The
  dashboard already shows an in-app reminder; `availabilityUpdatedAt` is stored.
- **Shareable profile links** for pros' Facebook and Instagram pages (a short `gara.ph/<name>` URL
  that opens their profile).

### Q3: Grow demand (80 pros, 3,000 contacts)
- **Occasion searches** (weddings, graduations, debuts) for hair, makeup and nails on one date.
  *Hook:* the `Occasion` enum already exists in the schema.
- Referral promos; event and school partnerships.

### Q4: Monetize (100 pros, 5,000 contacts)
- **Gara Pro** subscription: profile boost in search plus profile-view and contact analytics.
  *Hook:* `ProfileView` and `ContactEvent` already hold the data; the free dashboard shows 7/30-day
  totals.
- **Featured listings** and promoted placements in search.
- **Ads** from local beauty brands and suppliers.
- **Remove inactive profiles** (no availability update or contact in N weeks).

## Later
- Map-based search and travel radius by distance (add latitude/longitude to profiles).
- Expansion beyond Cebu City. `AREAS` in `server/src/config/constants.js` is the one list to extend.
- Cloud image storage (Cloudinary or S3) and deployment (the client already has `vercel.json`).
- httpOnly-cookie sessions and refresh tokens (the MVP keeps the JWT in `localStorage`).

## Parked: the booking version

The first MVP took bookings with a manual GCash deposit, a 10% commission and reviews tied to
completed bookings. Workbook v3 dropped that model. The code is still here behind
`FEATURE_BOOKINGS` / `VITE_FEATURE_BOOKINGS` (off), with its tests, and git tag `booking-mvp`
marks the version before the pivot. Its own follow-ups (event bundles across pros, PayMongo
payments, automatic refunds and payouts, cancellation rules, disputes, in-app chat) are on hold
unless the business model changes back.
