import { prisma, ReservationStatus } from "@reservasi/db";

const blockingStatuses: ReservationStatus[] = [
  "AWAITING_PAYMENT",
  "PAYMENT_REVIEW",
  "CONFIRMED",
  "COMPLETED"
];

export function slotDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function nextSlotDate(date: string) {
  const next = slotDate(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export function reservationDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00.000Z`);
}

export async function isRestaurantClosed(restaurantId: string, date: string) {
  const targetDate = slotDate(date);
  const dayOfWeek = targetDate.getUTCDay();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      closedDates: true,
      operatingHours: {
        where: { dayOfWeek },
        take: 1
      }
    }
  });

  if (!restaurant) return true;
  if (restaurant.closedDates.includes(date)) return true;
  return restaurant.operatingHours[0]?.isClosed ?? false;
}

export async function getAvailableSlots(restaurantId: string, date: string, partySize = 1) {
  if (await isRestaurantClosed(restaurantId, date)) {
    return [];
  }

  const startDate = slotDate(date);
  const endDate = nextSlotDate(date);
  let slots = await prisma.reservationSlot.findMany({
    where: {
      restaurantId,
      date: {
        gte: startDate,
        lt: endDate
      },
      isBlocked: false
    },
    orderBy: { time: "asc" }
  });

  if (slots.length === 0) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { maxPartySize: true }
    });

    const capacity = restaurant?.maxPartySize ? Math.max(restaurant.maxPartySize * 2, 12) : 20;
    const defaultTimes = ["11:00", "12:30", "14:00", "18:00", "19:30", "21:00"];

    slots = await prisma.$transaction(
      defaultTimes.map((time) =>
        prisma.reservationSlot.upsert({
          where: {
            restaurantId_date_time: {
              restaurantId,
              date: startDate,
              time
            }
          },
          update: {},
          create: {
            restaurantId,
            date: startDate,
            time,
            capacity
          }
        })
      )
    );
  }

  const uniqueSlots = Array.from(
    slots
      .reduce((byTime, slot) => {
        const existing = byTime.get(slot.time);
        if (!existing || slot.capacity > existing.capacity) {
          byTime.set(slot.time, slot);
        }
        return byTime;
      }, new Map<string, (typeof slots)[number]>())
      .values()
  ).sort((a, b) => a.time.localeCompare(b.time));

  const reservations = await prisma.reservation.findMany({
    where: {
      restaurantId,
      reservationAt: {
        gte: startDate,
        lt: endDate
      },
      status: { in: blockingStatuses }
    },
    select: {
      reservationAt: true,
      partySize: true
    }
  });

  return uniqueSlots.map((slot) => {
    const usedCapacity = reservations
      .filter((reservation) => reservation.reservationAt.toISOString().slice(11, 16) === slot.time)
      .reduce((total, reservation) => total + reservation.partySize, 0);
    const remainingCapacity = Math.max(slot.capacity - usedCapacity, 0);

    return {
      id: slot.id,
      date,
      time: slot.time,
      capacity: slot.capacity,
      usedCapacity,
      remainingCapacity,
      available: remainingCapacity >= partySize
    };
  });
}

export async function assertSlotAvailable(
  restaurantId: string,
  date: string,
  time: string,
  partySize: number
) {
  const slots = await getAvailableSlots(restaurantId, date, partySize);
  const slot = slots.find((candidate) => candidate.time === time);

  if (!slot || !slot.available) {
    throw new Error("Slot reservasi tidak tersedia.");
  }

  return slot;
}
