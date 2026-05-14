import { NextResponse } from "next/server";
import { getConfig, saveConfig, type OperatorConfig } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const cfg = await getConfig();
    return NextResponse.json({ ok: true, config: cfg });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<OperatorConfig>;
  try {
    const cfg = await saveConfig(body);
    return NextResponse.json({ ok: true, config: cfg });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
