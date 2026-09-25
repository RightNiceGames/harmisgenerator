import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Harmis · Låtbibliotek', description: 'Redigera, transponera och skriv ut dina ackordblad.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="sv"><body>{children}</body></html>;
}
