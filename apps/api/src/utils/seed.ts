// src/utils/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Admin
  const adminHash = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@thehousebarber.com" },
    update: {},
    create: { name: "Administrador", email: "admin@thehousebarber.com", passwordHash: adminHash, role: "ADMIN" },
  });
  console.log("✅ Admin criado:", admin.email);

  // Barber 1
  const b1Hash = await bcrypt.hash("barber123456", 12);
  const barber1 = await prisma.user.upsert({
    where: { email: "lucas@thehousebarber.com" },
    update: {},
    create: {
      name: "Lucas Almeida", email: "lucas@thehousebarber.com",
      passwordHash: b1Hash, role: "BARBER",
      barberProfile: {
        create: {
          commissionRate: 0.5,
          schedules: {
            createMany: {
              data: [
                { dayOfWeek: "MONDAY",    startTime: "09:00", endTime: "18:00", slotDuration: 30 },
                { dayOfWeek: "TUESDAY",   startTime: "09:00", endTime: "18:00", slotDuration: 30 },
                { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "18:00", slotDuration: 30 },
                { dayOfWeek: "THURSDAY",  startTime: "09:00", endTime: "18:00", slotDuration: 30 },
                { dayOfWeek: "FRIDAY",    startTime: "09:00", endTime: "18:00", slotDuration: 30 },
                { dayOfWeek: "SATURDAY",  startTime: "09:00", endTime: "14:00", slotDuration: 30 },
              ],
            },
          },
        },
      },
    },
  });
  console.log("✅ Barbeiro 1 criado:", barber1.email);

  // Barber 2
  const b2Hash = await bcrypt.hash("barber123456", 12);
  const barber2 = await prisma.user.upsert({
    where: { email: "rafael@thehousebarber.com" },
    update: {},
    create: {
      name: "Rafael Costa", email: "rafael@thehousebarber.com",
      passwordHash: b2Hash, role: "BARBER",
      barberProfile: {
        create: {
          commissionRate: 0.55,
          schedules: {
            createMany: {
              data: [
                { dayOfWeek: "TUESDAY",   startTime: "10:00", endTime: "19:00", slotDuration: 30 },
                { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "19:00", slotDuration: 30 },
                { dayOfWeek: "THURSDAY",  startTime: "10:00", endTime: "19:00", slotDuration: 30 },
                { dayOfWeek: "FRIDAY",    startTime: "10:00", endTime: "19:00", slotDuration: 30 },
                { dayOfWeek: "SATURDAY",  startTime: "09:00", endTime: "17:00", slotDuration: 30 },
              ],
            },
          },
        },
      },
    },
  });
  console.log("✅ Barbeiro 2 criado:", barber2.email);

  // Services — delete existing and recreate to avoid id issues
  await prisma.service.deleteMany({});
  await prisma.service.createMany({
    data: [
      { name: "Corte de Cabelo", description: "Corte masculino clássico", duration: 30, price: 45.0,  sortOrder: 1 },
      { name: "Barba",           description: "Barba e aparação",         duration: 20, price: 35.0,  sortOrder: 2 },
      { name: "Corte + Barba",   description: "Pacote completo",          duration: 45, price: 70.0,  sortOrder: 3 },
      { name: "Pigmentação",     description: "Pigmentação capilar",      duration: 60, price: 80.0,  sortOrder: 4 },
      { name: "Sobrancelha",     description: "Design de sobrancelha",    duration: 15, price: 20.0,  sortOrder: 5 },
      { name: "Relaxamento",     description: "Relaxamento capilar",      duration: 60, price: 90.0,  sortOrder: 6 },
    ],
  });
  console.log("✅ Serviços criados");

  // Test client
  const clientHash = await bcrypt.hash("client123456", 12);
  await prisma.user.upsert({
    where: { email: "joao@cliente.com" },
    update: {},
    create: { name: "João da Silva", email: "joao@cliente.com", phone: "47999999999", passwordHash: clientHash, role: "CLIENT" },
  });
  console.log("✅ Cliente de teste criado");

  console.log("\n🎉 Seed concluído!");
  console.log("\n📋 Credenciais:");
  console.log("   Admin:    admin@thehousebarber.com / admin123456");
  console.log("   Barbeiro: lucas@thehousebarber.com / barber123456");
  console.log("   Cliente:  joao@cliente.com / client123456");
}

main().catch(console.error).finally(() => prisma.$disconnect());