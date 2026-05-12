"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CalendarPlus, ClipboardList, ExternalLink, Settings, Utensils } from "lucide-react";
import {
  addMenuItem,
  approvePayment,
  demoRestaurant,
  getAdminDashboard,
  getRestaurant,
  type OperatingHour,
  type MenuItem,
  type Reservation,
  type Restaurant,
  updateMenuItem,
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
};

const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function defaultOperatingHours(): OperatingHour[] {
  return Array.from({ length: 7 }).map((_, dayOfWeek) => ({
    dayOfWeek,
    openTime: dayOfWeek === 0 ? "10:00" : "09:00",
    closeTime: dayOfWeek === 0 ? "20:00" : "22:00",
    isClosed: false
  }));
}

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
      ],
      operatingHours: demoRestaurant.operatingHours ?? defaultOperatingHours()
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

function emptyMenuForm(): Omit<MenuItem, "id"> {
  return {
    name: "",
    description: "",
    category: "Makanan Utama",
    labels: [],
    price: 0,
    isAvailable: true,
    imageUrl: ""
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
    closedDates: demoRestaurant.closedDates ?? [],
    operatingHours: demoRestaurant.operatingHours ?? defaultOperatingHours(),
    qrisImageUrl: demoRestaurant.qrisImageUrl ?? ""
  });
  const [slot, setSlot] = useState({ date: dateInput(), time: "19:30", capacity: 20, isBlocked: false });
  const [menu, setMenu] = useState<Omit<MenuItem, "id">>(emptyMenuForm());
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

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
        closedDates: dashboard.restaurant.closedDates ?? [],
        operatingHours: dashboard.restaurant.operatingHours?.length ? dashboard.restaurant.operatingHours : defaultOperatingHours(),
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

  async function compressMenuImage(file: File, maxBytes = 30 * 1024) {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca gambar menu."));
      img.src = URL.createObjectURL(file);
    });

    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Browser tidak mendukung kompres gambar.");

      const sourceWidth = image.naturalWidth || image.width;
      const sourceHeight = image.naturalHeight || image.height;
      let maxSide = Math.min(720, Math.max(sourceWidth, sourceHeight));
      let bestBlob: Blob | null = null;

      for (let scale = 1; scale >= 0.35; scale -= 0.15) {
        const ratio = Math.min(1, (maxSide * scale) / Math.max(sourceWidth, sourceHeight));
        canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
        canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (let quality = 0.78; quality >= 0.28; quality -= 0.1) {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
          if (!blob) continue;
          bestBlob = blob;
          if (blob.size <= maxBytes) {
            return await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result ?? ""));
              reader.readAsDataURL(blob);
            });
          }
        }
      }

      throw new Error(`Gambar masih lebih dari 30KB setelah dikompres${bestBlob ? ` (${Math.ceil(bestBlob.size / 1024)}KB)` : ""}. Coba pakai gambar yang lebih kecil.`);
    } finally {
      URL.revokeObjectURL(image.src);
    }
  }

  async function uploadMenuImage(file?: File) {
    if (!file) return;
    setMessage("Mengompres gambar menu maksimal 30KB...");
    try {
      const imageUrl = await compressMenuImage(file);
      setMenu((current) => ({ ...current, imageUrl }));
      setMessage("Gambar menu berhasil dikompres maksimal 30KB.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengompres gambar menu.");
    }
  }

  function updateOperatingHour(dayOfWeek: number, patch: Partial<OperatingHour>) {
    setSettings((current) => ({
      ...current,
      operatingHours: (current.operatingHours.length ? current.operatingHours : defaultOperatingHours()).map((hour) =>
        hour.dayOfWeek === dayOfWeek ? { ...hour, ...patch } : hour
      )
    }));
  }

  function addClosedDate(date: string) {
    if (!date) return;
    setSettings((current) => ({
      ...current,
      closedDates: Array.from(new Set([...current.closedDates, date])).sort()
    }));
  }

  function removeClosedDate(date: string) {
    setSettings((current) => ({ ...current, closedDates: current.closedDates.filter((item) => item !== date) }));
  }

  function updateMenuLabels(value: string) {
    const labels = Array.from(new Set(value.split(",").map((label) => label.trim()).filter(Boolean))).slice(0, 12);
    setMenu((current) => ({ ...current, labels }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      if (localMode) {
        setData({ ...data, restaurant: { ...data.restaurant, ...settings } });
      } else {
        await updateRestaurantSettings(data.restaurant.id, {
          ...settings,
          operatingHours: settings.operatingHours.length ? settings.operatingHours : defaultOperatingHours()
        });
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
            menuItems: editingMenuId
              ? data.restaurant.menuItems.map((item) => (item.id === editingMenuId ? { ...menu, id: editingMenuId } : item))
              : [...data.restaurant.menuItems, { ...menu, id: `local-menu-${Date.now()}` }]
          }
        });
      } else if (editingMenuId) {
        await updateMenuItem(data.restaurant.id, editingMenuId, menu);
        await load();
      } else {
        await addMenuItem(data.restaurant.id, menu);
        await load();
      }
      setMenu(emptyMenuForm());
      setEditingMenuId(null);
      setMessage(editingMenuId ? "Menu berhasil diperbarui." : "Menu berhasil ditambahkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan menu.");
    } finally {
      setSaving(false);
    }
  }

  function editMenuItem(item: MenuItem) {
    setEditingMenuId(item.id);
    setMenu({
      name: item.name,
      description: item.description,
      category: item.category,
      labels: item.labels ?? [],
      price: item.price,
      isAvailable: item.isAvailable,
      imageUrl: item.imageUrl ?? ""
    });
    setMessage("Mode edit menu aktif. Ubah data lalu klik Simpan perubahan menu.");
  }

  function cancelMenuEdit() {
    setEditingMenuId(null);
    setMenu(emptyMenuForm());
    setMessage("");
  }

  async function toggleMenuAvailability(item: MenuItem) {
    setSaving(true);
    setMessage("");
    const nextMenu = { ...item, imageUrl: item.imageUrl ?? "", labels: item.labels ?? [], isAvailable: !item.isAvailable };
    try {
      if (localMode) {
        setData({
          ...data,
          restaurant: {
            ...data.restaurant,
            menuItems: data.restaurant.menuItems.map((menuItem) => (menuItem.id === item.id ? nextMenu : menuItem))
          }
        });
      } else {
        await updateMenuItem(data.restaurant.id, item.id, nextMenu);
        await load();
      }
      setMessage(nextMenu.isAvailable ? "Menu berhasil diaktifkan." : "Menu berhasil dinonaktifkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengubah status menu.");
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
        <div className="relative mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:py-8 md:flex-row md:items-end md:justify-between md:px-8">
          <div>
            <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Dashboard admin resto</p>
            <h1 className="mt-4 text-2xl font-light tracking-[-0.04em] sm:text-5xl">{data.restaurant.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{data.restaurant.address}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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

      <section className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:gap-6 sm:px-4 sm:py-6 md:px-8">
        {message ? <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm shadow-sm">{message}</div> : null}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <Metric title="Penghasilan transaksi" value={rupiah(data.metrics.transactionRevenue)} />
          <Metric title="Reservasi mendatang" value={data.metrics.upcomingReservations} />
          <Metric title="Review pembayaran" value={data.metrics.pendingPaymentReviews} />
          <Metric title="Menu aktif" value={data.metrics.menuCount} />
          <Metric title="Slot tersedia" value={data.metrics.slotCount} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2"><ClipboardList className="h-5 w-5" /> Antrian reservasi</CardTitle>
              <CardDescription>Admin menyetujui pembayaran setelah mendapat notifikasi WA dari customer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentReservations.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-muted-foreground">Belum ada pembayaran yang perlu dicek.</div>
              ) : (
                paymentReservations.map((reservation) => (
                  <div key={reservation.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm shadow-sm sm:grid-cols-[minmax(0,1fr)_auto]">
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
                <CardTitle className="flex flex-wrap items-center gap-2"><Settings className="h-5 w-5" /> Pengaturan</CardTitle>
                <CardDescription>DP, kapasitas, dan durasi bisa disesuaikan admin.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <AdminField label="DP (%)"><Input type="number" value={settings.dpPercentage} onChange={(event) => setSettings({ ...settings, dpPercentage: Number(event.target.value) })} /></AdminField>
                <AdminField label="Maksimal tamu"><Input type="number" value={settings.maxPartySize} onChange={(event) => setSettings({ ...settings, maxPartySize: Number(event.target.value) })} /></AdminField>
                <AdminField label="Durasi slot (menit)"><Input type="number" value={settings.slotDurationMinute} onChange={(event) => setSettings({ ...settings, slotDurationMinute: Number(event.target.value) })} /></AdminField>
                <AdminField label="Tambah tanggal libur">
                  <div className="flex gap-2">
                    <Input type="date" onChange={(event) => addClosedDate(event.target.value)} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {settings.closedDates.length ? settings.closedDates.map((date) => (
                      <button key={date} type="button" onClick={() => removeClosedDate(date)} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                        Libur {date} ×
                      </button>
                    )) : <p className="text-xs text-muted-foreground">Belum ada tanggal libur khusus.</p>}
                  </div>
                </AdminField>
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="mb-3 text-sm font-semibold">Hari buka / libur mingguan</p>
                  <div className="space-y-2">
                    {(settings.operatingHours.length ? settings.operatingHours : defaultOperatingHours()).map((hour) => (
                      <div key={hour.dayOfWeek} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{dayNames[hour.dayOfWeek]}</span>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm">
                            <input className="peer sr-only" type="checkbox" checked={hour.isClosed} onChange={(event) => updateOperatingHour(hour.dayOfWeek, { isClosed: event.target.checked })} />
                            <span className="h-4 w-4 rounded border border-rose-200 bg-white text-center leading-3 peer-checked:bg-rose-600 peer-checked:after:text-white peer-checked:after:content-['✓']" />
                            Libur mingguan
                          </label>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input type="time" value={hour.openTime} disabled={hour.isClosed} onChange={(event) => updateOperatingHour(hour.dayOfWeek, { openTime: event.target.value })} />
                          <Input type="time" value={hour.closeTime} disabled={hour.isClosed} onChange={(event) => updateOperatingHour(hour.dayOfWeek, { closeTime: event.target.value })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <AdminField label="Upload QRIS">
                  <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadQris(event.target.files?.[0])} />
                </AdminField>
                {settings.qrisImageUrl ? (
                  <img src={settings.qrisImageUrl} alt="Preview QRIS" className="aspect-square w-full max-w-48 rounded-2xl border border-slate-200 bg-white p-2 object-contain shadow-sm" />
                ) : null}
                <Button onClick={saveSettings} disabled={saving}>Simpan pengaturan</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2"><CalendarPlus className="h-5 w-5" /> Slot reservasi</CardTitle>
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
            <CardTitle className="flex flex-wrap items-center gap-2"><Utensils className="h-5 w-5" /> Kelola menu</CardTitle>
            <CardDescription>{editingMenuId ? "Edit detail menu, label, gambar, dan status aktif/nonaktif." : "Menu ini muncul di flow customer sebelum ringkasan pembayaran."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:gap-6">
            <div className="space-y-3">
              <AdminField label="Nama menu"><Input value={menu.name} onChange={(event) => setMenu({ ...menu, name: event.target.value })} /></AdminField>
              <AdminField label="Kategori utama"><Input value={menu.category} onChange={(event) => setMenu({ ...menu, category: event.target.value })} placeholder="Contoh: Makanan Utama" /></AdminField>
              <AdminField label="Label menu">
                <Input value={menu.labels.join(", ")} onChange={(event) => updateMenuLabels(event.target.value)} placeholder="Contoh: Favorit, Pedas, Promo" />
                <p className="text-xs text-muted-foreground">Pisahkan dengan koma. Label ini bebas disesuaikan admin resto.</p>
              </AdminField>
              <AdminField label="Harga"><Input type="number" value={menu.price} onChange={(event) => setMenu({ ...menu, price: Number(event.target.value) })} /></AdminField>
              <AdminField label="Deskripsi"><Input value={menu.description} onChange={(event) => setMenu({ ...menu, description: event.target.value })} /></AdminField>
              <AdminField label="Status menu">
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input type="checkbox" checked={menu.isAvailable} onChange={(event) => setMenu({ ...menu, isAvailable: event.target.checked })} />
                  {menu.isAvailable ? "Aktif, tampil di halaman customer" : "Tidak aktif, disembunyikan dari customer"}
                </label>
              </AdminField>
              <AdminField label="Upload gambar menu">
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadMenuImage(event.target.files?.[0])} />
                <p className="text-xs text-muted-foreground">Gambar otomatis dikompres menjadi maksimal 30KB sebelum disimpan.</p>
              </AdminField>
              {menu.imageUrl ? (
                <img src={menu.imageUrl} alt="Preview menu" className="aspect-video w-full rounded-2xl border border-slate-200 bg-white object-cover shadow-sm" />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveMenu} disabled={saving || !menu.name}>{editingMenuId ? "Simpan perubahan menu" : "Tambah menu"}</Button>
                {editingMenuId ? <Button type="button" variant="outline" onClick={cancelMenuEdit} disabled={saving}>Batal edit</Button> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.restaurant.menuItems.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="aspect-video w-full bg-slate-100 object-cover" />
                  ) : null}
                  <div className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.category}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {item.isAvailable ? "Aktif" : "Tidak aktif"}
                      </span>
                    </div>
                    {item.labels?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.labels.map((label) => (
                          <span key={label} className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700">{label}</span>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm font-semibold">{rupiah(item.price)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editMenuItem(item)} disabled={saving}>Edit menu</Button>
                      <Button type="button" size="sm" variant={item.isAvailable ? "outline" : "default"} onClick={() => toggleMenuAvailability(item)} disabled={saving}>
                        {item.isAvailable ? "Nonaktifkan" : "Aktifkan"}
                      </Button>
                    </div>
                  </div>
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
      <CardContent className="relative p-4 sm:p-5">
        <div className="absolute right-4 top-4 h-12 w-12 rounded-full bg-indigo-100/70 blur-xl" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-3 break-words text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{value}</p>
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
