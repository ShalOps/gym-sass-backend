export function parseAvailabilityTime(baseDate: Date, timeStr: string): Date {

  const result = new Date(baseDate);
  const [hours, minutes] = timeStr.split(':').map(Number);
  result.setHours(hours, minutes, 0, 0);

  return result;
}