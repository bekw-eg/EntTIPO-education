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
    default: "Synaq — Пробник по математике ЕНТ ТиПО · B057",
    template: "%s | Synaq",
  },
  description:
    "Пробный тест по математике ЕНТ ТиПО: B057, сокращённый срок обучения. Баллы, разбор заданий и сохранённые результаты.",
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
