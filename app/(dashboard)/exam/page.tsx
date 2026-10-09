import { requirePageUserId } from "@/lib/user";
import { ExamStart } from "@/components/exam/ExamStart";
export const dynamic = "force-dynamic";
export default async function ExamStartPage() {
  await requirePageUserId();
  return <ExamStart />;
}
