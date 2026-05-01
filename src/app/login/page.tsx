"use client";

import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

const provider = new GoogleAuthProvider();

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard/tenants");
    } catch (err: any) {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm text-center">
        {/* Brand */}
        <div className="mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 border-2 border-white mb-5">
            <KeyRound size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-light tracking-tight text-white uppercase">Admin Portal</h1>
          <p className="text-gray-500 text-sm mt-2">Lease Management System</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-950 border border-red-800 text-red-300 text-sm p-3">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 px-6 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {/* Google G Logo */}
          {!loading && (
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        <p className="text-gray-600 text-xs mt-6">
          Only authorised Google accounts can access this portal.
        </p>
      </div>
    </div>
  );
}
