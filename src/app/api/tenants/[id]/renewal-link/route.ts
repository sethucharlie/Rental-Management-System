import { NextRequest, NextResponse } from "next/server";
import { InvalidSigningLinkError } from "@/lib/lease/lease-module";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The landlord creates a Renewal Signing Link for a Current Tenant.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/tenants/[id]/renewal-link">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const { unitType, unitNumber, rent } = await request.json();
    const created = await getLeaseModule().createRenewalLink(id, {
      unitType: String(unitType ?? ""),
      unitNumber: String(unitNumber ?? ""),
      rent: String(rent ?? ""),
    });
    return NextResponse.json(created);
  } catch (err) {
    if (err instanceof InvalidSigningLinkError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to create Renewal Signing Link", err);
    return NextResponse.json({ error: "Failed to create the link" }, { status: 500 });
  }
}
