import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Payload-Size-Limit: 1KB
const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Payload size guard
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const mosqueId = typeof payload.mosqueId === "string" ? payload.mosqueId.trim() : null;

  if (!mosqueId || !/^[a-z0-9]{1,20}$/.test(mosqueId)) {
    return NextResponse.json({ error: "Invalid mosqueId" }, { status: 400 });
  }

  // Rate limit: 1 request per mosque per minute
  const rlKey = `tv_heartbeat:${mosqueId}`;
  const rl = checkRateLimit(rlKey, 1, 60 * 1000);
  const rlHeaders = getRateLimitHeaders(rl);

  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: rlHeaders });
  }

  // v1 stub — no DB write, just acknowledge
  return new NextResponse(null, { status: 204, headers: rlHeaders });
}
