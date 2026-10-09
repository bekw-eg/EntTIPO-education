import { requirePageUserId } from "@/lib/user";
import { ExamHistory } from "@/components/exam/ExamHistory";
export const dynamic = "force-dynamic";
export default async function ResultsPage() {
  await requirePageUserId();
  return <ExamHistory />;
}
