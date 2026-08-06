const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isDateKey(value) {
  if (typeof value !== "string" || !DATE_KEY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function parseDateKey(value) {
  if (!isDateKey(value)) throw new TypeError(`Invalid date key: ${value}`);
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value, days) {
  const date = typeof value === "string" ? parseDateKey(value) : new Date(value);
  date.setDate(date.getDate() + Number(days));
  return dateKey(date);
}

export function daysBetween(from, to) {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  return Math.round((end - start) / 86_400_000);
}
