import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The landlord views the signature on one Lease.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/leases/[id]/signature">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const signature = await getLeaseModule().getSignature(id);
    if (!signature) return NextResponse.json({ error: "No signature on record" }, { status: 404 });
    return NextResponse.json(signature);
  } catch (err) {
    console.error("Failed to load signature", err);
    return NextResponse.json({ error: "Failed to load the signature" }, { status: 500 });
  }
}
