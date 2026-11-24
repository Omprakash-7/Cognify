'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [batchDetails, setBatchDetails] = useState(null);
  const [allUsers, setAllUsers] = useState([]);

  // Create Batch modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState('');
  const [newSubject, setNewSubject] = useState('Physics');

  // Add Member modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('student');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const [batchRes, userRes] = await Promise.all([
          apiRequest('/api/batches'),
          apiRequest('/api/users'),
        ]);
        const bList = batchRes.batches || [];
        setBatches(bList);
        setAllUsers(userRes.users || []);
        if (bList.length > 0) {
          setSelectedBatchId(bList[0].id);
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to initialize batch architect');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Load details when selected batch changes
  useEffect(() => {
    let active = true;
    if (!selectedBatchId) return;
    (async () => {
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}`);
        if (active) setBatchDetails(data.batch || data);
      } catch (err) {
        if (active) setErrorBanner(err.message || 'Failed to load batch details');
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedBatchId]);

  async function handleCreateBatch(e) {
    e.preventDefault();
    if (!newBatchName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorBanner('');
    try {
      const res = await apiRequest('/api/batches', {
        method: 'POST',
        body: JSON.stringify({ name: newBatchName.trim(), subject: newSubject.trim() }),
      });
      if (res.batch) {
        setBatches((prev) => [res.batch, ...prev]);
        setSelectedBatchId(res.batch.id);
        setIsCreateModalOpen(false);
        setNewBatchName('');
        setSuccessBanner('New academic cohort created successfully!');
        setTimeout(() => setSuccessBanner(''), 4000);
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to create batch');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberUserId || !selectedBatchId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorBanner('');
    try {
      await apiRequest(`/api/batches/${selectedBatchId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberUserId, role: memberRole }),
      });
      setIsAddMemberModalOpen(false);
      setSuccessBanner('Member assigned to batch successfully!');
      // Reload details
      const data = await apiRequest(`/api/batches/${selectedBatchId}`);
      setBatchDetails(data.batch || data);
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to add member to batch');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm('Remove this member from the batch cohort?')) return;
    try {
      await apiRequest(`/api/batches/${selectedBatchId}/members/${userId}`, {
        method: 'DELETE',
      });
      setSuccessBanner('Member removed.');
      const data = await apiRequest(`/api/batches/${selectedBatchId}`);
      setBatchDetails(data.batch || data);
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to remove member');
    }
  }

  const members = batchDetails?.members || [];
  const teachers = members.filter((m) => m.role === 'teacher');
  const students = members.filter((m) => m.role === 'student');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Batch Architect &amp; Rosters</h1>
          <p className="text-xs text-on-surface-variant">
            Structure academic cohorts, assign lead instructors, and manage student enrollments
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Create New Cohort</span>
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

      {/* 2-Column: Left Batch Selector / Right Roster & Assignment */}
      <div className="grid grid-cols-12 gap-6">
        {/* Batches List (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-3">
          <h3 className="text-sm font-bold text-on-surface">Campus Batches ({batches.length})</h3>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">Loading batches...</div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-2xl">
              No batches created yet.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {batches.map((b) => {
                const isSelected = b.id === selectedBatchId;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBatchId(b.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-surface-container-high text-primary shadow-sm'
                        : 'border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-sm truncate max-w-[180px]">{b.name}</span>
                      <span className="px-2 py-0.5 rounded bg-surface-container text-[10px] font-bold uppercase">
                        {b.subject}
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant mt-2 font-mono truncate">
                      ID: {b.id}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Batch Details & Members Roster (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {batchDetails ? (
            <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-on-surface">{batchDetails.name}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold uppercase">
                      {batchDetails.subject}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Total Members: {members.length} ({teachers.length} Faculty, {students.length} Students)
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsAddMemberModalOpen(true);
                    if (allUsers.length > 0) setMemberUserId(allUsers[0].id);
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span>
                  <span>Assign Member</span>
                </button>
              </div>

              {/* Faculty Section */}
              <div className="space-y-3">
                <h4 className="text-xs uppercase tracking-wider font-bold text-primary">
                  Assigned Faculty Teachers ({teachers.length})
                </h4>
                {teachers.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">No faculty assigned to this batch.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teachers.map((t) => (
                      <div
                        key={t.id || t.user_id}
                        className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                            {(t.full_name || t.fullName) ? (t.full_name || t.fullName)[0].toUpperCase() : 'T'}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-on-surface">{t.full_name || t.fullName || 'Teacher'}</div>
                            <div className="text-[11px] text-on-surface-variant">{t.email}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(t.id || t.user_id)}
                          className="p-1 rounded text-on-surface-variant hover:text-error"
                          title="Remove faculty"
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students Section */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs uppercase tracking-wider font-bold text-on-surface-variant">
                  Enrolled Students ({students.length})
                </h4>
                {students.length === 0 ? (
                  <p className="text-xs text-on-surface-variant italic">No students enrolled yet.</p>
                ) : (
                  <div className="divide-y divide-outline-variant/10">
                    {students.map((st) => (
                      <div
                        key={st.id || st.user_id}
                        className="py-2.5 flex items-center justify-between gap-2 hover:bg-surface-container-low px-2 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                            {(st.full_name || st.fullName) ? (st.full_name || st.fullName)[0].toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-on-surface">{st.full_name || st.fullName || 'Student'}</div>
                            <div className="text-[11px] text-on-surface-variant">{st.email}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveMember(st.id || st.user_id)}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                          title="Remove student"
                        >
                          <span className="material-symbols-outlined text-[16px]">person_remove</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-16 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-lowest">
              Select a batch on the left to inspect and configure cohort membership.
            </div>
          )}
        </div>
      </div>

      {/* Create Batch Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Academic Batch</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
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
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  placeholder="e.g. JEE Main Droppers Batch B"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Mathematics, Physics, Chemistry"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newBatchName.trim() || isSubmitting}
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

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign User to Batch</h3>
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Select User
                </label>
                <select
                  value={memberUserId}
                  onChange={(e) => setMemberUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                >
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.fullName || 'User'} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Batch Membership Role
                </label>
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher (Instructor)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!memberUserId || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirm Assignment</span>
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
