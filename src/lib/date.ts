export const PROJECT_TIME_ZONE = "Asia/Shanghai";

export type DateInput = Date | string;
export type DateFormat = "date" | "datetime";

export interface FormatDateOptions {
  timeZone?: string;
  format?: DateFormat;
}

export function parseDate(value: DateInput): Date {
  if (
    typeof value === "string" &&
    !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
    throw new RangeError(`Date string must include a time zone: ${value}`);
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${value}`);
  }
  return date;
}

export function formatDate(
  value: DateInput,
  { timeZone, format = "date" }: FormatDateOptions = {},
): string {
  const parts = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(format === "datetime"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const }
      : {}),
    timeZone,
  }).formatToParts(parseDate(value));

  const part = (type: "year" | "month" | "day" | "hour" | "minute") =>
    parts.find((item) => item.type === type)?.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  return format === "datetime"
    ? `${date} ${part("hour")}:${part("minute")}`
    : date;
}
