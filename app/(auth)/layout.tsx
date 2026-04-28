// Minimal auth layout — no Header, Footer, or width-constrained <main>.
// Lets /login and /auth/* pages render full-bleed without the global chrome.
import "../globals.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg text-text">{children}</div>;
}
