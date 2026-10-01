import React from "react";
import { Link } from "wouter";
import { schoolInfo } from "@/data/school";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Heart,
  ShieldCheck,
  Sparkles,
  ArrowUpRight
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#34291C] text-[#ece4d4] border-t border-[#4a3c2b] pt-16 pb-10 font-['Schibsted_Grotesk',sans-serif]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#473928]">
          {/* Col 1: School Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center shadow-md">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 11L12 4L20 11V19C20 19.5523 19.5523 20 19 20H5C4.44772 20 4 19.5523 4 19V11Z" stroke="#f6eddd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="2" fill="#f6eddd"/>
                </svg>
              </div>
              <div>
                <span className="font-bold text-xl text-[#f6eddd] font-['Space_Grotesk'] tracking-tight block">
                  Global Kids School
                </span>
                <span className="text-xs text-[#c4b6a1] font-medium">Vokkodi, Tumakuru</span>
              </div>
            </div>

            <p className="text-sm text-[#c7baa6] leading-relaxed">
              Where active curiosity builds lifelong character. A premier institution in Tumakuru dedicated to holistic CBSE education, deep conceptual mastery, and ethical growth.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href={schoolInfo.socials.instagram}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-[8px] bg-[#423424] hover:bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center transition-colors font-bold text-xs"
                title="Follow us on Instagram"
              >
                IG
              </a>
              <a
                href={`https://wa.me/91${schoolInfo.contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-[8px] bg-[#423424] hover:bg-[#25D366] text-[#f6eddd] flex items-center justify-center transition-colors font-bold text-xs"
                title="Chat on WhatsApp"
              >
                WA
              </a>
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-[8px] bg-[#423424] hover:bg-[#9e3b26] text-xs font-bold text-[#f6eddd] flex items-center gap-1.5 transition-colors ml-auto border border-[#52412e]"
              >
                <span>ERP Portal</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#f6eddd]" />
              </Link>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-[#f6eddd] text-xs font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#52412e] inline-block font-['Space_Grotesk']">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-[#c7baa6] hover:text-[#f6eddd] transition-colors flex items-center gap-2">
                  <span className="text-[#9e3b26]">›</span> Home & Journey
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[#c7baa6] hover:text-[#f6eddd] transition-colors flex items-center gap-2">
                  <span className="text-[#9e3b26]">›</span> Who We Are & Story
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#c7baa6] hover:text-[#f6eddd] transition-colors flex items-center gap-2">
                  <span className="text-[#9e3b26]">›</span> Admissions & Campus Visit
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#c7baa6] hover:text-[#f6eddd] transition-colors flex items-center gap-2">
                  <span className="text-[#9e3b26]">›</span> Enquire Online
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-[#e28743] hover:text-white font-semibold transition-colors flex items-center gap-2">
                  <span className="text-[#9e3b26]">›</span> Staff & Parent Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Educational Model */}
          <div>
            <h4 className="text-[#f6eddd] text-xs font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#52412e] inline-block font-['Space_Grotesk']">
              Educational Philosophy
            </h4>
            <ul className="space-y-3 text-xs text-[#c7baa6]">
              <li className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#e28743] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#f6eddd] block font-semibold">Inquiry-First Learning</strong>
                  Encouraging curiosity, tactile exploration, and independent questions.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#2C5B6B] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#f6eddd] block font-semibold">Holistic Growth</strong>
                  Balancing core academics, athletics, cultural expression, and life skills.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Heart className="w-4 h-4 text-[#9e3b26] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#f6eddd] block font-semibold">Caring Mentorship</strong>
                  1:15 ratio ensuring individualized attention and emotional safety.
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: Campus Contact & Location */}
          <div>
            <h4 className="text-[#f6eddd] text-xs font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#52412e] inline-block font-['Space_Grotesk']">
              Contact & Campus
            </h4>
            <div className="space-y-3 text-sm text-[#c7baa6]">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#e28743] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-[#f6eddd]">Global Kids School</p>
                  <p className="text-xs text-[#b8a993] leading-relaxed mt-0.5">
                    {schoolInfo.address.full}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#e28743] shrink-0 mt-1" />
                <div>
                  <a
                    href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                    className="hover:text-white font-semibold block text-[#f6eddd] transition-colors"
                  >
                    {schoolInfo.contact.primaryPhone}
                  </a>
                  <p className="text-xs text-[#b8a993]">Admissions: {schoolInfo.contact.secondaryPhone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#c7baa6] shrink-0" />
                <span className="text-xs">{schoolInfo.contact.officeHours}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#c7baa6] shrink-0" />
                <a href={`mailto:${schoolInfo.contact.email}`} className="text-xs hover:text-white transition-colors">
                  {schoolInfo.contact.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#a09079]">
          <p>© {new Date().getFullYear()} Global Kids School, Tumakuru. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>CBSE Pattern Methodology</span>
            <span>•</span>
            <span>Playgroup to Class 10</span>
            <span>•</span>
            <Link href="/login" className="hover:text-white text-[#d5c8b5]">
              Staff ERP Access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
