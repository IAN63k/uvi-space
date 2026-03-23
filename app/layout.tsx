import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.css";
import packageJson from "../package.json";

import { AppShell } from "@/components/app-sidebar";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UVI Space | Utilidades Moodle",
  description: "Repositorio de utilidades y reportes para Moodle en Next.js.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appVersion = packageJson.version ?? "0.0.0";

  return (
    <html lang="es">
      <body className={`${roboto.variable} ${robotoMono.variable} font-sans antialiased`}>
        <AppShell appVersion={appVersion}>{children}</AppShell>
      </body>
    </html>
  );
}
