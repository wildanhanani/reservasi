"use client";

import { useEffect, useMemo, useState } from "react";
import {
  checkAvailability,
  choosePayment,
  createReservation,
  demoRestaurant,
  getRestaurant,
  type Payment,
  type Reservation,
  type Restaurant,
  saveReservationMenu,
  submitPayment,
  type Slot
} from "@/lib/api";
import { formatDateTime, rupiah } from "@/lib/utils";

type Step = "identity" | "menu" | "summary" | "payment" | "receipt";

type IdentityForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  contactPerson: string;
  sourceChannel: "whatsapp" | "instagram" | "direct";
  date: string;
  time: string;
  partySize: number;
  notes: string;
};

const steps: Array<{ key: Step; label: string }> = [
  { key: "identity", label: "Data" },
  { key: "menu", label: "Menu" },
  { key: "summary", label: "Bayar" },
  { key: "payment", label: "Instruksi" },
  { key: "receipt", label: "Receipt" }
];

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function stepNumber(step: Step) {
  return steps.findIndex((item) => item.key === step) + 1;
}

function demoSlots(date: string, partySize: number): Slot[] {
  return [
    { id: "slot-1", date, time: "11:00", capacity: 20, usedCapacity: 0, remainingCapacity: 20, available: partySize <= 20 },
    { id: "slot-2", date, time: "18:00", capacity: 16, usedCapacity: 0, remainingCapacity: 16, available: partySize <= 16 },
    { id: "slot-3", date, time: "19:30", capacity: 12, usedCapacity: 0, remainingCapacity: 12, available: partySize <= 12 }
  ];
}

function localReservation(
  restaurant: Restaurant,
  form: IdentityForm,
  items: Reservation["items"] = [],
  payment?: Payment
): Reservation {
  const subtotal = items.reduce((total, item) => total + item.priceSnapshot * item.quantity, 0);

  return {
    id: "local",
    code: `LOCAL-${Date.now().toString(36).toUpperCase()}`,
    restaurant,
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    customerEmail: form.customerEmail,
    contactPerson: form.contactPerson,
    sourceChannel: form.sourceChannel,
    partySize: form.partySize,
    reservationAt: `${form.date}T${form.time || "11:00"}:00.000Z`,
    notes: form.notes,
    status: payment ? "AWAITING_PAYMENT" : "DRAFT",
    subtotal,
    paymentAmount: payment?.amountDue ?? 0,
    receiptUrl: "",
    items,
    payment
  };
}

