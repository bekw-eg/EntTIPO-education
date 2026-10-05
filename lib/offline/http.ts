import { NextResponse } from "next/server";
import { PracticeError } from "../practiceStorage";
import { ZodError } from "zod";

export function offlineError(error: unknown) {
  if (error instanceof PracticeError) return NextResponse.json({ error: error.message, code: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Invalid offline request", code: "INVALID_REQUEST" }, { status: 400 });
  console.error("Offline practice:", error);
  return NextResponse.json({ error: "Synchronization unavailable; keep your answers on the device", code: "SERVER_UNAVAILABLE" }, { status: 503 });
}
