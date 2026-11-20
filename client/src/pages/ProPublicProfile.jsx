import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { getPro, getProReviews } from '../api/discovery.js';
import { apiErrorMessage } from '../api/http.js';
import Badge from '../components/Badge.jsx';
import Button from '../components/Button.jsx';
import StarRating from '../components/StarRating.jsx';
import VerifiedBadge from '../components/VerifiedBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import { CATEGORY_LABELS, SERVICE_MODE_LABELS, formatDuration } from '../lib/labels.js';
import { formatPeso } from '../lib/money.js';
import { formatDate } from '../lib/dates.js';
import { uploadUrl } from '../lib/uploads.js';

function Lightbox({ photos, index, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (index != null && dialog && !dialog.open) dialog.showModal();
    if (index == null && dialog?.open) dialog.close();
  }, [index]);

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} className="m-auto max-h-[92vh] max-w-[92vw] rounded-card bg-transparent p-0 backdrop:bg-black/80">
      {index != null && (
        <div className="relative">
          <img src={uploadUrl(photos[index].path)} alt={`Portfolio photo ${index + 1} of ${photos.length}`} className="max-h-[88vh] max-w-[92vw] rounded-card object-contain" />
          <button type="button" onClick={onClose} className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-white/90 text-xl text-ink-800" aria-label="Close photo">
            ×
          </button>
        </div>
      )}
    </dialog>
  );
}

function ReviewItem({ review }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRating value={review.rating} />
          <span className="text-sm font-medium text-ink-800">{review.customerName}</span>
        </div>
        <span className="text-xs text-ink-500">{formatDate(review.createdAt)}</span>
      </div>
      {review.comment && <p className="mt-2 text-sm text-ink-700">{review.comment}</p>}
      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-success">
        <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
        Verified booking
      </p>
    </li>
  );
}

function Reviews({ pro }) {
  const [extra, setExtra] = useState([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const shown = [...pro.reviews, ...extra];
  const hasMore = shown.length < pro.reviewTotal;

  const more = async () => {
    setLoadingMore(true);
    setError('');
    try {
      const next = page + 1;
      const result = await getProReviews(pro.id, next);
      // The first page of 5 came with the profile; later pages use the default page size.
      const seen = new Set(shown.map((r) => r.id));
      setExtra((prev) => [...prev, ...result.reviews.filter((r) => !seen.has(r.id))]);
      setPage(next);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <section aria-labelledby="reviews-heading" className="rounded-card bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="reviews-heading" className="text-xl font-semibold">
          Reviews
        </h2>
        <StarRating value={pro.ratingAvg} count={pro.ratingCount} size="size-5" />
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-ink-600">No reviews yet. Reviews appear here after customers complete a booking.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-100">
          {shown.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {hasMore && (
        <Button variant="secondary" className="mt-3 w-full" onClick={more} loading={loadingMore}>
          Show more reviews
        </Button>
      )}
    </section>
  );
}

export default function ProPublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const bookDate = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '') ? searchParams.get('date') : '';
  const { data: pro, loading, error, reload } = useAsync(() => getPro(id), [id]);
  const [photoIndex, setPhotoIndex] = useState(null);

  if (loading) return <Spinner label="Loading profile..." />;
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorState message={error} onRetry={reload} />
        <p className="mt-4 text-center text-sm">
          <Link to="/search" className="font-semibold text-brand-600 hover:underline">
            Back to search
          </Link>
        </p>
      </main>
    );
  }

  const byCategory = pro.categories.map((c) => ({ category: c, services: pro.services.filter((s) => s.category === c) })).filter((g) => g.services.length > 0);
  const homeService = pro.serviceMode !== 'STORE';

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <header className="rounded-card bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{pro.displayName}</h1>
          <VerifiedBadge />
        </div>
        <div className="mt-2">
          <StarRating value={pro.ratingAvg} count={pro.ratingCount} size="size-5" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pro.categories.map((c) => (
            <Badge key={c} tone="brand">
              {CATEGORY_LABELS[c]}
            </Badge>
          ))}
        </div>
        {pro.bio && <p className="mt-3 text-ink-700">{pro.bio}</p>}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Service</dt>
            <dd>{SERVICE_MODE_LABELS[pro.serviceMode]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Areas served</dt>
            <dd>{pro.areas.join(', ')}</dd>
          </div>
          {pro.storeAddress && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Studio address</dt>
              <dd>{pro.storeAddress}</dd>
            </div>
          )}
          {homeService && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Home-service travel fee</dt>
              <dd>{pro.travelFee > 0 ? `${formatPeso(pro.travelFee)} (shown again before you confirm)` : 'No travel fee'}</dd>
            </div>
          )}
        </dl>
      </header>

      {pro.portfolio.length > 0 && (
        <section aria-labelledby="portfolio-heading" className="rounded-card bg-white p-5 shadow-card">
          <h2 id="portfolio-heading" className="text-xl font-semibold">
            Portfolio
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pro.portfolio.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setPhotoIndex(i)} className="block w-full overflow-hidden rounded-control focus-visible:outline-2 focus-visible:outline-brand-500" aria-label={`Open photo ${i + 1}`}>
                  <img src={uploadUrl(p.path)} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform hover:scale-105" />
                </button>
              </li>
            ))}
          </ul>
          <Lightbox photos={pro.portfolio} index={photoIndex} onClose={() => setPhotoIndex(null)} />
        </section>
      )}

      <section aria-labelledby="services-heading" className="rounded-card bg-white p-5 shadow-card">
        <h2 id="services-heading" className="text-xl font-semibold">
          Services and prices
        </h2>
        {byCategory.map((group) => (
          <div key={group.category} className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{CATEGORY_LABELS[group.category]}</h3>
            <ul className="mt-1 divide-y divide-ink-100">
              {group.services.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-ink-900">{s.name}</p>
                    <p className="text-sm text-ink-500">{formatDuration(s.durationMin)}</p>
                    {s.description && <p className="mt-1 text-sm text-ink-600">{s.description}</p>}
                  </div>
                  <p className="shrink-0 text-lg font-semibold text-brand-700">{formatPeso(s.price)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Reviews pro={pro} />

      {/* Pros and admins browse but do not book. Everyone else (including visitors, who are
          asked to log in first) gets the booking button, pinned to the bottom on phones. */}
      {(!user || user.role === 'CUSTOMER') && (
        <div className="sticky bottom-0 -mx-4 border-t border-ink-100 bg-white/95 px-4 py-3 backdrop-blur">
          <Link
            to={`/pros/${pro.id}/book${bookDate ? `?date=${bookDate}` : ''}`}
            className="flex min-h-12 w-full items-center justify-center rounded-control bg-brand-500 px-5 text-base font-semibold text-white hover:bg-brand-600"
          >
            Book {pro.displayName}
            {pro.services.length > 0 && <span className="ml-2 font-normal text-brand-100">from {formatPeso(Math.min(...pro.services.map((s) => s.price)))}</span>}
          </Link>
        </div>
      )}
    </main>
  );
}
