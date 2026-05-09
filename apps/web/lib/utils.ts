import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}
