"use client";

import React, { useEffect, useState } from "react";
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
import { User, LogOut, UserPlus, LogIn, Check, Users } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

export function UserNav() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchUsers();
  }, []);

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
        toast.error(data.error || "Ошибка входа");
      } else {
        toast.success(`Добро пожаловать, ${data.user.name}!`);
        setCurrentUser(data.user);
        setIsAuthOpen(false);
        window.location.reload();
      }
    } catch (err) {
      toast.error("Не удалось подключиться к серверу");
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
        toast.error(data.error || "Ошибка регистрации");
      } else {
        toast.success("Регистрация успешна!");
        setCurrentUser(data.user);
        setIsAuthOpen(false);
        fetchUsers();
        window.location.reload();
      }
    } catch (err) {
      toast.error("Ошибка при регистрации");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.info("Вы вышли из профиля");
      setCurrentUser(null);
      window.location.reload();
    } catch {
      // ignore
    }
  };

  const handleSwitchUser = async (targetUser: UserProfile) => {
    // Quick demo login
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetUser.email, password: "password" }),
      });
      if (res.ok) {
        toast.success(`Переключено на: ${targetUser.name}`);
        window.location.reload();
      } else {
        setEmail(targetUser.email);
        setAuthTab("login");
        setIsAuthOpen(true);
      }
    } catch {
      setEmail(targetUser.email);
      setAuthTab("login");
      setIsAuthOpen(true);
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
            className="flex items-center gap-2 h-9 px-2 hover:bg-muted rounded-full"
          >
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs">
              {userInitial}
            </div>
            <span className="hidden sm:inline-block text-xs font-semibold max-w-[100px] truncate">
              {currentUser?.name || "Ученик"}
            </span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 p-1.5">
          <DropdownMenuLabel className="font-normal p-2">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-semibold leading-none truncate">
                {currentUser?.name || "Гостевой профиль"}
              </p>
              <p className="text-xs text-muted-foreground leading-none truncate mt-0.5">
                {currentUser?.email || "student@example.com"}
              </p>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* Quick User Switcher */}
          {availableUsers.length > 1 && (
            <>
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>Профили учеников:</span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 py-1">
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSwitchUser(u)}
                    className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between hover:bg-muted transition-colors"
                  >
                    <span className="truncate">{u.name}</span>
                    {currentUser?.id === u.id && (
                      <Check className="w-3 h-3 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => {
              setAuthTab("login");
              setIsAuthOpen(true);
            }}
            className="text-xs cursor-pointer gap-2"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Войти в аккаунт</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => {
              setAuthTab("register");
              setIsAuthOpen(true);
            }}
            className="text-xs cursor-pointer gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Новый ученик (Регистрация)</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleLogout}
            className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Выйти</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Auth Modal (Login / Register) */}
      <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {authTab === "login" ? "Вход в ENT TIPO" : "Регистрация ученика"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Личный прогресс, история ошибок и персональный рейтинг ЕНТ.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={authTab}
            onValueChange={(val) => setAuthTab(val as any)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
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
                    Пароль
                  </Label>
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
                  {loading ? "Вход..." : "Войти"}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-name" className="text-xs">
                    Имя и фамилия
                  </Label>
                  <Input
                    id="reg-name"
                    required
                    placeholder="Алихан Нурланов"
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
                    Пароль (от 4 символов)
                  </Label>
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
                  {loading ? "Создание..." : "Зарегистрироваться"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
