import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLeaseModule, LeaseModule } from "@/lib/lease/lease-module";
import { createFakeMailer, createMemoryStore, fixedClock } from "@/lib/lease/testing";

let lease: LeaseModule;
vi.mock("@/lib/lease/server", () => ({ getLeaseModule: () => lease }));

const { POST } = await import("./route");

// Posts straight to the route, as anyone could without the signing page's checks.
const post = (id: string, body: unknown) =>
  POST(new NextRequest(`https://lease.example.com/api/signing-links/${id}/sign`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });

describe("POST /api/signing-links/[id]/sign", () => {
  let id: string;

  beforeEach(async () => {
    lease = createLeaseModule({
      store: createMemoryStore(),
      mailer: createFakeMailer(),
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
      documentVersions: [
        { version: 1, file: "lease-documents/version-1.pdf", changeNote: "First.", effectiveFrom: "2026-05-01" },
      ],
    });
    ({ id } = await lease.createSigningLink({
      unitType: "Flat",
      unitNumber: "5",
      rent: "1500",
      startDate: "2026-10-15",
      deposit: "1500",
      parkingReservation: false,
    }));
  });

  it.each([
    ["an SA ID with a wrong check digit", { idNumber: "9001015009087" }],
    ["a passport with no issuing country", { identityType: "passport", idNumber: "A1234567", dateOfBirth: "1992-07-14" }],
    ["a passport with no date of birth", { identityType: "passport", idNumber: "A1234567", passportCountry: "Zimbabwe" }],
    ["no Car Declaration", { carDeclaration: undefined }],
    ["fields that are not text", { idNumber: 9001015009086, carDeclaration: true }],
  ])("refuses %s with 400 and leaves the link open", async (_, change) => {
    const res = await post(id, { ...submission, ...change });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ status: "invalid", error: expect.any(String) });
    expect(await lease.openSigningLink(id)).toMatchObject({ status: "open" });
  });

  it("signs a valid passport submission", async () => {
    const res = await post(id, {
      ...submission,
      identityType: "passport",
      idNumber: "A1234567",
      passportCountry: "Zimbabwe",
      dateOfBirth: "1992-07-14",
    });

    expect(res.status).toBe(200);
    expect(await lease.openSigningLink(id)).toEqual({ status: "already_signed" });
  });
});

const submission = {
  fullName: "Thandi Mokoena",
  email: "thandi@example.com",
  identityType: "sa_id",
  idNumber: "9001015009086",
  phone: "0821234567",
  carDeclaration: "car",
  signatureName: "Thandi Mokoena",
  signatureDate: "2026-10-05",
  signatureBase64: "data:image/png;base64,AAAA",
};
