import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-on-primary hover:opacity-90 shadow-sm',
        primary: 'bg-primary text-on-primary hover:opacity-90 shadow-sm',
        outline: 'border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low',
        secondary: 'bg-secondary-container text-on-secondary-fixed hover:opacity-90',
        ghost: 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
        destructive: 'bg-error text-white hover:opacity-90',
        link: 'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2 gap-2',
        sm: 'h-8 px-3 text-xs gap-1.5',
        lg: 'h-11 px-6 text-base gap-2',
        icon: 'h-9 w-9 p-0 flex items-center justify-center',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export function Button({ className, variant, size, children, ...props }) {
  return (
    <button className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {children}
    </button>
  );
}
