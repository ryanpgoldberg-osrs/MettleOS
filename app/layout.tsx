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
      <head>
        <link rel="preconnect" href="https://fonts.cdnfonts.com" />
        <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/runescape-uf" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
