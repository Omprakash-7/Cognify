'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function TeacherConsolePage() {
  const [batches, setBatches] = useState([]);
  const [openTickets, setOpenTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    async function loadOverview() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const [batchRes, ticketRes] = await Promise.all([
          apiRequest('/api/batches'),
          apiRequest('/api/tickets?status=open').catch(() => ({ tickets: [] })),
        ]);
        setBatches(batchRes.batches || []);
        setOpenTickets(ticketRes.tickets || []);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load teacher console data');
      } finally {
        setIsLoading(false);
      }
    }
    loadOverview();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Faculty Command Console</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Manage course curriculum, vet generated study artifacts, and resolve student doubts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/teacher/review"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Upload Document</span>
          </Link>
          <Link
            href="/teacher/batches"
            className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold border border-outline-variant/30 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Batch</span>
          </Link>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Active Batches</span>
            <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{batches.length}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Enrolled academic cohorts</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Pending Doubts</span>
            <span className="material-symbols-outlined text-error text-[20px]">help_center</span>
          </div>
          <div className="text-2xl font-bold text-error mt-2">{openTickets.length}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Awaiting faculty answers</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">RAG Grounding</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">verified</span>
          </div>
          <div className="text-2xl font-bold text-tertiary mt-2">100%</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Strict material bounding</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Quality Gate</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">Active</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Drafts require review</div>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/teacher/review"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">fact_check</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            Document &amp; Drafts Review
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Upload course PDFs, monitor processing jobs, edit draft content, and approve notes, summaries, and DPP quizzes.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Open Review Workspace &rarr;
          </span>
        </Link>

        <Link
          href="/teacher/doubts"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-error-container text-on-error-container flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">support_agent</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            Doubt Triage Desk
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Review {openTickets.length} open questions raised by your students and provide rich LaTeX mathematical answers.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Resolve Open Tickets &rarr;
          </span>
        </Link>

        <Link
          href="/teacher/analytics"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">analytics</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            Pedagogical Analytics
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Inspect hardest quiz questions, per-student accuracy scores, and frequently asked ungrounded queries.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            View Analytics &rarr;
          </span>
        </Link>
      </div>

      {/* My Batches List Preview */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <h3 className="text-base font-bold text-on-surface">Assigned Cohorts &amp; Batches</h3>
          <Link href="/teacher/batches" className="text-xs text-primary font-semibold hover:underline">
            Manage All Batches
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">Loading batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
            You are not assigned to any batches yet. Click &ldquo;Create Batch&rdquo; to start one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-surface-container-high text-[11px] font-semibold text-primary">
                      {batch.subject}
                    </span>
                    <span className="text-[11px] text-on-surface-variant">
                      Created {new Date(batch.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-on-surface mt-2">{batch.name}</h4>
                </div>

                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">Batch ID: {batch.id.slice(0, 6)}</span>
                  <Link
                    href={`/teacher/batches/${batch.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View Roster &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
