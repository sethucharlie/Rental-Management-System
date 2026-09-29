"use client";

import { useState, useRef } from "react";
import { Check, Copy } from "lucide-react";
import { errorMessage, landlordFetch } from "@/lib/landlord-api";
import { firstLeaseEndDate, isRealDate } from "@/lib/lease/model";

const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function CreateTenantPage() {
  const [formData, setFormData] = useState({
    unitType: "Flat",
    unitNumber: "",
    rent: "",
    startDate: "",
    deposit: "",
    parkingReservation: false,
  });
  const [generatedLink, setGeneratedLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailState, setEmailState] = useState<{ sending: boolean; sentTo: string; error: string }>({
    sending: false,
    sentTo: "",
    error: "",
  });
  // Synchronous lock — prevents duplicate links on rapid double-clicks
  const isSubmitting = useRef(false);

  const endDate = isRealDate(formData.startDate) ? firstLeaseEndDate(formData.startDate) : null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const checked = e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : null;
    setFormData((prev) => ({ ...prev, [name]: checked ?? value }));
  };

  // The Deposit equals the rent unless the landlord has typed something else.
  const setRent = (rent: string) => {
    setFormData((prev) => ({ ...prev, rent, deposit: prev.deposit === "" || prev.deposit === prev.rent ? rent : prev.deposit }));
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    // Block if already in flight — ref check is synchronous, unlike state
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);
    setError("");

    try {
      const { id } = await landlordFetch<{ id: string }>("/api/signing-links", { method: "POST", body: formData });
      setGeneratedLink({ id, url: `${window.location.origin}/lease/sign/${id}` });
      setCopied(false);
      setEmailTo("");
      setEmailState({ sending: false, sentTo: "", error: "" });
    } catch (err) {
      setError(errorMessage(err, "Failed to generate link."));
    } finally {
      isSubmitting.current = false;
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const emailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatedLink || emailState.sending) return;
    setEmailState({ sending: true, sentTo: "", error: "" });
    try {
      await landlordFetch(`/api/signing-links/${encodeURIComponent(generatedLink.id)}/email`, {
        method: "POST",
        body: { to: emailTo },
      });
      setEmailState({ sending: false, sentTo: emailTo.trim(), error: "" });
    } catch (err) {
      setEmailState({ sending: false, sentTo: "", error: errorMessage(err, "Failed to send the email.") });
    }
  };

  return (
    <div className="text-black font-sans selection:bg-black selection:text-white">
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-3xl font-light tracking-tight mb-1">New Tenant Link</h1>
          <p className="text-gray-500 text-sm">Fill in the lease details to generate a unique lease signing link.</p>
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
                  onChange={(e) => setRent(e.target.value)}
                  required
                  className="w-full border-b-2 border-black focus:outline-none bg-transparent pb-1 pl-5 pr-1 text-lg rounded-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setRent("1500")}
                className="text-xs border border-gray-300 px-3 py-1 hover:border-black transition-colors"
              >
                R1500
              </button>
              <button
                type="button"
                onClick={() => setRent("3000")}
                className="text-xs border border-gray-300 px-3 py-1 hover:border-black transition-colors"
              >
                R3000
              </button>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <label htmlFor="deposit" className="text-sm font-medium whitespace-nowrap pb-1">
              Deposit
            </label>
            <div className="flex-1 relative">
              <span className="absolute left-1 bottom-1 text-lg">R</span>
              <input
                type="number"
                id="deposit"
                name="deposit"
                min="0"
                value={formData.deposit}
                onChange={handleChange}
                required
                className="w-full border-b-2 border-black focus:outline-none bg-transparent pb-1 pl-5 pr-1 text-lg rounded-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-end gap-4">
              <label htmlFor="startDate" className="text-sm font-medium whitespace-nowrap pb-1">
                Start Date
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
                className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
              />
            </div>
            <p className="text-sm text-gray-500">
              {endDate ? (
                <>
                  Lease ends <span className="font-medium text-black">{formatDate(endDate)}</span>.
                </>
              ) : (
                "Pick a start date to see when the lease ends."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="parkingReservation"
              name="parkingReservation"
              checked={formData.parkingReservation}
              onChange={handleChange}
              className="w-5 h-5 border-2 border-black rounded-none appearance-none checked:bg-black cursor-pointer"
            />
            <label htmlFor="parkingReservation" className="text-sm font-medium cursor-pointer select-none">
              Parking Reservation (one of the 2 bays)
            </label>
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
              <code className="text-sm flex-1 break-all">{generatedLink.url}</code>
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

            <form onSubmit={emailLink} className="mt-6 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex items-end gap-4 flex-1">
                <label htmlFor="emailTo" className="text-sm font-medium whitespace-nowrap pb-1">
                  Tenant Email
                </label>
                <input
                  type="email"
                  id="emailTo"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  required
                  className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
                />
              </div>
              <button
                type="submit"
                disabled={emailState.sending}
                className="bg-black text-white px-6 py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {emailState.sending ? "Sending..." : "Email Link"}
              </button>
            </form>
            {emailState.sentTo && <p className="text-sm text-green-700 mt-3">Sent to {emailState.sentTo}.</p>}
            {emailState.error && <p className="text-sm text-red-600 mt-3">{emailState.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
