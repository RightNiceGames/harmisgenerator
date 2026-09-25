'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="fatal"><h1>Biblioteket kunde inte öppnas.</h1><p>Kontrollera att songs-mappen går att läsa och försök igen.</p><button onClick={reset}>Försök igen</button></main>;
}
