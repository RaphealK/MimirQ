import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { ThemeAppearanceProvider } from "@/components/theme-appearance-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SonnerToaster } from "@/components/sonner-toaster";
import { CommandMenu } from "@/components/command-menu";
import { TaskCenter } from "@/components/task-center";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerRegistrar } from "@/components/providers/service-worker-registrar";
import { WebVitalsReporter } from "@/components/providers/web-vitals-reporter";
import { RouteScrollReset } from "@/components/route-scroll-reset";
import { AuthGuard } from "@/components/auth-guard";
import { resolveRequestDocumentSettings } from "@/lib/document-language";
import { MIMIRQ_MARK_PATH } from "@/lib/brand";
import {
  normalizeSurfaceTheme,
  SURFACE_THEME_COOKIE_KEY,
} from "@/lib/theme-surface";

export const metadata: Metadata = {
  title: "MimirQ - 可检查、可回归的 RAG 知识库",
  description: "可观察、可替换、可回归的企业 RAG 基础设施",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: { url: MIMIRQ_MARK_PATH, sizes: 'any', type: 'image/svg+xml' },
    apple: { url: '/brand/mimirq-mark.png', sizes: '512x512', type: 'image/png' },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  const locale = await getLocale();
  const messages = await getMessages();
  const requestHeaders = await headers();
  const appearanceCookies = await cookies();
  const cspNonce = requestHeaders.get("x-nonce") || undefined;
  const surfaceTheme = normalizeSurfaceTheme(
    appearanceCookies.get(SURFACE_THEME_COOKIE_KEY)?.value,
  );
  const { lang: documentLang, dir: documentDir } =
    resolveRequestDocumentSettings(
      requestHeaders,
      locale || process.env.NEXT_PUBLIC_APP_LANG?.trim() || undefined,
    );

  return (
    <html
      lang={documentLang}
      dir={documentDir}
      suppressHydrationWarning
      className="h-full overflow-hidden"
      data-surface-theme={surfaceTheme}
    >
      {/* Lock window scrolling: the app uses panel-internal scrolling for better UX. */}
      <body className="font-sans h-dvh overflow-hidden">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
            nonce={cspNonce}
          >
            <QueryProvider>
              <ServiceWorkerRegistrar />
              <WebVitalsReporter />
              <SonnerToaster />
              <ThemeAppearanceProvider />
              <CommandMenu />
              <RouteScrollReset />
              <TaskCenter />
              <AuthGuard>{children}</AuthGuard>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
