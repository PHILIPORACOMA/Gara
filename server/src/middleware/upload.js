import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { UPLOAD_LIMITS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { detectImageType, ensureDir, privateDir, publicDir, removeFileQuietly } from '../utils/files.js';

const MIME_TO_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

function imageFilter(req, file, cb) {
  if (MIME_TO_EXT[file.mimetype]) return cb(null, true);
  cb(ApiError.badRequest('Only JPG, PNG or WebP images are allowed'));
}

// Files are stored under a random name; the original file name is never trusted.
function uploader(destination, limits = {}) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, ensureDir(destination())),
      filename: (req, file, cb) => cb(null, `${randomUUID()}${MIME_TO_EXT[file.mimetype]}`),
    }),
    fileFilter: imageFilter,
    limits: { fileSize: UPLOAD_LIMITS.imageMaxBytes, ...limits },
  });
}

export const MAX_FILES_PER_UPLOAD = 10;

// Public: portfolio photos (many).
export const uploadPortfolioImages = uploader(() => publicDir('portfolio'), { files: MAX_FILES_PER_UPLOAD }).array(
  'images',
  MAX_FILES_PER_UPLOAD,
);

// Private: the professional's ID image (one).
export const uploadIdImage = uploader(() => privateDir('id'), { files: 1 }).single('idImage');

// Public: Gara's GCash QR code (one), uploaded by the admin.
export const uploadQrImage = uploader(() => publicDir('qr'), { files: 1 }).single('qr');

// Private: the customer's GCash payment screenshot (one).
export const uploadDepositScreenshot = uploader(() => privateDir('deposit'), { files: 1 }).single('screenshot');

// Route-level error handler: if anything after the upload fails (validation, business rule),
// delete the file multer already saved, then pass the error on.
// eslint-disable-next-line no-unused-vars
export async function discardUploadsOnError(err, req, res, next) {
  const files = req.file ? [req.file] : (req.files ?? []);
  await Promise.all(files.map((f) => removeFileQuietly(f.path)));
  next(err);
}

// Run after multer: confirm the bytes really are an image, otherwise delete and reject.
export async function verifyUploadedImages(req, res, next) {
  const files = req.file ? [req.file] : (req.files ?? []);
  for (const file of files) {
    if (!(await detectImageType(file.path))) {
      await Promise.all(files.map((f) => removeFileQuietly(f.path)));
      return next(ApiError.badRequest('One of the files is not a valid image'));
    }
  }
  next();
}
