/* eslint-disable no-console */
import "dotenv/config";

/**
 * `npm run ai:check`
 *
 * Answers one question honestly: is a real model answering, or is the app
 * running on the deterministic engine?
 *
 * This exists because the Hugging Face path is the one part of the AI layer
 * that cannot be verified without a token, and "the code looks right" is not
 * verification. It hits chat and embeddings for real and prints exactly what
 * came back, including the provider's own error text when something fails.
 */

const CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

function candidates(): string[] {
  const configured = process.env.HF_CHAT_MODEL?.trim();
  if (configured?.includes(":")) return [configured];
  const base = configured || "Qwen/Qwen2.5-7B-Instruct";
  return [base, `${base}:together`, `${base}:nebius`, `${base}:hf-inference`];
}

async function checkChat(token: string) {
  console.log("\n── chat ──────────────────────────────────────────────");

  for (const model of candidates()) {
    process.stdout.write(`  ${model} … `);
    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Reply with exactly one word." },
            { role: "user", content: "Name one property of linen." },
          ],
          max_tokens: 20,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(40_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.log(`✗ ${res.status} ${res.statusText}`);
        if (body) console.log(`      ${body.slice(0, 300).replace(/\n/g, " ")}`);
        continue;
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
      };
      const reply = json.choices?.[0]?.message?.content?.trim();
      console.log("✓");
      console.log(`      served by : ${json.model ?? model}`);
      console.log(`      replied   : ${JSON.stringify(reply ?? "")}`);
      console.log(`\n  → Put this in .env to skip the probe next time:`);
      console.log(`      HF_CHAT_MODEL="${model}"`);
      return true;
    } catch (err) {
      console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return false;
}

async function checkEmbeddings(token: string) {
  console.log("\n── embeddings ────────────────────────────────────────");
  const model = process.env.HF_EMBED_MODEL ?? "sentence-transformers/all-MiniLM-L6-v2";
  const url = `https://router.huggingface.co/hf-inference/models/${model}/pipeline/feature-extraction`;

  process.stdout.write(`  ${model} … `);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: "breathable cotton shirting", options: { wait_for_model: true } }),
      signal: AbortSignal.timeout(40_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(`✗ ${res.status} ${res.statusText}`);
      if (body) console.log(`      ${body.slice(0, 300).replace(/\n/g, " ")}`);
      console.log("      (not fatal — search falls back to the local hashing embedding)");
      return false;
    }

    const json = (await res.json()) as number[] | number[][];
    const dims = Array.isArray(json[0]) ? (json[0] as number[]).length : (json as number[]).length;
    console.log(`✓  ${dims} dimensions`);
    return true;
  } catch (err) {
    console.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  const token = process.env.HF_TOKEN?.trim();
  const ollama = process.env.OLLAMA_HOST?.trim();

  console.log("\nThreadwyn · AI provider check");
  console.log("══════════════════════════════════════════════════════");

  if (!token && !ollama) {
    console.log("\n  Provider: NONE — the deterministic rule engine is answering.");
    console.log("\n  Everything still works: search, the assistant, product Q&A and");
    console.log("  onboarding all run without a model. But nothing is model-authored,");
    console.log("  and the UI will say so.");
    console.log("\n  To enable the open-weights model:");
    console.log("    1. https://huggingface.co/settings/tokens → New token → type: Read");
    console.log('    2. Put it in .env as  HF_TOKEN="hf_..."');
    console.log("    3. npm run ai:check\n");
    process.exit(1);
  }

  if (!token && ollama) {
    console.log(`\n  Provider: OLLAMA at ${ollama}`);
    console.log("  (this script only probes Hugging Face — start Ollama and use the app)\n");
    return;
  }

  console.log(`\n  Provider: HUGGING FACE`);
  console.log(`  Token   : ${token!.slice(0, 6)}…${token!.slice(-4)} (${token!.length} chars)`);

  const chatOk = await checkChat(token!);
  const embedOk = await checkEmbeddings(token!);

  console.log("\n── verdict ───────────────────────────────────────────");
  if (chatOk) {
    console.log("  ✓ A real open-weights model is answering.");
    console.log(`  ${embedOk ? "✓" : "·"} Embeddings ${embedOk ? "live" : "on local fallback (fine)"}`);
    console.log("\n  The assistant will now label its replies with the model id.\n");
  } else {
    console.log("  ✗ No model id resolved. The app still works on the rule engine.");
    console.log("\n  Most likely causes:");
    console.log("    · token is not a Read token, or was revoked");
    console.log("    · the model needs a different provider pin — try setting");
    console.log('      HF_CHAT_MODEL="meta-llama/Llama-3.1-8B-Instruct:together"');
    console.log("    · no inference credits left on the free tier\n");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
