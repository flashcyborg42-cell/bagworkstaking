import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const SITE_BUTTON_CLASS = "OWFymn5C FR52tFZa";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function btnClass(...inputs: ClassValue[]) {
  return cn(SITE_BUTTON_CLASS, ...inputs);
}
