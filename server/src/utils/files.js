import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

// Uploads live in uploads/public (portfolio, QR: served statically) and uploads/private
// (ID images, deposit screenshots: served only through the role-checked /files route).
// Cloud storage later only needs to replace this file.
export const uploadRoot = () => path.resolve(env.UPLOAD_DIR);
export const publicDir = (...parts) => path.join(uploadRoot(), 'public', ...parts);
export const privateDir = (...parts) => path.join(uploadRoot(), 'private', ...parts);

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function removeFileQuietly(absolutePath) {
  if (!absolutePath) return;
  try {
    await fs.promises.unlink(absolutePath);
  } catch {
    /* already gone */
  }
}

// The browser-supplied MIME type can be faked, so also check the file's magic bytes.
export async function detectImageType(absolutePath) {
  const handle = await fs.promises.open(absolutePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
    return null;
  } finally {
    await handle.close();
  }
}
