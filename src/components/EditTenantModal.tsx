import React, { useState } from 'react';
import { errorMessage } from '@/lib/landlord-api';
import type { TenantState } from '@/lib/lease/model';
import type { TenantView } from '@/lib/lease/views';
import { X } from 'lucide-react';

export interface TenantChanges {
  name: string;
  email: string;
  identityNumber: string;
  phone: string;
  state: TenantState;
}

interface EditTenantModalProps {
  tenant: TenantView | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (tenantId: string, changes: TenantChanges) => Promise<void>;
}

// Edits the Tenant's own details. Unit and rent belong to the Lease, so they are not here.
// The page gives it a `key` per Tenant, so it starts fresh for each one.
export default function EditTenantModal({ tenant, isOpen, onClose, onSave }: EditTenantModalProps) {
  const [formData, setFormData] = useState<TenantChanges>({
    name: tenant?.name ?? '',
    email: tenant?.email ?? '',
    identityNumber: tenant?.identityNumber ?? '',
    phone: tenant?.phone ?? '',
    state: tenant?.state ?? 'current',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !tenant) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onSave(tenant.id, formData);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save tenant'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="sticky top-0 bg-white border-b-2 border-black p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-light tracking-tight">Edit Tenant</h2>
          <button onClick={onClose} className="hover:bg-black hover:text-white p-1 transition-colors border border-transparent hover:border-black">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">
                {tenant.identityNumberType === 'passport' ? 'Passport No.' : 'ID Number'}
              </label>
              <input type="text" name="identityNumber" value={formData.identityNumber} onChange={handleChange} required className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4 md:col-span-2">
              <label className="text-sm font-medium whitespace-nowrap pb-1">State</label>
              <select name="state" value={formData.state} onChange={handleChange} className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none cursor-pointer">
                <option value="current">Current</option>
                <option value="moved_out">Moved Out</option>
              </select>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <button type="button" onClick={() => setFormData((prev) => ({ ...prev, state: 'moved_out' }))} className="w-full md:w-auto text-sm border-2 border-gray-400 text-gray-600 px-6 py-3 hover:border-black hover:text-black transition-colors font-medium">
              Mark as Moved Out
            </button>

            <div className="flex gap-4 w-full md:w-auto">
              <button type="button" onClick={onClose} className="flex-1 md:flex-none px-8 py-3 text-sm font-medium border-2 border-black hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 md:flex-none bg-black text-white px-8 py-3 text-sm font-medium border-2 border-black hover:bg-gray-800 transition-colors disabled:opacity-50">
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
