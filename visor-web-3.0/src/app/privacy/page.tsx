export const metadata = { title: "Privacy Policy — Visor Web" };

export default function PrivacyPage() {
  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-10">
      <div className="glass p-6">
        <h1 className="text-lg font-semibold mb-1">Privacy Policy</h1>
        <p className="text-[11px] mb-6" style={{ color: "var(--ink-3)" }}>
          Last updated: {new Date().toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>

        <div className="flex flex-col gap-4 text-[13px]" style={{ color: "var(--ink-2)" }}>
          <p>
            Visor Web shows the revision history of a single Google Docs or
            Google Slides file that you choose, using Google&apos;s Drive API.
            This page explains exactly what that involves.
          </p>

          <h2 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            What we access
          </h2>
          <p>
            When you sign in with Google, we request the{" "}
            <code>drive.file</code> permission scope. This scope does not
            grant access to your Google Drive in general — it only grants
            access to the one file you explicitly select through Google&apos;s
            own file-picker dialog. We never request a list of your files,
            and we cannot see or access any file you have not chosen through
            that picker.
          </p>
          <p>
            For the file you pick, we read its revision history through
            Google&apos;s Drive API: the saved snapshots of that file, who
            last modified each one, and the text of each snapshot, in order
            to show you a breakdown of who wrote what.
          </p>

          <h2 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            What we store
          </h2>
          <p>
            Nothing about your document is stored on our servers. Each
            analysis is computed fresh when you request it and discarded
            once the result is sent back to your browser. We do not use a
            database, and we do not log document content.
          </p>
          <p>
            Your Google sign-in session is kept only in an encrypted cookie
            in your own browser, used to authenticate requests to Google on
            your behalf while you use the site. It is not stored anywhere
            else and expires with your browser session.
          </p>

          <h2 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            What we share
          </h2>
          <p>
            We do not sell, share, or transfer your data to any third party.
            The only party we communicate with is Google&apos;s own API, to
            read the one file you selected, on your behalf, using your own
            authorization.
          </p>

          <h2 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Revoking access
          </h2>
          <p>
            You can remove this app&apos;s access at any time from your
            Google Account&apos;s{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Third-party access settings
            </a>
            .
          </p>

          <h2 className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Contact
          </h2>
          <p>
            Questions about this policy can be sent to the contact address
            listed on this app&apos;s Google Cloud OAuth consent screen.
          </p>
        </div>
      </div>
    </main>
  );
}
