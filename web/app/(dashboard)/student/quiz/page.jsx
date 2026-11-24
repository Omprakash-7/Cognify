'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function StudentQuizListPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  // Load batches and progress on mount
  useEffect(() => {
    async function init() {
      try {
        const [batchRes, progressRes] = await Promise.all([
          apiRequest('/api/batches'),
          apiRequest('/api/me/progress').catch(() => ({ progress: [] })),
        ]);

        if (batchRes.batches && batchRes.batches.length > 0) {
          setBatches(batchRes.batches);
          setSelectedBatchId(batchRes.batches[0].id);
        }

        const map = {};
        (progressRes.progress || []).forEach((p) => {
          map[p.quizId] = p;
        });
        setProgressMap(map);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to initialize quizzes');
      }
    }
    init();
  }, []);

  // Load quizzes when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    async function loadQuizzes() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/items?type=quiz`);
        setQuizzes(data.items || []);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load quizzes for batch');
      } finally {
        setIsLoading(false);
      }
    }
    loadQuizzes();
  }, [selectedBatchId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">assignment_turned_in</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight">Practice Tests &amp; DPPs</h1>
            <p className="text-xs text-on-surface-variant">
              Chapter-wise Daily Practice Problems calibrated for JEE Advanced &amp; NEET
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Batch:
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

      {/* Quizzes Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm text-on-surface-variant">Loading practice tests...</div>
      ) : quizzes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">assignment_late</span>
          <h3 className="text-base font-semibold text-on-surface">No Quizzes Available Yet</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Your teacher has not published any approved quizzes for this batch yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => {
            const prog = progressMap[quiz.id];
            const hasAttempted = Boolean(prog && prog.attemptsCount > 0);
            const questionCount = quiz.content?.questions?.length || prog?.totalQuestions || 0;

            return (
              <div
                key={quiz.id}
                className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold uppercase tracking-wider">
                      DPP #{quiz.id.slice(0, 4)}
                    </span>
                    {hasAttempted ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-tertiary">
                        <span className="material-symbols-outlined text-[14px]">done_all</span>
                        Attempted ({prog.attemptsCount}x)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
                        Unattempted
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-on-surface mt-3 leading-snug">
                    {quiz.title}
                  </h3>

                  <div className="mt-4 flex items-center gap-4 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">quiz</span>
                      <span>{questionCount} Questions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">timer</span>
                      <span>{questionCount * 2} Mins</span>
                    </div>
                  </div>

                  {hasAttempted && (
                    <div className="mt-3 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs">
                      <span className="text-on-surface-variant">Best Score:</span>
                      <span className="font-bold text-primary">
                        {prog.bestScore} / {prog.totalQuestions} ({Math.round((prog.bestScore / prog.totalQuestions) * 100)}%)
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">Instant AI Scoring</span>
                  <Link
                    href={`/student/quiz/${quiz.id}`}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>{hasAttempted ? 'Re-attempt Quiz' : 'Start Quiz'}</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
