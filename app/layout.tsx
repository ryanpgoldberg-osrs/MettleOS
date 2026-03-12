import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mettle OS",
  description: "A progression-based Old School RuneScape challenge tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
