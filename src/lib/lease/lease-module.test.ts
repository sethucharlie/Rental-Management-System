import { describe, it, expect, beforeEach } from "vitest";
import { createLeaseModule, InvalidSigningLinkError, LeaseModule } from "./lease-module";
import { createMemoryStore, createFakeMailer, fixedClock, settableClock, FakeMailer, MemoryStore } from "./testing";

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

describe("Tenants and Leases", () => {
  let store: MemoryStore;
  let clock: ReturnType<typeof settableClock>;
  let lease: LeaseModule;

  beforeEach(() => {
    store = createMemoryStore();
    clock = settableClock(new Date("2026-10-05T09:00:00Z"));
    lease = createLeaseModule({
      store,
      mailer: createFakeMailer(),
      clock,
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
    });
  });

  it("lists an unsigned Signing Link as a Lease Awaiting Signature with no Tenant", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });

    expect(await lease.listDashboard()).toEqual([
      { tenant: null, lease: expect.objectContaining({ id, unitNumber: "5", rent: 1500, state: "awaiting_signature" }) },
    ]);
  });

  it("makes the signer a Current Tenant holding a Signed Lease", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);

    const [row, ...rest] = await lease.listDashboard();
    expect(rest).toHaveLength(0);
    expect(row.tenant).toMatchObject({
      name: "Thandi Mokoena",
      identityNumber: "9001015009086",
      dateOfBirth: "1990-01-01",
      state: "current",
      needsDepositAndParking: true,
    });
    expect(row.lease).toMatchObject({ id, state: "signed" });
    expect(await lease.getSignature(id)).toEqual({
      image: "data:image/png;base64,AAAA",
      printedName: "Thandi Mokoena",
      dateSigned: "2026-10-05",
    });
  });

  it("reads a Lease as Ended from the day after its end date, South African time", async () => {
    store.addLegacyRecord(signedLegacy);
    await lease.migrate({ dryRun: false });

    clock.set(new Date("2026-12-31T21:59:00Z")); // 23:59 on 31 December in Johannesburg
    expect((await lease.listDashboard())[0].lease?.state).toBe("signed");

    clock.set(new Date("2026-12-31T22:00:00Z")); // midnight, 1 January
    expect((await lease.listDashboard())[0].lease?.state).toBe("ended");
  });

  it("records a Move Out with the day it happened", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    const result = await lease.updateTenant(tenant!.id, { ...tenantDetails, state: "moved_out" });

    expect(result).toEqual({ status: "saved" });
    expect((await lease.listDashboard())[0].tenant).toMatchObject({ state: "moved_out", movedOutOn: "2026-10-05" });
  });

  it("refuses a Tenant edit with an invalid Identity Number", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    expect(await lease.updateTenant(tenant!.id, { ...tenantDetails, identityNumber: "123", state: "current" })).toEqual({
      status: "invalid",
      error: "Please enter a valid South African ID number.",
    });
  });

  it("deletes a Tenant together with their Leases", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    expect(await lease.deleteTenant(tenant!.id)).toEqual({ status: "deleted" });
    expect(await lease.listDashboard()).toEqual([]);
    expect(await lease.openSigningLink(id)).toEqual({ status: "not_found" });
  });

  it("deletes an unsigned Signing Link but not a signed one", async () => {
    const unsigned = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500" });
    const signed = await lease.createSigningLink({ unitType: "Flat", unitNumber: "6", rent: "1500" });
    await lease.signLease(signed.id, validSubmission);

    expect(await lease.deleteSigningLink(unsigned.id)).toEqual({ status: "deleted" });
    expect(await lease.deleteSigningLink(signed.id)).toEqual({ status: "signed" });
    expect(await lease.openSigningLink(signed.id)).toEqual({ status: "already_signed" });
  });

  describe("migration", () => {
    it("turns a signed record into a Current Tenant with a Signed Lease ending 31 December 2026", async () => {
      store.addLegacyRecord(signedLegacy);

      const report = await lease.migrate({ dryRun: false });

      expect(report).toMatchObject({ migrated: 1, skipped: 0 });
      expect(await lease.listDashboard()).toEqual([
        {
          tenant: expect.objectContaining({
            id: "old-1",
            name: "Sipho Dlamini",
            identityNumber: "9001015009086",
            state: "current",
            depositPaid: null,
            parkingReservation: null,
            needsDepositAndParking: true,
          }),
          lease: expect.objectContaining({ id: "old-1", unitType: "Flat", unitNumber: "3", rent: 1500, endDate: "2026-12-31", state: "signed" }),
        },
      ]);
      expect(await lease.getSignature("old-1")).toEqual({
        image: "data:image/png;base64,BBBB",
        printedName: "Sipho Dlamini",
        dateSigned: "2026-02-01",
      });
      expect(await lease.openSigningLink("old-1")).toEqual({ status: "already_signed" });
    });

    it("trims stray spaces from old details", async () => {
      store.addLegacyRecord({ ...signedLegacy, name: " Sipho Dlamini ", phone: "0831234567 ", idNumber: " 9001015009086" });

      await lease.migrate({ dryRun: false });

      expect((await lease.listDashboard())[0].tenant).toMatchObject({
        name: "Sipho Dlamini",
        phone: "0831234567",
        identityNumber: "9001015009086",
        dateOfBirth: "1990-01-01",
      });
    });

    it("turns people who had moved out or been hidden into Moved Out Tenants", async () => {
      store.addLegacyRecord({ ...signedLegacy, id: "old-1", status: "moved_out", moveOutDate: "2026-06-30T10:00:00.000Z" });
      store.addLegacyRecord({ ...signedLegacy, id: "old-2", status: "archived" });

      await lease.migrate({ dryRun: false });

      const tenants = (await lease.listDashboard()).map((r) => r.tenant);
      expect(tenants).toEqual([
        expect.objectContaining({ id: "old-1", state: "moved_out", movedOutOn: "2026-06-30" }),
        expect.objectContaining({ id: "old-2", state: "moved_out", movedOutOn: null }),
      ]);
    });

    it("turns an unsigned record into a Lease Awaiting Signature whose old link can still be signed", async () => {
      store.addLegacyRecord(unsignedLegacy);

      await lease.migrate({ dryRun: false });

      expect(await lease.listDashboard()).toEqual([
        { tenant: null, lease: expect.objectContaining({ id: "old-2", unitType: "House", rent: 3000, state: "awaiting_signature" }) },
      ]);
      expect(await lease.openSigningLink("old-2")).toEqual({ status: "open" });
      expect(await lease.signLease("old-2", validSubmission)).toEqual({ status: "signed" });
      const [row] = await lease.listDashboard();
      expect(row.tenant?.name).toBe("Thandi Mokoena");
      expect(row.lease).toMatchObject({ id: "old-2", state: "signed" });
    });

    it("creates no duplicates when run twice", async () => {
      store.addLegacyRecord(signedLegacy);
      store.addLegacyRecord(unsignedLegacy);

      await lease.migrate({ dryRun: false });
      const second = await lease.migrate({ dryRun: false });

      expect(second).toMatchObject({ migrated: 0 });
      expect(await lease.listDashboard()).toHaveLength(2);
    });

    it("skips a record whose Lease already exists", async () => {
      store.addLegacyRecord(signedLegacy);
      await lease.migrate({ dryRun: false });
      store.addLegacyRecord(signedLegacy); // say, restored from a backup

      expect(await lease.migrate({ dryRun: false })).toMatchObject({ migrated: 0, skipped: 1 });
      expect(await lease.listDashboard()).toHaveLength(1);
    });

    it("changes nothing on a dry run", async () => {
      store.addLegacyRecord(signedLegacy);
      store.addLegacyRecord(unsignedLegacy);

      const report = await lease.migrate({ dryRun: true });

      expect(report.steps).toEqual([
        { legacyId: "old-1", name: "Sipho Dlamini", becomes: "Signed Lease", outcome: "planned" },
        { legacyId: "old-2", name: "", becomes: "Lease Awaiting Signature", outcome: "planned" },
      ]);
      expect(await lease.listDashboard()).toEqual([]);
    });
  });
});

