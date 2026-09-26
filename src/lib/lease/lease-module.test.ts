import { describe, it, expect, beforeEach } from "vitest";
import { createLeaseModule, InvalidSigningLinkError, LeaseModule } from "./lease-module";
import { createMemoryStore, createFakeMailer, fixedClock, FakeMailer } from "./testing";

describe("Lease module", () => {
  let lease: LeaseModule;
  let mailer: FakeMailer;

  beforeEach(() => {
    mailer = createFakeMailer();
    lease = createLeaseModule({
      store: createMemoryStore(),
      mailer,
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
    });
  });

  it("opens a Signing Link the landlord created", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });

    expect(await lease.openSigningLink(id)).toEqual({ status: "open" });
  });

  it.each([
    ["an unknown unit type", { unitType: "Shed" }],
    ["a blank unit number", { unitNumber: " " }],
    ["a rent that is not a positive number", { rent: "-5" }],
    ["a rent that is not a number", { rent: "abc" }],
  ])("refuses to create a Signing Link with %s", async (_, change) => {
    await expect(
      lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...change }),
    ).rejects.toThrow(InvalidSigningLinkError);
  });

  it("reports a Signing Link that does not exist", async () => {
    expect(await lease.openSigningLink("no-such-link")).toEqual({ status: "not_found" });
  });

  it("shows a signed Signing Link as already signed", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });

    expect(await lease.signLease(id, validSubmission)).toEqual({ status: "signed" });
    expect(await lease.openSigningLink(id)).toEqual({ status: "already_signed" });
  });

  it("refuses to sign the same Signing Link twice", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);

    expect(await lease.signLease(id, { ...validSubmission, fullName: "Someone Else" })).toEqual({
      status: "already_signed",
    });
  });

  it.each([
    ["an SA ID with a wrong check digit", { idNumber: "9001015009087" }, "Please enter a valid South African ID number."],
    ["an SA ID that is too short", { idNumber: "900101500908" }, "Please enter a valid South African ID number."],
    ["a phone number not starting with 0", { phone: "8212345678" }, "Please enter a valid South African phone number."],
    ["a missing name", { fullName: "  " }, "Please fill in every field."],
    ["an email that is not an address", { email: "thandi" }, "Please enter a valid email address."],
    ["more than one email address", { email: "a@x.com, b@y.com" }, "Please enter a valid email address."],
    ["an email with a display name", { email: "Thandi <a@x.com>" }, "Please enter a valid email address."],
    ["a missing signature", { signatureBase64: "" }, "Please provide a signature."],
  ])("refuses %s and leaves the link open", async (_, change, error) => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });

    expect(await lease.signLease(id, { ...validSubmission, ...change })).toEqual({ status: "invalid", error });
    expect(await lease.openSigningLink(id)).toEqual({ status: "open" });
  });

  it("emails the Tenant the Lease Document and tells the landlord after signing", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);

    const toTenant = mailer.sent.find((m) => m.to === "thandi@example.com");
    const toLandlord = mailer.sent.find((m) => m.to === "landlord@example.com");
    expect(mailer.sent).toHaveLength(2);
    expect(toTenant?.html).toContain("Thandi Mokoena");
    expect(toTenant?.attachments?.[0].filename).toBe("Lease_Agreement.pdf");
    expect(toLandlord?.html).toContain("thandi@example.com");
    expect(toLandlord?.html).toContain("https://lease.example.com/dashboard/tenants");
  });

  it("sends no email when signing is refused", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, { ...validSubmission, phone: "123" });
    await lease.signLease("no-such-link", validSubmission);

    expect(mailer.sent).toHaveLength(0);
  });

  it("keeps the Lease signed when the email fails", async () => {
    const failing = createLeaseModule({
      store: createMemoryStore(),
      mailer: { send: async () => { throw new Error("SMTP down"); } },
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
    });
    const { id } = await failing.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });

    expect(await failing.signLease(id, validSubmission)).toEqual({ status: "signed" });
    expect(await failing.openSigningLink(id)).toEqual({ status: "already_signed" });
  });
});

const validSubmission = {
  fullName: "Thandi Mokoena",
  email: "thandi@example.com",
  idNumber: "9001015009086",
  phone: "0821234567",
  signatureName: "Thandi Mokoena",
  signatureDate: "2026-10-05",
  signatureBase64: "data:image/png;base64,AAAA",
};
