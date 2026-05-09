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
  title: "DubKaroo — Dub your reel into 6 Indian languages in 10 minutes",
  description:
    "Upload a Hindi or English reel; get Tamil, Telugu, Marathi, Bengali, Kannada, and Bhojpuri versions back — natural voices, lip-synced, ready to publish — for ₹1,499/month.",
  metadataBase: new URL("https://dubkaroo.com"),
  openGraph: {
    title: "DubKaroo",
    description:
      "Vernacular dub + lip-sync for Indian creators. 6 Indian languages, 10 minutes, one click.",
    url: "https://dubkaroo.com",
    siteName: "DubKaroo",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DubKaroo",
    description:
      "Vernacular dub + lip-sync for Indian creators. 6 Indian languages, 10 minutes, one click.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
