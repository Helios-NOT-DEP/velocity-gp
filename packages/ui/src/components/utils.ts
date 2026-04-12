/**
 * @file utils.ts
 * @description Tailwind CSS class merging algorithms.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Standardized sub-component or utility serving cn. */
export function cn(...inputs: ClassValue[]) {
  // Merge class conflicts after conditional composition.
  return twMerge(clsx(inputs));
}
