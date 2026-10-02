import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

const HTTP_STATUS = { moved: 200, invalid: 400, not_found: 404 } as const;

// The landlord records a Unit Move: a Current Tenant moving from one flat to another.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/tenants/[id]/unit-move">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const { unitType, unitNumber } = await request.json();
    const outcome = await getLeaseModule().moveUnit(id, {
      unitType: String(unitType ?? ""),
      unitNumber: String(unitNumber ?? ""),
    });
    return NextResponse.json(outcome, { status: HTTP_STATUS[outcome.status] });
  } catch (err) {
    console.error("Failed to record Unit Move", err);
    return NextResponse.json({ error: "Failed to record the move" }, { status: 500 });
  }
}