const signedLegacy = {
  id: "old-1",
  name: "Sipho Dlamini",
  email: "sipho@example.com",
  phone: "0831234567",
  idNumber: "9001015009086",
  unitType: "Flat",
  unitNumber: "3",
  rent: "1500",
  status: "active",
  isSigned: true,
  signatureBase64: "data:image/png;base64,BBBB",
  signatureName: "Sipho Dlamini",
  signatureDate: "2026-02-01",
  createdAt: new Date("2026-01-20T08:00:00Z"),
  submittedAt: new Date("2026-02-01T10:00:00Z"),
};

const unsignedLegacy = {
  id: "old-2",
  unitType: "House",
  unitNumber: "1",
  rent: 3000,
  status: "pending",
  isSigned: false,
  createdAt: new Date("2026-09-01T08:00:00Z"),
};

const tenantDetails = {
  name: "Thandi Mokoena",
  email: "thandi@example.com",
  identityNumber: "9001015009086",
  phone: "0821234567",
};

const validSubmission = {
  fullName: "Thandi Mokoena",
  email: "thandi@example.com",
  idNumber: "9001015009086",
  phone: "0821234567",
  signatureName: "Thandi Mokoena",
  signatureDate: "2026-10-05",
  signatureBase64: "data:image/png;base64,AAAA",
};
