import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COT//NQ Terminal",
  description: "Análisis del Commitments of Traders (TFF) del Nasdaq-100 E-mini y Micro.",
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
