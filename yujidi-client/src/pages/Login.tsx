// import { useState } from 'react'
// import { useLocation, useNavigate } from 'react-router-dom'
// import { motion } from 'framer-motion'
// import { useAuth } from '../context/AuthContext'

// export function Login() {
//   const { login } = useAuth()
//   const navigate = useNavigate()
//   const location = useLocation()
//   const [email, setEmail] = useState('analyst@yujidi.ai')
//   const [password, setPassword] = useState('password123')
//   const [error, setError] = useState('')
//   const [isSubmitting, setIsSubmitting] = useState(false)

//   const from = (location.state as { from?: { pathname?: string } } | null)?.from
//     ?.pathname

//   const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault()
//     setError('')
//     setIsSubmitting(true)

//     try {
//       await login({ email, password })
//       navigate(from ?? '/dashboard', { replace: true })
//     } catch {
//       setError('Unable to sign in. Check credentials or backend status.')
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
//       <motion.form
//         onSubmit={handleSubmit}
//         initial={{ opacity: 0, scale: 0.98, y: 20 }}
//         animate={{ opacity: 1, scale: 1, y: 0 }}
//         className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111111] p-8 shadow-[0_0_35px_rgba(168,85,247,0.12)]"
//       >
//         <h1 className="mb-2 text-2xl font-semibold text-purple-300">
//           Project YuJiDi
//         </h1>
//         <p className="mb-6 text-sm text-gray-400">
//           Sign in to access the crypto risk intelligence dashboard.
//         </p>
//         <div className="space-y-4">
//           <input
//             type="email"
//             value={email}
//             onChange={(event) => setEmail(event.target.value)}
//             placeholder="Email"
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 transition focus:ring-2"
//           />
//           <input
//             type="password"
//             value={password}
//             onChange={(event) => setPassword(event.target.value)}
//             placeholder="Password"
//             className="w-full rounded-md border border-gray-800 bg-[#0A0A0A] px-3 py-2 text-gray-100 outline-none ring-purple-500 transition focus:ring-2"
//           />
//         </div>
//         {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
//         <button
//           type="submit"
//           disabled={isSubmitting}
//           className="mt-6 w-full rounded-md border border-green-500/50 bg-green-500/15 px-4 py-2 font-semibold text-green-300 shadow-[0_0_20px_rgba(74,222,128,0.25)] transition hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-70"
//         >
//           {isSubmitting ? 'Signing In...' : 'Sign In'}
//         </button>
//       </motion.form>
//     </div>
//   )
// }
// import React, { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { motion } from 'framer-motion';
// import { Activity } from 'lucide-react';
// import { useAuth } from '../context/AuthContext';
// import { apiClient } from '../api/client';

// export function Login() {
//   const [email, setEmail] = useState('founder01@yujidi.com'); // Default for quick testing
//   const [password, setPassword] = useState('FAANGSecure!2026');
//   const [error, setError] = useState('');
//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError('');
//     try {
//       const { data } = await apiClient.post('/auth/login', { email, password });
//       login(data.user);
//       navigate('/');
//     } catch (err: any) {
//       setError(err.response?.data?.message || 'Login failed');
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
//       <motion.div 
//         initial={{ opacity: 0, y: 20 }}
//         animate={{ opacity: 1, y: 0 }}
//         className="w-full max-w-md bg-zinc-900/50 border border-white/5 rounded-2xl p-8 backdrop-blur-md"
//       >
//         <div className="flex justify-center mb-8">
//           <div className="p-3 bg-purple-500/10 rounded-xl">
//             <Activity className="w-8 h-8 text-purple-500" />
//           </div>
//         </div>
        
//         <h2 className="text-2xl font-bold text-center text-white mb-2">Project YuJiDi</h2>
//         <p className="text-zinc-400 text-center mb-8">Turn Market Noise into Intelligence</p>

//         {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm text-center">{error}</div>}

//         <form onSubmit={handleLogin} className="space-y-4">
//           <div>
//             <label className="block text-sm font-medium text-zinc-400 mb-1">Email Address</label>
//             <input 
//               type="email" 
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
//               required
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-zinc-400 mb-1">Password</label>
//             <input 
//               type="password" 
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
//               required
//             />
//           </div>
//           <button 
//             type="submit"
//             className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-lg transition-colors mt-4"
//           >
//             Sign In
//           </button>
//         </form>
//       </motion.div>
//     </div>
//   );
// }

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Zap,
  Brain,
  TrendingUp,
  Sparkles,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

