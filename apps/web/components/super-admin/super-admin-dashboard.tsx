"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Ban, Building2, CircleDollarSign, ExternalLink, Plus, ReceiptText, RefreshCw, Store } from "lucide-react";
import { createRestaurant, getSuperAdminDashboard, type CreateRestaurantBody, type SuperAdminDashboard, updateRestaurantStatus } from "@/lib/api";
import { formatDateTime, rupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const emptyDashboard: SuperAdminDashboard = {
  metrics: {
    restaurantCount: 0,
    activeRestaurantCount: 0,
    inactiveRestaurantCount: 0,
    transactionCount: 0,
    totalRevenue: 0,
    grossSales: 0,
    estimatedProfit: 0
  },
  restaurants: [],
  transactions: []
};

const initialCreateForm: CreateRestaurantBody = {
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  ownerPassword: "",
  restaurantName: "",
  slug: "",
  description: "",
  address: "",
  phone: "",
  whatsappNumber: ""
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SuperAdminDashboard() {
  const [data, setData] = useState<SuperAdminDashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateRestaurantBody>(initialCreateForm);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const dashboard = await getSuperAdminDashboard();
      setData(dashboard);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat dashboard super admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const paidTransactions = useMemo(
    () => data.transactions.filter((transaction) => transaction.payment?.status === "PAID" || transaction.payment?.status === "PARTIALLY_PAID"),
    [data.transactions]
  );

  async function toggleRestaurant(restaurantId: string, isActive: boolean) {
    setSavingId(restaurantId);
    setMessage("");
    try {
      await updateRestaurantStatus(restaurantId, isActive);
      await load();
      setMessage(isActive ? "Resto berhasil diaktifkan." : "Resto berhasil dinonaktifkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengubah status resto.");
    } finally {
      setSavingId(null);
    }
  }

  function updateCreateForm<K extends keyof CreateRestaurantBody>(key: K, value: CreateRestaurantBody[K]) {
    setCreateForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "restaurantName" && !current.slug ? { slug: slugify(String(value)) } : {})
    }));
  }

  async function submitCreateRestaurant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const slug = slugify(createForm.slug || createForm.restaurantName);
      if (!slug) {
        throw new Error("Path resto wajib diisi.");
      }
      const payload = { ...createForm, slug };
      await createRestaurant(payload);
      setCreateForm(initialCreateForm);
      await load();
      setMessage(`Resto berhasil dibuat. Link reservasi: /${slug}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat resto baru.");
    } finally {
      setCreating(false);
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
            <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Super admin</p>
            <h1 className="mt-4 text-3xl font-light tracking-[-0.04em] sm:text-5xl">Kontrol admin resto & transaksi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Kelola status resto, pantau transaksi, dan lihat rekapan profit.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => load()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-8">
        {message ? <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm shadow-sm">{message}</div> : null}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<Store className="h-5 w-5" />} title="Total resto" value={data.metrics.restaurantCount} />
          <Metric icon={<BadgeCheck className="h-5 w-5" />} title="Resto aktif" value={data.metrics.activeRestaurantCount} />
          <Metric icon={<ReceiptText className="h-5 w-5" />} title="Transaksi" value={data.metrics.transactionCount} />
          <Metric icon={<CircleDollarSign className="h-5 w-5" />} title="Profit terkumpul" value={rupiah(data.metrics.estimatedProfit)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Tambah resto baru</CardTitle>
            <CardDescription>Buat resto baru sekali klik. Link reservasinya otomatis jadi path sesuai nama/path resto, contoh: <span className="font-semibold text-slate-700">/kedai-baru</span>.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submitCreateRestaurant}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nama resto">
                  <Input required value={createForm.restaurantName} onChange={(event) => updateCreateForm("restaurantName", event.target.value)} placeholder="Contoh: Kedai Amarta" />
                </Field>
                <Field label="Path / slug resto">
                  <Input required pattern="[a-z0-9-]+" value={createForm.slug} onChange={(event) => updateCreateForm("slug", slugify(event.target.value))} placeholder="kedai-amarta" />
                  <p className="mt-1 text-xs text-muted-foreground">Nanti halaman reservasi ada di <span className="font-semibold text-slate-700">/{createForm.slug || "nama-resto"}</span></p>
                </Field>
                <Field label="Alamat">
                  <Input required value={createForm.address} onChange={(event) => updateCreateForm("address", event.target.value)} placeholder="Jl. Contoh No. 1" />
                </Field>
                <Field label="No. telepon resto">
                  <Input required value={createForm.phone} onChange={(event) => updateCreateForm("phone", event.target.value)} placeholder="021xxxx / 08xxxx" />
                </Field>
                <Field label="WhatsApp resto">
                  <Input required value={createForm.whatsappNumber} onChange={(event) => updateCreateForm("whatsappNumber", event.target.value)} placeholder="62812xxxx" />
                </Field>
                <Field label="Deskripsi singkat">
                  <Input required value={createForm.description} onChange={(event) => updateCreateForm("description", event.target.value)} placeholder="Reservasi online untuk resto..." />
                </Field>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-sm font-semibold">Admin/owner resto</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nama admin">
                    <Input required value={createForm.ownerName} onChange={(event) => updateCreateForm("ownerName", event.target.value)} placeholder="Nama pemilik/admin" />
                  </Field>
                  <Field label="Email login admin">
                    <Input required type="email" value={createForm.ownerEmail} onChange={(event) => updateCreateForm("ownerEmail", event.target.value)} placeholder="admin@resto.com" />
                  </Field>
                  <Field label="No. HP admin">
                    <Input required value={createForm.ownerPhone} onChange={(event) => updateCreateForm("ownerPhone", event.target.value)} placeholder="62812xxxx" />
                  </Field>
                  <Field label="Password awal admin">
                    <Input type="password" minLength={8} value={createForm.ownerPassword ?? ""} onChange={(event) => updateCreateForm("ownerPassword", event.target.value)} placeholder="Minimal 8 karakter" />
                    <p className="mt-1 text-xs text-muted-foreground">Kosongkan kalau mau pakai password default dev sementara.</p>
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" /> {creating ? "Menyimpan..." : "Tambah resto"}
                </Button>
                <p className="text-xs text-muted-foreground">Setelah dibuat, resto muncul di daftar bawah dan bisa dibuka via path publik.</p>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Admin resto</CardTitle>
              <CardDescription>Aktifkan/nonaktifkan resto dan cek owner/admin yang mengelola.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? <p className="text-sm text-muted-foreground">Memuat data...</p> : null}
              {data.restaurants.length === 0 && !loading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-muted-foreground">Belum ada resto.</div>
              ) : null}
              {data.restaurants.map((restaurant) => (
                <div key={restaurant.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm md:grid-cols-[1fr_auto]">
                  <div className="space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">{restaurant.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${restaurant.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {restaurant.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    <p className="text-muted-foreground">/{restaurant.slug} · {restaurant.address}</p>
                    <p>Owner: {restaurant.owner.name} ({restaurant.owner.email})</p>
                    <p>Admin: {restaurant.admins.map((admin) => admin.user.name).join(", ") || "-"}</p>
                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1">Reservasi {restaurant.reservationCount}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Transaksi paid {restaurant.paidReservationCount}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Profit {rupiah(restaurant.estimatedProfit)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:flex-col md:items-stretch">
                    {restaurant.isActive ? (
                      <Button variant="destructive" onClick={() => toggleRestaurant(restaurant.id, false)} disabled={savingId === restaurant.id}>
                        <Ban className="mr-2 h-4 w-4" /> Nonaktifkan
                      </Button>
                    ) : (
                      <Button onClick={() => toggleRestaurant(restaurant.id, true)} disabled={savingId === restaurant.id}>
                        <BadgeCheck className="mr-2 h-4 w-4" /> Aktifkan
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <a href={`/${restaurant.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Buka path</a>
                    </Button>
                    <Button asChild variant="outline">
                      <a href={`/admin?slug=${restaurant.slug}`}>Buka admin</a>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rekapan profit</CardTitle>
              <CardDescription>Profit saat ini dihitung dari nominal pembayaran yang sudah disetujui.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SummaryRow label="Omzet menu paid" value={rupiah(data.metrics.grossSales)} />
              <SummaryRow label="Pembayaran terkumpul" value={rupiah(data.metrics.totalRevenue)} />
              <SummaryRow label="Estimasi profit" value={rupiah(data.metrics.estimatedProfit)} strong />
              <SummaryRow label="Transaksi paid" value={`${paidTransactions.length} transaksi`} />
              <SummaryRow label="Resto nonaktif" value={`${data.metrics.inactiveRestaurantCount} resto`} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transaksi terbaru</CardTitle>
            <CardDescription>Menampilkan 50 reservasi terbaru yang sudah punya data pembayaran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.transactions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-muted-foreground">Belum ada transaksi.</div>
            ) : null}
            {data.transactions.map((transaction) => (
              <div key={transaction.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-sm text-sm md:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-semibold">{transaction.code} · {transaction.restaurantName}</p>
                  <p className="text-muted-foreground">{transaction.customerName} · {formatDateTime(transaction.reservationAt)} · {transaction.itemCount} item</p>
                  <p className="text-muted-foreground">Status: {transaction.status} / {transaction.payment?.status ?? "-"}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="font-semibold">{rupiah(transaction.payment?.amountPaid ?? 0)}</p>
                  <p className="text-muted-foreground">Tagihan {rupiah(transaction.payment?.amountDue ?? transaction.paymentAmount)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}

function Metric({ icon, title, value }: { icon: React.ReactNode; title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-full bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold text-emerald-700" : "font-semibold"}>{value}</span>
    </div>
  );
}
