"use client";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { interfaceText } from "@/lib/i18n/interface";


import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, UserPlus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/components/providers/AccountProvider";
import { navigateAfterAuth } from "@/lib/client-auth";

export function UserNav() {
  const { locale } = useLanguage();
  const { user: currentUser } = useAccount();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // Form states
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
        setIsAuthOpen(false);
        await navigateAfterAuth("/");
      }
    } catch (err) {
      toast.error(uiText("Не удалось подключиться к серверу", locale));
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
        toast.success(uiText("Регистрация успешна!", locale));
        setIsAuthOpen(false);
        await navigateAfterAuth("/");
      }
    } catch (err) {
      toast.error(uiText("Ошибка при регистрации", locale));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");
      toast.info(uiText("Вы вышли из профиля", locale));
      await navigateAfterAuth("/login");
    } catch {
      toast.error(uiText("Не удалось выйти из аккаунта", locale));
    }
  };

  const userInitial = currentUser?.name ? currentUser.name[0].toUpperCase() : "U";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={interfaceText[locale].account}
            className="flex items-center gap-2 px-2 hover:bg-muted"
          >
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
              {userInitial}
            </div>
            <span className="hidden sm:inline-block text-xs font-semibold max-w-[100px] truncate">
              {currentUser?.name || uiText("Ученик", locale)}
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 p-1.5">
          <DropdownMenuLabel className="font-normal p-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none truncate">
                {currentUser?.isDemo ? uiText("Демонстрационный профиль", locale) : currentUser?.name || uiText("Гость", locale)}
              </p>
              <p className="text-xs text-muted-foreground leading-none truncate mt-0.5">
                {currentUser?.isDemo ? uiText("Общие демонстрационные данные", locale) : currentUser?.email || uiText("Войдите, чтобы сохранять прогресс", locale)}
              </p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => {
              setAuthTab("login");
              setIsAuthOpen(true);
            }}
            className="text-xs cursor-pointer gap-2"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{uiText("Войти в аккаунт", locale)}</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setAuthTab("register");
              setIsAuthOpen(true);
            }}
            className="text-xs cursor-pointer gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{uiText("Новый ученик (Регистрация)", locale)}</span>
          </DropdownMenuItem>

          {currentUser && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{uiText("Выйти", locale)}</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Auth Modal (Login / Register) */}
      <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {authTab === "login" ? uiText("Вход в Synaq", locale) : uiText("Регистрация ученика", locale)}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {uiText(" Личный прогресс, история ошибок и персональный рейтинг ЕНТ. ", locale)}</DialogDescription>
          </DialogHeader>

          <Tabs
            value={authTab}
            onValueChange={(val) => setAuthTab(val as any)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">{uiText("Вход", locale)}</TabsTrigger>
              <TabsTrigger value="register">{uiText("Регистрация", locale)}</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs">
                    {uiText(" Пароль ", locale)}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? uiText("Вход...", locale) : uiText("Войти", locale)}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name" className="text-xs">
                    {uiText(" Имя и фамилия ", locale)}</Label>
                  <Input
                    id="reg-name"
                    required
                    placeholder={uiText("Алихан Нурланов", locale)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="student@ent.kz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password" className="text-xs">
                    {uiText(" Пароль (от 4 символов) ", locale)}</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    required
                    minLength={4}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? uiText("Создание...", locale) : uiText("Зарегистрироваться", locale)}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
