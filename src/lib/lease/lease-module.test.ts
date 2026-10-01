import { describe, it, expect, beforeEach } from "vitest";
import { createLeaseModule, InvalidSigningLinkError, LeaseModule } from "./lease-module";
import { createMemoryStore, createFakeMailer, fixedClock, settableClock, FakeMailer, MemoryStore } from "./testing";
import { LeaseDocumentVersion } from "./model";
import { LEASE_DOCUMENT_VERSIONS } from "./document-versions";
import { existsSync } from "fs";
import path from "path";

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
      documentVersions: [versionOne],
    });
  });

  it("opens a Signing Link the landlord created", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.openSigningLink(id)).toMatchObject({ status: "open" });
  });

  it.each([
    ["an unknown unit type", { unitType: "Shed" }],
    ["a blank unit number", { unitNumber: " " }],
    ["a rent that is not a positive number", { rent: "-5" }],
    ["a rent that is not a number", { rent: "abc" }],
    ["no start date", { startDate: "" }],
    ["a start date that does not exist", { startDate: "2026-02-30" }],
    ["a blank deposit", { deposit: "" }],
    ["a negative deposit", { deposit: "-1" }],
  ])("refuses to create a Signing Link with %s", async (_, change) => {
    await expect(
      lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms, ...change }),
    ).rejects.toThrow(InvalidSigningLinkError);
  });

  it("reports a Signing Link that does not exist", async () => {
    expect(await lease.openSigningLink("no-such-link")).toEqual({ status: "not_found" });
  });

  it("shows a signed Signing Link as already signed", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.signLease(id, validSubmission)).toEqual({ status: "signed" });
    expect(await lease.openSigningLink(id)).toEqual({ status: "already_signed" });
  });

  it("refuses to sign the same Signing Link twice", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
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
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.signLease(id, { ...validSubmission, ...change })).toEqual({ status: "invalid", error });
    expect(await lease.openSigningLink(id)).toMatchObject({ status: "open" });
  });

  it("emails the Tenant the Lease Document and tells the landlord after signing", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
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
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
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
      documentVersions: [versionOne],
    });
    const { id } = await failing.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

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
      documentVersions: [versionOne],
    });
  });

  it("lists an unsigned Signing Link as a Lease Awaiting Signature with no Tenant", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.listDashboard()).toEqual([
      { tenant: null, lease: expect.objectContaining({ id, unitNumber: "5", rent: 1500, state: "awaiting_signature" }) },
    ]);
  });

  it("makes the signer a Current Tenant holding a Signed Lease", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    await lease.signLease(id, validSubmission);

    const [row, ...rest] = await lease.listDashboard();
    expect(rest).toHaveLength(0);
    expect(row.tenant).toMatchObject({
      name: "Thandi Mokoena",
      identityNumber: "9001015009086",
      dateOfBirth: "1990-01-01",
      state: "current",
      needsDepositAndParking: false, // the Signing Link carried both
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
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    const result = await lease.updateTenant(tenant!.id, { ...tenantDetails, state: "moved_out" });

    expect(result).toEqual({ status: "saved" });
    expect((await lease.listDashboard())[0].tenant).toMatchObject({ state: "moved_out", movedOutOn: "2026-10-05" });
  });

  it("refuses a Tenant edit with an invalid Identity Number", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    expect(await lease.updateTenant(tenant!.id, { ...tenantDetails, identityNumber: "123", state: "current" })).toEqual({
      status: "invalid",
      error: "Please enter a valid South African ID number.",
    });
  });

  it("deletes a Tenant together with their Leases", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    await lease.signLease(id, validSubmission);
    const [{ tenant }] = await lease.listDashboard();

    expect(await lease.deleteTenant(tenant!.id)).toEqual({ status: "deleted" });
    expect(await lease.listDashboard()).toEqual([]);
    expect(await lease.openSigningLink(id)).toEqual({ status: "not_found" });
  });

  it("deletes an unsigned Signing Link but not a signed one", async () => {
    const unsigned = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    const signed = await lease.createSigningLink({ unitType: "Flat", unitNumber: "6", rent: "1500", ...firstLeaseTerms });
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
      expect(await lease.openSigningLink("old-2")).toMatchObject({ status: "open" });
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

describe("Lease Document Versions", () => {
  let store: MemoryStore;
  let versions: LeaseDocumentVersion[];
  let mailer: FakeMailer;
  let lease: LeaseModule;

  beforeEach(() => {
    store = createMemoryStore();
    versions = [versionOne];
    mailer = createFakeMailer();
    lease = createLeaseModule({
      store,
      mailer,
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
      documentVersions: versions,
    });
  });

  const versionTwo = {
    version: 2,
    file: "lease-documents/version-2.pdf",
    changeNote: "Adds the parking clause.",
    effectiveFrom: "2026-10-01",
  };

  it("offers the signer the version their Signing Link was created on", async () => {
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.openSigningLink(id)).toMatchObject({
      status: "open",
      document: { version: 1, url: "/lease-documents/version-1.pdf" },
    });
  });

  it("gives a new Signing Link the latest version, and an older Lease keeps its own", async () => {
    const older = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    versions.push(versionTwo);
    const newer = await lease.createSigningLink({ unitType: "Flat", unitNumber: "6", rent: "1500", ...firstLeaseTerms });

    expect(await lease.openSigningLink(older.id)).toMatchObject({ document: { version: 1 } });
    expect(await lease.openSigningLink(newer.id)).toMatchObject({ document: { version: 2 } });
  });

  it("does not use a version before the day it takes effect", async () => {
    versions.push({ ...versionTwo, effectiveFrom: "2026-11-01" });
    const { id } = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });

    expect(await lease.openSigningLink(id)).toMatchObject({ document: { version: 1 } });
  });

  it("emails the Tenant the version they signed", async () => {
    const older = await lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
    versions.push(versionTwo);
    await lease.signLease(older.id, validSubmission);

    const attached = mailer.sent.find((m) => m.to === "thandi@example.com")?.attachments?.[0].path;
    expect(attached?.replace(/\\/g, "/")).toMatch(/public\/lease-documents\/version-1\.pdf$/);
  });

  it("points every migrated Lease to Version 1", async () => {
    store.addLegacyRecord(signedLegacy);
    store.addLegacyRecord(unsignedLegacy);
    versions.push(versionTwo);

    await lease.migrate({ dryRun: false });

    expect((await store.getLease("old-1"))?.documentVersion).toBe(1);
    expect(await lease.openSigningLink("old-2")).toMatchObject({ document: { version: 1 } });
  });

  it("offers no way to edit or delete a version", () => {
    const changesVersions = Object.keys(lease).filter((name) => /(edit|update|delete|remove).*(version|document)/i.test(name));

    expect(changesVersions).toEqual([]);
  });

  it("registers Version 1, numbers versions 1, 2, 3 in order, and ships each file", () => {
    expect(LEASE_DOCUMENT_VERSIONS[0]).toMatchObject({ version: 1, file: "lease-documents/version-1.pdf" });
    LEASE_DOCUMENT_VERSIONS.forEach((v, i) => {
      expect(v.version).toBe(i + 1);
      expect(v.changeNote.trim()).not.toBe("");
      expect(existsSync(path.join(process.cwd(), "public", v.file))).toBe(true);
    });
  });
});

