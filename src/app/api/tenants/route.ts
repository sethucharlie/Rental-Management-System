import { NextResponse } from "next/server";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The dashboard: each Tenant with their current Lease, unsigned Signing Links, and who holds
// the Parking Bays.
export async function GET(request: Request) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  try {
    const lease = getLeaseModule();
    const [rows, parking] = await Promise.all([lease.listDashboard(), lease.parkingSummary()]);
    return NextResponse.json({ rows, parking });
  } catch (err) {
    console.error("Failed to list Tenants", err);
    return NextResponse.json({ error: "Failed to load Tenants" }, { status: 500 });
  }
}
