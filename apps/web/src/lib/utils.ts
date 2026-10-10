import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function assertNever(value: never): never {
  throw new Error(`مقدار ناشناخته: ${String(value)}`);
}
