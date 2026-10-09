import { NextResponse } from "next/server";

/** Server-side retirement: hidden services cannot be invoked by a direct request. */
export function retiredServiceResponse() {
  return NextResponse.json({ error: "Этот учебный раздел недоступен. Откройте пробник по математике.", href: "/exam" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } });
}
