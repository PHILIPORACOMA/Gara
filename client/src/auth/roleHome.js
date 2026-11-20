// Where each role lands after logging in.
export function homePathFor(role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PROFESSIONAL') return '/pro';
  return '/';
}
