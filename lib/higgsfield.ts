// Higgsfield — hyper-realistic UGC creator videos via MCP.
//
// Higgsfield does not expose a REST API. They ship an MCP (Model Context
// Protocol) server. We spawn that server as a stdio subprocess, call its
// generation tool, and (optionally) poll its status tool.
//
// Two ways to wire it:
//   1. MCP via stdio (default): set HIGGSFIELD_MCP_COMMAND + ARGS.
//      Example: HIGGSFIELD_MCP_COMMAND=npx
//               HIGGSFIELD_MCP_ARGS=-y,@higgsfield/mcp-server
//   2. CLI fallback: set HIGGSFIELD_CLI to a binary path. We'll exec it
//      with the prompt on stdin and parse `{ "id", "video_url" }` from
//      stdout. Useful when Higgsfield ship a one-shot CLI tool.
//
// If neither is configured, we return a mock job so the rest of the
// pipeline (voiceover, GHL scheduling) still works.

import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type HiggsfieldJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  videoUrl?: string;
  posterUrl?: string;
  error?: string;
  provider: "higgsfield-mcp" | "higgsfield-cli" | "mock";
};

export type UGCRequest = {
  pitch: string;
  pillar: string;
  creatorStyle?: "young-mom" | "older-athlete" | "soccer-dad" | "teen-creator";
  durationSec?: number;
  audioDataUri?: string;
  productUrl?: string;
};

const STYLE_PROMPT: Record<NonNullable<UGCRequest["creatorStyle"]>, string> = {
  "young-mom":
    "30s mother filming on phone in car, natural daylight, soccer mom energy, sincere, kid in background.",
  "older-athlete":
    "late teens athletic male, post-training, sweaty, gym/field background, confident handheld delivery.",
  "soccer-dad":
    "40s dad on sideline with phone, casual coach polo, ambient field sound, no-nonsense tone.",
  "teen-creator":
    "16-year-old TikTok creator in bedroom, ring light, fast cuts, gen-z cadence but still grounded.",
};

function buildPrompt(req: UGCRequest): string {
  const style = STYLE_PROMPT[req.creatorStyle ?? "young-mom"];
  return `Ultra-realistic UGC video of a real person speaking directly to the camera, phone-shot, natural light, no studio look. ${style} The creator delivers this script word for word: """${req.pitch}""" Pillar context: ${req.pillar}. Cinematography: handheld, intimate, 9:16, mild lens distortion. Audio: clean direct dialogue. No on-screen text. No watermarks.`;
}

export function higgsfieldMode(): "mcp" | "cli" | "mock" {
  if (process.env.HIGGSFIELD_MCP_COMMAND) return "mcp";
  if (process.env.HIGGSFIELD_CLI) return "cli";
  return "mock";
}

export function isHiggsfieldConfigured() {
  return higgsfieldMode() !== "mock";
}

// --- MCP transport ----------------------------------------------------------

