# Gara client

React 19 + Vite + React Router + Tailwind CSS 4 + Axios. Mobile-first.

## Setup

```bash
npm install
cp .env.example .env     # VITE_API_URL points at the API
npm run dev              # http://localhost:5310 (strictPort; see vite.config.js)
npm run build            # production build into dist/
npm run lint             # ESLint: undefined variables, unused imports, hook rules
```

## Branding

All colors, fonts and radii live in **`src/theme/theme.css`** (a Tailwind `@theme` block).
Components only use the tokens (`bg-brand-500`, `text-ink-700`, `font-display`, `rounded-card`),
so applying the brand book means editing that one file. If you change a font, also update the
Google Fonts `<link>` in `index.html`.

## Structure

```
src/
  theme/       theme.css (brand tokens)
  api/         axios instance + one module per resource
  auth/        AuthContext, ProtectedRoute (by role)
  hooks/       useAsync (loading/error/data), useMeta, useCountdown
  components/  shared UI: Button, Field, Tabs, BookingCard, PriceBreakdown, NotificationBell, ...
  pages/       route-level screens (customer), pro/ (professional), admin/
  lib/         money.js (₱ formatting), dates.js (Asia/Manila), labels, filters
```

Money is shown with `formatPeso()` and all dates and times with `lib/dates.js`, which always
uses Asia/Manila whatever the device timezone is. Every data screen has loading, empty and error
states, and forms show field-level validation messages (client-side first, then the server's).

## Routes

| Path | Who |
| --- | --- |
| `/`, `/search`, `/pros/:id`, `/login`, `/register` | everyone |
| `/pros/:id/book`, `/bookings`, `/bookings/:id` | customers |
| `/pro`, `/pro/bookings`, `/pro/earnings`, `/pro/profile`, `/pro/services`, `/pro/portfolio`, `/pro/availability`, `/pro/verification` | professionals |
| `/admin`, `/admin/verifications`, `/admin/deposits`, `/admin/bookings`, `/admin/settings` | admin |
| `/notifications` | any signed-in user |

Route guards only keep people out of screens they cannot use; the server enforces the same rules.
