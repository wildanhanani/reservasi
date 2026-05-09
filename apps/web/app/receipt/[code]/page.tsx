import { ReceiptView } from "@/components/receipt/receipt-view";

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReceiptView code={code} />;
}
