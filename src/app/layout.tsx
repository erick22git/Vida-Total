import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <div className="bg-blobs" aria-hidden="true">
          <div
            className="bg-blob"
            style={{ width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--gym)" }}
          />
          <div
            className="bg-blob"
            style={{ width: 420, height: 420, top: "20%", right: "-15%", background: "var(--habitos)" }}
          />
          <div
            className="bg-blob"
            style={{ width: 380, height: 380, bottom: "-10%", left: "10%", background: "var(--outfit)" }}
          />
          <div
            className="bg-blob"
            style={{ width: 360, height: 360, bottom: "5%", right: "5%", background: "var(--paz-mental)" }}
          />
        </div>
        {children}
      </body>
    </html>
  );
}
