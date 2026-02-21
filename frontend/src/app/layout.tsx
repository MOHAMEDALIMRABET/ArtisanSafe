import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Providers from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ArtisanDispo - Trouvez des artisans qualifiés",
  description: "Plateforme de mise en relation entre clients et artisans vérifiés",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} antialiased font-sans`}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
