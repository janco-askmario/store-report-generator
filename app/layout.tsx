import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AskMario · Store Report Generator",
  description:
    "Create branded Shopify store audit reports and export them as polished PDFs.",
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
