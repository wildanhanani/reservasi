import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservasi Online",
  description: "Sistem reservasi online restoran dengan pre-order menu dan konfirmasi pembayaran."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
