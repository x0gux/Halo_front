import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "신호등 시스템 — COCO-SSD 사람 인식",
  description: "ESP32 신호등 시스템을 COCO-SSD 사람 인식 기반으로 웹에서 구현",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