// ─── CSS injected once ────────────────────────────────────────────────────────
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  :root {
    --bg: #07080d;
    --surface: rgba(255,255,255,0.03);
    --border: rgba(255,255,255,0.07);
    --border-hover: rgba(124,58,237,0.4);
    --purple: #7c3aed;
    --purple-light: #a78bfa;
    --purple-glow: rgba(124,58,237,0.25);
    --green: #10b981;
    --green-glow: rgba(16,185,129,0.18);
    --text: #f8fafc;
    --muted: #64748b;
    --muted-light: #94a3b8;
    --input-bg: rgba(255,255,255,0.04);
    --card-bg: rgba(15,12,30,0.7);
  }

  .yujidi-root * { box-sizing: border-box; margin: 0; padding: 0; }
  .yujidi-root { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }

  /* ── Ambient background ── */
  .yujidi-bg {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background:
      radial-gradient(ellipse 80% 60% at 70% -10%, rgba(124,58,237,0.18) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 10% 80%, rgba(16,185,129,0.10) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 90% 90%, rgba(124,58,237,0.08) 0%, transparent 50%),
      var(--bg);
  }
  .yujidi-grid {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse 100% 100% at center, black 30%, transparent 80%);
  }

  /* ── Glass card ── */
  .glass-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 20px;
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }
  .glass-card-purple {
    box-shadow: 0 0 0 1px rgba(124,58,237,0.15), 0 8px 40px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .glass-card-green {
    box-shadow: 0 0 0 1px rgba(16,185,129,0.12), 0 8px 32px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
  }

  /* ── Neon divider ── */
  .neon-line {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(124,58,237,0.6), rgba(16,185,129,0.4), transparent);
  }

  /* ── Input ── */
  .yujidi-input {
    width: 100%;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .yujidi-input::placeholder { color: var(--muted); }
  .yujidi-input:focus {
    border-color: var(--purple);
    box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
  }

  /* ── Buttons ── */
  .btn-primary {
    width: 100%;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 13px 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    letter-spacing: 0.01em;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .btn-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    pointer-events: none;
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(124,58,237,0.45);
  }
  .btn-primary:active { transform: translateY(0); }

  .btn-google {
    width: 100%;
    background: var(--input-bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 20px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.2s;
  }
  .btn-google:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.14);
  }

  /* ── Gradient text ── */
  .text-grad-green {
    background: linear-gradient(135deg, #10b981, #6ee7b7);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .text-grad-purple {
    background: linear-gradient(135deg, #a78bfa, #7c3aed);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Terminal ── */
  .terminal-box {
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(16,185,129,0.2);
    border-radius: 10px;
    padding: 12px 16px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 13px;
    max-width: 100%;
  }
  .terminal-cursor {
    width: 8px; height: 16px;
    background: var(--green);
    border-radius: 1px;
    animation: blink 1s step-end infinite;
    flex-shrink: 0;
  }
  @keyframes blink { 50% { opacity: 0; } }

  /* ── Feature card hover ── */
  .feature-card {
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .feature-card:hover {
    transform: translateY(-4px);
  }

  /* ── Pill badge ── */
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(124,58,237,0.1);
    border: 1px solid rgba(124,58,237,0.2);
    border-radius: 100px;
    padding: 4px 12px;
    font-size: 12px; font-weight: 500;
    color: var(--purple-light);
    letter-spacing: 0.03em;
  }

  /* ── Error box ── */
  .error-box {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 8px;
    padding: 10px 14px;
    color: #f87171;
    font-size: 13px;
    text-align: center;
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
`;

// ─── Inject styles ─────────────────────────────────────────────────────────────
function StyleInjector() {
  const injected = useRef(false);
  if (!injected.current) {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('yujidi-styles') || document.createElement('style');
      el.id = 'yujidi-styles';
      el.textContent = GLOBAL_STYLE;
      document.head.appendChild(el);
    }
    injected.current = true;
  }
  return null;
}

// ─── Terminal typer ────────────────────────────────────────────────────────────
const ALERTS = [
  '⚡ SOL spiked 5.2% in 5 min — whale accumulation detected',
  '🔺 Bull Flag forming on ETH 15m chart',
  '🚨 BTC -3.1% — liquidation cascade on Binance',
  '🧠 DOGE pump linked to social sentiment surge',
  '⚡ ARB volume anomaly — 340% above 7d average',
];

function TerminalTyper() {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = ALERTS[idx];
    const speed = deleting ? 12 : 32;

    if (!deleting && text === current) {
      const t = setTimeout(() => setDeleting(true), 2200);
      return () => clearTimeout(t);
    }
    if (deleting && text === '') {
      setDeleting(false);
      setIdx(p => (p + 1) % ALERTS.length);
      return;
    }
    const t = setTimeout(() => {
      setText(deleting ? current.slice(0, text.length - 1) : current.slice(0, text.length + 1));
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, idx]);

  return (
    <div className="terminal-box">
      <span style={{ color: 'var(--green)', animation: 'blink 1s step-end infinite' }}>▶</span>
      <span style={{ color: 'var(--muted-light)', flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{text}</span>
      <span className="terminal-cursor" />
    </div>
  );
}

// ─── Feature cards ─────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Zap,
    title: 'Millisecond Tripwires',
    desc: 'Deploy custom price and volume triggers that fire in under 50ms. Never miss a market-moving event again.',
    color: 'var(--green)',
    glow: 'var(--green-glow)',
    cls: 'glass-card-green',
  },
  {
    icon: Brain,
    title: 'AI Root Cause Analysis',
    desc: "Our AI doesn't just alert you — it explains why. On-chain flows, order book imbalances, and social catalysts decoded instantly.",
    color: 'var(--purple-light)',
    glow: 'var(--purple-glow)',
    cls: 'glass-card-purple',
  },
  {
    icon: TrendingUp,
    title: 'Pattern Detection',
    desc: 'Automatically detect bull flags, head & shoulders, and 47 other patterns across every timeframe simultaneously.',
    color: 'var(--green)',
    glow: 'var(--green-glow)',
    cls: 'glass-card-green',
  },
];

function FeatureGrid() {
  return (
    <section style={{ padding: '80px 24px 100px', position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(26px,4vw,38px)', fontWeight: 800, marginBottom: 12 }}>
            Intelligence at <span className="text-grad-green">Machine Speed</span>
          </h2>
          <p style={{ color: 'var(--muted-light)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            Three layers of detection working together to give you an unfair advantage.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              className={`glass-card ${f.cls} feature-card`}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              style={{ padding: '32px 28px' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12, marginBottom: 24,
                background: `${f.glow}`,
                border: `1px solid ${f.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.icon size={22} color={f.color} />
              </div>
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, marginBottom: 10, color: 'var(--text)' }}>{f.title}</h3>
              <p style={{ color: 'var(--muted-light)', fontSize: 14, lineHeight: 1.65 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Auth card ─────────────────────────────────────────────────────────────────
interface AuthCardProps {
  onSubmit: (e: React.FormEvent) => Promise<void>;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  error: string;
  loading: boolean;
}

function AuthCard({ onSubmit, email, setEmail, password, setPassword, error, loading }: AuthCardProps) {
  const [showPw, setShowPw] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <motion.div
      className="glass-card glass-card-purple"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      style={{ padding: '36px 32px', width: '100%', maxWidth: 420 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={16} color="var(--purple-light)" />
        </div>
        <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700 }}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </span>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
        {isSignUp ? 'Start your intelligence journey' : 'Sign in to your workspace'}
      </p>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="err"
            className="error-box"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {isSignUp && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-light)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Full Name</label>
            <input className="yujidi-input" type="text" placeholder="Satoshi Nakamoto" />
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-light)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Email Address</label>
          <input
            className="yujidi-input"
            type="email"
            placeholder="you@fund.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--muted-light)', marginBottom: 6, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="yujidi-input"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ paddingRight: 44 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(p => !p)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)',
                display: 'flex', alignItems: 'center', padding: 2,
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Signing in…' : isSignUp ? 'Create Account' : 'Sign In'}
            {!loading && <ArrowRight size={16} />}
          </span>
        </button>
      </form>

      {/* Divider */}
      <div style={{ position: 'relative', margin: '22px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>or continue with</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Google */}
      <button className="btn-google" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginTop: 22 }}>
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <button
          type="button"
          onClick={() => setIsSignUp(p => !p)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-light)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}
        >
          {isSignUp ? 'Sign In' : 'Create Account'}
        </button>
      </p>
    </motion.div>
  );
}

// ─── Main Login page ────────────────────────────────────────────────────────────
export function Login() {
  const [email, setEmail] = useState('founder01@yujidi.com');
  const [password, setPassword] = useState('FAANGSecure!2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      login(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Check credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  const authProps = { onSubmit: handleLogin, email, setEmail, password, setPassword, error, loading };

  return (
    <div className="yujidi-root" style={{ minHeight: '100vh' }}>
      <StyleInjector />
      <div className="yujidi-bg" />
      <div className="yujidi-grid" />

      {/* ── HERO (web layout) ── */}
      <section style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '80px 24px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%' }}>

          {/* Two-column desktop layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 64, alignItems: 'center' }}>

            {/* LEFT: copy */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              <div>
                <span className="pill">
                  <Shield size={11} />
                  Project YuJiDi — AI Crypto Risk Intelligence
                </span>
              </div>

              <h1 style={{
                fontFamily: 'Syne, sans-serif',
                fontSize: 'clamp(38px, 6vw, 68px)',
                fontWeight: 900,
                lineHeight: 1.04,
                letterSpacing: '-0.02em',
              }}>
                Turn Market<br />
                Noise into{' '}
                <span className="text-grad-green">Business<br />Intelligence.</span>
              </h1>

              <p style={{ color: 'var(--muted-light)', fontSize: 17, maxWidth: 440, lineHeight: 1.65 }}>
                Deploy AI-powered tripwires across every crypto asset. Get root cause analysis, not just alerts.
              </p>

              <TerminalTyper />

              {/* Stat row */}
              <div style={{ display: 'flex', gap: 32, paddingTop: 8 }}>
                {[['< 50ms', 'Alert latency'], ['47+', 'Chart patterns'], ['24/7', 'AI monitoring']].map(([val, label]) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{val}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* RIGHT: auth card */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <AuthCard {...authProps} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Neon divider ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="neon-line" />
      </div>

      {/* ── Features ── */}
      <FeatureGrid />

      {/* ── Footer ── */}
      <footer style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '24px 24px 40px', borderTop: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          © 2026 Project YuJiDi. Built for serious traders.
        </p>
      </footer>
    </div>
  );
}

export default Login;