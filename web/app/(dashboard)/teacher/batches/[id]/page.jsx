'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/client-api';

export default function TeacherBatchDetailsPage() {
  const params = useParams();
  const batchId = params?.id;

  const [batch, setBatch] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    let active = true;
    if (!batchId) return;
    (async () => {
      try {
        const [batchRes, docRes] = await Promise.all([
          apiRequest(`/api/batches/${batchId}`),
          apiRequest(`/api/batches/${batchId}/documents`).catch(() => ({ documents: [] })),
        ]);
        if (active) {
          setBatch({ ...(batchRes.batch || batchRes), members: batchRes.members || [] });
          setDocuments(docRes.documents || []);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setErrorBanner(err.message || 'Failed to load batch details');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [batchId]);

  async function reloadData() {
    if (!batchId) return;
    try {
      const [batchRes, docRes] = await Promise.all([
        apiRequest(`/api/batches/${batchId}`),
        apiRequest(`/api/batches/${batchId}/documents`).catch(() => ({ documents: [] })),
      ]);
      setBatch({ ...(batchRes.batch || batchRes), members: batchRes.members || [] });
      setDocuments(docRes.documents || []);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load batch details');
    }
  }

  async function handleOpenAddStudent() {
    setIsAddModalOpen(true);
    setModalError('');
    try {
      const data = await apiRequest('/api/users?role=student');
      const allStudents = data.users || [];
      const currentMemberIds = new Set((batch?.members || []).map((m) => m.id));
      const unassigned = allStudents.filter((st) => !currentMemberIds.has(st.id));
      setAvailableStudents(unassigned);
      if (unassigned.length > 0) {
        setSelectedStudentId(unassigned[0].id);
      } else {
        setSelectedStudentId('');
      }
    } catch (err) {
      setModalError(err.message || 'Failed to load student directory');
    }
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    if (!selectedStudentId || isSubmitting) return;

    setIsSubmitting(true);
    setModalError('');
    setErrorBanner('');
    try {
      await apiRequest(`/api/batches/${batchId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedStudentId, role: 'student' }),
      });
      setSuccessBanner('Student successfully enrolled in batch!');
      setIsAddModalOpen(false);
      await reloadData();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to enroll student');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId) {
    if (!confirm('Are you sure you want to remove this member from the batch?')) return;

    try {
      await apiRequest(`/api/batches/${batchId}/members/${userId}`, {
        method: 'DELETE',
      });
      setSuccessBanner('Member removed from batch.');
      reloadData();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to remove member');
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-on-surface-variant font-medium">Loading batch roster...</p>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-lg font-bold text-on-surface">Batch Not Found</h2>
        <Link href="/teacher/batches" className="text-xs text-primary font-semibold hover:underline">
          &larr; Back to Batches
        </Link>
      </div>
    );
  }

  const members = batch.members || [];
  const teachers = members.filter((m) => m.role === 'teacher');
  const students = members.filter((m) => m.role === 'student');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/batches"
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-on-surface tracking-tight">{batch.name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-fixed text-[11px] font-bold uppercase">
                {batch.subject}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5 font-mono">ID: {batch.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddStudent}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>Enroll Student</span>
          </button>
          <Link
            href="/teacher/review"
            className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold border border-outline-variant/30 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Upload Material</span>
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

      {successBanner && (
        <div className="p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* Roster & Materials Columns */}
      <div className="grid grid-cols-12 gap-6">
        {/* Enrolled Students Roster (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <h3 className="text-base font-bold text-on-surface">
                Enrolled Students ({students.length})
              </h3>
              <span className="text-xs text-on-surface-variant">Active Learners</span>
            </div>

            {students.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
                No students enrolled in this batch yet. Click &ldquo;Enroll Student&rdquo; above.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/10">
                {students.map((student) => (
                  <div
                    key={student.id || student.user_id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-surface-container-low px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center font-bold text-xs">
                        {(student.full_name || student.fullName) ? (student.full_name || student.fullName)[0].toUpperCase() : 'S'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-on-surface">
                          {student.full_name || student.fullName || 'Student'}
                        </div>
                        <div className="text-xs text-on-surface-variant">{student.email}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveMember(student.id || student.user_id)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                      title="Remove from batch"
                    >
                      <span className="material-symbols-outlined text-[18px]">person_remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Faculty Section */}
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-on-surface">Assigned Faculty ({teachers.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id || teacher.user_id}
                  className="p-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-low flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                    {(teacher.full_name || teacher.fullName) ? (teacher.full_name || teacher.fullName)[0].toUpperCase() : 'T'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-on-surface">{teacher.full_name || teacher.fullName || 'Teacher'}</div>
                    <div className="text-[11px] text-on-surface-variant">{teacher.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Uploaded Course Documents (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
              <h3 className="text-base font-bold text-on-surface">Batch Documents</h3>
              <span className="text-xs text-primary font-semibold">{documents.length} Files</span>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
                No syllabus documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-on-surface truncate">{doc.title}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          doc.status === 'ready'
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : doc.status === 'processing'
                            ? 'bg-secondary-container text-on-secondary-fixed'
                            : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {doc.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-on-surface-variant flex items-center justify-between">
                      <span>{doc.file_type?.toUpperCase()}</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/teacher/review"
                className="w-full py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Manage in Review Vault</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Enroll Student</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Select Student
                </label>
                {availableStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    All students in the institute are already enrolled in this batch.
                  </p>
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                  >
                    {availableStudents.map((st) => (
                      <option key={st.id || st.user_id} value={st.id || st.user_id}>
                        {st.full_name || st.fullName || 'Student'} ({st.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirm Enrollment</span>
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
