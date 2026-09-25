import { getDashboardData } from "@/lib/dashboard";
import { getCurrentUserId } from "@/lib/user";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = getCurrentUserId();
  const data = await getDashboardData(userId);

  return <DashboardView initialData={data} />;
}
