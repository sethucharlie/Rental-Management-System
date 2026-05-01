import React, { useState, useEffect } from 'react';
import { Tenant } from '@/types';
import { X } from 'lucide-react';

interface EditTenantModalProps {
  tenant: Tenant | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (tenantId: string, data: Partial<Tenant>) => Promise<void>;
}

export default function EditTenantModal({ tenant, isOpen, onClose, onSave }: EditTenantModalProps) {
  const [formData, setFormData] = useState<Partial<Tenant>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || '',
        phone: tenant.phone || '',
        idNumber: tenant.idNumber || '',
        unitType: tenant.unitType || 'Flat',
        unitNumber: tenant.unitNumber || '',
        rent: tenant.rent || '',
        status: tenant.status || 'active',
      });
    }
  }, [tenant]);

  if (!isOpen || !tenant) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-update rent based on unitType
      if (name === 'unitType') {
        updated.rent = value === 'Flat' ? 1500 : value === 'House' ? 3000 : prev.rent;
      }
      
      return updated;
    });
  };

  const handleMarkMovedOut = () => {
    setFormData((prev) => ({
      ...prev,
      status: 'moved_out',
      moveOutDate: new Date().toISOString(), // Optional: simplify by saving as ISO string or timestamp
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(tenant.id, formData);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save tenant');
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>
            
            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">ID Number</label>
              <input type="text" name="idNumber" value={formData.idNumber} onChange={handleChange} className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Unit Type</label>
              <select name="unitType" value={formData.unitType} onChange={handleChange} className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none cursor-pointer">
                <option value="Flat">Flat</option>
                <option value="House">House</option>
              </select>
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Unit Number</label>
              <input type="text" name="unitNumber" value={formData.unitNumber} onChange={handleChange} required className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none" />
            </div>

            <div className="flex items-end gap-4">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Rent</label>
              <div className="flex-1 relative">
                <span className="absolute left-1 bottom-1 text-lg">R</span>
                <input type="number" name="rent" value={formData.rent} onChange={handleChange} required className="w-full border-b-2 border-black focus:outline-none bg-transparent pb-1 pl-5 pr-1 text-lg rounded-none" />
              </div>
            </div>
            
            <div className="flex items-end gap-4 md:col-span-2">
              <label className="text-sm font-medium whitespace-nowrap pb-1">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="flex-1 border-b-2 border-black focus:outline-none bg-transparent pb-1 px-1 text-lg rounded-none appearance-none cursor-pointer">
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="moved_out">Moved Out</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <button type="button" onClick={handleMarkMovedOut} className="w-full md:w-auto text-sm border-2 border-gray-400 text-gray-600 px-6 py-3 hover:border-black hover:text-black transition-colors font-medium">
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
