"use client";

import { useState, useRef } from "react";
import { Check, Copy } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function CreateTenantPage() {
  const [formData, setFormData] = useState({
    unitType: "Flat",
    unitNumber: "",
    rent: "",
  });
  const [generatedLink, setGeneratedLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Synchronous lock — prevents duplicate Firestore writes on rapid double-clicks
  const isSubmitting = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const autofillRent = (amount: string) => {
    setFormData((prev) => ({ ...prev, rent: amount }));
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    // Block if already in flight — ref check is synchronous, unlike state
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);
    setError("");

    try {
      // Write directly to Firestore from the client
      const docRef = await addDoc(collection(db, "tenants"), {
        unitType: formData.unitType,
        unitNumber: formData.unitNumber,
        rent: formData.rent,
        isSigned: false,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setGeneratedLink(`${origin}/lease/sign/${docRef.id}`);
      setCopied(false);
    } catch (err: any) {
      setError(err.message || "Failed to generate link. Check Firebase connection.");
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="text-black font-sans selection:bg-black selection:text-white">
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-3xl font-light tracking-tight mb-1">New Tenant Link</h1>
          <p className="text-gray-500 text-sm">Fill in the unit details to generate a unique lease signing link.</p>
        </div>

        <form onSubmit={handleGenerateLink} className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex items-end gap-4 flex-1">
              <label htmlFor="unitType" className="text-sm font-medium whitespace-nowrap pb-1">
                Unit Type
              </label>
              <select
                id="unitType"
                name="unitType"
                value={formData.unitType}
                onChange={handleChange}
                className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none cursor-pointer"
              >
                <option value="Flat">Flat</option>
                <option value="House">House</option>
              </select>
            </div>
            
            <div className="flex items-end gap-4 flex-1">
              <label htmlFor="unitNumber" className="text-sm font-medium whitespace-nowrap pb-1">
                Unit Number
              </label>
              <input
                type="text"
                id="unitNumber"
                name="unitNumber"
                value={formData.unitNumber}
                onChange={handleChange}
                required
                className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end gap-4">
              <label htmlFor="rent" className="text-sm font-medium whitespace-nowrap pb-1">
                Rent Amount
              </label>
              <div className="flex-1 relative">
                <span className="absolute left-1 bottom-1 text-lg">R</span>
                <input
                  type="number"
                  id="rent"
                  name="rent"
                  value={formData.rent}
                  onChange={handleChange}
                  required
                  className="w-full border-b-2 border-black focus:outline-none bg-transparent pb-1 pl-5 pr-1 text-lg rounded-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => autofillRent("1500")}
                className="text-xs border border-gray-300 px-3 py-1 hover:border-black transition-colors"
              >
                R1500
              </button>
              <button
                type="button"
                onClick={() => autofillRent("3000")}
                className="text-xs border border-gray-300 px-3 py-1 hover:border-black transition-colors"
              >
                R3000
              </button>
            </div>
          </div>

          <div className="pt-8">
            <button
              type="submit"
              disabled={loading}
              className="bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors w-full md:w-auto disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Link"}
            </button>
          </div>
        </form>

        {generatedLink && (
          <div className="mt-12 p-6 border-2 border-black animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-sm font-medium mb-4 uppercase tracking-widest text-gray-500">Generated Link</h3>
            <div className="flex items-center gap-3 bg-gray-50 p-3">
              <code className="text-sm flex-1 break-all">{generatedLink}</code>
              <button
                onClick={copyToClipboard}
                className="flex items-center justify-center w-10 h-10 border border-black hover:bg-black hover:text-white transition-colors flex-shrink-0"
                aria-label="Copy to clipboard"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Share this link with the tenant. It allows them to securely sign the lease.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
