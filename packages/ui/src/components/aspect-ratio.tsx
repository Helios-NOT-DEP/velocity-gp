/**
 * @file aspect-ratio.tsx
 * @description Displays content within a desired ratio.
 */
'use client';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

/** Maintains responsive dimensions for embedded media and responsive imagery. */
function AspectRatio({ ...props }: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };
