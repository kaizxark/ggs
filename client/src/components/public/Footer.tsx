import React from "react";
import { Link } from "wouter";
import { schoolInfo } from "@/data/school";
import {
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Clock,
  ExternalLink,
  Heart,
  ShieldCheck,
  Sparkles,
  ArrowUpRight
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#192d29] text-[#d6e3df] border-t border-[#25423c] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#294640]">
          {/* Col 1: School Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2f6f68] to-[#1f4e48] text-white flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-[#fbd38d]" />
              </div>
              <div>
                <span className="font-extrabold text-xl text-white font-['Manrope'] tracking-tight block">
                  Global Kids
                </span>
                <span className="text-xs text-[#8da59e] font-medium">School • Tumakuru</span>
              </div>
            </div>

            <p className="text-sm text-[#a8beba] leading-relaxed">
              Where curious minds grow into confident doers. A premier, nurturing school community in Tumakuru dedicated to holistic education, character, and experiential discovery.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href={schoolInfo.socials.instagram}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-lg bg-[#24403a] hover:bg-[#2f6f68] text-white flex items-center justify-center transition-colors"
                title="Follow us on Instagram"
              >
                <span className="text-xs font-bold">IG</span>
              </a>
              <a
                href={`https://wa.me/91${schoolInfo.contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-lg bg-[#24403a] hover:bg-[#25D366] text-white flex items-center justify-center transition-colors"
                title="Chat on WhatsApp"
              >
                <span className="text-xs font-bold">WA</span>
              </a>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-[#274841] hover:bg-[#345c54] text-xs font-bold text-[#e1f0ec] flex items-center gap-1.5 transition-colors ml-auto"
              >
                <span>ERP Portal</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#2d4c45] inline-block font-['Manrope']">
              Quick Navigation
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/" className="text-[#a8beba] hover:text-white transition-colors flex items-center gap-2">
                  <span>›</span> Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-[#a8beba] hover:text-white transition-colors flex items-center gap-2">
                  <span>›</span> About Our School
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#a8beba] hover:text-white transition-colors flex items-center gap-2">
                  <span>›</span> Admissions & Campus Visit
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[#a8beba] hover:text-white transition-colors flex items-center gap-2">
                  <span>›</span> Enquire Today
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-[#fbd38d] hover:text-white font-semibold transition-colors flex items-center gap-2">
                  <span>›</span> Staff & Parent ERP Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Educational Model */}
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#2d4c45] inline-block font-['Manrope']">
              Learning Philosophy
            </h4>
            <ul className="space-y-3 text-xs text-[#a8beba]">
              <li className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#fbd38d] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Curiosity-Led Learning</strong>
                  Encouraging inquiry, interactive exploration, and joyful discovery.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#68d391] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Holistic Growth</strong>
                  Balancing foundational academics, sports, cultural arts & life skills.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Heart className="w-4 h-4 text-[#fc8181] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-semibold">Caring Mentorship</strong>
                  Small class ratios ensuring individualized attention and safety.
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: Campus Contact & Location */}
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-4 pb-1 border-b border-[#2d4c45] inline-block font-['Manrope']">
              Contact & Location
            </h4>
            <div className="space-y-3 text-sm text-[#a8beba]">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#fbd38d] shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white">Global Kids School Campus</p>
                  <p className="text-xs text-[#9eb2ae] leading-relaxed mt-0.5">
                    {schoolInfo.address.full}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#68d391] shrink-0 mt-1" />
                <div>
                  <a
                    href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                    className="hover:text-white font-semibold block text-white transition-colors"
                  >
                    {schoolInfo.contact.primaryPhone}
                  </a>
                  <p className="text-xs text-[#8da59e]">Admissions Desk: {schoolInfo.contact.secondaryPhone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#8da59e] shrink-0" />
                <span className="text-xs">{schoolInfo.contact.officeHours}</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#8da59e] shrink-0" />
                <a href={`mailto:${schoolInfo.contact.email}`} className="text-xs hover:text-white transition-colors">
                  {schoolInfo.contact.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#829993]">
          <p>© {new Date().getFullYear()} Global Kids School, Tumakuru. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>CBSE Pattern Methodology</span>
            <span>•</span>
            <span>Playgroup to Class 10</span>
            <span>•</span>
            <Link href="/login" className="hover:text-white text-[#b0cbc5]">
              Staff ERP Access
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
