import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roleHome.js';
import { apiErrorMessage, apiFieldErrors } from '../api/http.js';
import { getPublicSettings } from '../api/publicApi.js';
import { validateRegister } from '../lib/validation.js';
import { TextField } from '../components/Field.jsx';
import Button from '../components/Button.jsx';

const ROLE_OPTIONS = [
  { value: 'CUSTOMER', title: 'I want to book', text: 'Find and book verified beauty pros.' },
  { value: 'PROFESSIONAL', title: "I'm a beauty professional", text: 'Hairstylist, nail tech or makeup artist.' },
];

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [role, setRole] = useState(params.get('role') === 'professional' ? 'PROFESSIONAL' : 'CUSTOMER');
  const [values, setValues] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commissionPct, setCommissionPct] = useState(null);

  // The commission rate is stated plainly to professionals before they sign up.
  useEffect(() => {
    getPublicSettings()
      .then((s) => setCommissionPct(s.commissionPct))
      .catch(() => {});
  }, []);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateRegister(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const created = await register({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
        role,
      });
      navigate(homePathFor(created.role), { replace: true });
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">Create your account</h1>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 rounded-card bg-white p-5 shadow-card">
        <fieldset>
          <legend className="text-sm font-medium text-ink-700">I am joining as</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-control border p-3 text-sm transition-colors ${
                  role === opt.value ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={role === opt.value}
                  onChange={() => setRole(opt.value)}
                  className="sr-only"
                />
                <span className="block font-semibold text-ink-900">{opt.title}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{opt.text}</span>
              </label>
            ))}
          </div>
          {role === 'PROFESSIONAL' && (
            <p className="mt-2 rounded-control bg-accent-50 px-3 py-2 text-xs text-accent-700">
              Free to join, no monthly fee.
              {commissionPct !== null && ` Gara keeps ${commissionPct}% of the service price on completed bookings.`}{' '}
              Verification (a valid ID and your portfolio) is required before you appear in search.
            </p>
          )}
        </fieldset>

        {formError && (
          <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        )}

        <TextField label="Full name" name="name" autoComplete="name" value={values.name} onChange={onChange} error={errors.name} />
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
          label="Mobile number (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="0917 123 4567"
          value={values.phone}
          onChange={onChange}
          error={errors.phone}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          value={values.password}
          onChange={onChange}
          error={errors.password}
        />
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
