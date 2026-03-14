import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authApi } from '../../utils/api';
import styles from './Auth.module.css';

export function LoginPage() {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.email)    e.email    = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed');
      if (err.errors) {
        const fieldErrs = {};
        err.errors.forEach(e => { fieldErrs[e.field] = e.message; });
        setErrors(fieldErrs);
      }
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <h1>Core<strong>Inventory</strong></h1>
        </div>
        <p className={styles.subtitle}>Sign in to your account</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="form-group">
            <label className="label">Email</label>
            <input className={`input ${errors.email ? 'error' : ''}`} type="email"
              placeholder="admin@coreinventory.com" value={form.email} onChange={set('email')} />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className={`input ${errors.password ? 'error' : ''}`} type="password"
              placeholder="••••••••" value={form.password} onChange={set('password')} />
            {errors.password && <span className="error-msg">{errors.password}</span>}
          </div>
          <div className={styles.forgot}>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" /> Signing in…</> : 'Sign In'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>

        <div className={styles.demo}>
          <span className="text-muted text-xs">Demo credentials:</span>
          <code className="text-xs">admin@coreinventory.com / Admin@1234</code>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'staff' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.name || form.name.length < 2) e.name = 'Name must be at least 2 characters';
    if (!form.email) e.email = 'Email is required';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(form.password)) e.password = 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) e.password = 'Password must contain a number';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await authApi.register(form);
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(er => ({ ...er, [k]: '' })); };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <h1>Core<strong>Inventory</strong></h1>
        </div>
        <p className={styles.subtitle}>Create a new account</p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="form-group">
            <label className="label">Full Name</label>
            <input className={`input ${errors.name ? 'error' : ''}`} type="text"
              placeholder="John Doe" value={form.name} onChange={set('name')} />
            {errors.name && <span className="error-msg">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className={`input ${errors.email ? 'error' : ''}`} type="email"
              placeholder="you@company.com" value={form.email} onChange={set('email')} />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className={`input ${errors.password ? 'error' : ''}`} type="password"
              placeholder="Min 8 chars, 1 uppercase, 1 number" value={form.password} onChange={set('password')} />
            {errors.password && <span className="error-msg">{errors.password}</span>}
          </div>
          <div className="form-group">
            <label className="label">Role</label>
            <select className="input select" value={form.role} onChange={set('role')}>
              <option value="staff">Warehouse Staff</option>
              <option value="manager">Inventory Manager</option>
            </select>
          </div>
          <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
            {loading ? <><div className="spinner" /> Creating account…</> : 'Create Account'}
          </button>
        </form>
        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [step, setStep] = useState('email'); // email | otp
  const [form, setForm] = useState({ email: '', otp: '', password: '' });
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const sendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: form.email });
      toast.info('OTP sent — check server console in dev mode');
      setStep('otp');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password too short'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword({ email: form.email, otp: form.otp, password: form.password });
      toast.success('Password reset! Please log in.');
      navigate('/login');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <h1>Reset Password</h1>
        </div>
        {step === 'email' ? (
          <form onSubmit={sendOTP} className={styles.form}>
            <p className={styles.subtitle}>Enter your email to receive an OTP.</p>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" />
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
            <p className={styles.switchLink}><Link to="/login">Back to login</Link></p>
          </form>
        ) : (
          <form onSubmit={resetPassword} className={styles.form}>
            <p className={styles.subtitle}>Enter the 6-digit OTP and your new password.</p>
            <div className="form-group">
              <label className="label">OTP Code</label>
              <input className="input mono" type="text" maxLength={6} value={form.otp} onChange={set('otp')} placeholder="123456" />
            </div>
            <div className="form-group">
              <label className="label">New Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder="Min 8 chars" />
            </div>
            <button className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Resetting…' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
