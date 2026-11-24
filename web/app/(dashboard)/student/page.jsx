'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/client-api';
import { Button } from '@/components/ui/button';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [batches, setBatches] = useState([]);
  const [progress, setProgress] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [meData, batchesData, progressData, ticketsData] = await Promise.all([
          apiRequest('/api/auth/me').catch(() => null),
          apiRequest('/api/batches').catch(() => ({ batches: [] })),
          apiRequest('/api/me/progress').catch(() => ({ progress: [] })),
          apiRequest('/api/tickets').catch(() => ({ tickets: [] })),
        ]);
        if (meData?.user) setUser(meData.user);
        setBatches(batchesData.batches || []);
        setProgress(progressData.progress || []);
        setTickets(ticketsData.tickets || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      router.push('/student/chat');
    } else {
      router.push(`/student/chat?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const displayName = user?.full_name || user?.fullName || 'Sita R.';
  const firstName = displayName.split(' ')[0] || 'Aspirant';
  const resolvedTickets = tickets.filter((t) => t.status === 'answered' || t.status === 'closed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Meta & Greeting Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-primary dark:text-blue-300 font-bold tracking-wide">
              Target: JEE Advanced 2025
            </span>
            <span>•</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">Roll #KOTA-2024-8841</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Good morning, {firstName}.
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You are on track for JEE Main 2025. 2 upcoming mock tests and active syllabus notes ready in your Kota study portal.
          </p>
        </div>

        {/* Badges Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/50 text-xs font-bold text-orange-700 dark:text-orange-300 shadow-xs">
            <span className="material-symbols-outlined text-[16px] text-orange-500">local_fire_department</span>
            <span>14-Day Streak</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-xs">
            <span className="material-symbols-outlined text-[16px] text-emerald-500">verified</span>
            <span>84% Quiz Accuracy</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-xs font-bold text-primary dark:text-blue-300 shadow-xs">
            <span className="material-symbols-outlined text-[16px] text-primary">task_alt</span>
            <span>{resolvedTickets > 0 ? resolvedTickets : 18} Verified Doubts</span>
          </div>
        </div>
      </div>

      {/* Hero: Cognify AI Knowledge Ground Search Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#00386b] via-[#004b89] to-[#005fa3] text-white shadow-lg space-y-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-[15px] text-amber-300">auto_awesome</span>
              <span>Cognify AI Knowledge Ground</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Ask anything grounded in your batch materials...
            </h2>
            <p className="text-xs text-blue-100 leading-relaxed">
              Verified citations pulled directly from Tarun Sir&apos;s mechanics modules &amp; Dr. Anita&apos;s reaction logs.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md w-full">
            <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-white">
              <span className="material-symbols-outlined text-[20px] text-slate-400 pl-2">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Compare impulse vs torque formulas"
                className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm outline-none px-1 py-1"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#004b89] hover:bg-[#00386b] text-white text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1"
              >
                <span>Open Assistant</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Main 2-Column Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Batches (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">My Batches</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold">
                {batches.length} Enrolled
              </span>
            </div>
            <Link
              href="/student/study"
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <span>Curriculum Roadmap</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm">
              Loading enrolled batches...
            </div>
          ) : batches.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
              You are not enrolled in any batches yet. Contact your institute admin.
            </div>
          ) : (
            <div className="space-y-4">
              {batches.map((batch, idx) => (
                <div
                  key={batch.id}
                  className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary/50 transition-all space-y-4"
                >
                  {/* Batch Header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-base shadow-xs">
                        {batch.subject?.[0] || 'C'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{batch.name}</h3>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-primary dark:text-blue-300 text-[11px] font-bold">
                            {batch.subject || 'General'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Instructor: {idx % 2 === 0 ? 'Tarun Teacher (Kota Division Lead)' : 'Dr. Anita Sharma (Head of Chemistry)'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>RAG Grounding Active</span>
                    </span>
                  </div>

                  {/* Latest Batch Dispatch Callout */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                      <span>Latest Batch Dispatch</span>
                      <span className="text-primary font-semibold">Updated Today</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Comprehensive Formula &amp; Concept Revision Notes
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Approved study materials calibrated with vector embeddings for instant verified answers.
                    </p>
                  </div>

                  {/* Metrics Strip */}
                  <div className="grid grid-cols-4 gap-2 pt-1 pb-1 border-y border-slate-100 dark:border-slate-800 text-center">
                    <div>
                      <span className="block text-[11px] text-slate-400 uppercase font-semibold">Notes</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">12 Files</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 uppercase font-semibold">Quizzes</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">4 Sets</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 uppercase font-semibold">Flashcards</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">180 Deck</span>
                    </div>
                    <div>
                      <span className="block text-[11px] text-slate-400 uppercase font-semibold">Mastery</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">High Yield</span>
                    </div>
                  </div>

                  {/* Progress Bar & Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Target Phase 1 Completion</span>
                      <span className="font-bold text-primary dark:text-blue-400">78% Complete</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: '78%' }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/student/study?batchId=${batch.id}`}>
                        <Button className="font-semibold text-xs flex items-center gap-1.5 shadow-sm">
                          <span className="material-symbols-outlined text-[16px]">menu_book</span>
                          <span>Continue Learning</span>
                        </Button>
                      </Link>
                      <Link href={`/student/chat?batchId=${batch.id}`}>
                        <Button variant="outline" className="font-semibold text-xs flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                          <span>Ask AI Assistant</span>
                        </Button>
                      </Link>
                    </div>

                    <Link
                      href={`/student/doubts?batchId=${batch.id}`}
                      className="text-xs text-slate-600 hover:text-primary dark:text-slate-400 font-semibold flex items-center gap-1"
                    >
                      <span>Batch Doubts</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <Link
              href="/student/study"
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary transition-all flex items-center gap-3.5 group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[24px]">menu_book</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Study Notes</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Approved theory &amp; summaries</p>
              </div>
            </Link>

            <Link
              href="/student/quiz"
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary transition-all flex items-center gap-3.5 group"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Practice DPPs</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Self-evaluation tests</p>
              </div>
            </Link>

            <Link
              href="/student/flashcards"
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-primary transition-all flex items-center gap-3.5 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[24px]">style</span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Formula Cards</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Spaced recall decks</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Right Column: Revision, Doubt Desk, & Progress (1 col) */}
        <div className="space-y-6">
          {/* Daily Revision Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">style</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Daily Revision</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[11px] font-bold">
                Due Today
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                45 Cards due for repetition
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Optimized with SuperMemo Spaced Repetition (Physics: 20 • Chemistry: 25).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Daily Target: 31 of 45 recalled</span>
              <span className="font-bold text-primary dark:text-blue-400">68%</span>
            </div>

            <Link href="/student/flashcards" className="block">
              <Button className="w-full font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>Start 5-min Blitz</span>
              </Button>
            </Link>
          </div>

          {/* Doubt Resolution Widget */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">help_center</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Doubt Resolution</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                • 1 Resolved
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Have a doubt about a formula, derivation, or reaction? Submit directly to Kota faculty mentors.
            </p>

            <Link href="/student/doubts" className="block">
              <Button variant="outline" className="w-full font-semibold text-xs flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">support_agent</span>
                <span>Open Doubt Desk</span>
              </Button>
            </Link>
          </div>

          {/* Recent Quiz Performance */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Recent Quiz Progress</h3>
              <Link href="/student/progress" className="text-xs text-primary hover:underline font-semibold">
                View All
              </Link>
            </div>

            {progress.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No quiz attempts yet. Start a practice test to track your accuracy!
              </div>
            ) : (
              progress.slice(0, 4).map((p, idx) => {
                const pct = Math.round((p.bestScore / (p.totalQuestions || 1)) * 100);
                return (
                  <div key={p.quizId || p.quiz_id || p.id || idx} className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">
                        {p.quizTitle}
                      </span>
                      <span className="font-bold text-primary dark:text-blue-400">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Best: {p.bestScore} / {p.totalQuestions}</span>
                      <span>{p.attemptsCount} {p.attemptsCount === 1 ? 'attempt' : 'attempts'}</span>
                    </div>
                  </div>
                );
              })
            )}

            <Link href="/student/progress" className="block pt-1">
              <Button variant="outline" className="w-full text-xs font-semibold">
                Detailed Performance Analytics
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
