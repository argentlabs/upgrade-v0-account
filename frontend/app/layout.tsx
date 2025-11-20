import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import readyLogo from "@/assets/ready-logo.png";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Upgrade Deprecated Account",
  description: "Upgrade deprecated Ready accounts",
};

const Navbar = () => (
  <nav className="text-white p-4">
    <Image alt="Ready Logo" src={readyLogo} width={200} height={200} />
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
