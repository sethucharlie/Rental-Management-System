// Shared by the signing page (for quick feedback) and the server (which decides).
import { dateOfBirthFromSAId, IdentityNumberType, isRealDate } from "./model";

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

export const isCarDeclaration = (answer: string) => answer === "car" || answer === "no_car";

export const isIdentityNumberType = (type: string): type is IdentityNumberType => type === "sa_id" || type === "passport";

const SA_ID_ERROR = "Please enter a valid South African ID number.";

export interface SubmissionFields {
  fullName: string;
  email: string;
  identityType: string; // "sa_id" or "passport"
  idNumber: string; // the SA ID or passport number
  passportCountry: string; // passport only
  dateOfBirth: string; // YYYY-MM-DD, passport only; an SA ID carries its own
  phone: string;
  carDeclaration: string; // "car" or "no_car"
  signatureName: string;
  signatureDate: string;
  signatureBase64: string;
}

const isBlank = (field: unknown) => typeof field !== "string" || !field.trim();

// Returns the first problem as a message for the Tenant, or null if all is well.
// `today` is YYYY-MM-DD, to refuse a date of birth in the future.
export function findSubmissionError(s: SubmissionFields, today: string): string | null {
  if ([s.fullName, s.email, s.phone, s.signatureName, s.signatureDate].some(isBlank)) {
    return "Please fill in every field.";
  }
  if (!s.signatureBase64?.startsWith("data:image/png;base64,")) return "Please provide a signature.";
  if (!isValidEmail(s.email)) return "Please enter a valid email address.";
  const identityError = findIdentityError(s, today);
  if (identityError) return identityError;
  if (!isValidPhone(s.phone)) return "Please enter a valid South African phone number.";
  if (!isCarDeclaration(s.carDeclaration)) return "Please say whether you have a car.";
  return null;
}

function findIdentityError(s: SubmissionFields, today: string): string | null {
  if (s.identityType === "sa_id") {
    // The ID must also hold a real date of birth.
    return isValidSAId(s.idNumber) && dateOfBirthFromSAId(s.idNumber, today) ? null : SA_ID_ERROR;
  }
  if (s.identityType !== "passport") return "Please choose South African ID or passport.";
  if (isBlank(s.idNumber)) return "Please enter your passport number.";
  if (isBlank(s.passportCountry)) return "Please enter the country that issued your passport.";
  if (!isRealDate(s.dateOfBirth) || s.dateOfBirth > today) return "Please enter your date of birth.";
  return null;
}

export interface TenantDetailsFields {
  name: string;
  email: string;
  identityNumber: string;
  phone: string;
}

// The landlord's edits to a Tenant pass the same checks as signing. The Tenant's
// Identity Number type does not change, so a passport number need only be filled in.
export function findTenantDetailsError(d: TenantDetailsFields, identityType: IdentityNumberType): string | null {
  if ([d.name, d.email, d.identityNumber, d.phone].some(isBlank)) return "Please fill in every field.";
  if (!isValidEmail(d.email)) return "Please enter a valid email address.";
  if (identityType === "sa_id" && !isValidSAId(d.identityNumber)) return SA_ID_ERROR;
  if (!isValidPhone(d.phone)) return "Please enter a valid South African phone number.";
  return null;
}
