"use client";

import { useEffect, useState, useCallback } from "react";
import Script from "next/script";

/* ============================================================================
 * Google Picker — the drive.file-compatible way to let a user hand over one
 * file. This is what makes the app work for the public without Google's
 * restricted-scope review: the user picks the file inside Google's own
 * dialog, and that pick *is* the grant. There is no "type a raw file ID"
 * fallback here on purpose — an ID typed by hand was never actually granted
 * through Picker, so the API would just reject it with drive.file scope.
 * ==========================================================================*/

// The Google Picker JS library (loaded from apis.google.com) has no stable
// official TypeScript types, hence the `any`s below.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const DOC_MIME = "application/vnd.google-apps.document";
const SLIDES_MIME = "application/vnd.google-apps.presentation";

export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
}

export default function GooglePicker({
  accessToken,
  onPick,
  disabled,
}: {
  accessToken: string;
  onPick: (file: PickedFile) => void;
  disabled?: boolean;
}) {
  const [pickerReady, setPickerReady] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);

  useEffect(() => {
    if (!gapiLoaded || !window.gapi) return;
    window.gapi.load("picker", () => setPickerReady(true));
  }, [gapiLoaded]);

  const openPicker = useCallback(() => {
    if (!pickerReady || !window.google?.picker || !API_KEY) return;

    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setMimeTypes(`${DOC_MIME},${SLIDES_MIME}`);

    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          onPick({ id: doc.id, name: doc.name, mimeType: doc.mimeType });
        }
      })
      .build();

    picker.setVisible(true);
  }, [pickerReady, accessToken, onPick]);

  if (!API_KEY) {
    return (
      <div className="text-[12px]" style={{ color: "var(--hot)" }}>
        NEXT_PUBLIC_GOOGLE_API_KEY isn&apos;t set — the file picker can&apos;t load
        without it. See README.md.
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://apis.google.com/js/api.js"
        onLoad={() => setGapiLoaded(true)}
        strategy="afterInteractive"
      />
      <button
        onClick={openPicker}
        disabled={disabled || !pickerReady}
        className="lift text-[13px] px-4 py-2 rounded-[10px] font-semibold cursor-pointer disabled:cursor-default"
        style={{
          color: "#fff",
          background: !pickerReady
            ? "var(--surface-3)"
            : "linear-gradient(140deg, var(--accent), var(--accent-2))",
        }}
      >
        {pickerReady ? "Select a Doc or Slides file" : "Loading picker…"}
      </button>
    </>
  );
}
