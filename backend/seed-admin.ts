import prisma from "./src/prisma";
import bcrypt from "bcryptjs";

async function seedAdmin() {
  const email = "admin@yourhealth.ai";
  const password = "AdminPassword123!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin user already exists:", email);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: "System Admin",
      role: "ADMIN",
    }
  });

  console.log("Admin user created successfully!");
  console.log("Email:", admin.email);
  console.log("Password:", password);
}

seedAdmin()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
