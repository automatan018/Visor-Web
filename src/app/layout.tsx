import type { Metadata } from "next";
import "./glass.css";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "Visor Web — Google Docs Revision History",
  description:
    "Paste a Google Docs or Slides link and see who wrote what, revision by revision.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light">
      <body className="min-h-full flex flex-col">
        <div className="aurora" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
