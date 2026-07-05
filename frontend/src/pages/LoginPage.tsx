import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('demo@jobforge.dev');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('Demo User');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (isRegister) await register(email, password, name);
      else await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Connection error. Is the backend running?');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-bg">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-row">
            <div className="login-icon"><Zap size={28} color="#fff" /></div>
            <h1 className="login-title">JobForge</h1>
          </div>
          <p className="login-sub">Production-grade distributed job scheduling</p>
        </div>

        <div className="login-card">
          <h2 className="login-heading">{isRegister ? 'Create account' : 'Sign in'}</h2>
          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary w-full" style={{justifyContent:'center', padding:'0.65rem'}} disabled={loading}>
              {loading && <Loader2 size={16} style={{animation:'spin 1s linear infinite'}} />}
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="toggle-text">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}
            <button className="toggle-link" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>

          <div className="demo-box">
            <p className="demo-label">Demo credentials</p>
            <p className="demo-text">demo@jobforge.dev / password123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
