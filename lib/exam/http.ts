import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PracticeError } from "../practiceStorage";
import { localizedJson } from '../i18n/http';
export function examError(error: unknown, request?: Request) {
  if (error instanceof PracticeError) return localizedJson(request, { error: error.message }, { status: error.status });
  if (error instanceof SyntaxError || error instanceof ZodError) return localizedJson(request, { error: "Некорректные параметры экзамена" }, { status: 400 });
  console.error("Exam request failed", error);
  return localizedJson(request, { error: "Не удалось обработать запрос. Повторите его: завершение экзамена безопасно повторять." }, { status: 500 });
}
