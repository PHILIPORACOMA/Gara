import { useState } from 'react';
import * as bookingsApi from '../api/bookings.js';
import { apiErrorMessage, apiFieldErrors } from '../api/http.js';
import { TextAreaField } from './Field.jsx';
import Alert from './Alert.jsx';
import Button from './Button.jsx';
import StarRating from './StarRating.jsx';

const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

// Shown on a COMPLETED booking: the thank-you with the review the customer left, or the form.
// The server enforces the real rules (own booking, completed, once only).
export default function ReviewForm({ booking, onReviewed }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (booking.review) {
    return (
      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold">Your review</h2>
        <div className="mt-2">
          <StarRating value={booking.review.rating} />
        </div>
        <p className="mt-2 text-sm text-ink-600">Thanks! Your review is now on {booking.professional.displayName}'s profile with a “Verified booking” label.</p>
      </section>
    );
  }
  if (!booking.canReview) return null;

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (rating < 1) return setErrors({ rating: 'Choose a star rating' });
    setErrors({});
    setSubmitting(true);
    try {
      const review = await bookingsApi.reviewBooking(booking.id, { rating, comment: comment.trim() });
      onReviewed(review);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-card border-2 border-brand-200 bg-white p-5 shadow-card" aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-xl font-semibold">
        How was your appointment?
      </h2>
      <p className="mt-1 text-sm text-ink-600">Your review helps other customers choose, and it is marked as a verified booking.</p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Alert tone="error">{formError}</Alert>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">Your rating</legend>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}: ${LABELS[n - 1]}`}
                onClick={() => setRating(n)}
                className="flex size-11 items-center justify-center rounded-control hover:bg-ink-50"
              >
                <svg viewBox="0 0 20 20" className="size-8" aria-hidden="true">
                  <path fill={n <= rating ? 'var(--color-accent-500)' : 'var(--color-ink-200)'} d="M10 1.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L10 14.9l-5.25 2.8 1-5.85L1.5 7.7l5.9-.9z" />
                </svg>
              </button>
            ))}
          </div>
          {rating > 0 && <p className="mt-1 text-sm text-ink-600">{LABELS[rating - 1]}</p>}
          {errors.rating && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.rating}
            </p>
          )}
        </fieldset>
        <TextAreaField label="Tell others about it (optional)" name="comment" value={comment} onChange={(e) => setComment(e.target.value)} error={errors.comment} rows={3} maxLength={1000} placeholder="What did you love? Anything to improve?" />
        <Button type="submit" loading={submitting}>
          Post review
        </Button>
      </form>
    </section>
  );
}
