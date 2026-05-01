"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Users, PlusCircle, LogOut, Menu, X, KeyRound } from "lucide-react";

const navItems = [
  { label: "Tenants", href: "/dashboard/tenants", icon: Users },
  { label: "New Tenant", href: "/dashboard/create-tenant", icon: PlusCircle },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  // Show nothing while checking auth
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-black text-white sticky top-0 z-40 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <KeyRound size={18} className="text-white" />
            <span className="text-sm font-medium uppercase tracking-widest">Lease Admin</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors rounded-none ${
                  pathname === href
                    ? "bg-white text-black font-medium"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-xs text-gray-500 truncate max-w-[160px]">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-white px-3 py-1.5 transition-colors"
            >
              <LogOut size={13} />
              Sign out
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-white p-1"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-black">
            {navItems.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-5 py-4 text-sm border-b border-gray-800 transition-colors ${
                  pathname === href
                    ? "text-white font-medium bg-gray-900"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-xs text-gray-500 truncate max-w-[200px]">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-10">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-black z-40">
        <div className="flex">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-xs transition-colors ${
                pathname === href
                  ? "bg-black text-white"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom padding on mobile to avoid tab bar overlap */}
      <div className="md:hidden h-16" />
    </div>
  );
}
