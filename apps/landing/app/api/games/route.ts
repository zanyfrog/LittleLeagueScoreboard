import { NextResponse } from "next/server";
import { getRuntime, requestContext } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = await getRuntime();
  const games = await runtime.engine.games.listGames(
    requestContext(runtime.actorId)
  );
  return NextResponse.json({ games });
}
