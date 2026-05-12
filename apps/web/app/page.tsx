import Link from "next/link";
import { ArrowRight, CalendarCheck2, CreditCard, LayoutDashboard, ShieldCheck, UtensilsCrossed } from "lucide-react";

const features = [
  {
    icon: CalendarCheck2,
    title: "Reservasi per resto",
    description: "Setiap resto punya path sendiri, jadwal sendiri, kapasitas sendiri, dan flow booking yang rapi."
  },
  {
    icon: UtensilsCrossed,
    title: "Pre-order menu",
    description: "Customer bisa pilih menu sebelum datang, lalu sistem menghitung subtotal dan nominal pembayaran."
  },
  {
    icon: CreditCard,
    title: "Pembayaran QRIS / transfer",
    description: "Admin bisa upload QRIS, customer melihat instruksi bayar, lalu admin menyetujui pembayaran."
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard admin resto",
    description: "Pantau reservasi, review pembayaran, kelola slot, menu, QRIS, dan penghasilan transaksi."
  },
  {
    icon: ShieldCheck,
    title: "Akses admin aman",
    description: "Dashboard admin resto dilindungi login dan token supaya operasional tetap terkontrol."
  }
];

const steps = ["Customer buka path resto", "Pilih jadwal & menu", "Bayar DP/full payment", "Admin approve & follow-up WA"];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f9fc] text-[#061b31]">
      <section className="relative border-b border-white/70 bg-white">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_20%_20%,rgba(83,58,253,0.18),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(249,107,238,0.18),transparent_28%)]" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:py-5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#533afd] text-white shadow-[rgba(50,50,93,0.25)_0px_18px_35px_-18px]">
              <CalendarCheck2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">ReservasiPro</p>
              <p className="text-xs text-slate-500">Sistem booking resto</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#fitur" className="hover:text-[#533afd]">Fitur</a>
            <a href="#alur" className="hover:text-[#533afd]">Alur</a>
            <a href="#dashboard" className="hover:text-[#533afd]">Dashboard</a>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/login" className="rounded-xl border border-[#d6d9fc] bg-white px-3 py-2 text-sm font-medium text-[#533afd] shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 sm:px-4">
              Login
            </Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 pb-14 pt-8 sm:pb-20 sm:pt-12 md:grid-cols-[minmax(0,1fr)_minmax(320px,460px)] md:px-8 md:pb-28 md:pt-20">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#533afd]">Booking system untuk resto modern</p>
            <h1 className="mt-5 text-4xl font-light leading-[1.04] tracking-[-0.05em] text-[#061b31] sm:mt-6 sm:text-6xl lg:text-7xl">
              Sistem booking resto yang simple, cepat, dan siap multi-cabang.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-light leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">
              Kelola reservasi online, pre-order menu, pembayaran QRIS, dashboard admin resto, dan follow-up customer dalam satu sistem yang ringan.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/teras-rempah" className="inline-flex w-full items-center justify-center rounded-xl bg-[#533afd] px-5 py-3 text-sm font-semibold text-white shadow-[rgba(50,50,93,0.25)_0px_30px_45px_-30px,rgba(0,0,0,0.1)_0px_18px_36px_-18px] transition hover:-translate-y-0.5 hover:bg-[#4434d4] sm:w-auto">
                Lihat demo booking <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex w-full items-center justify-center rounded-xl border border-[#d6d9fc] bg-white px-5 py-3 text-sm font-semibold text-[#533afd] shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-50 sm:w-auto">
                Masuk dashboard
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-3">
              <Stat value="Multi" label="resto & path" />
              <Stat value="QRIS" label="payment ready" />
              <Stat value="WA" label="follow-up admin" />
            </div>
          </div>

          <div id="dashboard" className="relative min-w-0">
            <div className="rounded-[2rem] border border-[#e5edf5] bg-white p-4 shadow-[rgba(50,50,93,0.25)_0px_30px_45px_-30px,rgba(0,0,0,0.1)_0px_18px_36px_-18px]">
              <div className="rounded-[1.5rem] bg-[#1c1e54] p-4 text-white sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">Dashboard hari ini</p>
                    <p className="mt-1 text-xl font-semibold">Teras Rempah</p>
                  </div>
                  <div className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-200">Aktif</div>
                </div>
                <div className="mt-6 grid gap-3 grid-cols-2">
                  <PreviewCard label="Penghasilan" value="Rp222.600" />
                  <PreviewCard label="Reservasi" value="8" />
                  <PreviewCard label="Review bayar" value="3" />
                  <PreviewCard label="Menu aktif" value="12" />
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-white/70">Antrian pembayaran</span>
                    <span className="text-indigo-200">QRIS DP</span>
                  </div>
                  {["Booking meja keluarga", "Pre-order menu", "Approve pembayaran"].map((item) => (
                    <div key={item} className="mb-2 flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm last:mb-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-300" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#533afd]">Fitur utama</p>
          <h2 className="mt-3 text-3xl font-light tracking-[-0.03em] sm:text-4xl">Semua kebutuhan booking resto dalam satu workflow.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-3xl border border-[#e5edf5] bg-white p-6 shadow-[rgba(23,23,23,0.06)_0px_12px_30px] transition hover:-translate-y-1 hover:shadow-[rgba(50,50,93,0.2)_0px_30px_45px_-30px]">
              <feature.icon className="h-6 w-6 text-[#533afd]" />
              <h3 className="mt-5 text-xl font-semibold tracking-[-0.02em]">{feature.title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="alur" className="bg-[#1c1e54] px-4 py-14 text-white sm:py-20 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[380px_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Alur booking</p>
            <h2 className="mt-3 text-3xl font-light tracking-[-0.03em] sm:text-4xl">Dari customer booking sampai admin approve.</h2>
            <p className="mt-4 leading-7 text-white/65">Flow dibuat pendek supaya customer tidak bingung dan admin tetap punya kontrol pembayaran.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-3xl border border-white/10 bg-white/10 p-5">
                <p className="text-sm text-indigo-200">0{index + 1}</p>
                <p className="mt-8 font-semibold leading-6">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-8">
        <div className="rounded-[2rem] border border-[#e5edf5] bg-white p-5 shadow-[rgba(50,50,93,0.22)_0px_30px_45px_-30px] sm:p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#533afd]">Siap dipakai</p>
              <h2 className="mt-3 text-3xl font-light tracking-[-0.03em] sm:text-4xl">Mulai dari halaman booking resto yang rapi dan mudah dipakai customer.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-slate-600">Setiap resto punya URL booking sendiri dan dashboard admin sendiri. Cocok untuk operasional resto yang ingin reservasi online terlihat profesional.</p>
            </div>
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/teras-rempah" className="inline-flex w-full items-center justify-center rounded-xl bg-[#533afd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4434d4] sm:w-auto">
                Coba booking
              </Link>
              <Link href="/login" className="inline-flex w-full items-center justify-center rounded-xl border border-[#d6d9fc] bg-white px-5 py-3 text-sm font-semibold text-[#533afd] transition hover:bg-indigo-50 sm:w-auto">
                Login admin
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#e5edf5] bg-white/80 p-4 shadow-sm">
      <p className="text-2xl font-semibold text-[#061b31]">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function PreviewCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
