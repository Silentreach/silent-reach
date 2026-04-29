import ReelMultiplier from "@/components/ReelMultiplier";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Reel Multiplier — Mintflow",
  description:
    "Drop a 30-90 second video. Get three platform-tuned reel packages (Instagram, YouTube Shorts, Facebook) with cuts, captions, hashtags, thumbnails, music suggestions, and posting times.",
};

export default function ReelMultiplierPage() {
  return (
    <div className="-mt-10">
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-5xl px-5 pt-20 pb-10 text-center md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-gold">
            <Sparkles className="h-3 w-3" />
            Reel Multiplier · Pro
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight md:text-6xl">
            <span className="display-gradient">Upload once.</span>{" "}
            <span className="display-gradient">Ship three.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted md:text-lg">
            One source video → three platform-native reels for Instagram, YouTube Shorts, and Facebook. Each with its own cuts, captions, hashtags, thumbnail moments, music suggestions, and posting time.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10">
        <ReelMultiplier />
      </section>
    </div>
  );
}
