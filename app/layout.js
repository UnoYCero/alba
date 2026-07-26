export const metadata = {
  title: "Alba Vision",
  description: "Visión artificial, inteligencia artificial y hardware para problemas reales."
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
