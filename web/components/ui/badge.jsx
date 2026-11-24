import { cn } from '@/lib/utils';

export function Badge({ children, variant = 'default', className }) {
  const styles = {
    default: 'bg-surface-container-high text-on-surface',
    approved: 'bg-tertiary-fixed text-on-tertiary-fixed',
    draft: 'bg-amber-100 text-amber-900',
    rejected: 'bg-red-100 text-red-900',
    open: 'bg-blue-100 text-blue-900',
    answered: 'bg-emerald-100 text-emerald-900',
    closed: 'bg-slate-200 text-slate-800',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
        styles[variant] || styles.default,
        className
      )}
    >
      {children}
    </span>
  );
}
