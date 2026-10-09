import { requirePageUserId } from "@/lib/user";
import { ExamAccount } from "@/components/exam/ExamAccount";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  await requirePageUserId();
  return <ExamAccount />;
}
