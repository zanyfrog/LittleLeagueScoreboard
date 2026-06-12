import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Little League Scoreboard",
  description: "Local-first scoring and replay"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
