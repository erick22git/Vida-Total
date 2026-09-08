import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BgBlobs } from "@/components/layout/bg-blobs";
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
        <BgBlobs />
        {children}
      </body>
    </html>
  );
}
