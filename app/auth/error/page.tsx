"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ErrorBody() {
  const reason = useSearchParams().get("reason") || "Unknown auth error";
  return (
    <div className="max-w-md text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h1 className="text-2xl font-semibold text-white mb-2">Sign-in failed</h1>
      <p className="text-sm text-neutral-400 mb-6">{reason}</p>
      <Link href="/login" className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition">
        Try again
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <Suspense fallback={<div className="text-neutral-500">…</div>}>
        <ErrorBody />
      </Suspense>
    </div>
  );
}
