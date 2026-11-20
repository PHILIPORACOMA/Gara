const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL ?? 'http://localhost:4310/uploads/public';

// Public uploads (portfolio, GCash QR): "portfolio/abc.jpg" -> full URL.
export const uploadUrl = (path) => (path ? `${UPLOADS_URL}/${path}` : null);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Returns an error message, or '' when the file is acceptable.
export function checkImageFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG or WebP images are allowed`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: image must be 5 MB or smaller`;
  return '';
}
