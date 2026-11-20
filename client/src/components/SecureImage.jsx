import { useEffect, useState } from 'react';
import { fetchPrivateImage } from '../api/admin.js';

// Shows an image from the private uploads area (ID photos, deposit screenshots).
export default function SecureImage({ path, alt, className = '' }) {
  const [state, setState] = useState({ url: null, error: false });

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    setState({ url: null, error: false });
    fetchPrivateImage(path)
      .then((url) => {
        if (revoked) URL.revokeObjectURL(url);
        else {
          objectUrl = url;
          setState({ url, error: false });
        }
      })
      .catch(() => !revoked && setState({ url: null, error: true }));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (state.error) {
    return (
      <div className={`flex items-center justify-center rounded-control bg-ink-100 p-4 text-xs text-ink-500 ${className}`}>
        Could not load image
      </div>
    );
  }
  if (!state.url) {
    return <div className={`animate-pulse rounded-control bg-ink-100 ${className}`} aria-label="Loading image" />;
  }
  return (
    <a href={state.url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={state.url} alt={alt} className={`rounded-control object-cover ${className}`} />
    </a>
  );
}
