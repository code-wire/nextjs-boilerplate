import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Character Animation Prototype",
  description:
    "Prototype a web-based 3D character controller with animation switching, keyboard triggers, and a clear path to chat-driven interactions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
