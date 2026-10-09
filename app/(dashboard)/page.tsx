import { requirePageUserId } from "@/lib/user";
import { DashboardView } from "@/components/dashboard/DashboardView";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  await requirePageUserId();
  return <DashboardView />;
}
