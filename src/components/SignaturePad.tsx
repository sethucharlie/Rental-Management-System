"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | undefined;
}

const SignaturePad = forwardRef<SignaturePadRef>((props, ref) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  useImperativeHandle(ref, () => ({
    clear: () => sigCanvas.current?.clear(),
    isEmpty: () => sigCanvas.current?.isEmpty() ?? true,
    toDataURL: () => sigCanvas.current?.toDataURL(),
  }));

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  return (
    <div className="border-2 border-black bg-gray-50 relative">
      <SignatureCanvas
        ref={sigCanvas}
        penColor="black"
        canvasProps={{ className: "w-full h-48 cursor-crosshair touch-none" }}
      />
      <button
        type="button"
        onClick={handleClear}
        className="absolute bottom-2 right-2 text-xs border border-gray-300 bg-white px-2 py-1 hover:border-black transition-colors"
      >
        Clear
      </button>
    </div>
  );
});

SignaturePad.displayName = "SignaturePad";

export default SignaturePad;
