import "./globals.css";
import type { Metadata } from "next";
import Navbar from "./(components)/Navbar";
import Footer from "./(components)/Footer";
import PageTransition from "./(components)/PageTransition";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, SITE_NAME, SITE_URL, WHATSAPP_NUMBER } from "./(lib)/site";
import tours from "./(data)/tours.json";

export const metadata: Metadata = {
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Bali airport pickup",
    "Bali airport transfer",
    "Bali day tour",
    "Ubud tour",
    "Uluwatu tour",
    "Lempuyang Heaven Gate",
    "Tirta Gangga",
    "Tegenungan Waterfall",
    "Bali swing",
    "Nusa Penida tour",
    "fast boat Gili",
  ],
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Bali airport pickup and day tour packages",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

function buildJsonLd() {
  const url = SITE_URL;
  const wa = `+${WHATSAPP_NUMBER}`;
  const offerCatalog = {
    "@type": "OfferCatalog",
    name: "Bali day tour packages",
    itemListElement: tours.map((t: any) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: t.title,
        url: `${url}/tours/${t.slug}/`,
        areaServed: "Bali",
      },
      availability: "https://schema.org/InStock",
      priceCurrency: "IDR",
      price: t.priceFrom && t.priceFrom > 0 ? String(t.priceFrom) : undefined,
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: SITE_NAME,
        url,
        telephone: wa,
        areaServed: "Bali",
        serviceArea: "Bali, Indonesia",
        sameAs: [`https://wa.me/${WHATSAPP_NUMBER}`],
        makesOffer: offerCatalog,
      },
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url,
        potentialAction: {
          "@type": "SearchAction",
          target: `${url}/tours?query={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = buildJsonLd();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <PageTransition>
          <Navbar />
          {children}
          <Footer />
        </PageTransition>
      </body>
    </html>
  );
}
