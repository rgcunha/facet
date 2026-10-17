import type { Metadata } from "next";
import {
  IBM_Plex_Sans,
  Instrument_Sans,
  Montserrat,
  Quicksand,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});
const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});
// CV templates: Sidebar (Montserrat name, Quicksand text) and Modern (IBM Plex Sans). Not preloaded:
// most pages never show them, and printing waits for fonts anyway.
const montserrat = Montserrat({
  variable: "--font-montserrat-face",
  subsets: ["latin"],
  weight: ["800"],
  preload: false,
});
const quicksand = Quicksand({
  variable: "--font-quicksand-face",
  subsets: ["latin"],
  preload: false,
});
const plex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Facet",
  description: "Keep a base CV and tailored variants for each job.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${montserrat.variable} ${quicksand.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
