import { readFile } from "node:fs/promises";
import { demoImagePath } from "@/lib/fixtures";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const bytes = await readFile(demoImagePath((await params).name));
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
