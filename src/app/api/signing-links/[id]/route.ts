import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

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

const DELETE_STATUS = { deleted: 200, not_found: 404, signed: 409 } as const;

// The landlord deletes a Signing Link nobody has signed.
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/signing-links/[id]">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const outcome = await getLeaseModule().deleteSigningLink(id);
    return NextResponse.json(outcome, { status: DELETE_STATUS[outcome.status] });
  } catch (err) {
    console.error("Failed to delete Signing Link", err);
    return NextResponse.json({ error: "Failed to delete the link" }, { status: 500 });
  }
}
