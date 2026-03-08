import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import TickerBar from "@/components/TickerBar";
import ThemeProvider from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";
import RefreshButton from "@/components/RefreshButton";
import Footer from "@/components/Footer";
import StaleDataWarning from "@/components/StaleDataWarning";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"),
  title: {
    default: "EcoTicker — Environmental Impact Tracker",
    template: "%s — EcoTicker",
  },
  description:
    "Track environmental news and their impact with real-time AI-scored severity. Monitor climate, pollution, biodiversity, and more.",
  openGraph: {
    type: "website",
    siteName: "EcoTicker",
    title: "EcoTicker — Environmental Impact Tracker",
    description:
      "Track environmental news and their impact with real-time AI-scored severity.",
    url: "/",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "EcoTicker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EcoTicker — Environmental Impact Tracker",
    description:
      "Track environmental news and their impact with real-time AI-scored severity.",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('ecoticker-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "EcoTicker",
              url: "https://ecoticker.sidsinsights.com",
              description:
                "Environmental news impact tracker with AI-scored severity",
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#faf7f2] dark:bg-gray-950 text-stone-800 dark:text-gray-100`}
      >
        <ThemeProvider>
          <TickerBar />
          <div className="fixed top-12 right-4 z-50 flex gap-2">
            <RefreshButton />
            <ThemeToggle />
          </div>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <StaleDataWarning />
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
