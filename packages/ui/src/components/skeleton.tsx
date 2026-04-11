/**
 * @file skeleton.tsx
 * @description Use to show a placeholder while content is loading.
 */
import { cn } from './utils';

/** Paints loading states visually mimicking the intended layout. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
