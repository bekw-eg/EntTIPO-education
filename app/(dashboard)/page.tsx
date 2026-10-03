import { getDashboardData } from "@/lib/dashboard";
import { requirePageUserId } from "@/lib/user";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requirePageUserId();
  const data = await getDashboardData(userId);

  return <DashboardView initialData={data} />;
}
