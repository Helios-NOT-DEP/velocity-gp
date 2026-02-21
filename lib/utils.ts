// Utility: Tailwind class name merger (lightweight cn helper)
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
