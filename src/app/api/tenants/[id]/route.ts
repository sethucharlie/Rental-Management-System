import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

const HTTP_STATUS = { saved: 200, deleted: 200, invalid: 400, not_found: 404 } as const;

// The landlord edits a Tenant's details or moves them out.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/tenants/[id]">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const text = (key: string) => (typeof body?.[key] === "string" ? body[key] : "");
    const outcome = await getLeaseModule().updateTenant(id, {
      name: text("name"),
      email: text("email"),
      identityNumber: text("identityNumber"),
      phone: text("phone"),
      state: body?.state,
    });
    return NextResponse.json(outcome, { status: HTTP_STATUS[outcome.status] });
  } catch (err) {
    console.error("Failed to update Tenant", err);
    return NextResponse.json({ error: "Failed to save the Tenant" }, { status: 500 });
  }
}

// The landlord deletes a Tenant and all their Leases.
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/tenants/[id]">) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  const { id } = await ctx.params;
  try {
    const outcome = await getLeaseModule().deleteTenant(id);
    return NextResponse.json(outcome, { status: outcome.status === "deleted" ? 200 : 404 });
  } catch (err) {
    console.error("Failed to delete Tenant", err);
    return NextResponse.json({ error: "Failed to delete the Tenant" }, { status: 500 });
  }
}
