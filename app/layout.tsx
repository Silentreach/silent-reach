import type { Metadata } from "next";
import Header from "@/components/Header";
import MigrationGate from "@/components/MigrationGate";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mintflowai.com"),
  title: {
    default: "Mintflow — Plan it. Shoot it. Ship it.",
    template: "%s · Mintflow",
  },
  description:
    "From design to distribution. The content production OS for creators who need to travel beyond their followers.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Mintflow",
    description:
      "From design to distribution. The content production OS for creators who need to travel beyond their followers.",
    type: "website",
    siteName: "Mintflow",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="grain min-h-screen bg-bg text-text">
        <Header />
        <MigrationGate />
        <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
