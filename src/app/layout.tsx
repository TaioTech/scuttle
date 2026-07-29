import type { Metadata, Viewport } from "next";
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
  title: "Scuttle",
  description:
    "A crab crossing a beach. Sideways is fast, forward is committed, and everyone gets the same beach today.",
  applicationName: "Scuttle",
  metadataBase: new URL("https://scuttle.taiotech.com"),
  openGraph: {
    title: "Scuttle",
    description: "A crab crossing a beach. Sideways is fast, forward is committed.",
    url: "https://scuttle.taiotech.com",
    siteName: "Scuttle",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The controls sit at the bottom edge of the screen, which is where a
  // pinch-zoomed page hides them.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
