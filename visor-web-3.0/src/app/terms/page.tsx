export const metadata = { title: "Terms of Service — Visor Web" };

export default function TermsPage() {
  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">
      <div className="glass p-6">
        <h1 className="text-lg font-semibold mb-1">Terms of Service</h1>
        <p className="text-[11px] mb-6" style={{ color: "var(--ink-3)" }}>
          Last updated: {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>

        <div className="flex flex-col gap-4 text-[13px]" style={{ color: "var(--ink-2)" }}>
          <p>
            Visor Web is provided as-is, free of charge, with no guarantee of
            uptime, accuracy, or continued availability.
          </p>
          <p>
            You may only use this service to analyze documents you have
            permission to access. You are responsible for how you use the
            information it shows you.
          </p>
          <p>
            The revision-history analysis is derived from snapshots retained
            by Google Drive, which are periodic rather than continuous. It is
            provided for informational purposes and should not be treated as
            a definitive or legally authoritative record of authorship.
          </p>
          <p>
            We may change or discontinue this service at any time without
            notice.
          </p>
        </div>
      </div>
    </main>
  );
}
