// Every Lease Document Version ever used (ADR 0002). To add one, put its PDF in
// public/lease-documents/ and append it here. Never edit or remove an old entry or file:
// signed Leases point to them by number.
import { LeaseDocumentVersion } from "./model";

export const LEASE_DOCUMENT_VERSIONS: readonly LeaseDocumentVersion[] = Object.freeze([
  {
    version: 1,
    file: "lease-documents/version-1.pdf",
    changeNote: "The lease as first used for online signing.",
    effectiveFrom: "2026-05-01",
  },
]);
