import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BindScope | Structural analysis workspace",
  description: "Inspect protein and ligand structures, visualize binding sites, and screen molecular contacts in the browser.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
