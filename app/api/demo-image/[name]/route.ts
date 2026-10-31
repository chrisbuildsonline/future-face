import { readFile } from "node:fs/promises";
import { demoImagePath, isFace } from "@/lib/fixtures";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const face = new URL(req.url).searchParams.get("face") ?? "a";
    if (!isFace(face)) return new Response(null, { status: 404 });
    const bytes = await readFile(demoImagePath((await params).name, face));
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
