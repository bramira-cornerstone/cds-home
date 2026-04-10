import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

let cacheBustCounter = 0;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function cacheBustedUrl(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  cacheBustCounter = (cacheBustCounter + 1) % Number.MAX_SAFE_INTEGER;
  const stamp = `${Date.now().toString(36)}${cacheBustCounter.toString(36)}`;
  return `${url}${sep}cb=${stamp}`;
}