export function BookingFlow({ slug }: { slug: string }) {
  const [restaurant, setRestaurant] = useState<Restaurant>(demoRestaurant);
  const [localMode, setLocalMode] = useState(false);
  const [step, setStep] = useState<Step>("identity");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [paymentType, setPaymentType] = useState<"FULL" | "DP">("DP");
  const [paymentMethod, setPaymentMethod] = useState<"QRIS" | "TRANSFER" | "CASH">("QRIS");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<IdentityForm>({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    contactPerson: "",
    sourceChannel: "whatsapp",
    date: tomorrowDate(),
    time: "",
    partySize: 2,
    notes: ""
  });

  useEffect(() => {
    getRestaurant(slug)
      .then((data) => {
        setRestaurant(data);
        setLocalMode(false);
      })
      .catch(() => {
        setRestaurant(demoRestaurant);
        setLocalMode(true);
        applySlots(demoSlots(form.date, form.partySize));
      });
  }, [slug]);

  useEffect(() => {
    if (step !== "identity") return;

    const timeout = window.setTimeout(() => {
      void loadSlots({ silent: true });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [form.date, form.partySize, localMode, step]);

  const menuGroups = useMemo(() => {
    return restaurant.menuItems.reduce<Record<string, typeof restaurant.menuItems>>((groups, item) => {
      groups[item.category] = groups[item.category] ?? [];
      groups[item.category].push(item);
      return groups;
    }, {});
  }, [restaurant.menuItems]);

  const cartItems = useMemo(() => {
    return restaurant.menuItems
      .map((item) => ({ item, quantity: selectedItems[item.id] ?? 0 }))
      .filter(({ quantity }) => quantity > 0);
  }, [restaurant.menuItems, selectedItems]);

  const subtotal = cartItems.reduce((total, { item, quantity }) => total + item.price * quantity, 0);
  const amountDue = paymentType === "DP" ? Math.ceil((subtotal * restaurant.dpPercentage) / 100) : subtotal;
  const qrisImageUrl = reservation?.restaurant?.qrisImageUrl || restaurant.qrisImageUrl || "https://placehold.co/560x560?text=QRIS";

  function applySlots(nextSlots: Slot[]) {
    setSlots(nextSlots);
    const firstAvailable = nextSlots.find((slot) => slot.available);

    setForm((current) => {
      const selectedStillAvailable = nextSlots.some(
        (slot) => slot.time === current.time && slot.available
      );

      if (selectedStillAvailable) {
        return current;
      }

      return {
        ...current,
        time: firstAvailable?.time ?? ""
      };
    });
  }

  async function loadSlots(options?: { silent?: boolean }) {
    setLoading(true);
    if (!options?.silent) {
      setMessage("");
    }

    try {
      if (localMode) {
        applySlots(demoSlots(form.date, form.partySize));
      } else {
        const data = await checkAvailability(slug, { date: form.date, partySize: form.partySize });
        applySlots(data.slots);

        if (!options?.silent && !data.slots.some((slot) => slot.available)) {
          setMessage("Tidak ada slot tersedia untuk tanggal dan jumlah tamu ini.");
        }
      }
    } catch (error) {
      if (!options?.silent) {
        setMessage(error instanceof Error ? error.message : "Gagal cek slot.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function startReservation() {
    if (!form.time) {
      await loadSlots();
      setMessage("Pilih salah satu jam tersedia sebelum lanjut.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const normalizedForm = {
        ...form,
        contactPerson: form.contactPerson || form.customerName
      };
      const data = localMode
        ? localReservation(restaurant, normalizedForm)
        : await createReservation(slug, normalizedForm);
      setReservation(data);
      setStep("menu");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat reservasi.");
    } finally {
      setLoading(false);
    }
  }

  async function saveMenu() {
    if (cartItems.length === 0) {
      setMessage("Pilih minimal satu menu.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      if (!reservation || localMode) {
        const items = cartItems.map(({ item, quantity }) => ({
          menuItemId: item.id,
          nameSnapshot: item.name,
          priceSnapshot: item.price,
          quantity
        }));
        setReservation(localReservation(restaurant, form, items));
      } else {
        const data = await saveReservationMenu(
          reservation.code,
          cartItems.map(({ item, quantity }) => ({ menuItemId: item.id, quantity }))
        );
        setReservation(data);
      }
      setStep("summary");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan menu.");
    } finally {
      setLoading(false);
    }
  }

  async function savePayment() {
    if (!reservation) return;
    setLoading(true);
    setMessage("");
    try {
      if (localMode) {
        setReservation({
          ...reservation,
          status: "AWAITING_PAYMENT",
          paymentAmount: amountDue,
          payment: {
            type: paymentType,
            method: paymentMethod,
            status: "UNPAID",
            amountDue,
            amountPaid: 0
          }
        });
      } else {
        const data = await choosePayment(reservation.code, { type: paymentType, method: paymentMethod });
        setReservation(data);
      }
      setStep("payment");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memilih pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  async function finishPayment() {
    if (!reservation) return;
    setLoading(true);
    setMessage("");
    try {
      if (localMode) {
        setReservation({
          ...reservation,
          status: paymentMethod === "CASH" ? "AWAITING_PAYMENT" : "PAYMENT_REVIEW",
          receiptUrl: `/receipt/${reservation.code}`,
          payment: reservation.payment
            ? {
                ...reservation.payment,
                status: paymentMethod === "CASH" ? "UNPAID" : "PENDING_REVIEW",
                proofUrl: null
              }
            : null
        });
      } else {
        const data = await submitPayment(reservation.code);
        setReservation(data);
      }
      setStep("receipt");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyelesaikan pembayaran.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f9fc] text-[#061b31]">
      <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-8 lg:px-0">
        <header className="mb-4 rounded-[2rem] border border-[#e5edf5] bg-white p-5 shadow-[rgba(50,50,93,0.18)_0px_30px_45px_-30px] sm:mb-6 sm:p-6">
          <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Reservasi online</p>
          <h1 className="mt-4 text-3xl font-light tracking-[-0.04em] sm:text-4xl">{restaurant.name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{restaurant.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">{restaurant.address}</span>
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">WA {restaurant.whatsappNumber}</span>
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">DP {restaurant.dpPercentage}%</span>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((item, index) => (
            <span
              key={item.key}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                stepNumber(step) >= index + 1 ? "bg-[#533afd] text-white" : "bg-white text-slate-500 ring-1 ring-[#e5edf5]"
              }`}
            >
              {index + 1}. {item.label}
            </span>
          ))}
        </div>

        {localMode ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            API belum terhubung, halaman memakai data demo lokal.
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
        ) : null}

        {step === "identity" ? (
          <Section title="Data reservasi">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <Field label="Nama customer">
                <input className="input" value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
              </Field>
              <Field label="Nomor WhatsApp">
                <input className="input" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
              </Field>
              <Field label="Email receipt">
                <input className="input" value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} />
              </Field>
              <Field label="Jumlah tamu">
                <input className="input" type="number" min={1} max={restaurant.maxPartySize} value={form.partySize} onChange={(event) => setForm({ ...form, partySize: Number(event.target.value) })} />
              </Field>
              <Field label="Tanggal">
                <input className="input" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value, time: "" })} />
              </Field>
              <div className="flex items-end">
                <button className="btn-secondary w-full sm:w-auto" type="button" onClick={() => loadSlots()} disabled={loading}>
                  {loading ? "Mengecek..." : "Cek slot"}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Jam tersedia</p>
                {form.time ? <p className="text-xs text-emerald-700">Terpilih {form.time}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setForm({ ...form, time: slot.time })}
                    className={`rounded border p-3 text-left text-sm ${
                      form.time === slot.time ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white"
                    } disabled:opacity-40`}
                  >
                    <span className="block font-semibold">{slot.time}</span>
                    <span>{slot.remainingCapacity} kursi</span>
                  </button>
                ))}
              </div>
              {slots.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-500">
                  Slot sedang dimuat. Jika belum muncul, tekan Cek slot.
                </p>
              ) : null}
            </div>

            <Field label="Catatan">
              <input className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opsional" />
            </Field>

            <button className="btn-primary w-full sm:w-auto" onClick={startReservation} disabled={loading || !form.customerName || !form.customerPhone || !form.time}>
              Lanjut pilih menu
            </button>
          </Section>
        ) : null}

        {step === "menu" ? (
          <Section title="Pilih menu">
            {Object.entries(menuGroups).map(([category, items]) => (
              <div key={category} className="mb-5">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">{category}</h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-slate-500">{rupiah(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="qty-btn" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: Math.max((selectedItems[item.id] ?? 0) - 1, 0) })}>
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{selectedItems[item.id] ?? 0}</span>
                        <button className="qty-btn" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: (selectedItems[item.id] ?? 0) + 1 })}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-4">
              <strong>Total {rupiah(subtotal)}</strong>
              <button className="btn-primary" onClick={saveMenu} disabled={loading}>
                Lanjut
              </button>
            </div>
          </Section>
        ) : null}

        {step === "summary" && reservation ? (
          <Section title="Ringkasan">
            <Summary reservation={{ ...reservation, subtotal }} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Tipe pembayaran">
                <select className="input" value={paymentType} onChange={(event) => setPaymentType(event.target.value as "FULL" | "DP")}>
                  <option value="DP">DP {restaurant.dpPercentage}%</option>
                  <option value="FULL">Bayar penuh</option>
                </select>
              </Field>
              <Field label="Metode">
                <select className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "QRIS" | "TRANSFER" | "CASH")}>
                  <option value="QRIS">QRIS</option>
                  <option value="TRANSFER">Transfer bank</option>
                  <option value="CASH">Cash</option>
                </select>
              </Field>
            </div>
            <div className="my-4 rounded-2xl bg-slate-100/80 p-4">
              <p className="text-sm text-slate-500">Dibayar sekarang</p>
              <p className="text-xl font-bold">{rupiah(amountDue)}</p>
            </div>
            <button className="btn-primary" onClick={savePayment} disabled={loading}>
              Lanjut pembayaran
            </button>
          </Section>
        ) : null}

        {step === "payment" && reservation?.payment ? (
          <Section title="Pembayaran">
            {paymentMethod === "QRIS" ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm">
                <p className="font-medium">Scan QRIS</p>
                <img className="mt-3 w-52 rounded border" src={qrisImageUrl} alt="QRIS" />
              </div>
            ) : null}
            {paymentMethod === "TRANSFER" ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm text-sm">
                <p className="font-medium">Transfer bank</p>
                <p className="mt-2">{restaurant.bankName} {restaurant.bankAccountNumber}</p>
                <p>a.n. {restaurant.bankAccountName}</p>
              </div>
            ) : null}
            {paymentMethod === "CASH" ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm text-sm">
                {restaurant.cashInstruction}
              </div>
            ) : null}
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Setelah membayar, tekan tombol di bawah. Sistem akan membuat notifikasi WhatsApp ke admin resto untuk review pembayaran. Untuk sekarang WA masih mode mock/simulasi sampai API WhatsApp dipasang.
            </div>
            <button className="btn-primary" onClick={finishPayment} disabled={loading}>
              Saya sudah bayar, kirim WA admin
            </button>
          </Section>
        ) : null}

        {step === "receipt" && reservation ? (
          <Section title="Receipt">
            <Summary reservation={reservation} />
            <div className="mt-4 grid gap-2 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm text-sm sm:grid-cols-2">
              <p><span className="text-slate-500">Kode</span><br /><strong>{reservation.code}</strong></p>
              <p><span className="text-slate-500">Status</span><br /><strong>{reservation.payment?.status}</strong></p>
              <p><span className="text-slate-500">Tipe</span><br /><strong>{reservation.payment?.type}</strong></p>
              <p><span className="text-slate-500">Metode</span><br /><strong>{reservation.payment?.method}</strong></p>
            </div>
            <button className="btn-secondary mt-4" onClick={() => window.print()}>
              Download receipt
            </button>
          </Section>
        ) : null}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm shadow-slate-200/60 backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Summary({ reservation }: { reservation: Reservation }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
      <p className="font-semibold">{reservation.customerName}</p>
      <p className="text-slate-600">{formatDateTime(reservation.reservationAt)} - {reservation.partySize} tamu</p>
      <div className="mt-3 space-y-1">
        {reservation.items.map((item) => (
          <div key={`${item.nameSnapshot}-${item.quantity}`} className="flex justify-between gap-3">
            <span>{item.quantity}x {item.nameSnapshot}</span>
            <span>{rupiah(item.priceSnapshot * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 font-semibold">
        <span>Total</span>
        <span>{rupiah(reservation.subtotal)}</span>
      </div>
    </div>
  );
}
