import { diffChars, diffWords } from "diff";
import type { DriveRevision } from "./googleDrive";

/* ============================================================================
 * Visor Web — authorship from revision snapshots
 * ----------------------------------------------------------------------------
 * This is the honest, coarser cousin of what the extension does. The
 * extension folds Google's live per-keystroke edit stream and can say who
 * typed which character. This module only has what the Drive API actually
 * hands over: a sequence of saved snapshots, each stamped with who last
 * modified the file. So a "contribution" here means: the text that changed
 * between two saved snapshots, credited to whoever saved the later one.
 *
 * That collapses anything that happened *between* snapshots into one block,
 * and if several people edited between two saves, only the last one gets
 * credit for that block — there's no way around that with snapshot data.
 * The UI says so; this module doesn't pretend otherwise.
 * ==========================================================================*/

const LARGE_DOC_CHARS = 120_000; // above this, use word-level diffing for speed

export interface RevisionStep {
  index: number;
  revisionId: string;
  time: string;
  author: {
    name: string;
    email: string | null;
    photoLink?: string;
  };
  charsAdded: number;
  charsRemoved: number;
  docLength: number;
  textUnavailable?: boolean;
}

export interface Contributor {
  key: string;
  name: string;
  email: string | null;
  photoLink?: string;
  charsAdded: number;
  charsRemoved: number;
  revisions: number;
  firstSeen: string;
  lastSeen: string;
}

export interface AuthorshipResult {
  steps: RevisionStep[];
  contributors: Contributor[];
  totalRevisions: number;
  analyzedRevisions: number;
  skippedNoText: number;
}

function authorOf(rev: DriveRevision) {
  return {
    name: rev.lastModifyingUser?.displayName || "Unknown contributor",
    email: rev.lastModifyingUser?.emailAddress || null,
    photoLink: rev.lastModifyingUser?.photoLink,
  };
}

function authorKey(author: { name: string; email: string | null }) {
  return author.email || `name:${author.name}`;
}

/**
 * Diff two snapshots and return { added, removed } character counts.
 * Word-level diffing is used above LARGE_DOC_CHARS purely so a big document
 * doesn't turn one request into a multi-second Myers diff — the character
 * counts it yields are a close approximation, not exact.
 */
function diffCounts(prev: string, curr: string) {
  const useWords = prev.length + curr.length > LARGE_DOC_CHARS;
  const parts = useWords ? diffWords(prev, curr) : diffChars(prev, curr);

  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.added) added += part.value.length;
    else if (part.removed) removed += part.value.length;
  }
  return { added, removed };
}

export function buildAuthorship(
  revisions: DriveRevision[],
  texts: Map<string, string | null>
): AuthorshipResult {
  const steps: RevisionStep[] = [];
  const contributorMap = new Map<string, Contributor>();
  let skippedNoText = 0;

  let prevText: string | null = "";

  revisions.forEach((rev, i) => {
    const author = authorOf(rev);
    const text = texts.get(rev.id) ?? null;

    if (text === null) {
      skippedNoText++;
      steps.push({
        index: i,
        revisionId: rev.id,
        time: rev.modifiedTime,
        author,
        charsAdded: 0,
        charsRemoved: 0,
        docLength: prevText?.length ?? 0,
        textUnavailable: true,
      });
      return;
    }

    const { added, removed } =
      prevText !== null ? diffCounts(prevText, text) : { added: text.length, removed: 0 };

    steps.push({
      index: i,
      revisionId: rev.id,
      time: rev.modifiedTime,
      author,
      charsAdded: added,
      charsRemoved: removed,
      docLength: text.length,
    });

    const key = authorKey(author);
    const existing = contributorMap.get(key);
    if (existing) {
      existing.charsAdded += added;
      existing.charsRemoved += removed;
      existing.revisions += 1;
      existing.lastSeen = rev.modifiedTime;
      if (!existing.photoLink && author.photoLink) existing.photoLink = author.photoLink;
    } else {
      contributorMap.set(key, {
        key,
        name: author.name,
        email: author.email,
        photoLink: author.photoLink,
        charsAdded: added,
        charsRemoved: removed,
        revisions: 1,
        firstSeen: rev.modifiedTime,
        lastSeen: rev.modifiedTime,
      });
    }

    prevText = text;
  });

  const contributors = [...contributorMap.values()].sort(
    (a, b) => b.charsAdded - a.charsAdded
  );

  return {
    steps,
    contributors,
    totalRevisions: revisions.length,
    analyzedRevisions: revisions.length - skippedNoText,
    skippedNoText,
  };
}
