import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "phiademo · Social semantic product recommendations",
  description: "Discover products through your friends' purchases and views with semantic search.",
  icons: [{ rel: "icon", url: "/favicon.ico" }]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
