import React, { useState } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import { Link } from "wouter";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      toast.success("Enquiry received. Our admissions team will reach out shortly.");
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      {/* Header section with back navigation */}
      <section className="pt-8 pb-10 border-b border-[#e5d8c3]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#9e3b26] hover:text-[#34291C] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
          <div className="max-w-2xl space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
              Talk to the school team
            </h1>
            <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
              Ask about admissions, arrange a campus visit, or simply say hello. Send an enquiry below and our admissions team will get back to you promptly.
            </p>
          </div>
        </div>
      </section>

      {/* 7:5 Split Section: Form (Left) & Contact Details (Right) */}
      <section className="py-12 max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/* Left Column (7 cols): Enquiry Form */}
          <div className="lg:col-span-7 bg-[#F9F1E0] p-6 sm:p-8 rounded-[18px] border border-[#e2d5c0] shadow-xs">
            {success ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                  Enquiry Request Received
                </h3>
                <p className="text-xs sm:text-sm text-[#6F6046] max-w-sm leading-relaxed">
                  Thank you for your interest in Global Kids School. Our admissions coordinator will contact you shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-4 px-5 py-2.5 rounded-[10px] border border-[#d8cbb5] font-bold text-xs text-[#34291C] hover:bg-[#ece4d4] transition-colors"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="border-b border-[#e2d5c0] pb-3 mb-2">
                  <h3 className="text-lg font-bold font-['Space_Grotesk'] text-[#34291C]">
                    Send an enquiry
                  </h3>
                  <p className="text-xs text-[#6F6046] mt-0.5">
                    A few details help the team respond well. Everything here goes directly to the school office.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#34291C]">Parent or guardian name <span className="text-[#9e3b26]">*</span></label>
                    <input
                      required
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#34291C]">Phone number <span className="text-[#9e3b26]">*</span></label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#34291C]">Email address</label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#34291C]">Child's age or grade of interest <span className="text-[#9e3b26]">*</span></label>
                    <select
                      required
                      className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] transition-all"
                    >
                      <option value="">Select Target Grade</option>
                      <option value="playgroup">Pre-Primary (Playgroup, Nursery, LKG, UKG)</option>
                      <option value="primary">Primary School (Grades 1 to 5)</option>
                      <option value="middle">Middle School (Grades 6 to 8)</option>
                      <option value="high">High School (Grades 9 to 10)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#34291C]">Preferred visit date (optional)</label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#34291C]">Message</label>
                  <textarea
                    rows={3}
                    placeholder="Any specific questions regarding admissions, transport, or curriculum..."
                    className="w-full px-3.5 py-2.5 rounded-[8px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all resize-none"
                  />
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="consent"
                    required
                    defaultChecked
                    className="mt-0.5 rounded border-[#d8cbb5] text-[#9e3b26] focus:ring-[#9e3b26]"
                  />
                  <label htmlFor="consent" className="text-[11px] text-[#6F6046] leading-snug">
                    I agree that the school may use these details to respond to my enquiry.
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-xs sm:text-sm shadow-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending enquiry...</span>
                      </>
                    ) : (
                      <>
                        <span>Send enquiry</span>
                        <ArrowRight className="w-4 h-4 text-[#f6eddd]" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column (5 cols): Side Stack */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">

            {/* School Contact Details Card */}
            <div className="p-6 rounded-[18px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-xs space-y-5">
              <h3 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C] border-b border-[#e2d5c0] pb-3">
                School contact details
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[6px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Campus Location</h4>
                    <p className="text-xs text-[#6F6046] leading-relaxed mt-0.5">
                      {schoolInfo.address.full}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[6px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Admissions Desk</h4>
                    <a
                      href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                      className="text-xs font-bold text-[#9e3b26] hover:underline block mt-0.5"
                    >
                      {schoolInfo.contact.primaryPhone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-[6px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Email</h4>
                    <a
                      href={`mailto:${schoolInfo.contact.email}`}
                      className="text-xs text-[#6F6046] hover:text-[#9e3b26] block mt-0.5 transition-colors"
                    >
                      {schoolInfo.contact.email}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Planning a Campus Visit Card (Dark) */}
            <div className="p-6 rounded-[18px] bg-[#34291C] text-[#f6eddd] border border-[#483928] shadow-lg space-y-3">
              <div className="flex items-center gap-2.5 border-b border-[#483928] pb-3">
                <Clock className="w-4 h-4 text-[#e28743]" />
                <h3 className="text-sm font-bold font-['Space_Grotesk'] text-[#f6eddd]">
                  Planning a campus visit?
                </h3>
              </div>
              <p className="text-xs text-[#d5cabb] leading-relaxed">
                Visiting hours are available Monday through Saturday. Send an enquiry and our team will confirm a time for your guided tour.
              </p>
              <div className="pt-1">
                <span className="block text-xs font-bold text-[#f6eddd]">{schoolInfo.contact.officeHours}</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
