import { NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The dashboard's list: each Tenant with their current Lease, and unsigned Signing Links.
export async function GET(request: Request) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  try {
    return NextResponse.json({ rows: await getLeaseModule().listDashboard() });
  } catch (err) {
    console.error("Failed to list Tenants", err);
    return NextResponse.json({ error: "Failed to load Tenants" }, { status: 500 });
  }
}
