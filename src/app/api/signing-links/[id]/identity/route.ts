import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule } from "@/lib/lease/server";

const HTTP_STATUS = { open: 200, wrong_identity: 403, not_found: 404, already_signed: 409, blocked: 429 } as const;

// The Tenant gives their Identity Number to open a Renewal. Only a match returns their details.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/signing-links/[id]/identity">) {
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const identityNumber = typeof body?.identityNumber === "string" ? body.identityNumber : "";
    const outcome = await getLeaseModule().checkRenewalIdentity(id, identityNumber);
    return NextResponse.json(outcome, { status: HTTP_STATUS[outcome.status] });
  } catch (err) {
    console.error("Failed to check Identity Number", err);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
