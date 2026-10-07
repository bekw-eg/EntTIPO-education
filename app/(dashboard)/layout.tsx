import { DashboardShell } from "@/components/layout/DashboardShell";
import { AccountProvider } from "@/components/providers/AccountProvider";
import { getSessionUserId, DEMO_USER_ID, isDemoEnabled } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  const profile = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  }) : null;
  const user = profile ? { ...profile, isDemo: profile.id === DEMO_USER_ID } : null;
  return (
    <AccountProvider user={user} demoEnabled={isDemoEnabled()}>
      <DashboardShell>{children}</DashboardShell>
    </AccountProvider>
  );
}
