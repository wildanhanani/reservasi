"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarPlus, ClipboardList, ExternalLink, Settings, Utensils } from "lucide-react";
import {
  addMenuItem,
  approvePayment,
  demoRestaurant,
  getAdminDashboard,
  getRestaurant,
  type MenuItem,
  type Reservation,
  type Restaurant,
  updateRestaurantSettings,
  upsertReservationSlot
} from "@/lib/api";
import { formatDateTime, rupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DashboardData = {
  restaurant: Restaurant & {
    reservations: Reservation[];
    reservationSlots: Array<{ id: string; date: string; time: string; capacity: number; isBlocked: boolean }>;
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
};

function dateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function demoDashboard(): DashboardData {
  return {
    restaurant: {
      ...demoRestaurant,
      reservations: [],
      reservationSlots: [
        { id: "slot-demo-1", date: `${dateInput()}T00:00:00.000Z`, time: "11:00", capacity: 24, isBlocked: false },
        { id: "slot-demo-2", date: `${dateInput()}T00:00:00.000Z`, time: "18:00", capacity: 18, isBlocked: false }
      ]
    },
    metrics: {
      upcomingReservations: 0,
      pendingPaymentReviews: 0,
      menuCount: demoRestaurant.menuItems.length,
      slotCount: 2,
      transactionRevenue: 0,
      grossSales: 0,
      estimatedProfit: 0,
      paidTransactionCount: 0
    }
  };
}

export function AdminDashboard({ slug }: { slug: string }) {
  const [data, setData] = useState<DashboardData>(demoDashboard());
  const [localMode, setLocalMode] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    dpPercentage: demoRestaurant.dpPercentage,
    maxPartySize: demoRestaurant.maxPartySize,
    slotDurationMinute: 90,
    qrisImageUrl: demoRestaurant.qrisImageUrl ?? ""
  });
  const [slot, setSlot] = useState({ date: dateInput(), time: "19:30", capacity: 20, isBlocked: false });
  const [menu, setMenu] = useState<Omit<MenuItem, "id">>({
    name: "",
    description: "",
    category: "Makanan Utama",
    price: 0,
    isAvailable: true,
    imageUrl: ""
  });

  async function load() {
    setMessage("");
    try {
      const restaurant = await getRestaurant(slug);
      const dashboard = await getAdminDashboard(restaurant.id);
      setData(dashboard);
      setSettings({
        dpPercentage: dashboard.restaurant.dpPercentage,
        maxPartySize: dashboard.restaurant.maxPartySize,
        slotDurationMinute: dashboard.restaurant.slotDurationMinute ?? 90,
        qrisImageUrl: dashboard.restaurant.qrisImageUrl ?? ""
      });
      setLocalMode(false);
    } catch {
      setData(demoDashboard());
      setLocalMode(true);
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  const reservations = data.restaurant.reservations ?? [];
  const paymentReservations = useMemo(
    () => reservations.filter((reservation) => reservation.payment?.status === "PENDING_REVIEW" || reservation.status === "AWAITING_PAYMENT" || reservation.status === "CONFIRMED"),
    [reservations]
  );

  function confirmationText(reservation: Reservation) {
    const receiptUrl = reservation.receiptUrl || `${window.location.origin}/receipt/${reservation.code}`;
    return `Reservasi ${data.restaurant.name} sudah terkonfirmasi. Kode: ${reservation.code}. Receipt: ${receiptUrl}`;
  }

  function waLink(reservation: Reservation) {
    const phone = reservation.customerPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(confirmationText(reservation))}`;
  }

  function uploadQris(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((current) => ({ ...current, qrisImageUrl: String(reader.result ?? "") }));
    };
    reader.readAsDataURL(file);
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      if (localMode) {
        setData({ ...data, restaurant: { ...data.restaurant, ...settings } });
      } else {
        await updateRestaurantSettings(data.restaurant.id, settings);
        await load();
      }
      setMessage("Pengaturan berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSlot() {
    setSaving(true);
    setMessage("");
    try {
      if (localMode) {
        setData({
          ...data,
          restaurant: {
            ...data.restaurant,
            reservationSlots: [
              ...data.restaurant.reservationSlots,
              { id: `local-slot-${Date.now()}`, date: `${slot.date}T00:00:00.000Z`, time: slot.time, capacity: slot.capacity, isBlocked: slot.isBlocked }
            ]
          }
        });
      } else {
        await upsertReservationSlot(data.restaurant.id, slot);
        await load();
      }
      setMessage("Slot berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan slot.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMenu() {
    setSaving(true);
    setMessage("");
    try {
      if (localMode) {
        setData({
          ...data,
          restaurant: {
            ...data.restaurant,
            menuItems: [...data.restaurant.menuItems, { ...menu, id: `local-menu-${Date.now()}` }]
          }
        });
      } else {
        await addMenuItem(data.restaurant.id, menu);
        await load();
      }
      setMenu({ name: "", description: "", category: "Makanan Utama", price: 0, isAvailable: true, imageUrl: "" });
      setMessage("Menu berhasil ditambahkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan menu.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmPayment(reservationId: string) {
    setSaving(true);
    setMessage("");
    try {
      await approvePayment(reservationId);
      await load();
      setMessage("Pembayaran disetujui dan notifikasi WhatsApp customer dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyetujui pembayaran.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    document.cookie.split(";").forEach((cookie) => {
      document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
    localStorage.removeItem("reservasi_token");
    localStorage.removeItem("reservasi_user");
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f6f9fc] text-[#061b31]">
      <section className="relative overflow-hidden border-b border-white/70 bg-white">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_20%_20%,rgba(83,58,253,0.14),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(249,107,238,0.14),transparent_28%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8">
          <div>
            <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Dashboard admin resto</p>
            <h1 className="mt-4 text-3xl font-light tracking-[-0.04em] sm:text-5xl">{data.restaurant.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{data.restaurant.address}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {localMode ? <p className="rounded-md border border-secondary/40 bg-secondary/10 px-3 py-2 text-sm">Mode demo lokal</p> : null}
            <Button asChild variant="outline">
              <a href={`/${data.restaurant.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Buka path
              </a>
            </Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-8">
        {message ? <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm shadow-sm">{message}</div> : null}

        <div className="grid gap-4 md:grid-cols-5">
          <Metric title="Penghasilan transaksi" value={rupiah(data.metrics.transactionRevenue)} />
          <Metric title="Reservasi mendatang" value={data.metrics.upcomingReservations} />
          <Metric title="Review pembayaran" value={data.metrics.pendingPaymentReviews} />
          <Metric title="Menu aktif" value={data.metrics.menuCount} />
          <Metric title="Slot tersedia" value={data.metrics.slotCount} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Antrian reservasi</CardTitle>
              <CardDescription>Admin menyetujui pembayaran setelah mendapat notifikasi WA dari customer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentReservations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-muted-foreground">Belum ada pembayaran yang perlu dicek.</div>
              ) : (
                paymentReservations.map((reservation) => (
                  <div key={reservation.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm md:grid-cols-[1fr_auto]">
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold">{reservation.customerName} - {reservation.code}</p>
                      <p>{formatDateTime(reservation.reservationAt)} untuk {reservation.partySize} tamu</p>
                      <p className="text-muted-foreground">{reservation.payment?.method} {reservation.payment?.type} - {rupiah(reservation.payment?.amountDue ?? 0)}</p>
                      <p className="text-muted-foreground">Status: {reservation.status} / {reservation.payment?.status}</p>
                    </div>
                    {reservation.status === "CONFIRMED" ? (
                      <Button asChild variant="outline">
                        <a href={waLink(reservation)} target="_blank" rel="noreferrer">
                          WA customer
                        </a>
                      </Button>
                    ) : (
                      <Button onClick={() => confirmPayment(reservation.id)} disabled={saving || localMode}>
                        <BadgeCheck className="h-4 w-4" /> Setujui
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan</CardTitle>
                <CardDescription>DP, kapasitas, dan durasi bisa disesuaikan admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminField label="DP (%)"><Input type="number" value={settings.dpPercentage} onChange={(event) => setSettings({ ...settings, dpPercentage: Number(event.target.value) })} /></AdminField>
                <AdminField label="Maksimal tamu"><Input type="number" value={settings.maxPartySize} onChange={(event) => setSettings({ ...settings, maxPartySize: Number(event.target.value) })} /></AdminField>
                <AdminField label="Durasi slot (menit)"><Input type="number" value={settings.slotDurationMinute} onChange={(event) => setSettings({ ...settings, slotDurationMinute: Number(event.target.value) })} /></AdminField>
                <AdminField label="Upload QRIS">
                  <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQris(event.target.files?.[0])} />
                </AdminField>
                {settings.qrisImageUrl ? (
                  <img src={settings.qrisImageUrl} alt="Preview QRIS" className="h-40 w-40 rounded-2xl border border-slate-200 bg-white p-2 object-contain shadow-sm" />
                ) : null}
                <Button onClick={saveSettings} disabled={saving}>Simpan pengaturan</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarPlus className="h-5 w-5" /> Slot reservasi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminField label="Tanggal"><Input type="date" value={slot.date} onChange={(event) => setSlot({ ...slot, date: event.target.value })} /></AdminField>
                <AdminField label="Jam"><Input value={slot.time} onChange={(event) => setSlot({ ...slot, time: event.target.value })} /></AdminField>
                <AdminField label="Kapasitas"><Input type="number" value={slot.capacity} onChange={(event) => setSlot({ ...slot, capacity: Number(event.target.value) })} /></AdminField>
                <Button onClick={saveSlot} disabled={saving}>Simpan slot</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Utensils className="h-5 w-5" /> Kelola menu</CardTitle>
            <CardDescription>Menu ini muncul di flow customer sebelum ringkasan pembayaran.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-3">
              <AdminField label="Nama menu"><Input value={menu.name} onChange={(event) => setMenu({ ...menu, name: event.target.value })} /></AdminField>
              <AdminField label="Kategori"><Input value={menu.category} onChange={(event) => setMenu({ ...menu, category: event.target.value })} /></AdminField>
              <AdminField label="Harga"><Input type="number" value={menu.price} onChange={(event) => setMenu({ ...menu, price: Number(event.target.value) })} /></AdminField>
              <AdminField label="Deskripsi"><Input value={menu.description} onChange={(event) => setMenu({ ...menu, description: event.target.value })} /></AdminField>
              <AdminField label="URL gambar"><Input value={menu.imageUrl ?? ""} onChange={(event) => setMenu({ ...menu, imageUrl: event.target.value })} /></AdminField>
              <Button onClick={saveMenu} disabled={saving || !menu.name}>Tambah menu</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.restaurant.menuItems.map((item) => (
                <div key={item.id} className="rounded-md border bg-white p-3">
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.category}</p>
                  <p className="mt-2 text-sm font-semibold">{rupiah(item.price)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-5">
        <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-indigo-100/70 blur-xl" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function AdminField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
