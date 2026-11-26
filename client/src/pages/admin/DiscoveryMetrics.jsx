// Admin metrics for the discovery version (workbook v3 success criteria).
const pct = (rate) => (rate == null ? '–' : `${Math.round(rate * 1000) / 10}%`);

function Card({ title, value, hint }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export default function DiscoveryMetrics({ m }) {
  const d = m.last30Days;
  const { HAIR, NAILS, MAKEUP } = m.verifiedPros.perCategory;
  return (
    <div className="space-y-5">
      <section aria-labelledby="supply-heading">
        <h2 id="supply-heading" className="text-xl font-semibold">
          Pros
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card title="Verified pros" value={m.verifiedPros.total} hint={`Hair ${HAIR} · Nails ${NAILS} · Makeup ${MAKEUP} (target 20 each)`} />
          <Card title="Waiting for verification" value={m.verifiedPros.pending} hint="In the verification queue" />
          <Card title="Updated availability this week" value={pct(m.availabilityUpdatedWeekly.rate)} hint={`${m.availabilityUpdatedWeekly.pros} of ${m.availabilityUpdatedWeekly.of} verified pros (target 70%)`} />
          <Card title="Customer accounts" value={m.customers} />
        </div>
      </section>

      <section aria-labelledby="funnel-heading">
        <h2 id="funnel-heading" className="text-xl font-semibold">
          Last 30 days
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card title="Searches" value={d.searches} hint="On the Find a pro page" />
          <Card title="Profile views" value={d.profileViews} />
          <Card title="Contacts" value={d.contacts.total} hint={`Messenger ${d.contacts.MESSENGER} · Call ${d.contacts.CALL} · SMS ${d.contacts.SMS}`} />
          <Card title="Search-to-contact rate" value={pct(d.searchToContactRate)} hint="Contacts per search (target 20%)" />
          <Card title="View-to-contact rate" value={pct(d.viewToContactRate)} hint="Contacts per profile view" />
          <Card
            title="Returning customers"
            value={pct(m.returningCustomers.rate)}
            hint={`${m.returningCustomers.returning} of ${m.returningCustomers.of} contacted pros on 2+ days in 90 days (target 25%)`}
          />
        </div>
      </section>
    </div>
  );
}
