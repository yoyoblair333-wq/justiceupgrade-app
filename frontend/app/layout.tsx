import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "JusticeUpgrade — on-chain disputes, judged by AI",
  description:
    "Two parties record a plain-language agreement on-chain. Either can file a dispute, and an on-chain AI arbiter renders a bounded, reasoned verdict. Powered by GenLayer Intelligent Contracts. #JusticeNeedsAnUpgrade",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#9B6AF6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
