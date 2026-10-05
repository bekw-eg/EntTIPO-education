import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PracticeError } from "../practiceStorage";
export function examError(error: unknown) {
  if (error instanceof PracticeError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError || error instanceof ZodError) return NextResponse.json({ error: "Некорректные параметры экзамена" }, { status: 400 });
  console.error("Exam request failed", error);
  return NextResponse.json({ error: "Не удалось обработать запрос. Повторите его: завершение экзамена безопасно повторять." }, { status: 500 });
}
