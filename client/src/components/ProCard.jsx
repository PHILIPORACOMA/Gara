import { Link } from 'react-router-dom';
import Badge from './Badge.jsx';
import StarRating from './StarRating.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { formatPeso } from '../lib/money.js';
import { uploadUrl } from '../lib/uploads.js';

const MODE_TEXT = { HOME: 'Home service', STORE: 'In-store', BOTH: 'Home service or in-store' };

// Search result card. `bookQuery` carries the chosen date/filters through to the profile.
export default function ProCard({ pro, query = '' }) {
  return (
    <li>
      <Link
        to={`/pros/${pro.id}${query}`}
        className="flex gap-4 rounded-card bg-white p-3 shadow-card transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand-500 sm:p-4"
      >
        {pro.coverPath ? (
          <img src={uploadUrl(pro.coverPath)} alt="" loading="lazy" className="size-24 shrink-0 rounded-control object-cover sm:size-32" />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-control bg-brand-100 font-display text-3xl text-brand-600 sm:size-32" aria-hidden="true">
            {pro.displayName[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-lg font-semibold text-ink-900">{pro.displayName}</h3>
            {pro.verified && <VerifiedBadge />}
          </div>
          <div className="mt-1">
            <StarRating value={pro.ratingAvg} count={pro.ratingCount} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pro.categories.map((c) => (
              <Badge key={c} tone="brand">
                {CATEGORY_LABELS[c]}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-sm text-ink-600">
            {MODE_TEXT[pro.serviceMode]} &middot; {pro.areas.slice(0, 2).join(', ')}
            {pro.areas.length > 2 && ` +${pro.areas.length - 2}`}
          </p>
          <p className="mt-1 text-sm">
            {pro.fromPrice != null && (
              <span className="font-semibold text-brand-700">From {formatPeso(pro.fromPrice)}</span>
            )}
            {pro.serviceMode !== 'STORE' && pro.travelFee > 0 && (
              <span className="text-ink-500"> &middot; Travel fee {formatPeso(pro.travelFee)}</span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}
