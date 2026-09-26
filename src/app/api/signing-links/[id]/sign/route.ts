import { NextRequest, NextResponse } from "next/server";
import { getLeaseModule } from "@/lib/lease/server";

const HTTP_STATUS = { signed: 200, invalid: 400, not_found: 404, already_signed: 409 } as const;

// The Tenant submits their details and signature.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/signing-links/[id]/sign">) {
  const { id } = await ctx.params;
  try {
    const body = await request.json();
    const text = (key: string) => (typeof body?.[key] === "string" ? body[key] : "");
    const outcome = await getLeaseModule().signLease(id, {
      fullName: text("fullName"),
      email: text("email"),
      idNumber: text("idNumber"),
      phone: text("phone"),
      signatureName: text("signatureName"),
      signatureDate: text("signatureDate"),
      signatureBase64: text("signatureBase64"),
    });
    return NextResponse.json(outcome, { status: HTTP_STATUS[outcome.status] });
  } catch (err) {
    console.error("Failed to sign lease", err);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
