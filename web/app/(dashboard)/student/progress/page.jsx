'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function StudentProgressPage() {
  const [progressList, setProgressList] = useState([]);
  const [attemptsList, setAttemptsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const [progRes, attRes] = await Promise.all([
          apiRequest('/api/me/progress'),
          apiRequest('/api/me/attempts').catch(() => ({ attempts: [] })),
        ]);
        setProgressList(progRes.progress || []);
        setAttemptsList(attRes.attempts || []);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load progress analytics');
      } finally {
        setIsLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  // Compute aggregate stats
  const totalQuizzes = progressList.length;
  const totalAttempts = progressList.reduce((acc, p) => acc + (p.attemptsCount || 0), 0);
  const totalPossible = progressList.reduce((acc, p) => acc + (p.totalQuestions || 0), 0);
  const totalBestScored = progressList.reduce((acc, p) => acc + (p.bestScore || 0), 0);
  const overallAccuracy = totalPossible > 0 ? Math.round((totalBestScored / totalPossible) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight">Personal Learning Analytics</h1>
            <p className="text-xs text-on-surface-variant">
              Track mastery, test attempts, and concept retention over time
            </p>
          </div>
        </div>

        <Link
          href="/student/quiz"
          className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          <span>Take New Practice DPP</span>
        </Link>
      </div>

      {errorBanner && (
        <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Aggregate Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Overall Accuracy</span>
            <span className="material-symbols-outlined text-primary text-[20px]">percent</span>
          </div>
          <div className="text-2xl font-bold text-primary mt-2">{overallAccuracy}%</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Based on highest scoring attempts</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">DPPs Attempted</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">assignment_turned_in</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{totalQuizzes}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">{totalAttempts} total attempts registered</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Questions Solved</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">psychology</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{totalBestScored}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">out of {totalPossible} total problems</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Concept Retention</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">verified</span>
          </div>
          <div className="text-2xl font-bold text-tertiary mt-2">
            {overallAccuracy >= 80 ? 'Mastery Tier' : overallAccuracy >= 60 ? 'Proficient' : 'Developing'}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">Calibrated to JEE cutoffs</div>
        </div>
      </div>

      {/* Chapter Mastery Breakdown */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-on-surface">Chapter-wise Quiz Performance</h3>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">Loading quiz metrics...</div>
        ) : progressList.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
            No quiz attempts recorded yet. Attempt a practice test to see your progress!
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {progressList.map((item) => {
              const pct = item.totalQuestions > 0 ? Math.round((item.bestScore / item.totalQuestions) * 100) : 0;
              return (
                <div key={item.quizId} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-on-surface">{item.quizTitle}</h4>
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                      <span>{item.attemptsCount} attempts</span>
                      <span>•</span>
                      <span>
                        Last Score: {item.lastScore} / {item.totalQuestions}
                      </span>
                      <span>•</span>
                      <span className="text-primary font-semibold">
                        Best: {item.bestScore} / {item.totalQuestions}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:w-48">
                    <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-on-surface w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Attempts History Table */}
      {attemptsList.length > 0 && (
        <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-on-surface">Recent Test Submissions Log</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Test Title</th>
                  <th className="pb-3 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Accuracy</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {attemptsList.map((att) => {
                  const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
                  return (
                    <tr key={att.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 font-medium">{att.quiz_title || `Quiz #${att.quiz_id?.slice(0, 4)}`}</td>
                      <td className="py-3 font-mono">
                        {att.score} / {att.total}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-primary font-semibold">
                          {pct}%
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant">
                        {new Date(att.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/student/quiz/${att.quiz_id}`}
                          className="text-primary hover:underline font-semibold"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
