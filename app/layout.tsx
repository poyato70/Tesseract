import type { ReactNode } from "react";
import "../src/web/styles.css";
import "../src/web/styles-mission09.css";
import "../src/web/styles-neumorphic.css";
import "./theme.css";
import "../src/web/styles-rebuild.css";
import "../src/web/styles-v2.css";
import "../src/web/styles-palette-indigo.css";
export const metadata = {
  title: "TESSERACT · Financial Intelligence",
  description: "Centro de inteligência financeira e IA",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark" data-palette="indigo" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
