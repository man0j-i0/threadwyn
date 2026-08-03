import { ask, askAboutProduct } from "@/lib/ai/assistant";
import { handleError, ok, parseBody } from "@/lib/api/respond";
import { aiChatSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { readOrCreateAnonId, readSession } from "@/lib/auth/session";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const input = await parseBody(req, aiChatSchema);

    // A question asked from a product page is answered strictly from that
    // product's row — narrower context, no chance of drifting to a neighbour.
    const reply = input.productSlug
      ? await askAboutProduct(input.productSlug, input.message)
      : await ask(input.message, input.history);

    // Persist for continuity. Never let a logging failure break the reply.
    void persist(input.message, reply.message, input.productSlug).catch(() => {});

    return ok(reply);
  } catch (err) {
    return handleError(err);
  }
}

async function persist(userText: string, assistantText: string, productSlug?: string) {
  const session = await readSession();
  const sessionId = session?.sub ?? (await readOrCreateAnonId());
  const surface = productSlug ? "product-qa" : "assistant";

  const conversation =
    (await db.aiConversation.findFirst({
      where: { sessionId, surface },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await db.aiConversation.create({
      data: { sessionId, surface, userId: session?.sub ?? null },
    }));

  await db.aiMessage.createMany({
    data: [
      { conversationId: conversation.id, role: "user", content: userText, meta: productSlug ? { productSlug } : undefined },
      { conversationId: conversation.id, role: "assistant", content: assistantText },
    ],
  });

  await db.aiConversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });
}
