import { twMerge, type ClassNameValue } from 'tailwind-merge'

// Utility for merging Tailwind CSS class names
export function cn(...inputs: ClassNameValue[]) {
  return twMerge(inputs)
}
