// Shared by the signing page (for quick feedback) and the server (which decides).

export const isValidSAId = (id: string) => {
  if (!/^\d{13}$/.test(id)) return false;

  // Luhn checksum
  let total = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(id[i]);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
  }
  return total % 10 === 0;
};

export const isValidPhone = (phone: string) => /^0\d{9}$/.test(phone);

// One plain address only: no lists, no display names. The server emails the lease to it.
export const isValidEmail = (email: string) => /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email);

export interface SubmissionFields {
  fullName: string;
  email: string;
  idNumber: string;
  phone: string;
  signatureName: string;
  signatureDate: string;
  signatureBase64: string;
}

const isBlank = (field: unknown) => typeof field !== "string" || !field.trim();

// Returns the first problem as a message for the Tenant, or null if all is well.
export function findSubmissionError(s: SubmissionFields): string | null {
  if ([s.fullName, s.email, s.idNumber, s.phone, s.signatureName, s.signatureDate].some(isBlank)) {
    return "Please fill in every field.";
  }
  if (!s.signatureBase64?.startsWith("data:image/png;base64,")) return "Please provide a signature.";
  return findContactError(s.email, s.idNumber, s.phone);
}

export interface TenantDetailsFields {
  name: string;
  email: string;
  identityNumber: string;
  phone: string;
}

// The landlord's edits to a Tenant pass the same checks as signing.
export function findTenantDetailsError(d: TenantDetailsFields): string | null {
  if ([d.name, d.email, d.identityNumber, d.phone].some(isBlank)) return "Please fill in every field.";
  return findContactError(d.email, d.identityNumber, d.phone);
}

function findContactError(email: string, idNumber: string, phone: string): string | null {
  if (!isValidEmail(email)) return "Please enter a valid email address.";
  if (!isValidSAId(idNumber)) return "Please enter a valid South African ID number.";
  if (!isValidPhone(phone)) return "Please enter a valid South African phone number.";
  return null;
}
