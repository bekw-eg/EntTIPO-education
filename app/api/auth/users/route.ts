import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
