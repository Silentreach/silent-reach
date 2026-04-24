import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gold text-black font-bold text-sm">
            SS
          </span>
          <span className="text-base font-semibold tracking-wide">
            Silent <span className="text-gold">Reach</span>
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-muted">
          <Link href="/pre-shoot" className="hover:text-text transition">
            Pre-Shoot
          </Link>
          <Link href="/post-upload" className="hover:text-text transition">
            Post-Upload
          </Link>
          <Link href="/history" className="hover:text-text transition">
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
