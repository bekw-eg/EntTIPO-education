import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Имя, email и пароль обязательны для заполнения" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Пароль должен содержать не менее 4 символов" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже зарегистрирован" },
        { status: 409 }
      );
    }

    const hashedPassword = hashPassword(password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      },
    });

    // Initialize daily goal
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.dailyGoal.create({
      data: {
        userId: newUser.id,
        date: today,
        targetCount: 20,
        completedCount: 0,
      },
    }).catch(() => {});

    // Create session token
    const token = createSessionToken(newUser.id);

    const res = NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
      token,
    });

    // Set HTTP-only cookie
    res.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return res;
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Ошибка сервера при регистрации" },
      { status: 500 }
    );
  }
}
