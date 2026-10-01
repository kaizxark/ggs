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
    { label: "Home & Journey", href: "/" },
    { label: "Who We Are", href: "/about" },
    { label: "Admissions & Campus", href: "/contact" },
  ];

  return (
    <header className="w-full z-50 sticky top-0 font-['Schibsted_Grotesk',sans-serif]">
      {/* Top Heritage Notice Ribbon */}
      <div className="bg-[#34291C] text-[#ece4d4] text-[11px] sm:text-xs py-2 px-4 sm:px-8 flex items-center justify-between border-b border-[#473a2a]">
        <div className="max-w-[1280px] mx-auto w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-[#9e3b26] text-[#f6eddd] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f6eddd] animate-pulse" />
              Admissions 2026-27 Open
            </span>
            <span className="hidden sm:inline font-medium text-[#d5cabb]">
              Playgroup to Grade 10 • Puttanapalya, Vokkodi, Tumakuru
            </span>
          </div>

          <div className="flex items-center gap-5 font-medium">
            <a
              href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
              className="flex items-center gap-1.5 text-[#f6eddd] hover:text-[#e28743] transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-[#e28743]" />
              <span className="font-bold">{schoolInfo.contact.primaryPhone}</span>
            </a>
            <span className="hidden md:inline text-[#5c4a35]">/</span>
            <a
              href={`https://wa.me/91${schoolInfo.contact.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="hidden md:flex items-center gap-1 text-[#d5cabb] hover:text-white transition-colors"
            >
              <span>WhatsApp Desk</span>
              <ArrowUpRight className="w-3 h-3 text-[#e28743]" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Saffron & Ink Navbar */}
      <nav
        className={`w-full transition-all duration-300 ${
          scrolled
            ? "bg-[#f6eddd]/95 backdrop-blur-md shadow-md border-b border-[#e2d5c0] py-3.5"
            : "bg-[#f6eddd] border-b border-[#e7dac7] py-4"
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 flex items-center justify-between">
          {/* Brand Mark SVG & Crest */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-[12px] bg-[#9e3b26] text-white flex flex-col items-center justify-center shadow-md group-hover:bg-[#85301e] transition-colors relative overflow-hidden">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 11L12 4L20 11V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V11Z" stroke="#f6eddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="13" r="2.5" fill="#f6eddd"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg sm:text-xl text-[#34291C] font-['Space_Grotesk'] tracking-tight">
                  Global Kids School
                </span>
              </div>
              <p className="text-[11px] text-[#6F6046] font-medium tracking-wide flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5 text-[#9e3b26]" />
                Tumakuru • CBSE Curriculum Pattern
              </p>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-1 bg-[#ece4d4] p-1.5 rounded-[12px] border border-[#ded4c0]">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-[8px] text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#F9F1E0] text-[#34291C] shadow-xs font-bold"
                      : "text-[#6F6046] hover:text-[#34291C] hover:bg-[#F9F1E0]/60"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-[10px] border border-[#d5c8b2] text-xs font-semibold text-[#34291C] bg-[#F9F1E0] hover:bg-[#ece4d4] transition-colors shadow-2xs"
            >
              <LogIn className="w-3.5 h-3.5 text-[#9e3b26]" />
              <span>Portal Login</span>
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#9e3b26] hover:bg-[#85301e] text-[#f6eddd] text-xs font-bold shadow-md shadow-[#9e3b26]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Book Campus Visit</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#f6eddd]" />
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/login"
              className="p-2.5 rounded-[10px] border border-[#d5c8b2] text-[#34291C] bg-[#F9F1E0] text-xs font-bold shadow-2xs"
              title="Portal Login"
            >
              <LogIn className="w-4 h-4 text-[#9e3b26]" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-[10px] bg-[#ece4d4] text-[#34291C] hover:bg-[#dfd5c2] focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-3 px-4 pt-4 pb-5 border-t border-[#e2d5c0] bg-[#f6eddd] space-y-2.5">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-[10px] text-sm font-semibold ${
                    isActive
                      ? "bg-[#34291C] text-[#f6eddd]"
                      : "text-[#34291C] hover:bg-[#ece4d4]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-3 border-t border-[#e2d5c0] flex flex-col gap-2">
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] bg-[#9e3b26] text-[#f6eddd] font-bold text-sm shadow-sm"
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
