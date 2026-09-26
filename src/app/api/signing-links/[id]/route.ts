import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule } from "@/lib/lease/server";

// The signing page asks whether its link can still be signed. It reveals nothing else.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/signing-links/[id]">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getLeaseModule().openSigningLink(id));
  } catch (err) {
    console.error("Failed to open Signing Link", err);
    return NextResponse.json({ error: "Failed to load the lease" }, { status: 500 });
  }
}
