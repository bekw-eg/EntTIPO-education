import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/providers/PwaRegister";

const inter = Inter({ subsets: ["latin", "cyrillic", "cyrillic-ext"] });

export const metadata: Metadata = {
  applicationName: "Synaq",
  title: {
    default: "Synaq — Подготовка к ЕНТ | ҰБТ-ға дайындық",
    template: "%s | Synaq",
  },
  description:
    "Персональный тренажёр математики для подготовки к ЕНТ ТиПО. ТжКБ ҰБТ математикасына арналған дербес жаттықтырушы.",
  keywords: ["ЕНТ", "ҰБТ", "математика", "подготовка", "ТиПО", "ТжКБ", "қазақстан"],
  icons: { icon: "/icon.svg?v=synaq", apple: "/icon-192.png?v=synaq" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            {children}
            <PwaRegister />
            <Toaster richColors position="top-right" closeButton />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
