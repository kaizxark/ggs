import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header className="w-full bg-[#f6eddd] border-b border-[#ebdcc7] font-['Schibsted_Grotesk',sans-serif] relative z-50">
      <div className="max-w-[1240px] mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-[8px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center shadow-xs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 10.5L12 4L20 10.5V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V10.5Z" stroke="#f6eddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="13.5" r="2.5" fill="#f6eddd"/>
            </svg>
          </motion.div>
          <span className="font-bold text-base sm:text-lg text-[#34291C] font-['Space_Grotesk'] tracking-tight group-hover:opacity-80 transition-opacity">
            Global Kids School
          </span>
        </Link>

        {/* Desktop Links & Enquire CTA */}
        <div className="hidden md:flex items-center gap-8">
          <div className="flex items-center gap-6 text-xs font-medium text-[#6F6046]">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative hover:text-[#34291C] transition-colors py-1 ${
                    isActive ? "text-[#34291C] font-bold" : ""
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[#9e3b26] rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-[20px] bg-[#9e3b26] hover:bg-[#852f1e] text-[#f6eddd] text-xs font-bold transition-colors shadow-xs select-none cursor-pointer"
            >
              Enquire
            </Link>
          </motion.div>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-3">
          <Link
            href="/contact"
            className="px-3.5 py-1.5 rounded-[16px] bg-[#9e3b26] text-[#f6eddd] text-xs font-bold"
          >
            Enquire
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#34291C] focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden bg-[#f6eddd] border-t border-[#ebdcc7]"
          >
            <div className="px-6 pb-5 pt-2 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block py-2 text-sm font-medium transition-colors ${
                    location === link.href ? "text-[#9e3b26] font-bold" : "text-[#34291C]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
