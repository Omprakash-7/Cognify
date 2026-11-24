'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

export default function TeacherAnalyticsPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');

  // Load batches on mount
  useEffect(() => {
    async function loadBatches() {
      try {
        const data = await apiRequest('/api/batches');
        if (data.batches && data.batches.length > 0) {
          setBatches(data.batches);
          setSelectedBatchId(data.batches[0].id);
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load batches');
      }
    }
    loadBatches();
  }, []);

  // Load analytics when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    async function loadBatchAnalytics() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/analytics`);
        setAnalytics(data);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load batch analytics');
      } finally {
        setIsLoading(false);
      }
    }
    loadBatchAnalytics();
  }, [selectedBatchId]);

  const summary = analytics?.summary || {};
  const hardest = analytics?.hardestQuestions || [];
  const roster = analytics?.studentProgress || [];
  const unanswered = analytics?.unansweredQuestions || [];
  const chatActivity = analytics?.chatActivity || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Pedagogical Intelligence</h1>
          <p className="text-xs text-on-surface-variant">
            Data-driven cohort mastery, concept difficulty heatmaps, and chat retrieval telemetry
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Cohort:
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm font-medium text-on-surface focus:outline-none focus:border-primary"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.subject})
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorBanner && (
        <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Cohort Accuracy</span>
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
          </div>
          <div className="text-2xl font-bold text-primary mt-2">
            {summary.avgQuizScore !== undefined ? `${Math.round(summary.avgQuizScore * 100)}%` : 'N/A'}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            Across {summary.totalAttempts || 0} student submissions
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Grounded Materials</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">menu_book</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{summary.totalDocuments || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            {summary.totalGeneratedItems || 0} approved artifacts
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Unresolved Doubts</span>
            <span className="material-symbols-outlined text-error text-[20px]">help_center</span>
          </div>
          <div className="text-2xl font-bold text-error mt-2">{summary.openTickets || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">
            out of {summary.totalTickets || 0} total tickets
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">DPP Practice Quizzes</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">assignment</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{summary.totalQuizzes || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Calibrated for JEE / NEET</div>
        </div>
      </div>

      {/* Hardest Questions & Conceptual Bottlenecks */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h3 className="text-base font-bold text-on-surface">Hardest Questions &amp; Misconceptions</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Problems with the highest error rates across student cohort test attempts
            </p>
          </div>
          <span className="px-2 py-0.5 rounded bg-error/10 text-error text-xs font-bold uppercase">
            Top Friction Points
          </span>
        </div>

        {hardest.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center py-6">
            No quiz error telemetry recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {hardest.map((item, idx) => (
              <div
                key={item.questionId || (item.quizId && item.questionIndex !== undefined ? `${item.quizId}-${item.questionIndex}` : idx)}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-medium text-on-surface">
                    <MathRenderer content={item.question} />
                  </div>
                  <div className="text-xs text-on-surface-variant flex items-center gap-3">
                    <span>{item.totalAttempts} total attempts</span>
                    <span>•</span>
                    <span className="text-error font-medium">{item.incorrectCount} incorrect</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-sm font-bold text-error">
                      {Math.round(item.errorRate * 100)}%
                    </span>
                    <span className="block text-[10px] text-on-surface-variant uppercase">Error Rate</span>
                  </div>
                  <div className="w-24 h-2 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-error rounded-full"
                      style={{ width: `${Math.round(item.errorRate * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2-Column: Student Roster Performance & Unanswered RAG Queries */}
      <div className="grid grid-cols-12 gap-6">
        {/* Student Progress (7 cols) */}
        <div className="col-span-12 lg:col-span-7 p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-on-surface">Student Performance Roster</h3>

          {roster.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">
              No student submissions registered for this batch yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">
                    <th className="pb-2.5 font-semibold">Student</th>
                    <th className="pb-2.5 font-semibold">Tests Taken</th>
                    <th className="pb-2.5 font-semibold">Avg Score</th>
                    <th className="pb-2.5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                  {roster.map((st, idx) => {
                    const studentKey = st.studentId || st.user_id || st.id || idx;
                    const studentName = st.studentName || st.name || 'Student';
                    const studentEmail = st.studentEmail || st.email || '';
                    const quizzesAttempted = st.quizzesAttempted ?? st.attempts_count ?? 0;
                    const rawScore = st.avgScore !== undefined ? st.avgScore : (st.avg_score_pct || 0) / 100;
                    const scorePct = Math.round(rawScore * 100);

                    return (
                      <tr key={studentKey} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-2.5">
                          <div className="font-semibold text-on-surface">{studentName}</div>
                          <div className="text-[11px] text-on-surface-variant">{studentEmail}</div>
                        </td>
                        <td className="py-2.5 font-mono">{quizzesAttempted}</td>
                        <td className="py-2.5 font-bold text-primary">
                          {scorePct}%
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rawScore >= 0.75
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : rawScore >= 0.5
                                ? 'bg-surface-container-high text-on-surface'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            {rawScore >= 0.75 ? 'Mastery' : rawScore >= 0.5 ? 'Average' : 'Intervention'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Unanswered Queries Log (5 cols) */}
        <div className="col-span-12 lg:col-span-5 p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-on-surface">Ungrounded AI Queries</h3>
            <span className="text-[11px] text-on-surface-variant">Syllabus gaps</span>
          </div>
          <p className="text-xs text-on-surface-variant">
            Student questions that triggered out-of-material fallbacks in the AI assistant:
          </p>

          {unanswered.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-6">
              All student AI queries were successfully answered from batch documents!
            </p>
          ) : (
            <div className="space-y-2.5">
              {unanswered.map((u, i) => (
                <div
                  key={u.message_id || u.messageId || u.id || i}
                  className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs space-y-1"
                >
                  <div className="font-medium text-on-surface italic">&ldquo;{u.query}&rdquo;</div>
                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>Asked {u.count} times</span>
                    <span>{new Date(u.lastAsked).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
