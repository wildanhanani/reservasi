import * as bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

function dateOnly(offsetDay: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDay);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

async function main() {
  const devPasswordHash = await bcrypt.hash("dev-password", 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@reservasi.local" },
    update: {},
    create: {
      role: Role.SUPER_ADMIN,
      name: "Super Admin Reservasi",
      email: "superadmin@reservasi.local",
      phone: "628111111111",
      passwordHash: devPasswordHash
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: "admin@terasrempah.local" },
    update: {},
    create: {
      role: Role.RESTAURANT_ADMIN,
      name: "Admin Teras Rempah",
      email: "admin@terasrempah.local",
      phone: "6281234567890",
      passwordHash: devPasswordHash
    }
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "teras-rempah" },
    update: {},
    create: {
      ownerId: owner.id,
      name: "Teras Rempah",
      slug: "teras-rempah",
      description: "Restoran keluarga dengan menu Nusantara modern dan sistem reservasi pre-order.",
      address: "Jl. Melati No. 8, Jakarta Selatan",
      phone: "021-555-0199",
      whatsappNumber: "6281234567890",
      qrisImageUrl: "https://placehold.co/560x560?text=QRIS+Teras+Rempah",
      bankName: "BCA",
      bankAccountNumber: "1234567890",
      bankAccountName: "PT Teras Rempah Indonesia",
      dpPercentage: 30,
      maxPartySize: 16,
      slotDurationMinute: 90
    }
  });

  await prisma.adminProfile.upsert({
    where: { userId: owner.id },
    update: { restaurantId: restaurant.id },
    create: {
      userId: owner.id,
      restaurantId: restaurant.id
    }
  });

  await Promise.all(
    Array.from({ length: 7 }).map((_, dayOfWeek) =>
      prisma.operatingHour.upsert({
        where: { restaurantId_dayOfWeek: { restaurantId: restaurant.id, dayOfWeek } },
        update: {},
        create: {
          restaurantId: restaurant.id,
          dayOfWeek,
          openTime: dayOfWeek === 0 ? "10:00" : "09:00",
          closeTime: dayOfWeek === 0 ? "20:00" : "22:00",
          isClosed: false
        }
      })
    )
  );

  const menus = [
    ["Nasi Bakar Ayam Kemangi", "Makanan Utama", 48000, "Nasi bakar aromatik dengan ayam suwir dan sambal terasi."],
    ["Iga Bakar Madu", "Makanan Utama", 118000, "Iga sapi bakar dengan glasir madu rempah dan sayur asam."],
    ["Sate Maranggi", "Makanan Utama", 76000, "Sate sapi bumbu ketumbar dengan acar tomat."],
    ["Gurame Sambal Matah", "Makanan Utama", 132000, "Gurame goreng kering dengan sambal matah segar."],
    ["Tahu Telur Petis", "Pembuka", 38000, "Tahu telur renyah dengan petis dan kacang sangrai."],
    ["Es Kopi Pandan", "Minuman", 32000, "Kopi susu dingin dengan sirup pandan rumah."],
    ["Wedang Rempah", "Minuman", 28000, "Jahe, serai, kayu manis, cengkeh, dan madu."],
    ["Klepon Cake", "Dessert", 42000, "Cake pandan kelapa dengan gula aren cair."]
  ] as const;

  for (const [name, category, price, description] of menus) {
    const existing = await prisma.menuItem.findFirst({
      where: { restaurantId: restaurant.id, name }
    });

    if (!existing) {
      await prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          name,
          category,
          price,
          description,
          imageUrl: `https://placehold.co/720x480?text=${encodeURIComponent(name)}`
        }
      });
    }
  }

  const slotTimes = ["11:00", "12:30", "14:00", "18:00", "19:30", "21:00"];
  for (let offset = 1; offset <= 14; offset += 1) {
    for (const time of slotTimes) {
      await prisma.reservationSlot.upsert({
        where: {
          restaurantId_date_time: {
            restaurantId: restaurant.id,
            date: dateOnly(offset),
            time
          }
        },
        update: {},
        create: {
          restaurantId: restaurant.id,
          date: dateOnly(offset),
          time,
          capacity: time === "19:30" ? 18 : 24
        }
      });
    }
  }

  console.log({
    superAdmin: superAdmin.email,
    admin: owner.email,
    restaurant: restaurant.slug
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
