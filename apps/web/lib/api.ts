export type OperatingHour = {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  labels: string[];
  price: number;
  imageUrl?: string | null;
  isAvailable: boolean;
};

export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  whatsappNumber: string;
  qrisImageUrl?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  cashInstruction: string;
  dpPercentage: number;
  maxPartySize: number;
  slotDurationMinute?: number;
  closedDates: string[];
  operatingHours?: OperatingHour[];
  menuItems: MenuItem[];
};

export type ReservationItem = {
  id?: string;
  menuItemId?: string;
  nameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
};

export type Payment = {
  type: "FULL" | "DP";
  method: "QRIS" | "TRANSFER" | "CASH";
  status: "UNPAID" | "PENDING_REVIEW" | "PARTIALLY_PAID" | "PAID" | "REJECTED";
  amountDue: number;
  amountPaid: number;
  proofUrl?: string | null;
};

export type Reservation = {
  id: string;
  code: string;
  restaurant: Restaurant;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  contactPerson: string;
  sourceChannel: string;
  partySize: number;
  reservationAt: string;
  notes?: string | null;
  status: string;
  subtotal: number;
  paymentAmount: number;
  receiptUrl?: string | null;
  items: ReservationItem[];
  payment?: Payment | null;
};

export type Slot = {
  id: string;
  date: string;
  time: string;
  capacity: number;
  usedCapacity: number;
  remainingCapacity: number;
  available: boolean;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiErrorBody = {
  message?: string;
  details?: string[];
  error?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const token = typeof window !== "undefined" ? localStorage.getItem("reservasi_token") : null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const rawMessage = await response.text();
    let message = rawMessage || `Request gagal: ${response.status}`;

    try {
      const parsed = JSON.parse(rawMessage) as ApiErrorBody;
      if (parsed.details?.length) {
        message = [parsed.message, ...parsed.details].filter(Boolean).join("\n");
      } else if (parsed.message) {
        message = parsed.message;
      } else if (parsed.error) {
        message = parsed.error;
      }
    } catch {
      // Fallback ke text response kalau server mengembalikan non-JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "RESTAURANT_ADMIN" | "CUSTOMER";
  restaurantId?: string | null;
  restaurantSlug?: string | null;
  restaurantName?: string | null;
};

export function login(body: { email: string; password: string }) {
  return request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getRestaurant(slug: string) {
  return request<Restaurant>(`/public/restaurants/${slug}`);
}

export function checkAvailability(slug: string, body: { date: string; partySize: number }) {
  return request<{ slots: Slot[] }>(`/public/restaurants/${slug}/availability`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createReservation(slug: string, body: Record<string, unknown>) {
  return request<Reservation>(`/public/restaurants/${slug}/reservations`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function saveReservationMenu(code: string, items: { menuItemId: string; quantity: number }[]) {
  return request<Reservation>(`/public/reservations/${code}/menu`, {
    method: "PATCH",
    body: JSON.stringify({ items })
  });
}

export function choosePayment(code: string, body: { type: "FULL" | "DP"; method: "QRIS" | "TRANSFER" | "CASH" }) {
  return request<Reservation>(`/public/reservations/${code}/payment`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function submitPayment(code: string, body: { proofUrl?: string } = {}) {
  return request<Reservation>(`/public/reservations/${code}/submit-payment`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function getReservation(code: string) {
  return request<Reservation>(`/public/reservations/${code}`);
}

export type SuperAdminDashboard = {
  metrics: {
    restaurantCount: number;
    activeRestaurantCount: number;
    inactiveRestaurantCount: number;
    transactionCount: number;
    totalRevenue: number;
    grossSales: number;
    estimatedProfit: number;
  };
  restaurants: Array<{
    id: string;
    name: string;
    slug: string;
    address: string;
    whatsappNumber: string;
    isActive: boolean;
    owner: { id: string; name: string; email: string; phone?: string | null };
    admins: Array<{ id: string; user: { id: string; name: string; email: string; phone?: string | null } }>;
    reservationCount: number;
    paidReservationCount: number;
    totalRevenue: number;
    grossSales: number;
    estimatedProfit: number;
  }>;
  transactions: Array<{
    id: string;
    code: string;
    restaurantId: string;
    restaurantName: string;
    customerName: string;
    customerPhone: string;
    reservationAt: string;
    createdAt: string;
    status: string;
    subtotal: number;
    paymentAmount: number;
    payment: Payment | null;
    itemCount: number;
  }>;
};

export function getSuperAdminDashboard() {
  return request<SuperAdminDashboard>("/super-admin/dashboard");
}

export type CreateRestaurantBody = {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerPassword?: string;
  restaurantName: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  whatsappNumber?: string;
};

export function createRestaurant(body: CreateRestaurantBody) {
  return request<{ owner: AuthUser; restaurant: Restaurant }>("/super-admin/restaurants", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updateRestaurantStatus(restaurantId: string, isActive: boolean) {
  return request(`/super-admin/restaurants/${restaurantId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive })
  });
}

export function getAdminDashboard(restaurantId: string) {
  return request<{
    restaurant: Restaurant & {
      reservations: Reservation[];
      reservationSlots: Array<{ id: string; date: string; time: string; capacity: number; isBlocked: boolean }>;
      operatingHours: OperatingHour[];
    };
    metrics: {
      upcomingReservations: number;
      pendingPaymentReviews: number;
      menuCount: number;
      slotCount: number;
      transactionRevenue: number;
      grossSales: number;
      estimatedProfit: number;
      paidTransactionCount: number;
    };
  }>(`/admin/restaurants/${restaurantId}/dashboard`);
}

export function approvePayment(reservationId: string) {
  return request<Reservation>(`/admin/reservations/${reservationId}/approve-payment`, { method: "POST" });
}

export function updateRestaurantSettings(restaurantId: string, body: Record<string, unknown>) {
  return request<Restaurant>(`/admin/restaurants/${restaurantId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function upsertReservationSlot(
  restaurantId: string,
  body: { date: string; time: string; capacity: number; isBlocked: boolean }
) {
  return request(`/admin/restaurants/${restaurantId}/slots`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export type MenuItemForm = Omit<MenuItem, "id">;

export function addMenuItem(restaurantId: string, body: MenuItemForm) {
  return request<MenuItem>(`/admin/restaurants/${restaurantId}/menu`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updateMenuItem(restaurantId: string, menuItemId: string, body: MenuItemForm) {
  return request<MenuItem>(`/admin/restaurants/${restaurantId}/menu/${menuItemId}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export const demoRestaurant: Restaurant = {
  id: "demo-teras-rempah",
  name: "Teras Rempah",
  slug: "teras-rempah",
  description: "Restoran keluarga dengan reservasi online dan pre-order menu.",
  address: "Jl. Melati No. 8, Jakarta Selatan",
  phone: "021-555-0199",
  whatsappNumber: "6281234567890",
  qrisImageUrl: "https://placehold.co/560x560?text=QRIS+Teras+Rempah",
  closedDates: [],
  operatingHours: Array.from({ length: 7 }).map((_, dayOfWeek) => ({
    dayOfWeek,
    openTime: dayOfWeek === 0 ? "10:00" : "09:00",
    closeTime: dayOfWeek === 0 ? "20:00" : "22:00",
    isClosed: false
  })),
  bankName: "BCA",
  bankAccountNumber: "1234567890",
  bankAccountName: "PT Teras Rempah Indonesia",
  cashInstruction: "Bayar di kasir saat datang ke restoran.",
  dpPercentage: 30,
  maxPartySize: 16,
  menuItems: [
    {
      id: "menu-1",
      name: "Nasi Bakar Ayam Kemangi",
      description: "Nasi bakar aromatik dengan ayam suwir dan sambal terasi.",
      category: "Makanan Utama",
      labels: ["Favorit"],
      price: 48000,
      imageUrl: "https://placehold.co/720x480?text=Nasi+Bakar",
      isAvailable: true
    },
    {
      id: "menu-2",
      name: "Iga Bakar Madu",
      description: "Iga sapi bakar dengan glasir madu rempah.",
      category: "Makanan Utama",
      labels: [],
      price: 118000,
      imageUrl: "https://placehold.co/720x480?text=Iga+Bakar",
      isAvailable: true
    },
    {
      id: "menu-3",
      name: "Tahu Telur Petis",
      description: "Tahu telur renyah dengan petis dan kacang sangrai.",
      category: "Pembuka",
      labels: ["Recommended"],
      price: 38000,
      imageUrl: "https://placehold.co/720x480?text=Tahu+Telur",
      isAvailable: true
    },
    {
      id: "menu-4",
      name: "Es Kopi Pandan",
      description: "Kopi susu dingin dengan sirup pandan rumah.",
      category: "Minuman",
      labels: [],
      price: 32000,
      imageUrl: "https://placehold.co/720x480?text=Es+Kopi+Pandan",
      isAvailable: true
    }
  ]
};
