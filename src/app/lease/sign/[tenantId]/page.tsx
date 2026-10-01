"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { dateInSouthAfrica } from "@/lib/lease/model";
import { findSubmissionError } from "@/lib/lease/validation";
import type { DocumentView, LeaseScheduleView, RenewalTenantView } from "@/lib/lease/views";

const INPUT_CLASS = "flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none w-full min-w-0";

// YYYY-MM-DD to "15 October 2026"; a migrated link may have no dates yet.
const formatDate = (date: string | null) =>
  date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : "To be confirmed";

export default function LeaseSignPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const router = useRouter();
  const signatureRef = useRef<SignaturePadRef>(null);
  const [agreed, setAgreed] = useState(false);
  const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [docExists, setDocExists] = useState(true);
  const [leaseDocument, setLeaseDocument] = useState<DocumentView | null>(null);
  const [schedule, setSchedule] = useState<LeaseScheduleView | null>(null);
  const [showPopia, setShowPopia] = useState(true);
  // A Renewal opens only after the Tenant gives the Identity Number on record.
  const [identityRequired, setIdentityRequired] = useState(false);
  const [identityInput, setIdentityInput] = useState("");
  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const [renewalTenant, setRenewalTenant] = useState<RenewalTenantView | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    identityType: "",
    idNumber: "",
    passportCountry: "",
    dateOfBirth: "",
    phone: "",
    carDeclaration: "",
    signatureName: "",
    signatureDate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  // Id validation
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/signing-links/${encodeURIComponent(tenantId)}`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const result = await res.json();
        if (result.status === "not_found") {
          setDocExists(false);
        } else if (result.status === "already_signed") {
          setAlreadySigned(true);
        } else if (result.status === "identity_required") {
          setIdentityRequired(true);
        } else {
          setLeaseDocument(result.document);
          setSchedule(result.schedule);
        }
      } catch (err) {
        console.error("Failed to load lease info", err);
        setDocExists(false);
      } finally {
        setLoadingDoc(false);
      }
    };
    fetchDoc();
  }, [tenantId]);

  const passport = formData.identityType === "passport";
  const renewal = renewalTenant !== null;

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCheckingIdentity(true);
    try {
      const res = await fetch(`/api/signing-links/${encodeURIComponent(tenantId)}/identity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityNumber: identityInput }),
      });
      const result = await res.json();
      switch (result.status) {
        case "open": {
          const tenant: RenewalTenantView = result.tenant;
          setLeaseDocument(result.document);
          setSchedule(result.schedule);
          setRenewalTenant(tenant);
          setFormData((prev) => ({
            ...prev,
            fullName: tenant.name,
            email: tenant.email,
            identityType: tenant.identityNumberType,
            idNumber: tenant.identityNumber,
            passportCountry: tenant.passportCountry ?? "",
            dateOfBirth: tenant.dateOfBirth ?? "",
            phone: tenant.phone,
          }));
          setIdentityRequired(false);
          break;
        }
        case "wrong_identity":
          setError("That number does not match our records. Please check it and try again.");
          break;
        case "blocked":
          setError("Too many wrong tries. Please wait 15 minutes and try again.");
          break;
        case "already_signed":
          setAlreadySigned(true);
          break;
        case "not_found":
          setDocExists(false);
          break;
        default:
          throw new Error(result.error);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setCheckingIdentity(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!agreed) {
      setError("You must agree to the lease terms before submitting.");
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      setError("Please provide a signature.");
      return;
    }

    // The same checks the server makes, for quick feedback
    const signatureBase64 = signatureRef.current?.toDataURL() || "";
    const problem = findSubmissionError({ ...formData, signatureBase64 }, dateInSouthAfrica(new Date()));
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      // The server checks everything again, saves it and sends the emails
      const res = await fetch(`/api/signing-links/${encodeURIComponent(tenantId)}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, signatureBase64 }),
      });
      const outcome = await res.json();
      if (outcome.status === "already_signed") {
        setAlreadySigned(true);
        return;
      }
      if (outcome.status === "blocked") {
        throw new Error("Too many wrong tries. Please wait 15 minutes and try again.");
      }
      if (outcome.status !== "signed") {
        throw new Error(outcome.error || "An unexpected error occurred. Please try again.");
      }

      router.push("/lease/success");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (loadingDoc) {
    return (
      <div className="min-h-screen bg-white text-black py-12 px-6 flex items-center justify-center font-sans">
        <p className="text-xl font-light animate-pulse">Loading lease document...</p>
      </div>
    );
  }

  if (!docExists) {
    return (
      <div className="min-h-screen bg-white text-black py-12 px-6 flex items-center justify-center font-sans">
        <p className="text-xl font-light">Lease document not found. Please verify your link.</p>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="min-h-screen bg-white text-black py-12 px-6 flex items-center justify-center font-sans">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-medium tracking-wide uppercase mb-4">Already Signed</h1>
          <p className="text-gray-500">This lease agreement has already been signed and submitted.</p>
        </div>
      </div>
    );
  }

  if (identityRequired) {
    return (
      <div className="min-h-screen bg-white text-black py-12 px-6 flex items-center justify-center font-sans">
        <form onSubmit={handleIdentitySubmit} className="max-w-md w-full space-y-8">
          <div>
            <h1 className="text-3xl font-light tracking-tight mb-2 uppercase">Lease Renewal</h1>
            <p className="text-gray-500 text-sm">
              To open your renewal, enter the South African ID number or passport number you gave when you first signed.
            </p>
          </div>
          {error && <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm font-medium">{error}</div>}
          <div className="flex items-end gap-4">
            <label htmlFor="identityNumber" className="text-sm font-medium whitespace-nowrap pb-1">ID or Passport No.</label>
            <input
              type="text"
              id="identityNumber"
              value={identityInput}
              onChange={(e) => setIdentityInput(e.target.value)}
              required
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </div>
          <button
            type="submit"
            disabled={checkingIdentity}
            className="w-full bg-black text-white py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {checkingIdentity ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black py-12 px-6 md:px-12 font-sans selection:bg-black selection:text-white">

      {/* POPIA Popup */}
      {showPopia && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
          <div className="bg-white max-w-md w-full p-8 border border-black">
            <h2 className="text-xl font-medium tracking-wide uppercase mb-4">Privacy Notice</h2>
            <p className="text-sm text-gray-600 mb-4">
              In accordance with the{" "}
              <span className="font-semibold text-black">
                Protection of Personal Information Act (POPIA)
              </span>
              , please note the following before proceeding:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 mb-6 list-disc list-inside">
              <li>
                We collect your full name, South African ID number or passport number with its issuing country, date of
                birth, phone number, email address, and whether you have a car.
              </li>
              <li>This information is used solely for processing this lease agreement and maintaining tenant records.</li>
              <li>Your data is stored securely and will not be shared with third parties.</li>
              <li>
                You have the right to access, correct, or request deletion of your information by
                contacting the landlord directly.
              </li>
            </ul>
            <p className="text-sm text-gray-600 mb-6">
              By clicking{" "}
              <span className="font-semibold text-black">Accept & Continue</span>, you consent to
              your personal information being collected and processed as described above.
            </p>
            <button
              onClick={() => setShowPopia(false)}
              className="w-full bg-black text-white py-3 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Accept & Continue
            </button>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl font-light tracking-tight mb-2 uppercase">{renewal ? "Lease Renewal" : "Lease Agreement"}</h1>
          <p className="text-gray-500 text-sm">
            {renewal
              ? "Please review the lease terms carefully, check your details and correct anything that has changed, and sign below."
              : "Please review the lease terms carefully, fill in your details, and sign below."}
          </p>
        </div>

        {/* Lease Schedule */}
        {schedule && (
          <div className="mb-12">
            <h2 className="text-xl font-medium tracking-wide uppercase mb-6 border-b border-black pb-2">Lease Schedule</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-4 text-sm">
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="text-gray-500">Unit</dt>
                <dd className="font-medium">{schedule.unitType} {schedule.unitNumber}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="text-gray-500">Rent</dt>
                <dd className="font-medium">R{schedule.rent.toLocaleString("en-ZA")} a month</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="text-gray-500">Start date</dt>
                <dd className="font-medium">{formatDate(schedule.startDate)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="text-gray-500">End date</dt>
                <dd className="font-medium">{formatDate(schedule.endDate)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="text-gray-500">Deposit</dt>
                <dd className="font-medium">
                  {schedule.deposit === null ? "To be confirmed" : `R${schedule.deposit.toLocaleString("en-ZA")}`}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Lease Download Section */}
        <div className="mb-12 border border-black p-6 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-medium tracking-wide uppercase mb-2">Lease Document</h2>
            <p className="text-sm text-gray-600">Please download and review the full lease agreement carefully before signing below.</p>
          </div>
          <a
            href={leaseDocument?.url}
            download={`Lease_Agreement_Version_${leaseDocument?.version}.pdf`}
            className="flex items-center gap-3 text-sm font-medium border-2 border-black bg-white px-6 py-3 hover:bg-black hover:text-white transition-colors whitespace-nowrap"
          >
            <Download size={18} />
            Download PDF
          </a>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 text-red-600 p-4 border border-red-200 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-12">

          {/* Tenant Information */}
          <div>
            <h2 className="text-xl font-medium tracking-wide uppercase mb-6 border-b border-black pb-2">Tenant Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="flex items-end gap-2 sm:gap-4">
                <label htmlFor="fullName" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none w-full min-w-0"
                />
              </div>

              <div className="flex items-end gap-2 sm:gap-4">
                <label htmlFor="email" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none w-full min-w-0"
                />
              </div>

              <fieldset className="md:col-span-2">
                <legend className="text-sm font-medium mb-3">South African ID or passport?</legend>
                <div className="flex flex-wrap gap-x-8 gap-y-2">
                  {[
                    ["sa_id", "South African ID"],
                    ["passport", "Passport"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="identityType"
                        value={value}
                        checked={formData.identityType === value}
                        onChange={handleChange}
                        required
                        disabled={renewal && formData.identityType !== value}
                        className="w-4 h-4 accent-black"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {formData.identityType && (
                <div className="flex items-end gap-2 sm:gap-4">
                  <label htmlFor="idNumber" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">
                    {passport ? "Passport No." : "ID Number"}
                  </label>
                  <input
                    type="text"
                    id="idNumber"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleChange}
                    required
                    readOnly={renewal}
                    {...(passport ? {} : { pattern: "\\d{13}", title: "ID number must be exactly 13 digits" })}
                    className={INPUT_CLASS}
                  />
                </div>
              )}

              {passport && (
                <>
                  <div className="flex items-end gap-2 sm:gap-4">
                    <label htmlFor="passportCountry" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Issued By</label>
                    <input
                      type="text"
                      id="passportCountry"
                      name="passportCountry"
                      value={formData.passportCountry}
                      onChange={handleChange}
                      required
                      placeholder="Country"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex items-end gap-2 sm:gap-4">
                    <label htmlFor="dateOfBirth" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Date of Birth</label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      required
                      max={dateInSouthAfrica(new Date())}
                      className={`${INPUT_CLASS} appearance-none`}
                    />
                  </div>
                </>
              )}

              <div className="flex items-end gap-2 sm:gap-4">
                <label htmlFor="phone" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  pattern="0\d{9}"
                  title="Phone number must be 10 digits and start with 0"
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none w-full min-w-0"
                />
              </div>
            </div>
          </div>

          {/* Car Declaration */}
          <fieldset>
            <legend className="w-full text-xl font-medium tracking-wide uppercase mb-6 border-b border-black pb-2">Car Declaration</legend>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {[
                ["car", "I have a car"],
                ["no_car", "I do not have a car"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="carDeclaration"
                    value={value}
                    checked={formData.carDeclaration === value}
                    onChange={handleChange}
                    required
                    className="w-4 h-4 accent-black"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">
              The property has two Parking Bays. Having a car does not by itself give you one; the landlord grants a
              Parking Reservation only when a bay is free.
            </p>
            {renewalTenant?.parkingReservation && (
              <p className="text-xs font-medium mt-2">
                You hold a Parking Reservation. Answering &ldquo;I do not have a car&rdquo; ends it.
              </p>
            )}
          </fieldset>

          {/* Signature Section */}
          <div>
            <h2 className="text-xl font-medium tracking-wide uppercase mb-6 border-b border-black pb-2">Signature</h2>

            <div className="mb-8">
              <label className="block text-sm font-medium mb-2">Please sign within the box below:</label>
              <SignaturePad ref={signatureRef} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="flex items-end gap-2 sm:gap-4">
                <label htmlFor="signatureName" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Printed Name</label>
                <input
                  type="text"
                  id="signatureName"
                  name="signatureName"
                  value={formData.signatureName}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none w-full min-w-0"
                />
              </div>

              <div className="flex items-end gap-2 sm:gap-4">
                <label htmlFor="signatureDate" className="w-24 sm:w-28 text-sm font-medium whitespace-nowrap pb-1">Date</label>
                <input
                  type="date"
                  id="signatureDate"
                  name="signatureDate"
                  value={formData.signatureDate}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none w-full min-w-0"
                />
              </div>
            </div>
          </div>

          {/* Submission Section */}
          <div className="pt-6 border-t border-black space-y-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 border-2 border-black rounded-none appearance-none checked:bg-black cursor-pointer"
              />
              <label htmlFor="agree" className="text-sm font-medium cursor-pointer select-none">
                I agree to the lease terms and confirm that the information provided is accurate.
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full md:w-auto bg-black text-white px-12 py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Signature"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
