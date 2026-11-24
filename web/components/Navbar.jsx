'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/client-api';

/**
 * Navbar Component
 *
 * Top navigation bar providing institute branding, active user identity,
 * role indicator badge, and secure session termination.
 *
 * @param {object} props
 * @param {object} props.user - Active authenticated user object
 * @param {string} props.user.id - User UUID
 * @param {string} props.user.email - User email
 * @param {string} [props.user.full_name] - User full name
 * @param {string} [props.user.fullName] - User full name fallback
 * @param {'admin'|'teacher'|'student'} props.user.role - User tenancy role
 * @returns {React.ReactElement}
 */
export function Navbar({ user }) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Graceful error fallback
    }
    router.push('/login');
    router.refresh();
  }

  const roleLabels = {
    admin: 'Institute Admin',
    teacher: 'Faculty Member',
    student: 'Aspirant Student',
  };

  const displayName = user?.full_name || user?.fullName || 'User';
  const initial = displayName ? displayName[0].toUpperCase() : 'U';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant/30 z-50 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg p-1">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-xs">
            <span className="material-symbols-outlined text-[20px]">school</span>
          </div>
          <span className="font-headline-sm text-xl font-bold text-primary tracking-tight">Cognify</span>
        </Link>
        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-surface-container text-primary text-xs font-medium border border-outline-variant/40">
          Apex Academy • Kota
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user?.role && (
          <span className="px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-fixed text-xs font-semibold uppercase tracking-wider">
            {roleLabels[user.role] || user.role}
          </span>
        )}

        <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/40">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold shadow-xs">
            {initial}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-sm font-medium text-on-surface leading-tight">
              {displayName}
            </span>
            <span className="text-xs text-on-surface-variant leading-tight">{user?.email}</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="ml-2 p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors flex items-center gap-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-error"
          title="Sign out of Cognify"
          aria-label="Logout"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

