import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import { apiErrorMessage } from '../../api/http.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import SecureImage from '../../components/SecureImage.jsx';
import { checkImageFile } from '../../lib/uploads.js';
import { formatDateTime } from '../../lib/dates.js';
import { VERIFICATION_LABELS, VERIFICATION_TONES } from '../../lib/labels.js';

export default function ProVerification() {
  const { refreshUser } = useAuth();
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getProfile(), []);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Local preview of the chosen ID photo.
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (loading) return <Spinner label="Loading verification..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { profile, checklist } = data;
  const status = profile.verificationStatus;
  const locked = status === 'PENDING' || status === 'APPROVED';
  const otherTodo = checklist.items.filter((i) => i.key !== 'id' && !i.done);
  const hasId = Boolean(file) || profile.hasIdImage;
  const canSubmit = !locked && otherTodo.length === 0 && hasId;

  const onPick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const problem = checkImageFile(picked);
    setFileError(problem);
    setFile(problem ? null : picked);
    if (problem) setPreview(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await proApi.submitVerification(file);
      setData(result);
      setFile(null);
      setPreview(null);
      await refreshUser();
    } catch (err) {
      setSubmitError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Verification</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-600">
          Status: <Badge tone={VERIFICATION_TONES[status]}>{VERIFICATION_LABELS[status]}</Badge>
          {profile.submittedAt && status === 'PENDING' && <span>Submitted {formatDateTime(profile.submittedAt)}</span>}
        </p>
      </div>

      {status === 'APPROVED' && <Alert tone="success">You are verified. Customers see the Verified badge on your profile.</Alert>}
      {status === 'PENDING' && <Alert tone="warning">Your application is under review. You can keep improving your profile in the meantime.</Alert>}
      {status === 'REJECTED' && (
        <Alert tone="error">
          Not verified yet: {profile.rejectionReason}. Update your details or ID below, then submit again.
        </Alert>
      )}

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold">Your valid ID</h2>
        <p className="mt-1 text-sm text-ink-600">
          Upload a clear photo of a government-issued ID (passport, driver's license, UMID, PhilID...). It is private: only you and the Gara team can see it.
        </p>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          {preview ? (
            <img src={preview} alt="Selected ID preview" className="h-40 w-64 rounded-control object-cover" />
          ) : profile.hasIdImage ? (
            <SecureImage path={profile.idImagePath} alt="Your uploaded ID" className="h-40 w-64" />
          ) : (
            <div className="flex h-40 w-64 items-center justify-center rounded-control border border-dashed border-ink-300 text-sm text-ink-400">No ID uploaded</div>
          )}
          {!locked && (
            <div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="sr-only" aria-label="Choose ID photo" />
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                {profile.hasIdImage || file ? 'Choose a different photo' : 'Choose ID photo'}
              </Button>
              <p className="mt-2 text-xs text-ink-500">JPG, PNG or WebP, up to 5 MB.</p>
            </div>
          )}
        </div>
        <Alert tone="error" className="mt-3">
          {fileError}
        </Alert>
      </section>

      {!locked && (
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold">Submit for review</h2>
          {otherTodo.length > 0 ? (
            <>
              <p className="mt-1 text-sm text-ink-600">Finish these first:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {otherTodo.map((i) => (
                  <li key={i.key}>
                    <Link to={i.link} className="font-medium text-brand-600 hover:underline">
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-600">Everything is ready. The Gara team reviews applications in the order they arrive.</p>
          )}
          <Alert tone="error" className="mt-3">
            {submitError}
          </Alert>
          <Button className="mt-4" onClick={submit} loading={submitting} disabled={!canSubmit}>
            {status === 'REJECTED' ? 'Resubmit for verification' : 'Submit for verification'}
          </Button>
          {!hasId && otherTodo.length === 0 && <p className="mt-2 text-xs text-ink-500">Choose an ID photo to continue.</p>}
        </section>
      )}
    </div>
  );
}
