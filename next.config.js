/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // Multi-threaded ffmpeg.wasm needs SharedArrayBuffer, which requires the page
    // to be in a "cross-origin isolated" context. We scope these headers to the
    // Reel Multiplier route only, so we don't break other pages that load
    // cross-origin embeds, fonts, or images without CORP headers.
    return [
      {
        source: "/reel-multiplier",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/reel-multiplier/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
