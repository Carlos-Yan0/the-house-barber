import { describe, expect, test } from "bun:test";
import { isAppointmentFutureOrOngoing } from "../lib/appointmentTiming";

describe("Appointment timing", () => {
  test("past appointments should not block new lunch breaks", () => {
    const blocksLunch = isAppointmentFutureOrOngoing(
      new Date("2026-05-04T13:00:00-03:00"),
      new Date("2026-05-05T10:00:00-03:00")
    );

    expect(blocksLunch).toBe(false);
  });

  test("future appointments should block new lunch breaks", () => {
    const blocksLunch = isAppointmentFutureOrOngoing(
      new Date("2026-05-11T13:00:00-03:00"),
      new Date("2026-05-10T10:00:00-03:00")
    );

    expect(blocksLunch).toBe(true);
  });

  test("ongoing appointments should keep blocking until they end", () => {
    const blocksLunch = isAppointmentFutureOrOngoing(
      new Date("2026-05-11T13:00:00-03:00"),
      new Date("2026-05-11T12:45:00-03:00")
    );

    expect(blocksLunch).toBe(true);
  });
});
