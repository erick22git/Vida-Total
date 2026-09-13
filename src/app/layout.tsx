import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlassEngineProvider } from "@/components/glass/glass-engine-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vida Total",
  description: "Tu super-app de bienestar: gym, hábitos, outfit, paz mental, finanzas y voz.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Motor óptico de vidrio real — portado de
            C:\Erick\Gym\src\glass-engine (ver src/glass-engine/*.ts):
            este provider dispara, solo en cliente, el fetch() e
            inyección de public/svg/filters.svg (feImage+
            feDisplacementMap para la lupa real de la burbuja del
            BottomNav, feTurbulence+feSpecularLighting para los
            dropdowns/.glass-panel). Si el fetch falla, cada
            consumidor degrada a su propio blur/saturate CSS — ver
            glass-engine/refraction.ts, glass.ts y menu.ts. */}
        <GlassEngineProvider />
        {children}
      </body>
    </html>
  );
}
