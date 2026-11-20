import { useRef, useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import { apiErrorMessage } from '../../api/http.js';
import Button from '../../components/Button.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { checkImageFile, uploadUrl } from '../../lib/uploads.js';

const MAX_PHOTOS = 12;

export default function ProPortfolio() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getProfile(), []);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ tone: 'error', text: '' });

  if (loading) return <Spinner label="Loading your portfolio..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const photos = data.portfolio;

  const onFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow choosing the same file again
    if (!files.length) return;

    const problem = files.map(checkImageFile).find(Boolean);
    if (problem) return setMessage({ tone: 'error', text: problem });
    if (photos.length + files.length > MAX_PHOTOS) {
      return setMessage({ tone: 'error', text: `You can have at most ${MAX_PHOTOS} photos (you have ${photos.length}).` });
    }

    setUploading(true);
    setMessage({ tone: 'error', text: '' });
    try {
      const added = await proApi.uploadPortfolio(files);
      setData((d) => ({ ...d, portfolio: [...d.portfolio, ...added] }));
      setMessage({ tone: 'success', text: `${added.length} photo${added.length > 1 ? 's' : ''} uploaded.` });
    } catch (err) {
      setMessage({ tone: 'error', text: apiErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (photo) => {
    setDeletingId(photo.id);
    setMessage({ tone: 'error', text: '' });
    try {
      await proApi.deletePortfolioImage(photo.id);
      setData((d) => ({ ...d, portfolio: d.portfolio.filter((p) => p.id !== photo.id) }));
    } catch (err) {
      setMessage({ tone: 'error', text: apiErrorMessage(err) });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-600">
            Show your best work: {photos.length} of {MAX_PHOTOS} photos. JPG, PNG or WebP, up to 5 MB each.
          </p>
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} className="sr-only" aria-label="Choose portfolio photos" />
        <Button onClick={() => inputRef.current?.click()} loading={uploading} disabled={photos.length >= MAX_PHOTOS}>
          Upload photos
        </Button>
      </div>

      <Alert tone={message.tone}>{message.text}</Alert>

      {photos.length === 0 ? (
        <EmptyState title="No photos yet" description="Customers choose pros by their work. Upload photos of your best hairstyles, nails or makeup looks." />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-card bg-white shadow-card">
              <img src={uploadUrl(p.path)} alt={`Portfolio photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
              <div className="p-2">
                <ConfirmButton className="w-full !min-h-9 !py-1.5" loading={deletingId === p.id} onConfirm={() => remove(p)} confirmLabel="Tap again to delete">
                  Delete
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
