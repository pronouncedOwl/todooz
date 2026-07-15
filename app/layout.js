import { DM_Sans } from "next/font/google";
import AppNav from "@/components/AppNav";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata = {
  title: "Toodooz",
  description: "Personal todo list",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
