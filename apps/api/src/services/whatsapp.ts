type WhatsAppMessage = {
  to: string;
  message: string;
};

export async function sendWhatsApp({ to, message }: WhatsAppMessage) {
  if (process.env.WA_PROVIDER === "mock" || !process.env.WA_PROVIDER) {
    console.log(`[WA MOCK] to=${to} message=${message}`);
    return { provider: "mock", to, status: "queued" };
  }

  throw new Error("WA_PROVIDER belum dikonfigurasi. Tambahkan adapter provider di services/whatsapp.ts.");
}

export function customerConfirmationMessage(params: {
  restaurantName: string;
  reservationCode: string;
  receiptUrl: string;
}) {
  return `Reservasi ${params.restaurantName} sudah terkonfirmasi. Kode: ${params.reservationCode}. Receipt: ${params.receiptUrl}`;
}

export function adminPaymentReviewMessage(params: {
  restaurantName: string;
  reservationCode: string;
  adminUrl: string;
}) {
  return `Ada pembayaran baru untuk ${params.restaurantName}. Kode reservasi ${params.reservationCode}. Cek: ${params.adminUrl}`;
}
