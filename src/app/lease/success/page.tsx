import { CheckCircle } from "lucide-react";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-white text-black py-20 px-6 flex flex-col items-center justify-center font-sans selection:bg-black selection:text-white">
      <div className="max-w-md text-center space-y-6">
        <CheckCircle size={64} className="mx-auto mb-6 text-black" strokeWidth={1} />
        <h1 className="text-4xl font-light tracking-tight uppercase">Successfully Signed</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your lease agreement has been successfully submitted and recorded. An automated email receipt with a copy of the lease has been sent to your email address.
        </p>
        <p className="text-black font-medium text-sm mt-4">
          You may now safely close this window.
        </p>
      </div>
    </div>
  );
}
