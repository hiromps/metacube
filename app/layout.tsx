import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SMARTGRAM - Instagram自動化ツール",
  description: "SMARTGRAM（Social Mobile Auto Reach Tool）は、iPhone 7/8 + AutoTouchで動作するInstagram自動化ツールです。個人専用暗号化ファイル（.ate）で安全に利用可能。3日間無料体験実施中。",
  keywords: [
    "SMARTGRAM",
    "Instagram自動化",
    "AutoTouch",
    "iPhone 7",
    "iPhone 8",
    "Instagramツール",
    "自動いいね",
    "自動フォロー",
    "Instagram管理",
    "SNS自動化"
  ],
  authors: [{ name: "SMARTGRAM" }],
  creator: "SMARTGRAM",
  publisher: "SMARTGRAM",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://smartgram.jp'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "SMARTGRAM - Instagram自動化ツール",
    description: "個人専用暗号化ファイルでInstagramを安全に自動化。iPhone 7/8 + AutoTouchで動作。3日間無料体験実施中。",
    url: 'https://smartgram.jp',
    siteName: 'SMARTGRAM',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SMARTGRAM - Instagram自動化ツール',
      }
    ],
    locale: 'ja_JP',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "SMARTGRAM - Instagram自動化ツール",
    description: "個人専用暗号化ファイルでInstagramを安全に自動化。iPhone 7/8 + AutoTouchで動作。3日間無料体験実施中。",
    images: ['/og-image.png'],
    creator: '@smartgram_jp',
    site: '@smartgram_jp',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code',
  },
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SMARTGRAM" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1TT9J2ZLG9"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-1TT9J2ZLG9');
            `,
          }}
        />
        <script src="https://js.stripe.com/v3/" async></script>
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
