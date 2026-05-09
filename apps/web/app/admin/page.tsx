import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const params = await searchParams;
  return <AdminDashboard slug={params.slug ?? "teras-rempah"} />;
}