describe("Signing Link for a first Lease", () => {
  let mailer: FakeMailer;
  let lease: LeaseModule;

  beforeEach(() => {
    mailer = createFakeMailer();
    lease = createLeaseModule({
      store: createMemoryStore(),
      mailer,
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
      documentVersions: [versionOne],
    });
  });

  const link = (terms: Partial<typeof firstLeaseTerms> = {}, unitNumber = "5") =>
    lease.createSigningLink({ unitType: "Flat", unitNumber, rent: "1500", ...firstLeaseTerms, ...terms });

  it.each([
    ["31 October", "2026-10-31", "2026-12-31"],
    ["1 November", "2026-11-01", "2027-12-31"],
    ["31 December", "2026-12-31", "2027-12-31"],
  ])("ends a first Lease starting %s on %s's 31 December", async (_, startDate, endDate) => {
    await link({ startDate });

    const [row] = await lease.listDashboard();
    expect(row.lease).toMatchObject({ startDate, endDate });
  });

  it("saves the Deposit and Parking Reservation on the Tenant who signs", async () => {
    const { id } = await link({ deposit: "1400", parkingReservation: true });
    await lease.signLease(id, validSubmission);

    const [row] = await lease.listDashboard();
    expect(row.tenant).toMatchObject({ depositPaid: 1400, parkingReservation: true, needsDepositAndParking: false });
    expect(row.lease).toMatchObject({ startDate: "2026-10-15", endDate: "2026-12-31" });
  });

  it("refuses a third Parking Reservation but still allows a link without one", async () => {
    const first = await link({ parkingReservation: true }, "1");
    await lease.signLease(first.id, validSubmission);
    await link({ parkingReservation: true }, "2");

    await expect(link({ parkingReservation: true }, "3")).rejects.toThrow("Both Parking Bays are already reserved.");
    await expect(link({ parkingReservation: false }, "3")).resolves.toHaveProperty("id");
  });

  it("frees a bay when an unsigned link is deleted or its holder moves out", async () => {
    const signed = await link({ parkingReservation: true }, "1");
    await lease.signLease(signed.id, validSubmission);
    const unsigned = await link({ parkingReservation: true }, "2");

    await lease.deleteSigningLink(unsigned.id);
    await expect(link({ parkingReservation: true }, "3")).resolves.toHaveProperty("id");

    const tenant = (await lease.listDashboard()).find((r) => r.tenant)!.tenant!;
    await lease.updateTenant(tenant.id, { ...tenantDetails, state: "moved_out" });
    await expect(link({ parkingReservation: true }, "4")).resolves.toHaveProperty("id");
  });

  it("emails the link to the Tenant", async () => {
    const { id } = await link();

    expect(await lease.emailSigningLink(id, " thandi@example.com ")).toEqual({ status: "sent" });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("thandi@example.com");
    expect(mailer.sent[0].html).toContain(`https://lease.example.com/lease/sign/${id}`);
    expect(mailer.sent[0].html).toContain("15 October 2026 to 31 December 2026");
  });

  it("refuses to email a link to a bad address, or one that is signed or gone", async () => {
    const { id } = await link();

    expect(await lease.emailSigningLink(id, "thandi")).toEqual({
      status: "invalid",
      error: "Please enter a valid email address.",
    });
    expect(await lease.emailSigningLink("no-such-link", "thandi@example.com")).toEqual({ status: "not_found" });
    await lease.signLease(id, validSubmission);
    mailer.sent.length = 0;
    expect(await lease.emailSigningLink(id, "thandi@example.com")).toEqual({ status: "already_signed" });
    expect(mailer.sent).toHaveLength(0);
  });
});

