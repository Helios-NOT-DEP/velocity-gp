import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  // Merge class conflicts after conditional composition.
  return twMerge(clsx(inputs));
}
