"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="bn">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f7f6f3", color: "#16151c", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>কিছু একটা ভুল হয়েছে · Something went wrong</h1>
          <p style={{ color: "#4b4a57", fontSize: 14, lineHeight: 1.7 }}>
            পেজটি লোড করা যায়নি। আবার চেষ্টা করুন। / This page could not be rendered. Your data was not changed.
          </p>
          {error.digest ? <p style={{ fontSize: 11, color: "#7c7b89" }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, borderRadius: 999, border: 0, background: "#4f46e5", color: "#fff", padding: "10px 20px", fontSize: 14, cursor: "pointer" }}
          >
            আবার চেষ্টা করুন / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
