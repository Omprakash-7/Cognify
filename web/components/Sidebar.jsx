'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * Sidebar Navigation Component
 *
 * Provides persistent vertical navigation tailored dynamically to the authenticated
 * user's role (Institute Admin, Faculty Teacher, or Aspirant Student).
 *
 * @param {object} props
 * @param {object} props.user - Active authenticated user session
 * @param {'admin'|'teacher'|'student'} [props.user.role='student'] - Current user tenancy role
 * @returns {React.ReactElement}
 */
export function Sidebar({ user }) {
  const pathname = usePathname();
  const role = user?.role || 'student';

  // Navigation schema for student aspirational learning
  const studentLinks = [
    { href: '/student', label: 'My Batches', icon: 'school' },
    { href: '/student/chat', label: 'AI Study Tutor', icon: 'smart_toy' },
    { href: '/student/study', label: 'Lecture Notes', icon: 'menu_book' },
    { href: '/student/quiz', label: 'Practice Tests (DPP)', icon: 'assignment_turned_in' },
    { href: '/student/flashcards', label: 'Formula Cards', icon: 'style' },
    { href: '/student/doubts', label: 'Doubt Desk', icon: 'help_center' },
    { href: '/student/progress', label: 'Learning Analytics', icon: 'trending_up' },
  ];

  // Navigation schema for faculty members & educators
  const teacherLinks = [
    { href: '/teacher', label: 'Teacher Console', icon: 'dashboard' },
    { href: '/teacher/review', label: 'Document & Drafts Vault', icon: 'fact_check' },
    { href: '/teacher/batches', label: 'My Batches & Rosters', icon: 'groups' },
    { href: '/teacher/doubts', label: 'Doubt Triage Desk', icon: 'help_center' },
    { href: '/teacher/analytics', label: 'Pedagogical Analytics', icon: 'analytics' },
  ];

  // Navigation schema for institute administrators
  const adminLinks = [
    { href: '/admin', label: 'Admin Portal', icon: 'admin_panel_settings' },
    { href: '/admin/users', label: 'User Directory', icon: 'badge' },
    { href: '/admin/batches', label: 'Batch Architect', icon: 'account_tree' },
    { href: '/admin/analytics', label: 'Campus Analytics', icon: 'insights' },
  ];

  const links = role === 'admin' ? adminLinks : role === 'teacher' ? teacherLinks : studentLinks;

  return (
    <aside
      className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest border-r border-outline-variant/30 z-40 hidden lg:flex flex-col py-4 px-3 overflow-y-auto"
      aria-label="Sidebar Navigation"
    >
      <div className="px-3 pb-3 mb-2 border-b border-outline-variant/20">
        <span className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
          Academic Workspace
        </span>
        <div className="text-sm font-semibold text-primary mt-1">JEE Advanced &amp; NEET</div>
      </div>

      <nav className="flex-1 space-y-1" role="navigation">
        {links.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-3 border-t border-outline-variant/20 px-2">
        <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center justify-between text-xs text-on-surface-variant">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span>RAG Grounding: 100%</span>
          </div>
          <span className="font-mono text-outline">v4.2</span>
        </div>
      </div>
    </aside>
  );
}

