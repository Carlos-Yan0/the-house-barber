// src/utils/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Admin + perfil de barbeiro
  const adminHash = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "netobazar04@gmail.com" },
    update: {},
    create: {
      name: "Neto",
      email: "netobazar04@gmail.com",
      passwordHash: adminHash,
      role: "ADMIN",
      barberProfile: {
        create: {
          commissionRate: 1.0,
          isAvailable: true,
        },
      },
    },
  });
  console.log("✅ Admin/Barbeiro criado:", admin.email);

  // Serviços
  await prisma.service.deleteMany({});
  await prisma.service.createMany({
    data: [
      { name: "Corte",             description: "Corte masculino",        duration: 30, price: 35.00, sortOrder: 1 },
      { name: "Barba",             description: "Barba e aparação",       duration: 20, price: 35.00, sortOrder: 2 },
      { name: "Sobrancelha",       description: "Design de sobrancelha",  duration: 15, price: 10.00, sortOrder: 3 },
      { name: "Cabelo e Barba",    description: "Corte + barba completo", duration: 45, price: 65.00, sortOrder: 4 },
      { name: "Combo Pai e Filho", description: "Corte para dois",        duration: 50, price: 60.00, sortOrder: 5 },
    ],
  });
  console.log("✅ Serviços criados");

  console.log("\n🎉 Seed concluído!");
  console.log("\n📋 Credenciais:");
  console.log("   Admin: netobazar04@gmail.com / admin123456");
}

main().catch(console.error).finally(() => prisma.$disconnect());