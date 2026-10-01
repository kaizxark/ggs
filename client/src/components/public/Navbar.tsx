import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { schoolInfo } from "@/data/school";
import {
  Phone,
  MapPin,
  Clock,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  LogIn,
  GraduationCap,
  ShieldCheck,
  HeartHandshake
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
    { label: "About Us", href: "/about" },
    { label: "Contact & Admissions", href: "/contact" },
  ];

  return (
    <header className="w-full z-50 sticky top-0 transition-all duration-200">
      {/* Top Announcement Bar */}
      <div className="bg-[#214e49] text-[#e3f0ec] text-xs py-2 px-4 sm:px-8 flex flex-wrap items-center justify-between gap-2 border-b border-[#2d645e]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-[#3a7c73] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-[#fbd38d]" /> Admissions Open
          </span>
          <span className="hidden sm:inline font-medium">Academic Year 2026–27 • Playgroup to Grade 10</span>
          <span className="sm:hidden font-medium">AY 2026–27 • Admissions Open</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <a
            href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-[#fbd38d]" />
            <span className="font-semibold">{schoolInfo.contact.primaryPhone}</span>
          </a>
          <span className="hidden md:inline text-[#3a7c73]">|</span>
          <span className="hidden md:flex items-center gap-1 text-[#b5d3cb]">
            <MapPin className="w-3.5 h-3.5" />
            Tumakuru, Karnataka
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <nav
        className={`w-full transition-all duration-200 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-[#e2e9e5] py-3.5 px-4 sm:px-8"
            : "bg-[#fbfcfb] border-b border-[#e9efe9] py-4 px-4 sm:px-8"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2f6f68] to-[#1f4e48] text-white flex items-center justify-center shadow-md shadow-[#2f6f68]/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6 text-[#fbd38d]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl text-[#243530] font-['Manrope'] tracking-tight">
                  Global Kids
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[#e8f3ef] text-[#2f6f68] font-bold">
                  School
                </span>
              </div>
              <p className="text-[11px] text-[#71847e] font-medium tracking-wide">
                Tumakuru, Karnataka
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "text-[#2f6f68] bg-[#eef6f3]"
                      : "text-[#4d5e59] hover:text-[#214e49] hover:bg-[#f2f7f4]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cde0d8] text-xs font-bold text-[#2f6f68] bg-[#f5faf8] hover:bg-[#eaf4f0] transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Portal Login</span>
            </Link>

            <Link
              href="/contact"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2f6f68] hover:bg-[#255b55] text-white text-xs font-bold shadow-sm shadow-[#2f6f68]/25 transition-all hover:shadow-md hover:translate-y-[-1px]"
            >
              <span>Enquire Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <Link
              href="/login"
              className="p-2 rounded-lg border border-[#d2e2db] text-[#2f6f68] text-xs font-bold bg-[#f3f9f6]"
            >
              <LogIn className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#30403b] hover:bg-[#eef3f0] focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[#e2eae5] space-y-2 pb-2">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-semibold ${
                    isActive
                      ? "text-[#2f6f68] bg-[#eef6f3]"
                      : "text-[#4d5e59] hover:bg-[#f2f7f4]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-[#e2eae5] flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#cde0d8] text-sm font-bold text-[#2f6f68] bg-[#f5faf8]"
              >
                <LogIn className="w-4 h-4" />
                <span>School ERP / Staff Portal</span>
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2f6f68] text-white text-sm font-bold shadow-sm"
              >
                <span>Admissions Enquiry</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
