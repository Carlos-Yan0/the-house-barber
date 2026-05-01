import { isBefore, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { isAppointmentFutureOrOngoing } from "./appointmentTiming";

const SCHEDULE_TZ = "America/Sao_Paulo";

const JS_DAY_TO_DAY_OF_WEEK: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export type LunchConflictAppointment = {
  scheduledAt: Date;
  endsAt: Date;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Almoco [lunchStart, lunchEnd); agendamento [scheduledAt, endsAt). */
function appointmentOverlapsLunchWindow(
  scheduledAt: Date,
  endsAt: Date,
  scheduleDayOfWeek: string,
  lunchStartHHmm: string,
  lunchEndHHmm: string
): boolean {
  const zonedStart = toZonedTime(scheduledAt, SCHEDULE_TZ);
  const localDay = JS_DAY_TO_DAY_OF_WEEK[zonedStart.getDay()];
  if (localDay !== scheduleDayOfWeek) return false;

  const dateStr = format(zonedStart, "yyyy-MM-dd");
  const [lsh, lsm] = lunchStartHHmm.split(":").map(Number);
  const [leh, lem] = lunchEndHHmm.split(":").map(Number);
  const lunchStart = fromZonedTime(`${dateStr}T${pad2(lsh)}:${pad2(lsm)}:00`, SCHEDULE_TZ);
  const lunchEnd = fromZonedTime(`${dateStr}T${pad2(leh)}:${pad2(lem)}:00`, SCHEDULE_TZ);

  return isBefore(scheduledAt, lunchEnd) && isAfter(endsAt, lunchStart);
}

export function hasLunchConflictWithFutureAppointments(
  appointments: LunchConflictAppointment[],
  scheduleDayOfWeek: string,
  lunchStartHHmm: string,
  lunchEndHHmm: string,
  now: Date = new Date()
): boolean {
  return appointments.some(
    (appointment) =>
      isAppointmentFutureOrOngoing(appointment.endsAt, now) &&
      appointmentOverlapsLunchWindow(
        appointment.scheduledAt,
        appointment.endsAt,
        scheduleDayOfWeek,
        lunchStartHHmm,
        lunchEndHHmm
      )
  );
}
