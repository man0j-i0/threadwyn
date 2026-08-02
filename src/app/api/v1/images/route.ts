import { db } from "@/lib/db";
import { requireSupplier, HttpError } from "@/lib/auth/guards";
import { created, handleError } from "@/lib/api/respond";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/**
 * Product photo upload.
 *
 * Stored as bytes in Postgres rather than on disk, because serverless hosts
 * have an ephemeral filesystem — an uploaded photo has to survive a cold start.
 * The client downsizes to ≤1600px and re-encodes to WebP before posting, so
 * rows stay small; this endpoint still enforces its own ceiling and MIME
 * allow-list, because client-side validation is a convenience, not a control.
 */
export async function POST(req: Request) {
  try {
    await requireSupplier();

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(422, "no_file", "Attach an image file.");
    }
    if (!ALLOWED.has(file.type)) {
      throw new HttpError(415, "bad_type", "Upload a JPEG, PNG, WebP or AVIF image.");
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(413, "too_large", "Images must be under 2 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const row = await db.uploadedImage.create({
      data: { mimeType: file.type, byteSize: buffer.byteLength, data: buffer },
      select: { id: true, byteSize: true, mimeType: true },
    });

    return created({ id: row.id, url: `/api/v1/images/${row.id}`, byteSize: row.byteSize });
  } catch (err) {
    return handleError(err);
  }
}
