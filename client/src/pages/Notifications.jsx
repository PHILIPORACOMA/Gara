import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as api from '../api/notifications.js';
import { notificationLink } from '../lib/notificationLink.js';
import { formatDateTime } from '../lib/dates.js';
import Button from '../components/Button.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Notifications() {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => api.listNotifications(100), []);

  if (loading) return <Spinner label="Loading notifications..." />;
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <ErrorState message={error} onRetry={reload} />
      </main>
    );
  }

  const readAll = async () => {
    setData((d) => ({ ...d, unreadCount: 0, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
    await api.markAllRead().catch(() => reload());
  };
  const open = (n) => {
    if (!n.read) api.markRead(n.id).catch(() => {});
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {data.unreadCount > 0 && (
          <Button variant="secondary" onClick={readAll}>
            Mark all read
          </Button>
        )}
      </div>

      {data.notifications.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No notifications yet" description="Updates about your bookings will show up here." />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {data.notifications.map((n) => (
            <li key={n.id}>
              <Link to={notificationLink(n, user.role)} onClick={() => open(n)} className={`block rounded-card p-4 shadow-card hover:bg-ink-50 ${n.read ? 'bg-white' : 'bg-brand-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-ink-900">
                    {n.title}
                    {!n.read && <span className="sr-only"> (unread)</span>}
                  </p>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />}
                </div>
                <p className="mt-1 text-sm text-ink-700">{n.body}</p>
                <p className="mt-1 text-xs text-ink-400">{formatDateTime(n.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
