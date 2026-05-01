"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import SignaturePad, { SignaturePadRef } from "@/components/SignaturePad";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function LeaseSignPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const router = useRouter();
  const signatureRef = useRef<SignaturePadRef>(null);
  const [agreed, setAgreed] = useState(false);

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [isSigned, setIsSigned] = useState(false);
  const [docExists, setDocExists] = useState(true);

  const [formData, setFormData] = useState({
    fullName: "",
    idNumber: "",
    phone: "",
    signatureName: "",
    signatureDate: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const tenantDoc = await getDoc(doc(db, "tenants", tenantId));
        if (!tenantDoc.exists()) {
          setDocExists(false);
        } else if (tenantDoc.data().isSigned) {
          setIsSigned(true);
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

    setSubmitting(true);
    try {
      // 1. Get the signature as a base64 data URL
      const signatureBase64 = signatureRef.current?.toDataURL() || "";

      // 2. Save everything directly to Firestore — no Storage needed
      const tenantRef = doc(db, "tenants", tenantId);
      await updateDoc(tenantRef, {
        name: formData.fullName,
        idNumber: formData.idNumber,
        phone: formData.phone,
        signatureName: formData.signatureName,
        signatureDate: formData.signatureDate,
        signatureBase64,   // signature image stored directly in Firestore
        isSigned: true,
        status: "active",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

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

  if (isSigned) {
    return (
      <div className="min-h-screen bg-white text-black py-12 px-6 flex items-center justify-center font-sans">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-medium tracking-wide uppercase mb-4">Already Signed</h1>
          <p className="text-gray-500">This lease agreement has already been signed and submitted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black py-12 px-6 md:px-12 font-sans selection:bg-black selection:text-white">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl font-light tracking-tight mb-2 uppercase">Lease Agreement</h1>
          <p className="text-gray-500 text-sm">Please review the lease terms carefully, fill in your details, and sign below.</p>
        </div>

        {/* Lease Preview & Download Section */}
        <div className="mb-12">
          <div className="flex justify-between items-end mb-4 border-b border-black pb-2">
            <h2 className="text-xl font-medium tracking-wide uppercase">Lease Document</h2>
            <button
              type="button"
              className="flex items-center gap-2 text-xs font-medium border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              <Download size={14} />
              Download PDF
            </button>
          </div>

          <div className="border border-gray-300 p-6 h-80 overflow-y-auto bg-gray-50 text-sm leading-relaxed text-gray-700">
            <h3 className="font-bold text-black mb-4 uppercase">1. Terms of Agreement</h3>
            <p className="mb-4">This Lease Agreement is made and entered into on this day between the Landlord and the Tenant. The Landlord hereby leases to the Tenant the premises described below for the term and upon the conditions specified herein.</p>

            <h3 className="font-bold text-black mb-4 uppercase mt-6">2. Rent Payment</h3>
            <p className="mb-4">The Tenant agrees to pay the Landlord the monthly rent sum specified in the agreement, payable in advance on the first day of each calendar month. Late payments may incur additional fees as described in the full document.</p>

            <h3 className="font-bold text-black mb-4 uppercase mt-6">3. Use of Premises</h3>
            <p className="mb-4">The premises shall be used strictly for residential purposes by the Tenant and authorized occupants. The Tenant shall not use the premises for any unlawful purpose or permit any nuisance.</p>

            <h3 className="font-bold text-black mb-4 uppercase mt-6">4. Maintenance and Repairs</h3>
            <p className="mb-4">The Tenant shall keep the premises in a clean and sanitary condition and promptly notify the Landlord of any necessary repairs. The Landlord is responsible for structural repairs unless caused by the Tenant's negligence.</p>

            <p className="mt-8 italic text-xs text-gray-500 text-center">-- Please download the full PDF to view all terms and conditions --</p>
          </div>
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
              <div className="flex items-end gap-4">
                <label htmlFor="fullName" className="text-sm font-medium whitespace-nowrap pb-1">Full Name</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
                />
              </div>

              <div className="flex items-end gap-4">
                <label htmlFor="idNumber" className="text-sm font-medium whitespace-nowrap pb-1">ID Number</label>
                <input
                  type="text"
                  id="idNumber"
                  name="idNumber"
                  value={formData.idNumber}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
                />
              </div>

              <div className="flex items-end gap-4">
                <label htmlFor="phone" className="text-sm font-medium whitespace-nowrap pb-1">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
                />
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div>
            <h2 className="text-xl font-medium tracking-wide uppercase mb-6 border-b border-black pb-2">Signature</h2>

            <div className="mb-8">
              <label className="block text-sm font-medium mb-2">Please sign within the box below:</label>
              <SignaturePad ref={signatureRef} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="flex items-end gap-4">
                <label htmlFor="signatureName" className="text-sm font-medium whitespace-nowrap pb-1">Printed Name</label>
                <input
                  type="text"
                  id="signatureName"
                  name="signatureName"
                  value={formData.signatureName}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
                />
              </div>

              <div className="flex items-end gap-4">
                <label htmlFor="signatureDate" className="text-sm font-medium whitespace-nowrap pb-1">Date</label>
                <input
                  type="date"
                  id="signatureDate"
                  name="signatureDate"
                  value={formData.signatureDate}
                  onChange={handleChange}
                  required
                  className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none"
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
