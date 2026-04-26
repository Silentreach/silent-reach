import { NextRequest, NextResponse } from "next/server";

/* Allow-list to prevent SSRF abuse — we only proxy image hosts we trust. */
const ALLOWED_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "i9.ytimg.com",
  "yt3.ggpht.com",
]);

export const runtime = "nodejs";
export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("url");
  if (!u) {
    return NextResponse.json({ error: "Missing ?url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      { error: "Host not allowed", host: parsed.hostname },
      { status: 403 }
    );
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      // No credentials — these are public thumbnails
      cache: "force-cache",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Upstream fetch failed", status: upstream.status },
        { status: 502 }
      );
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        // CORS — allow any origin so html-to-image's canvas can read this without taint
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown fetch error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
