import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  DriveApiError,
  SUPPORTED_MIME_TYPES,
  extractFileId,
  fetchRevisionText,
  getFileMetadata,
  listRevisions,
  type DriveRevision,
} from "@/lib/googleDrive";
import { buildAuthorship } from "@/lib/authorship";

export const runtime = "nodejs";
export const maxDuration = 60;

// Hard ceiling on how many revisions we'll actually diff in one request, so
// a document with thousands of retained revisions can't turn a page load
// into a multi-minute job. When a document has more than this, we sample
// evenly across its history (always keeping the first and last) and say so.
const MAX_ANALYZED_REVISIONS = 250;
const EXPORT_CONCURRENCY = 6;

function sampleRevisions(revisions: DriveRevision[], max: number): DriveRevision[] {
  if (revisions.length <= max) return revisions;
  const step = (revisions.length - 1) / (max - 1);
  const picked: DriveRevision[] = [];
  for (let i = 0; i < max; i++) {
    picked.push(revisions[Math.round(i * step)]);
  }
  return picked;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(new Array(Math.min(limit, items.length)).fill(0).map(worker));
  return results;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return NextResponse.json(
      { error: "Sign in with Google to analyze a document." },
      { status: 401 }
    );
  }
  if (session.accessTokenError) {
    return NextResponse.json(
      { error: "Your Google session expired. Sign in again." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  // Prefer a fileId that came straight out of the Google Picker — that's the
  // only case where drive.file scope actually grants access. A raw pasted
  // link/id is accepted too (useful for local testing against a file you
  // created with this app), but with drive.file scope Google will simply
  // return 404 for anything the user didn't pick, which is surfaced below.
  const fileId =
    (typeof body?.fileId === "string" && body.fileId) ||
    extractFileId(typeof body?.url === "string" ? body.url : "");
  if (!fileId) {
    return NextResponse.json(
      { error: "No file was selected." },
      { status: 400 }
    );
  }

  const accessToken = session.accessToken;

  try {
    const meta = await getFileMetadata(accessToken, fileId);

    if (!SUPPORTED_MIME_TYPES.has(meta.mimeType)) {
      return NextResponse.json(
        { error: "Visor Web only analyzes Google Docs and Google Slides files." },
        { status: 400 }
      );
    }

    const allRevisions = await listRevisions(accessToken, fileId);
    if (allRevisions.length === 0) {
      return NextResponse.json(
        {
          file: meta,
          steps: [],
          contributors: [],
          totalRevisions: 0,
          analyzedRevisions: 0,
          sampled: false,
          note: "Drive has no revision history retained for this file.",
        },
        { status: 200 }
      );
    }

    const sampled = allRevisions.length > MAX_ANALYZED_REVISIONS;
    const revisions = sampleRevisions(allRevisions, MAX_ANALYZED_REVISIONS);

    const texts = new Map<string, string | null>();
    await mapWithConcurrency(revisions, EXPORT_CONCURRENCY, async (rev) => {
      const text = await fetchRevisionText(accessToken, fileId, rev);
      texts.set(rev.id, text);
    });

    const authorship = buildAuthorship(revisions, texts);

    return NextResponse.json({
      file: meta,
      ...authorship,
      totalRevisions: allRevisions.length,
      sampled,
    });
  } catch (err) {
    if (err instanceof DriveApiError) {
      if (err.status === 404) {
        return NextResponse.json(
          { error: "File not found, or you don't have access to it." },
          { status: 404 }
        );
      }
      if (err.status === 403) {
        return NextResponse.json(
          {
            error:
              "Google refused this request. You need edit access to the file's revision history, the same as Google Docs' own version history.",
          },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: err.message }, { status: err.status || 500 });
    }
    return NextResponse.json(
      { error: "Something went wrong analyzing this document." },
      { status: 500 }
    );
  }
}
