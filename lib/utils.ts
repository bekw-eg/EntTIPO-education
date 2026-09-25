import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as percentage string
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format seconds into mm:ss
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format a date as locale string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format relative time (e.g. "2 дня назад")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return "только что";
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дня назад`;
  return formatDate(d);
}

/**
 * Get today's date at midnight (for daily comparisons)
 */
export function getTodayMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Calculate streak from array of dates
 */
export function calculateStreak(dates: Date[]): number {
  if (!dates.length) return 0;

  const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
  const today = getTodayMidnight();
  let streak = 0;
  let currentDate = today;

  for (const date of sorted) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (currentDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = d;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Get difficulty label in Russian
 */
export function getDifficultyLabel(difficulty: number): string {
  const labels: Record<number, string> = {
    1: "Начало",
    2: "Базовый",
    3: "Средний",
    4: "Сложный",
    5: "Экспертный",
  };
  return labels[difficulty] ?? "Неизвестно";
}

/**
 * Get difficulty color class
 */
export function getDifficultyColor(difficulty: number): string {
  const colors: Record<number, string> = {
    1: "text-green-500",
    2: "text-blue-500",
    3: "text-yellow-500",
    4: "text-orange-500",
    5: "text-red-500",
  };
  return colors[difficulty] ?? "text-gray-500";
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
