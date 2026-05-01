import React from 'react';
import { X, PenLine } from 'lucide-react';

interface SignatureViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName?: string;
  signatureBase64?: string;
  signatureDate?: string;
  signatureName?: string;
}

export default function SignatureViewModal({
  isOpen,
  onClose,
  tenantName,
  signatureBase64,
  signatureDate,
  signatureName,
}: SignatureViewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black w-full max-w-lg animate-in fade-in zoom-in-95 border-2 border-black">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-black p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <PenLine size={20} />
            <div>
              <h2 className="text-lg font-medium tracking-tight">Signature</h2>
              {tenantName && <p className="text-sm text-gray-500">{tenantName}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-black hover:text-white p-1 transition-colors border border-transparent hover:border-black"
          >
            <X size={22} />
          </button>
        </div>

        {/* Signature Image */}
        <div className="p-6">
          {signatureBase64 ? (
            <div className="border-2 border-black bg-gray-50 flex items-center justify-center min-h-[180px]">
              <img
                src={signatureBase64}
                alt={`Signature of ${tenantName}`}
                className="max-w-full max-h-48 object-contain"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center min-h-[180px]">
              <p className="text-gray-400 text-sm">No signature on record</p>
            </div>
          )}

          {/* Metadata */}
          {(signatureName || signatureDate) && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
              {signatureName && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Printed Name</p>
                  <p className="font-medium">{signatureName}</p>
                </div>
              )}
              {signatureDate && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Date Signed</p>
                  <p className="font-medium">{signatureDate}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
