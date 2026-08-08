export interface CalendarBoardDay {
  date: Date;
  isoDate: string;
  label: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface CalendarBoardInterval {
  id: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
  title?: string;
  subtitle?: string;
  muted?: boolean;
}

export type CalendarBoardTrackKind = 'availability' | 'appointment';

export interface CalendarBoardTrack {
  id: string;
  label?: string;
  color: string;
  events: CalendarBoardInterval[];
  interactive?: boolean;
  kind?: CalendarBoardTrackKind;
}

export function formatCalendarMinutes(minutes: number): string {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function parseCalendarTime(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + (minutes || 0);
}

export function calendarIntervalDurationLabel(interval: Pick<CalendarBoardInterval, 'startMinutes' | 'endMinutes'>): string {
  const total = interval.endMinutes - interval.startMinutes;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  return hours ? `${hours}h` : `${minutes}m`;
}
