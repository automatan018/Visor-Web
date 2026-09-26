import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Visor Web — auth configuration
 * --------------------------------------------------------------------------
 * Scope: `drive.file`, Google's "non-sensitive" tier. It does NOT grant
 * access to a user's whole Drive — only to files the user explicitly hands
 * over through the Google Picker (see components/GooglePicker.tsx) or that
 * the app created itself. That per-file grant is what lets this run for the
 * public with zero verification wait: `drive.readonly` or `drive` would work
 * too, but both are "Restricted" scopes that require Google's annual, paid
 * CASA security assessment before any non-test user can sign in. `drive.file`
 * sidesteps that requirement entirely, by construction — the app can never
 * see more than what the user picked, so there's nothing broad to review.
 */

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: `openid email profile ${DRIVE_FILE_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // Stash the Google access token (and its expiry) on the JWT so API
    // routes — and the client-side Picker, which also needs it — can use it.
    // Nothing here is persisted anywhere — it lives only in the encrypted
    // session cookie for the lifetime of the browser session.
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : undefined;
      }

      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < (token.accessTokenExpires as number) - 60_000
      ) {
        return token;
      }
      if (!token.refreshToken) return token;

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID as string,
            client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken as string,
          }),
        });
        const refreshed = await res.json();
        if (!res.ok) throw refreshed;

        token.accessToken = refreshed.access_token;
        token.accessTokenExpires = Date.now() + refreshed.expires_in * 1000;
        token.refreshToken = refreshed.refresh_token ?? token.refreshToken;
      } catch {
        token.accessTokenError = "refresh_failed";
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.accessTokenError = token.accessTokenError as
        | string
        | undefined;
      return session;
    },
  },
};
