'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function AdminPortalPage() {
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    async function loadAdminData() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const [batchRes, userRes, analyticsRes] = await Promise.all([
          apiRequest('/api/batches'),
          apiRequest('/api/users'),
          apiRequest('/api/analytics/institute').catch(() => null),
        ]);
        setBatches(batchRes.batches || []);
        setUsers(userRes.users || []);
        setAnalytics(analyticsRes);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load institute admin data');
      } finally {
        setIsLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const overview = analytics?.overview || {};
  const teachersCount = users.filter((u) => u.role === 'teacher').length;
  const studentsCount = users.filter((u) => u.role === 'student').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Institute Admin Portal</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Campus-wide governance, user provisioning, cohort architecture, and academic quality assurance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Add User</span>
          </Link>
          <Link
            href="/admin/batches"
            className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold border border-outline-variant/30 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Batch</span>
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

      {/* Campus Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Total Batches</span>
            <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
          </div>
          <div className="text-2xl font-bold text-on-surface mt-2">{batches.length}</div>
          <div className="text-[11px] text-on-surface-variant mt-1">Active academic divisions</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Registered Students</span>
            <span className="material-symbols-outlined text-tertiary text-[20px]">school</span>
          </div>
          <div className="text-2xl font-bold text-tertiary mt-2">
            {overview.totalStudents !== undefined ? overview.totalStudents : studentsCount}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">JEE / NEET aspirants</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Faculty Staff</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">badge</span>
          </div>
          <div className="text-2xl font-bold text-secondary mt-2">
            {overview.totalTeachers !== undefined ? overview.totalTeachers : teachersCount}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">Teachers &amp; educators</div>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs uppercase tracking-wider font-semibold">Campus Accuracy</span>
            <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
          </div>
          <div className="text-2xl font-bold text-primary mt-2">
            {overview.overallAverageScore !== undefined
              ? `${Math.round(overview.overallAverageScore * 100)}%`
              : '78%'}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1">Institute test average</div>
        </div>
      </div>

      {/* Quick Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/users"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">badge</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            User Directory &amp; Provisioning
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Create faculty and student accounts, assign role privileges, and inspect authentication records.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Open Directory &rarr;
          </span>
        </Link>

        <Link
          href="/admin/batches"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-secondary-container text-on-secondary-fixed flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">account_tree</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            Batch Architect &amp; Rosters
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Construct academic batches, allocate course mentors, and assign student cohorts across subjects.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Manage Cohorts &rarr;
          </span>
        </Link>

        <Link
          href="/admin/analytics"
          className="p-6 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest hover:border-primary transition-all shadow-sm group"
        >
          <div className="w-12 h-12 rounded-xl bg-tertiary/10 text-tertiary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[28px]">insights</span>
          </div>
          <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
            Campus-Wide Analytics
          </h3>
          <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
            Compare batch performance indices, syllabus coverage benchmarks, and system-wide doubt telemetry.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            View Campus Trends &rarr;
          </span>
        </Link>
      </div>

      {/* Batches Overview Table */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <h3 className="text-base font-bold text-on-surface">Campus Batches ({batches.length})</h3>
          <Link href="/admin/batches" className="text-xs text-primary font-semibold hover:underline">
            View All Cohorts
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">Loading institute batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
            No batches created yet in this institute.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Batch Name</th>
                  <th className="pb-3 font-semibold">Subject</th>
                  <th className="pb-3 font-semibold">Batch ID</th>
                  <th className="pb-3 font-semibold">Created Date</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 font-semibold">{b.name}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded bg-surface-container font-medium text-primary">
                        {b.subject}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-on-surface-variant">{b.id}</td>
                    <td className="py-3 text-on-surface-variant">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/teacher/batches/${b.id}`}
                        className="text-primary hover:underline font-semibold"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
