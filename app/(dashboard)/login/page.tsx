"use client";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";


import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/components/providers/AccountProvider";
import { navigateAfterAuth } from "@/lib/client-auth";

export default function LoginPage() {
  const { locale } = useLanguage();
  const { demoEnabled } = useAccount();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(errorText(data.error, locale));
      } else {
        toast.success(uiText(`Добро пожаловать, ${data.user.name}!`, locale));
        await navigateAfterAuth("/");
      }
    } catch {
      toast.error(uiText("Не удалось связаться с сервером", locale));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(errorText(data.error, locale));
      } else {
        toast.success(uiText("Аккаунт успешно создан!", locale));
        await navigateAfterAuth("/");
      }
    } catch {
      toast.error(uiText("Ошибка при создании аккаунта", locale));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(errorText(data.error, locale));
      } else {
        await navigateAfterAuth("/");
      }
    } catch {
      toast.error(uiText("Не удалось связаться с сервером", locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title={uiText("Вход и профиль", locale)} subtitle={uiText("Персональный кабинет ученика ЕНТ ТиПО", locale)} />

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground mx-auto flex items-center justify-center shadow-md">
              <GraduationCap className="w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {activeTab === "login" ? uiText("Авторизация", locale) : uiText("Новый профиль", locale)}
            </CardTitle>
            <CardDescription className="text-xs">
              {uiText(" Сохраняйте серию тренировок (Streak), статистику и персональный разбор ошибок. ", locale)}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">{uiText("Вход", locale)}</TabsTrigger>
                <TabsTrigger value="register">{uiText("Регистрация", locale)}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="page-login-email">Email</Label>
                    <Input
                      id="page-login-email"
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="page-login-password">{uiText("Пароль", locale)}</Label>
                    <Input
                      id="page-login-password"
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? uiText("Вход...", locale) : uiText("Войти в кабинет", locale)}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="page-reg-name">{uiText("Имя и фамилия", locale)}</Label>
                    <Input
                      id="page-reg-name"
                      required
                      placeholder={uiText("Арман Ахметов", locale)}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="page-reg-email">Email</Label>
                    <Input
                      id="page-reg-email"
                      type="email"
                      required
                      placeholder="arman@ent.kz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="page-reg-password">{uiText("Пароль", locale)}</Label>
                    <Input
                      id="page-reg-password"
                      type="password"
                      required
                      minLength={4}
                      placeholder={uiText("Минимум 4 символа", locale)}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? uiText("Создание...", locale) : uiText("Зарегистрироваться", locale)}
                    <ShieldCheck className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            {demoEnabled && (
              <div className="border-t pt-4 space-y-2">
                <Button variant="outline" className="w-full" disabled={loading} onClick={handleDemoLogin}>
                  {uiText(" Попробовать демоверсию ", locale)}</Button>
                <p className="text-xs text-muted-foreground text-center">
                  {uiText(" В демоверсии используются общие учебные данные. Для личного прогресса создайте аккаунт. ", locale)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
