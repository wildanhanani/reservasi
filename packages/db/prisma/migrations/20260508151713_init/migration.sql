-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'RESTAURANT_ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PAYMENT_REVIEW', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('FULL', 'DP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('QRIS', 'TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING_REVIEW', 'PARTIALLY_PAID', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "qrisImageUrl" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "cashInstruction" TEXT NOT NULL DEFAULT 'Bayar di kasir saat datang ke restoran.',
    "dpPercentage" INTEGER NOT NULL DEFAULT 30,
    "maxPartySize" INTEGER NOT NULL DEFAULT 12,
    "slotDurationMinute" INTEGER NOT NULL DEFAULT 90,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingHour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OperatingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSlot" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReservationSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "contactPerson" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "reservationAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "paymentAmount" INTEGER NOT NULL DEFAULT 0,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "proofUrl" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingHour_restaurantId_dayOfWeek_key" ON "OperatingHour"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSlot_restaurantId_date_time_key" ON "ReservationSlot"("restaurantId", "date", "time");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationItem_reservationId_menuItemId_key" ON "ReservationItem"("reservationId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reservationId_key" ON "Payment"("reservationId");

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingHour" ADD CONSTRAINT "OperatingHour_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSlot" ADD CONSTRAINT "ReservationSlot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
