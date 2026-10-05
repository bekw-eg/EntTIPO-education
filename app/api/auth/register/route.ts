import { localizedJson } from "@/lib/i18n/http";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { z } from "zod";

const registrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(4).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registrationSchema.safeParse(body);
    if (!parsed.success) {
      return localizedJson(req,
        { error: "Введите имя, корректный email и пароль от 4 до 128 символов" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return localizedJson(req,
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

    const res = localizedJson(req, {
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
    return localizedJson(req,
      { error: "Ошибка сервера при регистрации" },
      { status: 500 }
    );
  }
}
