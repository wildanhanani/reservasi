import { BookingFlow } from "@/components/booking/booking-flow";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BookingFlow slug={slug} />;
}
