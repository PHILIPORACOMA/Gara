import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roleHome.js';
import { apiErrorMessage, apiFieldErrors } from '../api/http.js';
import { validateLogin } from '../lib/validation.js';
import { TextField } from '../components/Field.jsx';
import Button from '../components/Button.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from ?? homePathFor(user.role)} replace />;

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateLogin(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const signedIn = await login({ email: values.email.trim(), password: values.password });
      navigate(from ?? homePathFor(signedIn.role), { replace: true });
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-600">Log in to book or manage your appointments.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 rounded-card bg-white p-5 shadow-card">
        {formError && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={values.email}
          onChange={onChange}
          error={errors.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={onChange}
          error={errors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-600">
        New to Gara?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
