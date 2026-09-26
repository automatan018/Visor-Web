/* ============================================================================
 * Visor Web — Drive API layer
 * ----------------------------------------------------------------------------
 * Everything here goes through Google's official, documented Drive API v3
 * using the signed-in user's OAuth access token. Nothing here talks to any
 * undocumented docs.google.com endpoint, and nothing is stored — each call
 * is made fresh, on demand, for the one file the user pasted a link to.
 * ==========================================================================*/

const DRIVE_API = "https://www.googleapis.com/drive/v3";

export class DriveApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function driveFetch(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Revisions/exports can be sizable; never cache a user's document.
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `Drive API request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new DriveApiError(message, res.status);
  }
  return res.json();
}

/** Accepts a full Docs/Slides URL, a bare file ID, or a drive.google.com link. */
export function extractFileId(input: string): string | null {
  const trimmed = input.trim();

  const patterns = [
    /docs\.google\.com\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }

  // A bare ID: Drive file IDs are alphanumeric plus - and _, and always at
  // least ~15 characters in practice.
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;

  return null;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
}

export async function getFileMetadata(
  accessToken: string,
  fileId: string
): Promise<DriveFileMeta> {
  const url = `${DRIVE_API}/files/${encodeURIComponent(
    fileId
  )}?fields=id,name,mimeType,webViewLink,iconLink`;
  return driveFetch(url, accessToken);
}

export const SUPPORTED_MIME_TYPES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.presentation",
]);

export interface DriveRevision {
  id: string;
  modifiedTime: string;
  lastModifyingUser?: {
    displayName?: string;
    emailAddress?: string;
    photoLink?: string;
    me?: boolean;
  };
  exportLinks?: Record<string, string>;
  size?: string;
  keepForever?: boolean;
}

/** All retained revisions for the file, oldest first. Google prunes old
 * automatic revisions after ~30 days / 100 revisions unless a revision was
 * explicitly kept forever, so very old history may simply be gone — the
 * Drive API has no way around that; it's the source of truth Visor Web
 * reads from. */
export async function listRevisions(
  accessToken: string,
  fileId: string
): Promise<DriveRevision[]> {
  const revisions: DriveRevision[] = [];
  let pageToken: string | undefined;
  const fields =
    "nextPageToken,revisions(id,modifiedTime,lastModifyingUser,exportLinks,size,keepForever)";

  do {
    const url = new URL(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/revisions`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const json = await driveFetch(url.toString(), accessToken);
    revisions.push(...(json.revisions || []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  revisions.sort(
    (a, b) => new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime()
  );
  return revisions;
}

/** Plain-text snapshot of one revision, or null if Drive offers no text
 * export for it (can happen for very old revisions with a narrower
 * exportLinks set). */
export async function fetchRevisionText(
  accessToken: string,
  fileId: string,
  revision: DriveRevision
): Promise<string | null> {
  const link = revision.exportLinks?.["text/plain"];
  if (!link) return null;

  const res = await fetch(link, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}
