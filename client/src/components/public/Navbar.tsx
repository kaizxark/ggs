import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { schoolInfo } from "@/data/school";
import {
  Phone,
  MapPin,
  Menu,
  X,
  ArrowRight,
  LogIn,
  Sparkles,
  Compass,
  ArrowUpRight
} from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "Our Story & Values", href: "/about" },
    { label: "Admissions & Campus", href: "/contact" },
  ];

  return (
    <header className="w-full z-50 sticky top-0 font-['DM_Sans',sans-serif]">
      {/* Top Heritage Notice Ribbon */}
      <div className="bg-[#122824] text-[#d6e5e1] text-[11px] sm:text-xs py-2 px-4 sm:px-8 flex items-center justify-between border-b border-[#1c3833]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-[#e68a2e] text-[#122824] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#122824] animate-pulse" />
              Admissions 2026–27
            </span>
            <span className="hidden sm:inline font-medium text-[#c0d4cf]">
              Playgroup to Grade 10 • Puttanapalya, Vokkodi, Tumakuru
            </span>
          </div>

          <div className="flex items-center gap-5 font-medium">
            <a
              href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 text-[#ffc87a] hover:text-white transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-bold">{schoolInfo.contact.primaryPhone}</span>
            </a>
            <span className="hidden md:inline text-[#2d5049]">/</span>
            <a
              href={`https://wa.me/91${schoolInfo.contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1 text-[#a5c5bd] hover:text-white transition-colors"
            >
              <span>WhatsApp Helpline</span>
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Glass Navbar */}
      <nav
        className={`w-full transition-all duration-300 ${
          scrolled
            ? "bg-[#faf9f5]/95 backdrop-blur-md shadow-md border-b border-[#e5ebe7] py-3.5"
            : "bg-[#faf9f5] border-b border-[#e9efe9] py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center justify-between">
          {/* Crest & Identity */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-2xl bg-[#122824] text-white flex flex-col items-center justify-center shadow-md group-hover:bg-[#1a3832] transition-colors border border-[#2b4c45]">
              <span className="font-['Manrope'] font-extrabold text-sm tracking-tighter text-[#ffc87a]">GKS</span>
              <span className="text-[7px] font-bold tracking-widest text-[#8ba8a1] uppercase">TMK</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl text-[#122824] font-['Manrope'] tracking-tight">
                  Global Kids School
                </span>
              </div>
              <p className="text-[11px] text-[#6d827c] font-medium tracking-wide flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-[#e68a2e]" />
                Tumakuru • CBSE Pattern Holistic Learning
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-1 bg-[#edf3ef] p-1.5 rounded-2xl border border-[#e0eae4]">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-white text-[#122824] shadow-xs font-extrabold"
                      : "text-[#586c66] hover:text-[#122824] hover:bg-white/60"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#d2dfd8] text-xs font-bold text-[#1a3b34] bg-white hover:bg-[#f0f6f3] transition-colors shadow-2xs"
            >
              <LogIn className="w-3.5 h-3.5 text-[#e68a2e]" />
              <span>Staff / Parent Portal</span>
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white text-xs font-bold shadow-md shadow-[#122824]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Book Campus Visit</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#ffc87a]" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/login"
              className="p-2.5 rounded-xl border border-[#d2dfd8] text-[#122824] bg-white text-xs font-bold shadow-2xs"
              title="Portal Login"
            >
              <LogIn className="w-4 h-4 text-[#e68a2e]" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-[#edf3ef] text-[#122824] hover:bg-[#e4ede8] focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 px-4 pt-4 pb-5 border-t border-[#e5ebe7] bg-[#faf9f5] space-y-2.5">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-bold ${
                    isActive
                      ? "bg-[#122824] text-white"
                      : "text-[#344843] hover:bg-[#edf3ef]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 border-t border-[#e5ebe7] flex flex-col gap-2">
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#e68a2e] text-[#122824] font-extrabold text-sm shadow-sm"
              >
                <span>Book Campus Visit</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
