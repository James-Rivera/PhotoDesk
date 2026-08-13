import type { Metadata } from "next";
import { FeedbackProvider } from "@/components/feedback-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CJNET PhotoDesk", template: "%s · CJNET PhotoDesk" },
  description: "Exact-size ID photo layouts for CJNET Printing Shop",
  icons: {
    icon: [{ url: "/assets/cjnet-logomark.png", type: "image/png" }],
    shortcut: "/assets/cjnet-logomark.png",
    apple: "/assets/cjnet-logomark.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body><FeedbackProvider>{children}</FeedbackProvider></body>
    </html>
  );
}
