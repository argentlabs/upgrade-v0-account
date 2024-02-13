import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Upgrade Deprecated Account",
  description: "Upgrade deprecated Argent accounts",
};

const Navbar = () => (
  <nav className=" text-white">
    <Image alt="Argent Logo" src="/argent-logo-colour.png" width={200} height={200} />
  </nav>
);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} `}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
