import "./globals.css";
import type { Metadata } from "next";
import Navbar from "./(components)/Navbar";
import Footer from "./(components)/Footer";
import PageTransition from "./(components)/PageTransition";

export const metadata: Metadata = {
  title: "Bali GoldenBoy Tour — Local Guides & Authentic Bali Trips",
  description:
    "Curated day trips and multi-day adventures across Bali. Local experts, flexible itineraries, and fair prices.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Bali GoldenBoy Tour",
    description: "Curated day trips and adventures in Bali.",
    url: "https://balinova.example.com",
    siteName: "Bali GoldenBoy Tour",
    images: [
      {
        url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1600&q=80",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  metadataBase: new URL("https://balinova.example.com"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PageTransition>
          <Navbar />
          {children}
          <Footer />
        </PageTransition>
      </body>
    </html>
  );
}
