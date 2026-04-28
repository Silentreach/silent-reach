// Confirmation intermediary — defeats Gmail's link prefetcher.
//
// Why this exists:
//   Email clients (Gmail, Outlook, virus scanners) prefetch URLs in emails
//   to scan for malware. If the magic-link URL auto-verifies on GET, the
//   prefetcher consumes the one-time token before the user can click it.
//   This page just renders a button — no verification happens until the
//   user actively clicks "Sign in", which navigates to /auth/callback
//   where verifyOtp() runs and consumes the token.
//
// Flow:
//   1. Email link  → /auth/confirm?token_hash=...&type=magiclink&next=/
//   2. Page renders. User sees "Sign in to Mintflow" button.
//   3. User clicks button → /auth/callback?token_hash=...&type=magiclink&next=/
//   4. Callback runs verifyOtp(), sets session cookie, redirects.

import Link from "next/link";

interface ConfirmPageProps {
  searchParams: {
    token_hash?: string;
    type?: string;
    next?: string;
  };
}

export default function ConfirmPage({ searchParams }: ConfirmPageProps) {
  const { token_hash, type, next } = searchParams;

  if (!token_hash || !type) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-semibold text-white mb-2">Invalid link</h1>
          <p className="text-sm text-neutral-400 mb-6">
            This sign-in link is malformed. Request a fresh one from the login page.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  const params = new URLSearchParams({
    token_hash,
    type,
    ...(next ? { next } : {}),
  });
  const callbackUrl = `/auth/callback?${params.toString()}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Mintflow</h1>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-medium text-white mb-3">Almost there</h2>
          <p className="text-sm text-neutral-400 mb-8">
            Click below to complete your sign-in.
          </p>
          <Link
            href={callbackUrl}
            className="inline-block w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition"
          >
            Sign in to Mintflow
          </Link>
        </div>

        <p className="text-xs text-neutral-600 mt-6">
          This extra click protects your account from email scanners that could
          accidentally consume your sign-in link.
        </p>
      </div>
    </div>
  );
}
