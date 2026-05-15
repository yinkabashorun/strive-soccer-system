import type { OperatorConfig, StoredPost } from "./store";

/**
 * Build the Claude.ai prompt block that the operator pastes into a fresh
 * Claude conversation (with the Higgsfield MCP connected). Claude follows
 * this prompt verbatim — calls `generate_video` with the right params, then
 * `job_display` to surface the rendered video URL.
 *
 * The operator's job each day:
 *   1. Open Strive OS → /queue
 *   2. Click "Copy Higgsfield prompt" on today's awaiting_video card
 *   3. Open claude.ai → paste → send
 *   4. Wait ~2–5 min for Higgsfield to render
 *   5. Copy the resulting cloudfront video URL
 *   6. Paste it back into the queue card → status flips to awaiting_approval
 *   7. Tap Approve → GHL schedules to TikTok
 */
export function buildHiggsfieldPrompt(
  post: Pick<
    StoredPost,
    "hook" | "voiceoverScript" | "caption" | "pillar" | "goal" | "videoPrompt"
  >,
  config: Pick<
    OperatorConfig,
    | "higgsfieldAvatarId"
    | "higgsfieldAvatarName"
    | "higgsfieldAvatarType"
    | "higgsfieldWebproductId"
    | "higgsfieldWebproductUrl"
    | "higgsfieldMode"
    | "higgsfieldDurationSec"
  >,
): string {
  const lines = [
    `Use the Higgsfield MCP to generate a ${config.higgsfieldDurationSec}-second 9:16 TikTok video using these exact params:`,
    "",
    `- model: marketing_studio_video`,
    `- mode: ${config.higgsfieldMode}`,
    `- aspect_ratio: 9:16`,
    `- duration: ${config.higgsfieldDurationSec}`,
    `- avatars: [{ id: "${config.higgsfieldAvatarId}", type: "${config.higgsfieldAvatarType}" }]   // ${config.higgsfieldAvatarName}`,
    `- type: webproduct`,
    `- url: ${config.higgsfieldWebproductUrl}`,
    "",
    "Prompt to use verbatim:",
    "",
    post.videoPrompt,
    "",
    "Spoken voiceover (the avatar should speak these exact words):",
    "",
    `"${post.voiceoverScript}"`,
    "",
    `After submission, call job_display with the returned job id. When complete, give me the cloudfront URL only — nothing else.`,
  ];
  return lines.join("\n");
}

/**
 * Deep link that opens Claude.ai in a new tab with the prompt pre-filled.
 * Claude.ai accepts ?q= to seed a new conversation.
 */
export function claudeDeepLink(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}
