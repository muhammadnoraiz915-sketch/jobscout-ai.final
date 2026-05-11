import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobScout AI",
  description: "Autonomous Job Hunting Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}