import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mind Certificados",
  description: "Ferramenta interna para emissão de certificados Mind",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "https://mind-institute.github.io/certificado/logo.png", type: "image/png" },
    ],
    apple: "https://mind-institute.github.io/certificado/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
