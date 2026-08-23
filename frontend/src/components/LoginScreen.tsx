import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: { username: string; display_name: string; role: string }, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        const token = data.token;
        const user = data.user;

        if (rememberMe) {
          localStorage.setItem('cctv_auth_token', token);
          localStorage.setItem('cctv_username', user.username);
          localStorage.setItem('cctv_display_name', user.display_name);
          localStorage.setItem('cctv_role', user.role);
        } else {
          sessionStorage.setItem('cctv_auth_token', token);
          sessionStorage.setItem('cctv_username', user.username);
          sessionStorage.setItem('cctv_display_name', user.display_name);
          sessionStorage.setItem('cctv_role', user.role);
        }

        onLoginSuccess(user, token);
      } else {
        setErrorMsg(data.detail || 'Authentication failed. Invalid username or password.');
      }
    } catch {
      setErrorMsg('Connection error to surveillance server. Please verify backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808] flex items-center justify-center p-4 select-none overflow-y-auto">
      {/* Background Cyber Grid Lines */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(#3B82F6 1px, transparent 1px), linear-gradient(to right, #18181b 1px, transparent 1px), linear-gradient(to bottom, #18181b 1px, transparent 1px)',
          backgroundSize: '32px 32px, 64px 64px, 64px 64px',
        }}
      />

      <div className="relative w-full max-w-md bg-[#111111] border border-[#222222] rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#3B82F6]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding (Matching Exact Application Design) */}
        <div className="flex flex-col items-center text-center space-y-3">
          {/* Blue Hexagonal Camera Reticle Logo */}
          <div className="shrink-0 flex items-center justify-center">
            <svg className="h-12 w-12 shrink-0 drop-shadow-xl" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M18 2L32 10.0829V25.9171L18 34L4 25.9171V10.0829L18 2Z"
                fill="#2563EB"
              />
              <circle cx="18" cy="18" r="6.5" stroke="white" strokeWidth="2.2" fill="none" />
              <circle cx="18" cy="18" r="2.8" fill="white" />
            </svg>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center text-xl sm:text-2xl font-bold tracking-tight font-sans leading-none">
              <span className="text-white">CCTV</span>
              <span className="text-[#3B82F6] ml-2">HUB</span>
            </div>
            <p className="text-[10px] font-mono tracking-[0.22em] text-zinc-500 uppercase mt-2 leading-none font-medium">
              Surveillance System
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-150 font-sans">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="w-full bg-[#161616] border border-[#262626] rounded-xl pl-9 pr-3 py-2.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-mono"
                required
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider block">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                className="w-full bg-[#161616] border border-[#262626] rounded-xl pl-9 pr-10 py-2.5 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-[#3B82F6] transition-colors font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Remember Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-zinc-400 text-xs font-sans">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-[#333] text-[#3B82F6] focus:ring-0 bg-[#161616]"
              />
              <span className="text-[11px] text-zinc-400">Remember session</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 active:scale-[0.99] text-white text-xs font-semibold font-sans flex items-center justify-center gap-2 shadow-xl shadow-[#3B82F6]/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span className="font-mono">Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Badges */}
        <div className="pt-4 border-t border-[#1c1c1c] flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>SQLite Security Vault</span>
          </div>
          <span className="text-zinc-600">•</span>
          <span>Role-Based Access</span>
        </div>
      </div>
    </div>
  );
};
