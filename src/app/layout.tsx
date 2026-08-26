import type { Metadata, Viewport } from "next";
import { ToastHost } from "@/components/ToastHost";
import "./globals.css";

export const metadata: Metadata = {
  title: "מעקב כלבים וחתולים - כלביית רחובות",
  description: "מערכת משותפת למעקב אחר כלבים וחתולים בכלביית רחובות",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
