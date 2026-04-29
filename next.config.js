/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 301 redirects from old route names to new four-pillar IA.
  // Kept indefinitely — old URLs in invite emails, social shares, and bookmarks must keep working.
  async redirects() {
    return [
      { source: "/pre-shoot",            destination: "/pre-production",           permanent: true },
      { source: "/pre-shoot/:path*",     destination: "/pre-production/:path*",    permanent: true },
      { source: "/post-upload",          destination: "/post-production",          permanent: true },
      { source: "/post-upload/:path*",   destination: "/post-production/:path*",   permanent: true },
      { source: "/reel-multiplier",      destination: "/distribution",             permanent: true },
      { source: "/reel-multiplier/:path*", destination: "/distribution/:path*",    permanent: true },
      { source: "/reels/outcomes",       destination: "/distribution/analytics",   permanent: true },
    ];
  },

  async headers() {
    // Multi-threaded ffmpeg.wasm needs SharedArrayBuffer, which requires the page
    // to be in a "cross-origin isolated" context. Scoped to /distribution (the
    // browser-side reel renderer, formerly /reel-multiplier).
    return [
      {
        source: "/distribution",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/distribution/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