function mcpEnv(): Record<string, string> {
  // MCP servers usually read HIGGSFIELD_API_KEY from env. Pass through any
  // user-set vars by default — explicit keys win.
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

async function withMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const command = process.env.HIGGSFIELD_MCP_COMMAND!;
  const args = (process.env.HIGGSFIELD_MCP_ARGS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const transport = new StdioClientTransport({
    command,
    args,
    env: mcpEnv(),
  });
  const client = new Client(
    { name: "strive-os", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

function extractFromMcpResult(raw: unknown): { id?: string; status?: HiggsfieldJob["status"]; videoUrl?: string; posterUrl?: string; error?: string } {
  // MCP tool results come back as `{ content: [{ type: "text", text: "..." }] }`.
  // The Higgsfield server returns JSON in that text block. Some servers also
  // surface structured content directly.
  const r = raw as { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown; isError?: boolean };
  let parsed: Record<string, unknown> | null = null;

  if (r?.structuredContent && typeof r.structuredContent === "object") {
    parsed = r.structuredContent as Record<string, unknown>;
  } else if (Array.isArray(r?.content)) {
    const text = r.content.find((c) => c.type === "text")?.text ?? "";
    try {
      parsed = JSON.parse(text);
    } catch {
      // The MCP server might just emit a URL string.
      const urlMatch = text.match(/https?:\S+\.(mp4|mov|webm)/i);
      if (urlMatch) parsed = { video_url: urlMatch[0] };
    }
  }

  if (!parsed) return { error: r?.isError ? "tool_error" : "unparseable_mcp_response" };
  const id = (parsed.id ?? parsed.job_id ?? parsed.generation_id) as string | undefined;
  const status = (parsed.status as HiggsfieldJob["status"] | undefined) ?? (parsed.video_url || parsed.url ? "completed" : "queued");
  const videoUrl = (parsed.video_url ?? parsed.url ?? parsed.output_url) as string | undefined;
  const posterUrl = (parsed.poster_url ?? parsed.thumbnail_url) as string | undefined;
  return { id, status, videoUrl, posterUrl };
}

const GENERATE_TOOL = () => process.env.HIGGSFIELD_GENERATE_TOOL || "generate_video";
const POLL_TOOL = () => process.env.HIGGSFIELD_POLL_TOOL || "get_generation";

// --- CLI transport ----------------------------------------------------------

function runCli(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const bin = process.env.HIGGSFIELD_CLI!;
    const child = spawn(bin, args, {
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }
  });
}

function parseCliPayload(stdout: string): { id?: string; status?: HiggsfieldJob["status"]; videoUrl?: string } {
  try {
    const data = JSON.parse(stdout);
    return {
      id: data.id ?? data.job_id,
      status: data.status ?? (data.video_url ? "completed" : "queued"),
      videoUrl: data.video_url ?? data.url,
    };
  } catch {
    const urlMatch = stdout.match(/https?:\S+\.(mp4|mov|webm)/i);
    return urlMatch ? { status: "completed", videoUrl: urlMatch[0] } : {};
  }
}

// --- Public API -------------------------------------------------------------

export async function startUGCVideo(req: UGCRequest): Promise<HiggsfieldJob> {
  const mode = higgsfieldMode();
  const prompt = buildPrompt(req);

  if (mode === "mock") {
    return {
      id: `mock_${Math.random().toString(36).slice(2, 10)}`,
      status: "queued",
      provider: "mock",
    };
  }

  if (mode === "mcp") {
    try {
      const out = await withMcpClient(async (client) => {
        const result = await client.callTool({
          name: GENERATE_TOOL(),
          arguments: {
            prompt,
            script: req.pitch,
            duration_seconds: req.durationSec ?? 30,
            aspect_ratio: "9:16",
            audio_data_uri: req.audioDataUri,
            reference_product_url: req.productUrl,
          },
        });
        return extractFromMcpResult(result);
      });
      return {
        id: out.id ?? `hf_${Date.now()}`,
        status: out.status ?? "queued",
        videoUrl: out.videoUrl,
        posterUrl: out.posterUrl,
        error: out.error,
        provider: "higgsfield-mcp",
      };
    } catch (err) {
      throw new Error(`higgsfield_mcp: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // CLI path
  const args = [
    "generate",
    "--prompt", prompt,
    "--script", req.pitch,
    "--duration", String(req.durationSec ?? 30),
    "--aspect-ratio", "9:16",
    "--json",
  ];
  if (req.audioDataUri) args.push("--audio", req.audioDataUri);
  if (req.productUrl) args.push("--reference-url", req.productUrl);

  const { stdout, stderr, code } = await runCli(args);
  if (code !== 0) throw new Error(`higgsfield_cli_${code}: ${stderr.slice(0, 200)}`);
  const parsed = parseCliPayload(stdout);
  return {
    id: parsed.id ?? `hf_${Date.now()}`,
    status: parsed.status ?? "queued",
    videoUrl: parsed.videoUrl,
    provider: "higgsfield-cli",
  };
}

export async function pollUGCVideo(id: string): Promise<HiggsfieldJob> {
  const mode = higgsfieldMode();

  if (mode === "mock" || id.startsWith("mock_")) {
    return { id, status: "processing", provider: "mock" };
  }

  if (mode === "mcp") {
    const out = await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: POLL_TOOL(),
        arguments: { id },
      });
      return extractFromMcpResult(result);
    });
    return {
      id,
      status: out.status ?? "processing",
      videoUrl: out.videoUrl,
      posterUrl: out.posterUrl,
      error: out.error,
      provider: "higgsfield-mcp",
    };
  }

  // CLI path
  const { stdout, stderr, code } = await runCli(["status", "--id", id, "--json"]);
  if (code !== 0) throw new Error(`higgsfield_cli_poll_${code}: ${stderr.slice(0, 200)}`);
  const parsed = parseCliPayload(stdout);
  return {
    id,
    status: parsed.status ?? "processing",
    videoUrl: parsed.videoUrl,
    provider: "higgsfield-cli",
  };
}
