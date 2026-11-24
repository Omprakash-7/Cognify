'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/client-api';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('student1@demo.test');
  const [password, setPassword] = useState('Password@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeRole, setActiveRole] = useState('student');

  function handleRoleSelect(role) {
    setActiveRole(role);
    if (role === 'student') {
      setEmail('student1@demo.test');
      setPassword('Password@123');
    } else if (role === 'teacher') {
      setEmail('teacher@demo.test');
      setPassword('Password@123');
    } else if (role === 'admin') {
      setEmail('admin@demo.test');
      setPassword('Password@123');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err.status === 429) {
        setError('Too many failed login attempts. Please wait 15 minutes before trying again.');
      } else {
        setError(err.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-on-surface">
      <header className="w-full py-4 px-8 border-b border-outline-variant/30 bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">school</span>
            </div>
            <span className="font-headline-sm text-xl font-bold text-primary tracking-tight">
              Cognify LMS
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            <span className="material-symbols-outlined text-tertiary text-[16px]">verified</span>
            <span>Institutional Access Portal</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl bg-surface-container-lowest shadow-xl border border-outline-variant/30 overflow-hidden min-h-[580px]">
          {/* Left Column: Brand Showcase & Architecture */}
          <div className="lg:col-span-5 bg-surface-container-low p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-surface-container-lowest px-3 py-1 rounded-full shadow-xs text-xs font-semibold text-primary uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                <span>Cognify AI Engine v4.2</span>
              </div>

              <div>
                <span className="text-xs uppercase tracking-widest text-primary font-bold block mb-1">
                  Institutional Architecture
                </span>
                <h1 className="text-2xl font-bold text-on-surface leading-tight">
                  Grounded AI Learning for Coaching Institutes
                </h1>
                <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                  Empowering faculty cohorts and aspirants with 100% citation-grounded notes,
                  automated quizzes, and doubt resolution.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-surface-container-lowest rounded-xl shadow-xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">fact_check</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-on-surface">Zero Hallucination Guarantee</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Answers mapped directly to uploaded syllabus PDFs, notes, and NCERT canonicals.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-lowest rounded-xl shadow-xs flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary-container text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-on-surface">Faculty Review Gate</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Teacher approval required before practice modules and notes deploy to cohorts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
              <span>Kota Main Campus • Node DC-01</span>
              <span className="font-mono text-outline">TLS 1.3 Strict</span>
            </div>
          </div>

          {/* Right Column: Sign In Form */}
          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-on-surface tracking-tight">Sign in to Cognify</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  Enter your credentials to access your batches and AI study vault.
                </p>
              </div>

              {/* Role Switcher Pills */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="uppercase text-on-surface-variant font-semibold tracking-wider">
                    Select Role (Demo)
                  </label>
                  <span className="text-outline">Click pill to autofill</span>
                </div>
                <div className="grid grid-cols-3 gap-2 p-1 bg-surface-container-low rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('student')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      activeRole === 'student'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">school</span>
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('teacher')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      activeRole === 'teacher'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">psychology</span>
                    <span>Faculty</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelect('admin')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      activeRole === 'admin'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-error-container text-on-error-container rounded-xl text-xs flex items-center gap-2 border border-error/20">
                  <span className="material-symbols-outlined text-error text-[18px]">error</span>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface">Institutional Email</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. student1@demo.test"
                      className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface">Password</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-on-surface-variant text-[18px]">
                      lock
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full h-10 pl-10 pr-3 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 text-sm font-semibold">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      <span>Authenticating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span>Sign In to Workspace</span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </span>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full bg-surface-container-low py-4 px-8 border-t border-outline-variant/30 text-xs text-on-surface-variant">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span>© 2026 Cognify LMS. Built for Coaching Institutes.</span>
          <span>Single Sign-On & RAG-Grounded Verified</span>
        </div>
      </footer>
    </div>
  );
}
