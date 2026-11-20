# Gara roadmap (not in the MVP)

The MVP covers: auth, pro onboarding and verification, search, booking with a manual GCash
deposit, reviews, commission, in-app notifications and an admin dashboard.

Everything below is **deliberately not built yet**. The data model already leaves room for it
(noted per item) so none of it needs a rewrite.

## Booking and events

- **Event bundles.** Coordinate hair + makeup + nails from *different* pros in one schedule
  (weddings, debuts, graduations).
  *Hook:* `Booking` already owns many `BookingItem`s and has an optional `occasion`. Add an
  `EventBundle` table that groups several `Booking` rows, one per pro, with a shared date and a
  coordinated timeline.
- **Cancellation policy rules and deposit forfeiture automation.** Today a customer can cancel an
  active booking before it starts, and the admin handles the deposit by hand.
  *Hook:* `Booking.cancelledAt/cancelledById`, `refundNeeded`, `refundResolvedAt`.
- **Reschedule.** Let a customer move a booking to another slot without re-paying the deposit.
- **Pro replies to reviews.** One public reply per review.
  *Hook:* add `Review.proReply` and `Review.proRepliedAt`.

## Payments

- **Real GCash payments through a gateway** (e.g. PayMongo): automatic deposit confirmation,
  automatic refunds and pro payouts, replacing the manual reference-number check.
  *Hook:* `Booking.gcashRef`, `depositVerifiedAt`, `BookingEarning` (the payout record).
- **Pro payouts.** Today the dashboard only reports earnings (gross, commission, net).

## Communication

- **Automatic email/SMS reminders.** The MVP creates the day-before reminder as an in-app
  notification only.
  *Hook:* `Notification.dedupeKey` already makes scheduled sends idempotent; add a `channel` column
  and a delivery worker.
- **In-app chat** between customer and pro, one thread per booking.
- **Dispute and support tickets**, tied to a booking, with admin resolution.

## Discovery

- **Map-based search and travel radius by distance.** Today a pro lists the areas served and a
  fixed travel fee.
  *Hook:* add latitude/longitude to `ProfessionalProfile` and to `Booking`.
- **Profile-view tracking** to measure visitor-to-deposit conversion.
- **Expansion beyond Cebu City.** `AREAS` in `server/src/config/constants.js` is the one list to extend.

## Monetisation

- **Gara Pro subscription:** profile boost, booking analytics, shareable social-media booking links.
- **Featured listings and promotional placements.**
- **Referral promos.**

## Platform

- **Cloud image storage** (Cloudinary or S3). Uploads currently go to `server/uploads`.
  *Hook:* all file paths go through one upload helper.
- **Deployment** (Render or Railway for the API and database, Vercel or Netlify for the client).
- **httpOnly-cookie sessions** and refresh tokens (the MVP keeps the JWT in `localStorage`).
