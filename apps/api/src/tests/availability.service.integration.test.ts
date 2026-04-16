import { afterAll, describe, expect, test } from "bun:test";
import { PrismaClient, Prisma } from "@prisma/client";
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { getAvailableSlots } from "../services/availability.service";

const prisma = new PrismaClient();
const ROLLBACK_ERROR = new Error("__TEST_ROLLBACK__");
const TIMEZONE = "America/Sao_Paulo";

async function runInRollback(
  run: (tx: Prisma.TransactionClient) => Promise<void>
) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw ROLLBACK_ERROR;
    });
  } catch (error) {
    if (error !== ROLLBACK_ERROR) {
      throw error;
    }
  }
}

async function createBaseData(tx: Prisma.TransactionClient) {
  const suffix = crypto.randomUUID().slice(0, 8);

  const client = await tx.user.create({
    data: {
      name: `Client ${suffix}`,
      email: `client.${suffix}@test.local`,
      passwordHash: "hash",
      role: "CLIENT",
    },
  });

  const barberUser = await tx.user.create({
    data: {
      name: `Barber ${suffix}`,
      email: `barber.${suffix}@test.local`,
      passwordHash: "hash",
      role: "BARBER",
      barberProfile: {
        create: {
          schedules: {
            create: {
              dayOfWeek: "THURSDAY",
              startTime: "17:00",
              endTime: "20:00",
              slotDuration: 30,
              isActive: true,
            },
          },
        },
      },
    },
    include: {
      barberProfile: true,
    },
  });

  const longService = await tx.service.create({
    data: {
      name: `Long ${suffix}`,
      duration: 70,
      price: "90.00",
      isActive: true,
    },
  });

  const shortService = await tx.service.create({
    data: {
      name: `Short ${suffix}`,
      duration: 20,
      price: "30.00",
      isActive: true,
    },
  });

  const mediumService = await tx.service.create({
    data: {
      name: `Medium ${suffix}`,
      duration: 30,
      price: "45.00",
      isActive: true,
    },
  });

  if (!barberUser.barberProfile) {
    throw new Error("Expected barber profile to be created");
  }

  return {
    clientId: client.id,
    barberProfileId: barberUser.barberProfile.id,
    longServiceId: longService.id,
    shortServiceId: shortService.id,
    mediumServiceId: mediumService.id,
  };
}

function brtDateTime(date: string, time: string) {
  return fromZonedTime(`${date}T${time}:00`, TIMEZONE);
}

describe("Availability service (integration)", () => {
  test("includes the exact endsAt as a dynamic start for a short service", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = brtDateTime("2030-01-10", "17:30");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberProfileId,
          serviceId: base.longServiceId,
          scheduledAt,
          endsAt: addMinutes(scheduledAt, 70),
          status: "PENDING",
        },
      });

      const slots = await getAvailableSlots(base.barberProfileId, "2030-01-10", 20);

      expect(slots).toContain("18:40");
    });
  });

  test("includes the exact endsAt as a dynamic start for a 30-minute service when it fits", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = brtDateTime("2030-01-10", "17:30");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberProfileId,
          serviceId: base.longServiceId,
          scheduledAt,
          endsAt: addMinutes(scheduledAt, 70),
          status: "PENDING",
        },
      });

      const slots = await getAvailableSlots(base.barberProfileId, "2030-01-10", 30);

      expect(slots).toContain("18:40");
    });
  });

  test("blocks dynamic encaixes that would overlap the next appointment", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const firstStart = brtDateTime("2030-01-10", "17:30");
      const secondStart = brtDateTime("2030-01-10", "19:00");

      await tx.appointment.createMany({
        data: [
          {
            clientId: base.clientId,
            barberProfileId: base.barberProfileId,
            serviceId: base.longServiceId,
            scheduledAt: firstStart,
            endsAt: addMinutes(firstStart, 70),
            status: "PENDING",
          },
          {
            clientId: base.clientId,
            barberProfileId: base.barberProfileId,
            serviceId: base.mediumServiceId,
            scheduledAt: secondStart,
            endsAt: addMinutes(secondStart, 30),
            status: "PENDING",
          },
        ],
      });

      const slots = await getAvailableSlots(base.barberProfileId, "2030-01-10", 30);

      expect(slots).not.toContain("18:40");
    });
  });

  test("keeps base-grid starts and dynamic starts together without duplicates", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const scheduledAt = brtDateTime("2030-01-10", "17:30");

      await tx.appointment.create({
        data: {
          clientId: base.clientId,
          barberProfileId: base.barberProfileId,
          serviceId: base.longServiceId,
          scheduledAt,
          endsAt: addMinutes(scheduledAt, 70),
          status: "PENDING",
        },
      });

      const slots = await getAvailableSlots(base.barberProfileId, "2030-01-10", 20);

      expect(slots).toEqual(["17:00", "18:40", "19:00", "19:30"]);
    });
  });

  test("cancelled and no-show appointments do not block dynamic encaixes", async () => {
    await runInRollback(async (tx) => {
      const base = await createBaseData(tx);
      const cancelledStart = brtDateTime("2030-01-10", "17:30");
      const noShowStart = brtDateTime("2030-01-10", "18:40");

      await tx.appointment.createMany({
        data: [
          {
            clientId: base.clientId,
            barberProfileId: base.barberProfileId,
            serviceId: base.longServiceId,
            scheduledAt: cancelledStart,
            endsAt: addMinutes(cancelledStart, 70),
            status: "CANCELLED",
          },
          {
            clientId: base.clientId,
            barberProfileId: base.barberProfileId,
            serviceId: base.shortServiceId,
            scheduledAt: noShowStart,
            endsAt: addMinutes(noShowStart, 20),
            status: "NO_SHOW",
          },
        ],
      });

      const slots = await getAvailableSlots(base.barberProfileId, "2030-01-10", 20);

      expect(slots).toContain("17:30");
      expect(slots).toContain("18:40");
    });
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
