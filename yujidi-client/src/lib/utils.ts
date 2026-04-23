import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatGlobalTime(dateInput: string, showSeconds = false) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short', // e.g., "Apr" or "Oct"
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    timeZoneName: 'short',
  }).format(new Date(dateInput));
}