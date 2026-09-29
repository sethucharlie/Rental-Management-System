import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The landlord emails an unsigned Signing Link to the Tenant.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/signing-links/[id]/email">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const outcome = await getLeaseModule().emailSigningLink(id, typeof body?.to === "string" ? body.to : "");
    switch (outcome.status) {
      case "sent":
        return NextResponse.json(outcome);
      case "invalid":
        return NextResponse.json(outcome, { status: 400 });
      case "not_found":
        return NextResponse.json({ ...outcome, error: "This link no longer exists." }, { status: 404 });
      case "already_signed":
        return NextResponse.json({ ...outcome, error: "This lease is already signed." }, { status: 409 });
    }
  } catch (err) {
    console.error("Failed to email Signing Link", err);
    return NextResponse.json({ error: "Failed to send the email" }, { status: 500 });
  }
}
