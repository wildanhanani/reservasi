"use client";

import { useEffect, useState } from "react";
import { Download, ReceiptText } from "lucide-react";
import { demoRestaurant, getReservation, type Reservation } from "@/lib/api";
import { formatDateTime, rupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function fallbackReservation(code: string): Reservation {
  return {
    id: "fallback",
    code,
    restaurant: demoRestaurant,
    customerName: "Customer",
    customerPhone: "-",
    contactPerson: "-",
    sourceChannel: "direct",
    partySize: 2,
    reservationAt: new Date().toISOString(),
    status: "PAYMENT_REVIEW",
    subtotal: 0,
    paymentAmount: 0,
    items: [],
    payment: null
  };
}

export function ReceiptView({ code }: { code: string }) {
  const [reservation, setReservation] = useState<Reservation>(fallbackReservation(code));
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    getReservation(code)
      .then((data) => {
        setReservation(data);
        setOffline(false);
      })
      .catch(() => {
        setReservation(fallbackReservation(code));
        setOffline(true);
      });
  }, [code]);

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-3xl px-4 py-8">
        <Card className="shadow-panel print:border-0 print:shadow-none">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">{reservation.restaurant.name}</p>
                <CardTitle className="mt-2 flex items-center gap-2 text-2xl">
                  <ReceiptText className="h-6 w-6" /> Receipt reservasi
                </CardTitle>
              </div>
              <div className="rounded-md border bg-muted px-3 py-2 text-sm font-semibold">{reservation.code}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {offline ? (
              <div className="rounded-md border border-secondary/40 bg-secondary/10 p-3 text-sm">
                API belum berjalan, receipt detail hanya menampilkan kode dari URL.
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Info label="Nama customer" value={reservation.customerName} />
              <Info label="Nomor kontak" value={reservation.customerPhone} />
              <Info label="Tanggal dan jam" value={formatDateTime(reservation.reservationAt)} />
              <Info label="Jumlah tamu" value={`${reservation.partySize} orang`} />
              <Info label="Status reservasi" value={reservation.status} />
              <Info label="Status pembayaran" value={reservation.payment?.status ?? "UNPAID"} />
              <Info label="Tipe pembayaran" value={reservation.payment?.type === "DP" ? "DP" : "Bayar penuh"} />
              <Info label="Metode pembayaran" value={reservation.payment?.method ?? "-"} />
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Pesanan</h2>
              <div className="rounded-md border">
                {reservation.items.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Belum ada item menu.</p>
                ) : (
                  reservation.items.map((item) => (
                    <div key={`${item.nameSnapshot}-${item.quantity}`} className="flex justify-between gap-4 border-b p-4 text-sm last:border-b-0">
                      <span>{item.quantity}x {item.nameSnapshot}</span>
                      <span>{rupiah(item.priceSnapshot * item.quantity)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between bg-muted p-4 font-semibold">
                  <span>Total menu</span>
                  <span>{rupiah(reservation.subtotal)}</span>
                </div>
                <div className="flex justify-between p-4 font-semibold">
                  <span>Nominal pembayaran</span>
                  <span>{rupiah(reservation.payment?.amountDue ?? reservation.paymentAmount)}</span>
                </div>
              </div>
            </div>

            <Button variant="outline" onClick={() => window.print()} className="print:hidden">
              <Download className="h-4 w-4" /> Download receipt
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
