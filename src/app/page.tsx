"use client";

import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { Contributor, RevisionStep } from "@/lib/authorship";
import type { DriveFileMeta } from "@/lib/googleDrive";
import GooglePicker, { type PickedFile } from "@/components/GooglePicker";

interface AnalyzeResponse {
  file: DriveFileMeta;
  steps: RevisionStep[];
  contributors: Contributor[];
  totalRevisions: number;
  analyzedRevisions: number;
  skippedNoText: number;
  sampled: boolean;
  note?: string;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function fmtInt(n: number) {
  return n.toLocaleString();
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Home() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handlePick(file: PickedFile) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: file.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
      } else {
        setResult(json);
      }
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const totalAdded = result?.contributors.reduce((s, c) => s + c.charsAdded, 0) ?? 0;

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-10 rise">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" width={40} height={26} />
          <div>
            <strong className="text-[15px] tracking-tight block">Visor Web</strong>
            <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
              Revision history for a document you link
            </span>
          </div>
        </div>

        {status === "authenticated" ? (
          <div className="flex items-center gap-3">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <button
              onClick={() => signOut()}
              className="glass-thin lift text-[12px] px-3 py-2 rounded-[10px] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        ) : null}
      </header>

      {/* Sign-in gate */}
      {status !== "authenticated" && (
        <section className="glass rise p-6 text-center flex flex-col items-center gap-4">
          <h1 className="text-lg font-semibold">See who wrote what</h1>
          <p className="text-[13px] max-w-md" style={{ color: "var(--ink-2)" }}>
            Sign in with Google, pick a Doc or Slides file you can edit through
            Google&apos;s own file picker, and Visor Web reconstructs its
            revision history — who changed what, and when — straight from
            Google&apos;s Drive API.
          </p>
          <button
            onClick={() => signIn("google")}
            className="p-btn lift"
            style={{
              padding: "11px 20px",
              borderRadius: 13,
              border: "none",
              fontWeight: 650,
              fontSize: 13,
              color: "#fff",
              background: "linear-gradient(140deg, var(--accent), var(--accent-2))",
              cursor: "pointer",
            }}
          >
            Sign in with Google
          </button>
          <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            Only used to read the one document you paste a link to. Nothing is
            stored — each analysis runs fresh and nothing is saved after you
            leave the page.
          </p>
        </section>
      )}

      {/* Analyze form */}
      {status === "authenticated" && (
        <>
          <div className="glass rise p-5 flex items-center gap-3 mb-6">
            {session.accessToken ? (
              <GooglePicker
                accessToken={session.accessToken}
                disabled={loading}
                onPick={handlePick}
              />
            ) : (
              <span className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                Reconnecting your Google session…
              </span>
            )}
            {loading && (
              <span className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                Analyzing…
              </span>
            )}
          </div>

          {error && (
            <div
              className="glass p-4 mb-6 text-[13px]"
              style={{ color: "var(--hot)" }}
            >
              {error}
            </div>
          )}

          {loading && (
            <div className="glass p-6 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
              Reading revision history from Drive…
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-6 rise-stagger">
              {/* File header */}
              <div className="glass p-5 flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold">{result.file.name}</div>
                  <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                    {fmtInt(result.totalRevisions)} revisions retained by Drive
                    {result.sampled &&
                      ` · showing ${fmtInt(result.analyzedRevisions)} sampled evenly across the full history`}
                  </div>
                </div>
                {result.file.webViewLink && (
                  <a
                    href={result.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-thin lift text-[12px] px-3 py-2 rounded-[10px]"
                  >
                    Open doc ↗
                  </a>
                )}
              </div>

              {result.note && (
                <div className="glass p-4 text-[13px]" style={{ color: "var(--ink-2)" }}>
                  {result.note}
                </div>
              )}

              {result.contributors.length > 0 && (
                <>
                  {/* Contributors */}
                  <div className="glass p-5">
                    <div className="text-[12px] font-semibold mb-4" style={{ color: "var(--ink-2)" }}>
                      Contributors
                    </div>
                    <div className="flex flex-col gap-3">
                      {result.contributors.map((c) => {
                        const share = totalAdded ? c.charsAdded / totalAdded : 0;
                        return (
                          <div key={c.key} className="flex items-center gap-3">
                            {c.photoLink ? (
                              <img
                                src={c.photoLink}
                                alt=""
                                width={32}
                                height={32}
                                className="rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold"
                                style={{
                                  width: 32,
                                  height: 32,
                                  background: "var(--surface-3)",
                                  color: "var(--ink-2)",
                                }}
                              >
                                {initials(c.name)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[13px] font-medium truncate">{c.name}</span>
                                <span className="text-[11px] flex-shrink-0" style={{ color: "var(--ink-3)" }}>
                                  +{fmtInt(c.charsAdded)} / −{fmtInt(c.charsRemoved)} chars ·{" "}
                                  {c.revisions} rev{c.revisions === 1 ? "" : "s"}
                                </span>
                              </div>
                              <div
                                className="h-[6px] rounded-full mt-1 overflow-hidden"
                                style={{ background: "var(--surface-3)" }}
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%`,
                                    background:
                                      "linear-gradient(90deg, var(--accent), var(--accent-2))",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Growth */}
                  <div className="glass p-5">
                    <div className="text-[12px] font-semibold mb-4" style={{ color: "var(--ink-2)" }}>
                      Document length over time
                    </div>
                    <GrowthBars steps={result.steps} />
                  </div>

                  {/* Timeline */}
                  <div className="glass p-5">
                    <div className="text-[12px] font-semibold mb-3" style={{ color: "var(--ink-2)" }}>
                      Revisions
                    </div>
                    <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                      {[...result.steps].reverse().map((s) => (
                        <div
                          key={s.revisionId}
                          className="flex items-center justify-between text-[12px] py-2"
                          style={{ borderBottom: "1px solid var(--hairline-dim)" }}
                        >
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.author.name}</div>
                            <div style={{ color: "var(--ink-3)" }}>{fmtTime(s.time)}</div>
                          </div>
                          {s.textUnavailable ? (
                            <span style={{ color: "var(--ink-3)" }}>no export available</span>
                          ) : (
                            <span className="flex-shrink-0" style={{ color: "var(--ink-2)" }}>
                              <span style={{ color: "var(--good)" }}>+{fmtInt(s.charsAdded)}</span>{" "}
                              <span style={{ color: "var(--hot)" }}>−{fmtInt(s.charsRemoved)}</span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {result.contributors.length === 0 && !result.note && (
                <div className="glass p-6 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                  No text differences could be read from this file&apos;s revisions.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <footer className="mt-10 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
        Reads revision snapshots via the official Google Drive API. Not affiliated
        with Google. Nothing you analyze is stored on any server.
      </footer>
    </main>
  );
}

function GrowthBars({ steps }: { steps: RevisionStep[] }) {
  const usable = steps.filter((s) => !s.textUnavailable);
  if (usable.length < 2) {
    return (
      <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>
        Not enough revisions to chart.
      </div>
    );
  }
  const max = Math.max(...usable.map((s) => s.docLength), 1);
  return (
    <div className="flex items-end gap-[2px] h-[80px]">
      {usable.map((s) => (
        <div
          key={s.revisionId}
          title={`${fmtTime(s.time)} · ${fmtInt(s.docLength)} chars`}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${Math.max((s.docLength / max) * 100, 2)}%`,
            background: "linear-gradient(180deg, var(--accent-vivid), var(--accent-2-vivid))",
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}
