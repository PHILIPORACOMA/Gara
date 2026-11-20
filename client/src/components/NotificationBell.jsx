import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import * as api from '../api/notifications.js';
import { notificationLink } from '../lib/notificationLink.js';
import { formatDateTime } from '../lib/dates.js';
import Spinner from './Spinner.jsx';

const POLL_MS = 30_000;

// The bell in the header: unread count, a dropdown of the latest notifications, mark as read.
// It checks for new ones every 30 seconds while the tab is visible (no websockets in the MVP).
export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const wrapRef = useRef(null);

  const refreshCount = useCallback(() => {
    api.getUnreadCount().then(setUnread).catch(() => {});
  }, []);

  const loadItems = useCallback(async () => {
    setError(false);
    try {
      const data = await api.listNotifications(10);
      setItems(data.notifications);
      setUnread(data.unreadCount);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const tick = () => document.visibilityState === 'visible' && refreshCount();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refreshCount, user?.id]);

  useEffect(() => {
    if (!open) return undefined;
    loadItems();
    const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, loadItems]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((cur) => cur?.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      api.markRead(n.id).catch(() => {});
    }
    navigate(notificationLink(n, user.role));
  };

  const readAll = async () => {
    setItems((cur) => cur?.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.markAllRead().catch(() => {});
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-ink-100"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 7H4c0-1 2-2 2-7zM10 19a2 2 0 004 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-bold leading-5 text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-14 z-40 max-h-[75vh] overflow-y-auto rounded-card border border-ink-100 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96" role="region" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h2 className="font-display text-lg font-semibold">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={readAll} className="text-sm font-semibold text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          {error ? (
            <p role="alert" className="p-4 text-sm text-danger">
              Could not load notifications.{' '}
              <button type="button" onClick={loadItems} className="font-semibold underline">
                Try again
              </button>
            </p>
          ) : items === null ? (
            <Spinner label="Loading..." />
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-500">You're all caught up. Updates about your bookings will show up here.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-ink-50 ${n.read ? '' : 'bg-brand-50/60'}`}>
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-500'}`} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="mt-0.5 block text-sm text-ink-600">{n.body}</span>
                      <span className="mt-1 block text-xs text-ink-400">{formatDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 px-4 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-ink-50">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
