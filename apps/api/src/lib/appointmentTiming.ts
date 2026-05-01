export function isAppointmentFutureOrOngoing(endsAt: Date, now: Date = new Date()): boolean {
  return endsAt.getTime() > now.getTime();
}
