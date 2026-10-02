import React, { useState } from 'react';
import { X } from 'lucide-react';
import { errorMessage, landlordFetch } from '@/lib/landlord-api';
import type { DashboardRow } from '@/lib/lease/views';

interface UnitMoveModalProps {
  row: DashboardRow | null;
  onClose: () => void;
  onMoved: () => void;
}

const HOUSE_MESSAGE = 'A move into or out of the house needs a new first Lease, not a Unit Move.';

// Records a Current Tenant's move from one flat to another: no signing, no change in rent.
// The page gives it a `key` per row, so it starts fresh for each one.
export default function UnitMoveModal({ row, onClose, onMoved }: UnitMoveModalProps) {
  const [unitNumber, setUnitNumber] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!row?.tenant || !row.lease) return null;
  const { tenant, lease } = row;
  const inHouse = lease.unitType !== 'Flat';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await landlordFetch(`/api/tenants/${encodeURIComponent(tenant.id)}/unit-move`, {
        method: 'POST',
        body: { unitType: 'Flat', unitNumber },
      });
      onMoved();
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to record the move.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        <div className="sticky top-0 bg-white border-b-2 border-black p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-light tracking-tight">Unit Move for {tenant.name}</h2>
          <button onClick={onClose} className="hover:bg-black hover:text-white p-1 transition-colors border border-transparent hover:border-black">
            <X size={24} />
          </button>
        </div>

        {inHouse ? (
          <div className="p-6 space-y-6">
            <p className="text-sm">{tenant.name} rents the house. {HOUSE_MESSAGE}</p>
            <button onClick={onClose} className="px-8 py-3 text-sm font-medium border-2 border-black hover:bg-gray-100 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {error && <div className="bg-red-50 text-red-600 p-4 border border-red-200 text-sm">{error}</div>}
            <p className="text-sm text-gray-500">
              Now in Flat {lease.unitNumber}. The rent stays R{lease.rent} and nothing needs signing. The next Renewal names
              the new flat. {HOUSE_MESSAGE}
            </p>
            <div className="flex items-end gap-4">
              <label htmlFor="newUnitNumber" className="text-sm font-medium whitespace-nowrap pb-1">New Flat Number</label>
              <input
                type="text"
                id="newUnitNumber"
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                required
                className="flex-1 min-w-0 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none"
              />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={onClose} className="flex-1 md:flex-none px-8 py-3 text-sm font-medium border-2 border-black hover:bg-gray-100 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 md:flex-none bg-black text-white px-8 py-3 text-sm font-medium border-2 border-black hover:bg-gray-800 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : 'Record Move'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
