"use client";

import { useEffect, useMemo, useState } from "react";
import {
  checkAvailability,
  choosePayment,
  createReservation,
  demoRestaurant,
  getRestaurant,
  getReservation,
  type Payment,
  type Reservation,
  type Restaurant,
  saveReservationMenu,
  submitPayment,
  type Slot
} from "@/lib/api";
import { formatDateTime, rupiah } from "@/lib/utils";

type Step = "identity" | "menu" | "summary";

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
  { key: "summary", label: "Bayar" }
];

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function stepNumber(step: Step) {
  return steps.findIndex((item) => item.key === step) + 1;
}

function addDays(offsetDay: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDay);
  return date.toISOString().slice(0, 10);
}

function isClosedDate(restaurant: Restaurant, date: string) {
  const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const weekly = restaurant.operatingHours?.find((hour) => hour.dayOfWeek === dayOfWeek);
  return Boolean(restaurant.closedDates?.includes(date) || weekly?.isClosed);
}

function demoSlots(date: string, partySize: number): Slot[] {
  return [
    { id: "slot-1", date, time: "11:00", capacity: 20, usedCapacity: 0, remainingCapacity: 20, available: partySize <= 20 },
    { id: "slot-2", date, time: "18:00", capacity: 16, usedCapacity: 0, remainingCapacity: 16, available: partySize <= 16 },
    { id: "slot-3", date, time: "19:30", capacity: 12, usedCapacity: 0, remainingCapacity: 12, available: partySize <= 12 }
  ];
}

function normalizePartySizeInput(value: string, maxPartySize: number) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return 0;
  return Math.min(Number(digits), maxPartySize);
}

function validateIdentityForm(form: IdentityForm) {
  const name = form.customerName.trim();
  const phone = form.customerPhone.trim();
  const email = form.customerEmail.trim();
  const errors: string[] = [];

  if (!name) errors.push("Nama customer wajib diisi.");
  else if (name.length < 2) errors.push("Nama customer minimal 2 karakter.");

  if (!phone) errors.push("Nomor WhatsApp wajib diisi.");
  else if (phone.length < 8) errors.push("Nomor WhatsApp minimal 8 digit.");

  if (!email) errors.push("Email receipt wajib diisi.");
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Email receipt belum valid.");

  if (!form.partySize || form.partySize < 1) errors.push("Jumlah tamu wajib diisi minimal 1.");
  if (!form.date) errors.push("Tanggal wajib diisi.");
  if (!form.time) errors.push("Pilih salah satu jam tersedia sebelum lanjut.");
  return errors.join("\n");
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    DRAFT: "Draft - belum pilih menu",
    AWAITING_PAYMENT: "Menunggu pembayaran",
    PAYMENT_REVIEW: "Pembayaran sedang direview admin",
    CONFIRMED: "Reservasi dikonfirmasi",
    REJECTED: "Reservasi ditolak",
    CANCELLED: "Reservasi dibatalkan",
    COMPLETED: "Reservasi selesai"
  };
  return status ? labels[status] ?? status : "Belum ada status";
}

function paymentStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    UNPAID: "Belum dibayar",
    PENDING_REVIEW: "Menunggu review pembayaran",
    PARTIALLY_PAID: "DP diterima",
    PAID: "Lunas",
    REJECTED: "Pembayaran ditolak"
  };
  return status ? labels[status] ?? status : "Belum ada pembayaran";
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
  const [trackingCode, setTrackingCode] = useState("");
  const [trackingResult, setTrackingResult] = useState<Reservation | null>(null);
  const [trackingMessage, setTrackingMessage] = useState("");
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
  const dateOptions = useMemo(
    () => Array.from({ length: 30 }).map((_, index) => {
      const date = addDays(index + 1);
      return { date, closed: isClosedDate(restaurant, date) };
    }),
    [restaurant]
  );

  function goBack(target: Step) {
    setMessage("");
    setStep(target);
  }

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
      if (isClosedDate(restaurant, form.date)) {
        applySlots([]);
        if (!options?.silent) {
          setMessage("Tanggal ini sedang libur. Silakan pilih tanggal lain.");
        }
        return;
      }

      if (localMode) {
        applySlots(isClosedDate(restaurant, form.date) ? [] : demoSlots(form.date, form.partySize));
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
    if (isClosedDate(restaurant, form.date)) {
      applySlots([]);
      setMessage("Tanggal ini sedang libur. Silakan pilih tanggal lain.");
      return;
    }

    const validationMessage = validateIdentityForm(form);
    if (validationMessage) {
      if (!form.time) {
        await loadSlots();
      }
      setMessage(validationMessage);
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

  async function trackReservation() {
    const code = trackingCode.trim().toUpperCase();
    setTrackingMessage("");
    setTrackingResult(null);

    if (!code) {
      setTrackingMessage("Masukkan kode reservasi dulu.");
      return;
    }

    setLoading(true);
    try {
      const data = await getReservation(code);
      setTrackingResult(data);
    } catch (error) {
      setTrackingMessage(error instanceof Error ? error.message : "Reservasi tidak ditemukan.");
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
        const payment: Payment = {
          type: paymentType,
          method: "QRIS",
          status: "PENDING_REVIEW",
          amountDue,
          amountPaid: 0,
          proofUrl: null
        };
        setReservation({
          ...reservation,
          status: "PAYMENT_REVIEW",
          paymentAmount: amountDue,
          receiptUrl: `/receipt/${reservation.code}`,
          payment
        });
      } else {
        const paymentReservation = await choosePayment(reservation.code, { type: paymentType, method: "QRIS" });
        const data = await submitPayment(paymentReservation.code);
        setReservation(data);
      }
      setMessage("Receipt reservasi sudah dibuat. Notifikasi WhatsApp dan email receipt sudah dikirim otomatis.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memproses pembayaran dan receipt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f9fc] text-[#061b31]">
      <div className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <header className="mb-4 rounded-[1.5rem] border border-[#e5edf5] bg-white p-4 shadow-[rgba(50,50,93,0.18)_0px_30px_45px_-30px] sm:mb-6 sm:rounded-[2rem] sm:p-6">
          <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Reservasi online</p>
          <h1 className="mt-4 text-2xl font-light tracking-[-0.04em] sm:text-4xl">{restaurant.name}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{restaurant.description}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">{restaurant.address}</span>
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">WA {restaurant.whatsappNumber}</span>
            <span className="rounded-xl bg-[#f6f9fc] px-3 py-1 ring-1 ring-[#e5edf5]">DP {restaurant.dpPercentage}%</span>
          </div>
        </header>

        <div className="mb-4 -mx-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
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

        <section className="mb-4 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/60 backdrop-blur sm:rounded-3xl sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h2 className="text-lg font-semibold">Cek status pemesanan</h2>
              <p className="mt-1 text-sm text-slate-500">Masukkan kode reservasi untuk tracking status pembayaran dan konfirmasi.</p>
              <input
                className="input mt-3"
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value.toUpperCase())}
                placeholder="Contoh: RSV-XXXX-1234"
              />
            </div>
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={trackReservation} disabled={loading}>
              Cek status
            </button>
          </div>
          {trackingMessage ? <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{trackingMessage}</p> : null}
          {trackingResult ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:grid-cols-2">
              <p><span className="text-emerald-700/80">Kode</span><br /><strong>{trackingResult.code}</strong></p>
              <p><span className="text-emerald-700/80">Reservasi</span><br /><strong>{statusLabel(trackingResult.status)}</strong></p>
              <p><span className="text-emerald-700/80">Pembayaran</span><br /><strong>{paymentStatusLabel(trackingResult.payment?.status)}</strong></p>
              <p><span className="text-emerald-700/80">Jadwal</span><br /><strong>{formatDateTime(trackingResult.reservationAt)}</strong></p>
              {trackingResult.receiptUrl ? (
                <a className="font-semibold text-[#533afd] underline sm:col-span-2" href={trackingResult.receiptUrl} target="_blank" rel="noreferrer">Buka receipt</a>
              ) : null}
            </div>
          ) : null}
        </section>

        {message ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
        ) : null}

        {step === "identity" ? (
          <Section title="Data reservasi">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <Field label="Nama customer">
                <input className="input" required value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
              </Field>
              <Field label="Nomor WhatsApp">
                <input className="input" required value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
              </Field>
              <Field label="Email receipt">
                <input className="input" type="email" required value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} />
              </Field>
              <Field label="Jumlah tamu">
                <input className="input" type="text" inputMode="numeric" pattern="[0-9]*" required min={1} max={restaurant.maxPartySize} value={form.partySize || ""} onChange={(event) => setForm({ ...form, partySize: normalizePartySizeInput(event.target.value, restaurant.maxPartySize) })} />
              </Field>
              <Field label="Tanggal">
                <input className="input" type="date" required value={form.date} min={dateOptions[0]?.date} onChange={(event) => {
                  if (isClosedDate(restaurant, event.target.value)) {
                    applySlots([]);
                    setMessage("Tanggal ini sedang libur. Silakan pilih tanggal lain.");
                    return;
                  }
                  setMessage("");
                  setForm({ ...form, date: event.target.value, time: "" });
                }} />
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {dateOptions.slice(0, 10).map((option) => (
                    <button
                      key={option.date}
                      type="button"
                      disabled={option.closed}
                      onClick={() => {
                        setMessage("");
                        setForm({ ...form, date: option.date, time: "" });
                      }}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold ${form.date === option.date ? "border-[#533afd] bg-[#533afd] text-white" : "border-slate-200 bg-white text-slate-700"} disabled:cursor-not-allowed disabled:bg-rose-50 disabled:text-rose-400`}
                    >
                      {option.date.slice(5)}{option.closed ? <span className="block text-[10px]">Libur</span> : null}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex items-end">
                <button className="btn-secondary w-full" type="button" onClick={() => loadSlots()} disabled={loading}>
                  {loading ? "Mengecek..." : "Cek slot"}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Jam tersedia</p>
                {form.time ? <p className="text-xs text-emerald-700">Terpilih {form.time}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
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
              <input className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opsional: kursi bayi, area non-smoking, atau request khusus" />
            </Field>

            <button className="btn-primary w-full sm:w-auto" onClick={startReservation} disabled={loading}>
              Lanjut pilih menu
            </button>
          </Section>
        ) : null}

        {step === "menu" ? (
          <Section title="Galeri menu">
            <p className="text-sm text-slate-500">Card gallery menu dengan foto, label, deskripsi, dan tombol tambah item.</p>
            {Object.entries(menuGroups).map(([category, items]) => (
              <div key={category} className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">{category}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <div key={item.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                      <img src={item.imageUrl || `https://placehold.co/720x480?text=${encodeURIComponent(item.name)}`} alt={item.name} className="aspect-video w-full bg-slate-100 object-cover" />
                      <div className="space-y-3 p-4">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm font-medium text-[#533afd]">{rupiah(item.price)}</p>
                          {item.description ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}
                        </div>
                        {item.labels?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {item.labels.map((label) => (
                              <span key={label} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">{label}</span>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-2">
                          <button className="qty-btn" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: Math.max((selectedItems[item.id] ?? 0) - 1, 0) })}>-</button>
                          <span className="min-w-10 rounded-full bg-slate-50 px-3 py-1 text-center text-sm font-semibold">{selectedItems[item.id] ?? 0}</span>
                          <button className="qty-btn" onClick={() => setSelectedItems({ ...selectedItems, [item.id]: (selectedItems[item.id] ?? 0) + 1 })}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="grid gap-3 border-t pt-4 sm:flex sm:items-center sm:justify-between">
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={() => goBack("identity")}>Kembali ubah tanggal</button>
              <strong>Total {rupiah(subtotal)}</strong>
              <button className="btn-primary w-full sm:w-auto" onClick={saveMenu} disabled={loading}>
                Lanjut
              </button>
            </div>
          </Section>
        ) : null}

        {step === "summary" && reservation ? (
          <Section title={reservation.receiptUrl ? "Pembayaran QRIS & receipt" : "Ringkasan bayar"}>
            <Summary reservation={{ ...reservation, subtotal: reservation.subtotal || subtotal }} />

            {reservation.receiptUrl ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-center shadow-sm sm:text-left">
                  <p className="font-medium">Scan QRIS</p>
                  <p className="mt-1 text-sm text-slate-500">Receipt reservasi sudah dibuat. WhatsApp dan email receipt dikirim otomatis.</p>
                  <img className="mx-auto mt-3 aspect-square w-full max-w-72 rounded-xl border bg-white object-contain p-2 sm:mx-0" src={qrisImageUrl} alt="QRIS" />
                </div>
                <div className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:grid-cols-2">
                  <p><span className="text-emerald-700/80">Kode receipt</span><br /><strong>{reservation.code}</strong></p>
                  <p><span className="text-emerald-700/80">Status pembayaran</span><br /><strong>{reservation.payment?.status}</strong></p>
                  <p><span className="text-emerald-700/80">Metode</span><br /><strong>QRIS</strong></p>
                  <p><span className="text-emerald-700/80">Dibayar sekarang</span><br /><strong>{rupiah(reservation.paymentAmount || reservation.payment?.amountDue || amountDue)}</strong></p>
                </div>
                <a className="btn-secondary inline-flex w-full items-center justify-center sm:w-auto" href={reservation.receiptUrl} target="_blank" rel="noreferrer">
                  Buka receipt reservasi
                </a>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Tipe pembayaran">
                    <select className="input" value={paymentType} onChange={(event) => setPaymentType(event.target.value as "FULL" | "DP")}>
                      <option value="DP">DP {restaurant.dpPercentage}%</option>
                      <option value="FULL">Bayar penuh</option>
                    </select>
                  </Field>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                    <span className="text-slate-500">Metode pembayaran</span>
                    <p className="mt-1 font-semibold text-slate-900">QRIS otomatis</p>
                  </div>
                </div>
                <div className="my-4 rounded-2xl bg-slate-100/80 p-4">
                  <p className="text-sm text-slate-500">Dibayar sekarang</p>
                  <p className="text-xl font-bold">{rupiah(amountDue)}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="btn-secondary w-full sm:w-auto" type="button" onClick={() => goBack("menu")}>Kembali pilih menu</button>
                  <button className="btn-primary w-full sm:w-auto" onClick={savePayment} disabled={loading}>
                    {loading ? "Memproses..." : "Lanjut bayar"}
                  </button>
                </div>
              </>
            )}
          </Section>
        ) : null}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-sm shadow-slate-200/60 backdrop-blur sm:rounded-3xl sm:p-5">
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
          <div key={`${item.nameSnapshot}-${item.quantity}`} className="grid gap-1 sm:flex sm:justify-between sm:gap-3">
            <span>{item.quantity}x {item.nameSnapshot}</span>
            <span>{rupiah(item.priceSnapshot * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-1 border-t border-slate-200 pt-2 font-semibold sm:flex sm:justify-between">
        <span>Total</span>
        <span>{rupiah(reservation.subtotal)}</span>
      </div>
    </div>
  );
}
