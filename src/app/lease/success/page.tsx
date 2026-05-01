import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-white text-black py-20 px-6 flex flex-col items-center justify-center font-sans selection:bg-black selection:text-white">
      <div className="max-w-md text-center space-y-6">
        <CheckCircle size={64} className="mx-auto mb-6 text-black" strokeWidth={1} />
        <h1 className="text-4xl font-light tracking-tight uppercase">Successfully Signed</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your lease agreement has been successfully submitted and recorded. A copy of the signed lease will be processed by the landlord.
        </p>
        
        <div className="pt-8">
          <Link 
            href="/"
            className="inline-block border-2 border-black text-black px-12 py-4 text-sm font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
