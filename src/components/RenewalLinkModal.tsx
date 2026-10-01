import React, { useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { errorMessage, landlordFetch } from '@/lib/landlord-api';
import { dateInSouthAfrica, isInRenewalWindow } from '@/lib/lease/model';
import type { DashboardRow } from '@/lib/lease/views';

interface RenewalLinkModalProps {
  row: DashboardRow | null;
  onClose: () => void;
  onChanged: () => void;
}

const INPUT_CLASS = 'flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none';
const WINDOW_WARNING =
  'Renewal Signing Links should go out between 7 September and 3 November, so Tenants get the notice the Consumer Protection Act expects before a Lease ends on 31 December.';

const formatDate = (date: string | null) =>
  date
    ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    : '';

// Creates a Tenant's Renewal Signing Link, with unit and rent pre-filled from their current
// Lease, or shows the open one to copy, email or delete. The page gives it a `key` per row.
export default function RenewalLinkModal({ row, onClose, onChanged }: RenewalLinkModalProps) {
  const [form, setForm] = useState({
    unitType: row?.lease?.unitType || 'Flat',
    unitNumber: row?.lease?.unitNumber ?? '',
    rent: row?.lease?.rent ? String(row.lease.rent) : '',
  });
  const [linkId, setLinkId] = useState(row?.renewal?.id ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(row?.tenant?.email ?? '');
  const [emailState, setEmailState] = useState({ sending: false, sentTo: '', error: '' });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Synchronous lock against duplicate links on a double click
  const isSubmitting = useRef(false);

  if (!row?.tenant) return null;
  const tenant = row.tenant;
  const outsideWindow = !isInRenewalWindow(dateInSouthAfrica(new Date()));
  const linkUrl = linkId ? `${window.location.origin}/lease/sign/${linkId}` : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const createLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setBusy(true);
    setError('');
    try {
      const { id } = await landlordFetch<{ id: string }>(`/api/tenants/${encodeURIComponent(tenant.id)}/renewal-link`, {
        method: 'POST',
        body: form,
      });
      setLinkId(id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create the link.'));
    } finally {
      isSubmitting.current = false;
      setBusy(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailState.sending) return;
    setEmailState({ sending: true, sentTo: '', error: '' });
    try {
      await landlordFetch(`/api/signing-links/${encodeURIComponent(linkId)}/email`, { method: 'POST', body: { to: emailTo } });
      setEmailState({ sending: false, sentTo: emailTo.trim(), error: '' });
    } catch (err) {
      setEmailState({ sending: false, sentTo: '', error: errorMessage(err, 'Failed to send the email.') });
    }
  };

  const deleteLink = async () => {
    setBusy(true);
    setError('');
    try {
      await landlordFetch(`/api/signing-links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
      onChanged();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete the link.'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="sticky top-0 bg-white border-b-2 border-black p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-light tracking-tight">Renewal for {tenant.name}</h2>
          <button onClick={onClose} className="hover:bg-black hover:text-white p-1 transition-colors border border-transparent hover:border-black">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {error && <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm">{error}</div>}

          {!linkId ? (
            <form onSubmit={createLink} className="space-y-8">
              <p className="text-sm text-gray-500">
                The Renewal runs for the whole Lease Year after the current Lease ends. The Deposit stays as it is.
              </p>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="flex items-end gap-4 flex-1">
                  <label htmlFor="renewalUnitType" className="text-sm font-medium whitespace-nowrap pb-1">Unit Type</label>
                  <select id="renewalUnitType" name="unitType" value={form.unitType} onChange={handleChange} className={`${INPUT_CLASS} appearance-none cursor-pointer`}>
                    <option value="Flat">Flat</option>
                    <option value="House">House</option>
                  </select>
                </div>
                <div className="flex items-end gap-4 flex-1">
                  <label htmlFor="renewalUnitNumber" className="text-sm font-medium whitespace-nowrap pb-1">Unit Number</label>
                  <input type="text" id="renewalUnitNumber" name="unitNumber" value={form.unitNumber} onChange={handleChange} required className={INPUT_CLASS} />
                </div>
              </div>
              <div className="flex items-end gap-4">
                <label htmlFor="renewalRent" className="text-sm font-medium whitespace-nowrap pb-1">Rent Amount</label>
                <div className="flex-1 relative">
                  <span className="absolute left-1 bottom-1 text-lg">R</span>
                  <input type="number" id="renewalRent" name="rent" value={form.rent} onChange={handleChange} required className={`${INPUT_CLASS} w-full pl-5`} />
                </div>
              </div>
              {outsideWindow && (
                <div className="bg-amber-50 text-amber-800 p-4 border border-amber-200 text-sm">
                  Today is outside the Renewal window. {WINDOW_WARNING} You can still create the link.
                </div>
              )}
              <button
                type="submit"
                disabled={busy}
                className="bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors w-full md:w-auto disabled:opacity-50"
              >
                {busy ? 'Creating...' : 'Create Signing Link'}
              </button>
            </form>
          ) : (
            <div className="space-y-6">
              {row.renewal && (
                <p className="text-sm text-gray-500">
                  {row.renewal.unitType} {row.renewal.unitNumber}, R{row.renewal.rent} a month,{' '}
                  {formatDate(row.renewal.startDate)} to {formatDate(row.renewal.endDate)}. Not signed yet.
                </p>
              )}
              <div className="flex items-center gap-3 bg-gray-50 p-3">
                <code className="text-sm flex-1 break-all">{linkUrl}</code>
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center w-10 h-10 border border-black hover:bg-black hover:text-white transition-colors flex-shrink-0"
                  aria-label="Copy to clipboard"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                The Tenant opens it with their ID or passport number. It keeps working after 31 December.
              </p>

              <form onSubmit={emailLink} className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-end gap-4 flex-1">
                  <label htmlFor="renewalEmailTo" className="text-sm font-medium whitespace-nowrap pb-1">Tenant Email</label>
                  <input type="email" id="renewalEmailTo" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} required className={INPUT_CLASS} />
                </div>
                <button
                  type="submit"
                  disabled={emailState.sending}
                  className="bg-black text-white px-6 py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {emailState.sending ? 'Sending...' : 'Email Link'}
                </button>
              </form>
              {emailState.sentTo && <p className="text-sm text-green-700">Sent to {emailState.sentTo}.</p>}
              {emailState.error && <p className="text-sm text-red-600">{emailState.error}</p>}

              <div className="pt-6 border-t border-gray-200">
                {confirmingDelete ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm">The link will stop working. Delete it?</span>
                    <button onClick={deleteLink} disabled={busy} className="text-sm px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                      {busy ? 'Deleting...' : 'Delete Link'}
                    </button>
                    <button onClick={() => setConfirmingDelete(false)} className="text-sm px-4 py-2 border border-gray-300 hover:border-black">
                      Keep It
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingDelete(true)} className="text-sm text-red-600 hover:underline">
                    Delete this link
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
