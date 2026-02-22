export interface SnoozePreset {
  id: string;
  label: string;
  until: Date;
  display: string;
}

function setLocalTime(base: Date, hours: number, minutes: number): Date {
  const next = new Date(base);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function nextWeekdayAt(hours: number, minutes: number, weekday: number, now: Date): Date {
  const next = setLocalTime(now, hours, minutes);
  const currentWeekday = next.getDay();
  let delta = (weekday - currentWeekday + 7) % 7;
  if (delta === 0 && next <= now) delta = 7;
  if (delta > 0) next.setDate(next.getDate() + delta);
  return next;
}

function formatPresetDisplay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(",", ", ");
}

export function getSnoozePresets(now = new Date()): SnoozePreset[] {
  const laterToday = new Date(now);
  laterToday.setHours(laterToday.getHours() + 3, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 0, 0);
  if (laterToday > endOfToday) {
    laterToday.setTime(endOfToday.getTime());
  }

  const tomorrow = setLocalTime(new Date(now.getTime() + 24 * 60 * 60 * 1000), 8, 0);
  const laterThisWeek = nextWeekdayAt(8, 0, 4, now); // Thu
  const thisWeekend = nextWeekdayAt(8, 0, 6, now); // Sat
  const daysUntilNextMonday = ((8 - now.getDay()) % 7) || 7;
  const nextWeek = setLocalTime(new Date(now.getTime() + daysUntilNextMonday * 24 * 60 * 60 * 1000), 8, 0);

  return [
    { id: "later-today", label: "Later today", until: laterToday, display: formatPresetDisplay(laterToday) },
    { id: "tomorrow", label: "Tomorrow", until: tomorrow, display: formatPresetDisplay(tomorrow) },
    { id: "later-this-week", label: "Later this week", until: laterThisWeek, display: formatPresetDisplay(laterThisWeek) },
    { id: "this-weekend", label: "This weekend", until: thisWeekend, display: formatPresetDisplay(thisWeekend) },
    { id: "next-week", label: "Next week", until: nextWeek, display: formatPresetDisplay(nextWeek) },
  ];
}

export function toDateTimeLocalValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
