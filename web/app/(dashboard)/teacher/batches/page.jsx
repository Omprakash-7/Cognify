'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function TeacherBatchesPage() {
  const [batches, setBatches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    async function loadBatches() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest('/api/batches');
        setBatches(data.batches || []);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load batches');
      } finally {
        setIsLoading(false);
      }
    }
    loadBatches();
  }, []);

  async function handleCreateBatch(e) {
    e.preventDefault();
    if (!batchName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorBanner('');
    try {
      const res = await apiRequest('/api/batches', {
        method: 'POST',
        body: JSON.stringify({ name: batchName.trim(), subject: subject.trim() }),
      });
      if (res.batch) {
        setBatches((prev) => [res.batch, ...prev]);
        setBatchName('');
        setIsModalOpen(false);
        setSuccessBanner('New batch created successfully!');
        setTimeout(() => setSuccessBanner(''), 4000);
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to create batch');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Assigned Batches &amp; Rosters</h1>
          <p className="text-xs text-on-surface-variant">
            Create academic cohorts, manage student rosters, and inspect enrolled members
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Create New Batch</span>
        </button>
      </div>

      {errorBanner && (
        <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* Batches Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-on-surface-variant">Loading batches...</div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">groups</span>
          <h3 className="text-base font-semibold text-on-surface">No Batches Yet</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Click &ldquo;Create New Batch&rdquo; to set up your first cohort.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => (
            <div
              key={batch.id}
              className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold uppercase">
                    {batch.subject}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(batch.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-base font-bold text-on-surface mt-3">{batch.name}</h3>
                <p className="text-xs text-on-surface-variant mt-1 font-mono">
                  ID: {batch.id}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                <Link
                  href={`/teacher/batches/${batch.id}`}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">groups</span>
                  <span>Roster &amp; Students</span>
                </Link>
                <Link
                  href={`/teacher/analytics?batchId=${batch.id}`}
                  className="text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
                >
                  Analytics &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Academic Batch</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Batch Name
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g. JEE Advanced 2025 - Alpha"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Subject / Domain
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Physics, Chemistry, Mathematics"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!batchName.trim() || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Create Batch</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
