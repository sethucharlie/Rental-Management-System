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

// Returns the first problem as a message for the Tenant, or null if all is well.
export function findSubmissionError(s: SubmissionFields): string | null {
  const textFields = [s.fullName, s.email, s.idNumber, s.phone, s.signatureName, s.signatureDate];
  if (textFields.some((field) => typeof field !== "string" || !field.trim())) {
    return "Please fill in every field.";
  }
  if (!s.signatureBase64?.startsWith("data:image/png;base64,")) return "Please provide a signature.";
  if (!isValidEmail(s.email)) return "Please enter a valid email address.";
  if (!isValidSAId(s.idNumber)) return "Please enter a valid South African ID number.";
  if (!isValidPhone(s.phone)) return "Please enter a valid South African phone number.";
  return null;
}
