import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuSense - AI Document Analyzer & Assistant",
  description: "Upload PDF or text documents to instantly analyze contents, extract key insights, and query the text with an interactive Q&A assistant.",
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
    return (
      <html lang="en" data-theme="light">
        <body>{children}</body>
      </html>
    );
}

