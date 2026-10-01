import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLeaseModule, LeaseModule } from "@/lib/lease/lease-module";
import { createFakeMailer, createMemoryStore, fixedClock } from "@/lib/lease/testing";

let lease: LeaseModule;
vi.mock("@/lib/lease/server", () => ({ getLeaseModule: () => lease }));

const { POST } = await import("./route");

const post = (id: string, body: unknown) =>
  POST(
    new NextRequest(`https://lease.example.com/api/signing-links/${id}/identity`, { method: "POST", body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) },
  );

describe("POST /api/signing-links/[id]/identity", () => {
  let id: string;

  beforeEach(async () => {
    const store = createMemoryStore();
    lease = createLeaseModule({
      store,
      mailer: createFakeMailer(),
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
      documentVersions: [
        { version: 1, file: "lease-documents/version-1.pdf", changeNote: "First.", effectiveFrom: "2026-05-01" },
      ],
    });
    const first = await lease.createSigningLink({
      unitType: "Flat",
      unitNumber: "5",
      rent: "1500",
      startDate: "2026-10-15",
      deposit: "1500",
      parkingReservation: false,
    });
    await lease.signLease(first.id, {
      fullName: "Thandi Mokoena",
      email: "thandi@example.com",
      identityType: "sa_id",
      idNumber: "9001015009086",
      passportCountry: "",
      dateOfBirth: "",
      phone: "0821234567",
      carDeclaration: "car",
      signatureName: "Thandi Mokoena",
      signatureDate: "2026-10-05",
      signatureBase64: "data:image/png;base64,AAAA",
    });
    const [tenant] = await store.listTenants();
    ({ id } = await lease.createRenewalLink(tenant.id, { unitType: "Flat", unitNumber: "5", rent: "1650" }));
  });

  it.each([
    ["a wrong number", { identityNumber: "8001015009087" }],
    ["a number that is not text", { identityNumber: 9001015009086 }],
    ["no number", {}],
  ])("refuses %s with 403 and no Tenant details", async (_, body) => {
    const res = await post(id, body);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ status: "wrong_identity" });
  });

  it("returns the details for the right number", async () => {
    const res = await post(id, { identityNumber: "9001015009086" });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "open", tenant: { name: "Thandi Mokoena" } });
  });

  it("answers 429 once the link is blocked", async () => {
    for (let i = 0; i < 5; i++) await post(id, { identityNumber: "0000000000000" });

    const res = await post(id, { identityNumber: "9001015009086" });
    expect(res.status).toBe(429);
  });
});
