'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [filterRole, setFilterRole] = useState('all'); // all | teacher | student
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student'); // student | teacher

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [modalError, setModalError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    setErrorBanner('');
    try {
      const data = await apiRequest('/api/users');
      setUsers(data.users || []);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load user directory');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorBanner('');
    setModalError('');
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          full_name: fullName.trim(),
          fullName: fullName.trim(),
          role,
        }),
      });

      setSuccessBanner(`User "${fullName}" created successfully with role ${role}!`);
      setIsModalOpen(false);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('student');
      setModalError('');
      loadUsers();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (filterRole === 'all') return true;
    return u.role === filterRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">User Directory &amp; Provisioning</h1>
          <p className="text-xs text-on-surface-variant">
            Create teacher and student credentials, review campus roles, and manage account access
          </p>
        </div>

        <button
          onClick={() => {
            setModalError('');
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Create New User</span>
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

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 pb-1">
        {[
          { id: 'all', label: `All Users (${users.length})` },
          { id: 'teacher', label: `Faculty (${users.filter((u) => u.role === 'teacher').length})` },
          { id: 'student', label: `Students (${users.filter((u) => u.role === 'student').length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterRole(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterRole === tab.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* User Table */}
      <div className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-4">
        {isLoading ? (
          <div className="p-16 text-center text-xs text-on-surface-variant">Loading user directory...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-xl">
            No users found matching this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant uppercase tracking-wider">
                  <th className="pb-3 font-semibold">User</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 font-semibold flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        {(u.full_name || u.fullName || 'U')[0].toUpperCase()}
                      </div>
                      <span>{u.full_name || u.fullName || 'User'}</span>
                    </td>
                    <td className="py-3 text-on-surface-variant">{u.email}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          u.role === 'admin'
                            ? 'bg-primary text-on-primary'
                            : u.role === 'teacher'
                            ? 'bg-secondary-container text-on-secondary-fixed'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-[11px] text-on-surface-variant">{u.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Campus Account</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center justify-between">
                  <span>{modalError}</span>
                  <button type="button" onClick={() => setModalError('')} className="font-bold underline ml-2">
                    Dismiss
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. ramesh@demo.test"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Temporary Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters (e.g. Password123!)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Assigned Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                >
                  <option value="student">Student (Aspirant)</option>
                  <option value="teacher">Faculty Teacher</option>
                </select>
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
                  disabled={!email.trim() || !password.trim() || !fullName.trim() || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Create Account</span>
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
