type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({ to, subject, text }: EmailMessage) {
  if (process.env.EMAIL_PROVIDER === "mock" || !process.env.EMAIL_PROVIDER) {
    console.log(`[EMAIL MOCK] to=${to} subject=${subject} text=${text}`);
    return { provider: "mock", to, status: "queued" };
  }

  throw new Error("EMAIL_PROVIDER belum dikonfigurasi. Tambahkan adapter provider di services/email.ts.");
}

export function receiptEmailMessage(params: {
  restaurantName: string;
  reservationCode: string;
  receiptUrl: string;
  amountDue: number;
}) {
  return {
    subject: `Receipt reservasi ${params.restaurantName} - ${params.reservationCode}`,
    text: `Receipt reservasi ${params.restaurantName} sudah dibuat. Kode: ${params.reservationCode}. Total dibayar: ${params.amountDue}. Link receipt: ${params.receiptUrl}`
  };
}
