import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  tenantName: string;
}

export default function ConfirmDeleteModal({ isOpen, onClose, onConfirm, tenantName }: ConfirmDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to delete tenant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black w-full max-w-md animate-in fade-in zoom-in-95 border-2 border-black">
        <div className="border-b-2 border-black p-4 flex justify-between items-center bg-red-50">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-bold">Confirm Deletion</h2>
          </div>
          <button onClick={onClose} className="hover:bg-red-100 p-1 transition-colors border border-transparent hover:border-red-600 text-red-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="mb-6">
            Are you sure you want to completely delete the record for <strong>{tenantName}</strong>? 
            This action will also remove their signature from storage and cannot be undone.
          </p>

          <div className="flex justify-end gap-4">
            <button 
              onClick={onClose} 
              disabled={loading}
              className="px-6 py-2 text-sm font-medium border-2 border-black hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm} 
              disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-red-600 text-white border-2 border-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
