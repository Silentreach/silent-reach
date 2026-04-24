import Link from "next/link";
import { Camera, Youtube } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="pt-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Silent <span className="text-gold">Reach</span>
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Content intelligence for Silent Story. Plan non-follower reach before
          you film — then pack the content the moment you upload.
        </p>
        <div className="gold-divider mt-6 max-w-xs" />
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <Link
          href="/pre-shoot"
          className="group rounded-xl border border-border bg-surface p-6 transition hover:border-gold"
        >
          <Camera className="h-6 w-6 text-gold" />
          <h2 className="mt-4 text-xl font-semibold">Pre-Shoot Brief</h2>
          <p className="mt-2 text-sm text-muted">
            Plan the hook, shot list, title, and thumbnail direction before you
            film. Designed for retention and non-follower reach.
          </p>
          <span className="mt-4 inline-block text-sm text-gold group-hover:underline">
            Start a brief →
          </span>
        </Link>

        <Link
          href="/post-upload"
          className="group rounded-xl border border-border bg-surface p-6 transition hover:border-gold"
        >
          <Youtube className="h-6 w-6 text-gold" />
          <h2 className="mt-4 text-xl font-semibold">Post-Upload Pack</h2>
          <p className="mt-2 text-sm text-muted">
            Paste your YouTube URL. Get captions, titles, hook rewrites,
            chapter markers, and shareable clip timestamps in one pass.
          </p>
          <span className="mt-4 inline-block text-sm text-gold group-hover:underline">
            Generate a pack →
          </span>
        </Link>
      </section>
    </div>
  );
}
