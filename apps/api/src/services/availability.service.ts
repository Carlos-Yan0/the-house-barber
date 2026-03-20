// src/services/availability.service.ts
import { prisma } from "../lib/prisma";
import { addMinutes, isBefore, isAfter, format, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";

export const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

/**
 * Parse a "yyyy-MM-dd" string as a Brazil-local date, avoiding UTC midnight issues.
 * "2026-03-22" → Sunday in Brazil, regardless of server timezone.
 */
function parseDateBR(dateInput: Date | string): { year: number; month: number; day: number; dayOfWeek: string } {
  // If it came as a Date object from new Date("2026-03-22"), it's UTC midnight
  // Convert to Brazil time to get the correct calendar date
  const zonedDate = toZonedTime(
    typeof dateInput === "string" ? new Date(dateInput) : dateInput,
    TIMEZONE
  );

  // Use format to extract the date parts in Brazil timezone
  const dateStr = format(zonedDate, "yyyy-MM-dd");
  const [year, month, day] = dateStr.split("-").map(Number);

  // Build a plain local Date to get day of week correctly
  const localDate = new Date(year, month - 1, day);
  const dayOfWeek = DAY_OF_WEEK_MAP[localDate.getDay()];

  return { year, month, day, dayOfWeek };
}

export async function getAvailableSlots(
  barberProfileId: string,
  date: Date,
  serviceDuration: number
): Promise<string[]> {
  const { year, month, day, dayOfWeek } = parseDateBR(date);

  // Check if barber has schedule for this day of week
  const schedule = await prisma.barberSchedule.findFirst({
    where: {
      barberProfileId,
      dayOfWeek: dayOfWeek as any,
      isActive: true,
    },
  });

  if (!schedule) return [];

  // Build the Brazil-local day boundaries for querying existing appointments
  // "2026-03-22 00:00:00 BRT" → UTC equivalent
  const dayStartBR = fromZonedTime(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T00:00:00`, TIMEZONE);
  const dayEndBR   = fromZonedTime(`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T23:59:59`, TIMEZONE);

  // Check if this date is blocked
  const blocked = await prisma.barberBlockedDate.findFirst({
    where: {
      barberProfileId,
      date: { gte: dayStartBR, lte: dayEndBR },
    },
  });
  if (blocked) return [];

  // Get existing appointments for this day
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      barberProfileId,
      scheduledAt: { gte: dayStartBR, lte: dayEndBR },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, endsAt: true },
  });

  // Generate slots in Brazil time
  const [startHour, startMin] = schedule.startTime.split(":").map(Number);
  const [endHour, endMin]     = schedule.endTime.split(":").map(Number);

  // Build slot start/end as Brazil-local timestamps (in UTC)
  let slotStart = fromZonedTime(
    `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(startHour).padStart(2,"0")}:${String(startMin).padStart(2,"0")}:00`,
    TIMEZONE
  );
  const scheduleEnd = fromZonedTime(
    `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${String(endHour).padStart(2,"0")}:${String(endMin).padStart(2,"0")}:00`,
    TIMEZONE
  );

  const now = new Date();
  const slots: string[] = [];

  while (isBefore(slotStart, scheduleEnd)) {
    const slotEnd = addMinutes(slotStart, serviceDuration);

    // Skip past slots (add 5 min buffer)
    if (isBefore(slotStart, addMinutes(now, 5))) {
      slotStart = addMinutes(slotStart, schedule.slotDuration);
      continue;
    }

    // Don't go past end of schedule
    if (isAfter(slotEnd, scheduleEnd)) break;

    // Check conflicts
    const hasConflict = existingAppointments.some((apt) => {
      return (
        isBefore(slotStart, apt.endsAt) &&
        isAfter(slotEnd, apt.scheduledAt)
      );
    });

    if (!hasConflict) {
      // Return time in Brazil timezone format "HH:mm"
      slots.push(format(toZonedTime(slotStart, TIMEZONE), "HH:mm"));
    }

    slotStart = addMinutes(slotStart, schedule.slotDuration);
  }

  return slots;
}