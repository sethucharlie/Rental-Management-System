import { NextResponse } from "next/server";
import { InvalidSigningLinkError } from "@/lib/lease/lease-module";
import { getLeaseModule, isLandlordRequest } from "@/lib/lease/server";

// The landlord creates a Signing Link for a new Tenant.
export async function POST(request: Request) {
  if (!(await isLandlordRequest(request))) {
    return NextResponse.json({ error: "Not signed in as the landlord" }, { status: 401 });
  }
  try {
    const { unitType, unitNumber, rent, startDate, deposit, parkingReservation } = await request.json();
    const { id } = await getLeaseModule().createSigningLink({
      unitType: String(unitType ?? ""),
      unitNumber: String(unitNumber ?? ""),
      rent: String(rent ?? ""),
      startDate: String(startDate ?? ""),
      deposit: String(deposit ?? ""),
      parkingReservation: parkingReservation === true,
    });
    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof InvalidSigningLinkError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Failed to create Signing Link", err);
    return NextResponse.json({ error: "Failed to create the link" }, { status: 500 });
  }
}
