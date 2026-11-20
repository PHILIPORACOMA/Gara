// Client-side checks so people get instant messages. The server validates everything again
// and its field errors are shown too (see apiFieldErrors).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export function validateRegister({ name, email, phone, password, confirmPassword }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!email.trim()) errors.email = 'Email is required';
  else if (!EMAIL.test(email.trim())) errors.email = 'Enter a valid email address';
  if (phone.trim() && !/^[+\d][\d\s-]{6,19}$/.test(phone.trim())) errors.phone = 'Enter a valid phone number';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (password.length > 72) errors.password = 'Password must be at most 72 characters';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
}
