import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Serves an uploaded image. Content is immutable once written — the id is
 * content-addressed by row, never reused — so it can be cached hard.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const image = await db.uploadedImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });

  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.data.byteLength),
    },
  });
}
