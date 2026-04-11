import type { Metadata } from "next";
import { Roboto, Roboto_Mono, Orbitron } from "next/font/google";
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

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UVI Space | Utilidades Moodle",
  description: "Repositorio de utilidades y reportes para Moodle en Next.js.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appVersion = packageJson.version ?? "0.0.0";

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Applies dark class before first paint — prevents flash of wrong theme.
            Defaults to dark (the primary UVI Space brand theme). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('uvi-space.theme.v1');if(t==='dark'){document.documentElement.classList.add('dark');return;}if(t==='light')return;if(window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${roboto.variable} ${robotoMono.variable} ${orbitron.variable} font-sans antialiased`}>
        <AppShell appVersion={appVersion}>{children}</AppShell>
      </body>
    </html>
  );
}
