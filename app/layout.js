import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata = {
  title: "CSM Operaciones",
  description: "Traspasos, proveedores e inventario de Carnes San Martin",
  applicationName: "CSM Operaciones",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#edf3f8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${ibmPlexSans.variable} ${jetBrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
