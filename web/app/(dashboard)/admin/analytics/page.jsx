'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    async function loadInstituteAnalytics() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const res = await apiRequest('/api/analytics/institute');
        setData(res);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load campus analytics');
      } finally {
        setIsLoading(false);
      }
    }
    loadInstituteAnalytics();
  }, []);

  const overview = data?.overview || {};
  const batchComparisons = data?.batchComparisons || [];
  const topIssues = data?.topIssues || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Campus-Wide Academic Analytics</h1>
          <p className="text-xs text-on-surface-variant">
            Cross-cohort benchmarks, macro accuracy metrics, and institute-level conceptual trends
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-semibold">
            Live Campus Feed
          </span>
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Batches</span>
            <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{overview.totalBatches || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Active cohorts</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Students</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">school</span>
          </div>
          <div className="text-2xl font-bold text-tertiary mt-2">{overview.totalStudents || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Enrolled aspirants</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Faculty</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
          </div>
          <div className="text-2xl font-bold text-secondary mt-2">{overview.totalTeachers || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Instructors</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Documents</span>
            <span className="material-symbols-outlined text-primary text-[20px]">menu_book</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{overview.totalDocuments || 0}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Syllabus PDFs grounded</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Campus Accuracy</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">trending_up</span>
          </div>
          <div className="text-2xl font-bold text-primary mt-2">
            {overview.overallAverageScore !== undefined
              ? `${Math.round(overview.overallAverageScore * 100)}%`
              : 'N/A'}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">Weighted test index</div>
        </div>
      </div>

      {/* Cross-Batch Comparative Table */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h3 className="text-base font-bold text-on-surface">Cohort Performance Benchmarks</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Side-by-side evaluation of student counts, quiz scores, and syllabus material depth
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">{batchComparisons.length} Batches</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-on-surface-variant">Loading benchmarks...</div>
        ) : batchComparisons.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
            No batch comparison data recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Cohort Name</th>
                  <th className="pb-3 font-semibold">Subject</th>
                  <th className="pb-3 font-semibold">Students</th>
                  <th className="pb-3 font-semibold">Syllabus Documents</th>
                  <th className="pb-3 font-semibold">Average Test Score</th>
                  <th className="pb-3 font-semibold text-right">Academic Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {batchComparisons.map((b, idx) => {
                  const scorePct = Math.round((b.averageScore || 0) * 100);
                  return (
                    <tr key={b.batchId || b.id || b.batch_id || idx} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 font-semibold">{b.batchName}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-primary">
                          {b.subject}
                        </span>
                      </td>
                      <td className="py-3 font-mono">{b.studentCount}</td>
                      <td className="py-3 font-mono">{b.documentCount}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary w-10">{scorePct}%</span>
                          <div className="w-24 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            scorePct >= 75
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : scorePct >= 50
                              ? 'bg-surface-container-high text-on-surface'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {scorePct >= 75 ? 'Tier 1 (Advanced)' : scorePct >= 50 ? 'Tier 2 (Core)' : 'Tier 3 (Support)'}
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

      {/* Top Conceptual Issues */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h3 className="text-base font-bold text-on-surface">Institute-Wide Conceptual Bottlenecks</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              High-frequency failure concepts aggregated across all batches and test attempts
            </p>
          </div>
          <span className="px-2 py-0.5 rounded bg-error-container text-on-error-container text-xs font-bold uppercase">
            Curriculum Review Alert
          </span>
        </div>

        {topIssues.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center py-6">
            No recurring conceptual bottlenecks detected across institute cohorts.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topIssues.map((issue, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-bold text-sm text-on-surface">{issue.topic}</h4>
                  <span className="px-2 py-0.5 rounded bg-error/10 text-error font-bold text-xs">
                    {issue.errorCount} Errors
                  </span>
                </div>
                <div className="mt-3 text-xs text-on-surface-variant">
                  High error density identified. Recommend scheduling faculty review workshop.
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
