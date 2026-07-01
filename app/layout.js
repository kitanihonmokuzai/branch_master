import "./globals.css";

export const metadata = {
  title: "銘木市 枝番号別集計",
  description: "銘木市 入札物件の枝番号別集計システム",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