describe("First-Lease form", () => {
  let store: MemoryStore;
  let lease: LeaseModule;

  beforeEach(() => {
    store = createMemoryStore();
    lease = createLeaseModule({
      store,
      mailer: createFakeMailer(),
      clock: fixedClock(new Date("2026-10-05T09:00:00Z")),
      landlordEmail: "landlord@example.com",
      appUrl: "https://lease.example.com",
      documentVersions: [versionOne],
    });
  });

  const link = () => lease.createSigningLink({ unitType: "Flat", unitNumber: "5", rent: "1500", ...firstLeaseTerms });
  const signedTenant = async () => (await lease.listDashboard())[0].tenant;

  const passport = {
    identityType: "passport",
    idNumber: " A1234567 ",
    passportCountry: " Zimbabwe ",
    dateOfBirth: "1992-07-14",
  };

  describe("SA ID", () => {
    it.each([
      ["9001015009086", "1990-01-01"],
      ["0503125009087", "2005-03-12"],
      ["3006155009081", "1930-06-15"], // 2030 lies in the future, so 1930
    ])("works out the date of birth of %s as %s", async (idNumber, dateOfBirth) => {
      const { id } = await link();
      await lease.signLease(id, { ...validSubmission, idNumber });

      expect(await signedTenant()).toMatchObject({ identityNumberType: "sa_id", identityNumber: idNumber, dateOfBirth });
    });

    it.each([
      ["a wrong check digit", "9001015009087"],
      ["12 digits", "900101500908"],
      ["a letter", "90010150090A6"],
      ["a month that does not exist", "9013015009081"],
      ["29 February in a year that has none", "0102295009082"],
    ])("refuses an ID with %s", async (_, idNumber) => {
      const { id } = await link();

      expect(await lease.signLease(id, { ...validSubmission, idNumber })).toEqual({
        status: "invalid",
        error: "Please enter a valid South African ID number.",
      });
    });

    it("takes the date of birth from the ID, not from the form, and stores no passport country", async () => {
      const { id } = await link();
      await lease.signLease(id, { ...validSubmission, dateOfBirth: "1999-09-09", passportCountry: "Zimbabwe" });

      expect(await signedTenant()).toMatchObject({ dateOfBirth: "1990-01-01", passportCountry: null });
    });
  });

  describe("passport", () => {
    it("saves the passport number, issuing country and date of birth", async () => {
      const { id } = await link();

      expect(await lease.signLease(id, { ...validSubmission, ...passport })).toEqual({ status: "signed" });
      expect(await signedTenant()).toMatchObject({
        identityNumberType: "passport",
        identityNumber: "A1234567",
        passportCountry: "Zimbabwe",
        dateOfBirth: "1992-07-14",
      });
    });

    it.each([
      ["no number", { idNumber: "  " }, "Please enter your passport number."],
      ["no issuing country", { passportCountry: "" }, "Please enter the country that issued your passport."],
      ["no date of birth", { dateOfBirth: "" }, "Please enter your date of birth."],
      ["a date of birth that does not exist", { dateOfBirth: "1992-02-30" }, "Please enter your date of birth."],
      ["a date of birth in the future", { dateOfBirth: "2026-10-06" }, "Please enter your date of birth."],
    ])("refuses a passport with %s and leaves the link open", async (_, change, error) => {
      const { id } = await link();

      expect(await lease.signLease(id, { ...validSubmission, ...passport, ...change })).toEqual({ status: "invalid", error });
      expect(await lease.openSigningLink(id)).toMatchObject({ status: "open" });
    });
  });

  it("refuses a submission that names neither SA ID nor passport", async () => {
    const { id } = await link();

    expect(await lease.signLease(id, { ...validSubmission, identityType: "drivers_licence" })).toEqual({
      status: "invalid",
      error: "Please choose South African ID or passport.",
    });
  });

  it.each([
    ["car", "car"],
    ["no_car", "no_car"],
  ] as const)("saves a Car Declaration of %s on the Lease", async (_, carDeclaration) => {
    const { id } = await link();
    await lease.signLease(id, { ...validSubmission, carDeclaration });

    expect((await store.getLease(id))?.carDeclaration).toBe(carDeclaration);
    expect((await lease.listDashboard())[0].lease).toMatchObject({ carDeclaration });
  });

  it.each(["", "maybe"])("refuses a Car Declaration of %j", async (carDeclaration) => {
    const { id } = await link();

    expect(await lease.signLease(id, { ...validSubmission, carDeclaration })).toEqual({
      status: "invalid",
      error: "Please say whether you have a car.",
    });
  });

  it("shows the Lease Schedule the landlord set on an open link", async () => {
    const { id } = await link();

    expect(await lease.openSigningLink(id)).toMatchObject({
      status: "open",
      schedule: {
        unitType: "Flat",
        unitNumber: "5",
        rent: 1500,
        startDate: "2026-10-15",
        endDate: "2026-12-31",
        deposit: 1500,
      },
    });
  });

  it("shows a migrated link's Lease Schedule with the dates and Deposit left blank", async () => {
    store.addLegacyRecord(unsignedLegacy);
    await lease.migrate({ dryRun: false });

    expect(await lease.openSigningLink("old-2")).toMatchObject({
      schedule: { unitType: "House", unitNumber: "1", rent: 3000, startDate: null, endDate: null, deposit: null },
    });
  });

  it("lets the landlord edit a passport Tenant without losing their country or date of birth", async () => {
    const { id } = await link();
    await lease.signLease(id, { ...validSubmission, ...passport });
    const tenant = await signedTenant();
    const edit = { ...tenantDetails, identityNumber: "B7654321", state: "current" as const };

    expect(await lease.updateTenant(tenant!.id, edit)).toEqual({ status: "saved" });
    expect(await signedTenant()).toMatchObject({
      identityNumberType: "passport",
      identityNumber: "B7654321",
      passportCountry: "Zimbabwe",
      dateOfBirth: "1992-07-14",
    });
    expect(await lease.updateTenant(tenant!.id, { ...edit, identityNumber: " " })).toEqual({
      status: "invalid",
      error: "Please fill in every field.",
    });
  });
});

const firstLeaseTerms = { startDate: "2026-10-15", deposit: "1500", parkingReservation: false };

const versionOne: LeaseDocumentVersion = {
  version: 1,
  file: "lease-documents/version-1.pdf",
  changeNote: "The lease as first used for online signing.",
  effectiveFrom: "2026-05-01",
};

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
  identityType: "sa_id",
  idNumber: "9001015009086",
  passportCountry: "",
  dateOfBirth: "",
  phone: "0821234567",
  carDeclaration: "no_car",
  signatureName: "Thandi Mokoena",
  signatureDate: "2026-10-05",
  signatureBase64: "data:image/png;base64,AAAA",
};
