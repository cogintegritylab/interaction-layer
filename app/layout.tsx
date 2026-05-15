import "./globals.css";

export const metadata = {
  title: "AI-Free Composition",
  description: "Compose text by hand. Sign it. Make it verifiable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
