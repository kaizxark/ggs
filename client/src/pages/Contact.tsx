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
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      <section className="py-12 border-b border-[#e5d8c3]">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 flex flex-col items-start gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest text-[#9e3b26] hover:text-[#34291C] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Home
          </Link>
          <div className="max-w-2xl space-y-2">
            <h1 className="text-3xl sm:text-5xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
              Talk to the school team.
            </h1>
            <p className="text-sm sm:text-base text-[#6F6046] leading-relaxed">
              We welcome families to schedule campus tours, converse with educators, and discover our learning environment in Tumakuru firsthand.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid: Form (7 cols) + Side-stack (5 cols) */}
      <section className="py-16 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Left Column (7 cols): Enquiry Form */}
          <div className="lg:col-span-7 bg-[#F9F1E0] p-8 sm:p-10 rounded-[20px] border border-[#e2d5c0] shadow-xs">
            {success ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-[12px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                  Enquiry Request Received
                </h3>
                <p className="text-xs sm:text-sm text-[#6F6046] max-w-sm leading-relaxed">
                  Thank you for your interest in Global Kids School. A member of our admissions leadership will contact you shortly to arrange a discussion.
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-6 px-6 py-3 rounded-[10px] border border-[#d8cbb5] font-bold text-xs text-[#34291C] hover:bg-[#ece4d4] transition-colors"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="border-b border-[#e2d5c0] pb-4 mb-2">
                  <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                    Book a Campus Visit or Enquire
                  </h3>
                  <p className="text-xs text-[#6F6046] mt-1">
                    Complete this form to receive our official prospectus or schedule an on-campus tour.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#34291C]">Parent / Guardian Name <span className="text-[#9e3b26]">*</span></label>
                    <input
                      required
                      placeholder="e.g. Ramesh Sharma"
                      className="w-full px-4 py-3.5 rounded-[10px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#34291C]">Mobile Contact <span className="text-[#9e3b26]">*</span></label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-4 py-3.5 rounded-[10px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all shadow-2xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#34291C]">Child's Name</label>
                    <input
                      placeholder="e.g. Aarav"
                      className="w-full px-4 py-3.5 rounded-[10px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all shadow-2xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#34291C]">Grade of Interest <span className="text-[#9e3b26]">*</span></label>
                    <select
                      required
                      className="w-full px-4 py-3.5 rounded-[10px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] transition-all shadow-2xs"
                    >
                      <option value="">Select Target Grade</option>
                      <option value="playgroup">Pre-Primary (Playgroup, LKG, UKG)</option>
                      <option value="primary">Primary (Grades 1 to 5)</option>
                      <option value="middle">Middle School (Grades 6 to 8)</option>
                      <option value="high">High School (Grades 9 to 10)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#34291C]">Specific Requirements or Questions</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us what you represent conceptually, or any specific questions regarding CBSE academics..."
                    className="w-full px-4 py-3.5 rounded-[10px] border border-[#d8cbb5] focus:border-[#9e3b26] focus:ring-1 focus:ring-[#9e3b26] outline-none text-xs sm:text-sm bg-[#f6eddd] text-[#34291C] placeholder:text-[#a09079] transition-all shadow-2xs resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-[10px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-sm shadow-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Transmitting Data...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Registration Request</span>
                        <ArrowRight className="w-4 h-4 text-[#f6eddd]" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Column (5 cols): Side-stack Info Cards */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">

            {/* School Details Card */}
            <div className="p-8 rounded-[20px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-xs space-y-6">
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C] border-b border-[#e2d5c0] pb-4">
                Core Directory
              </h3>

              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[8px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Official Admissions Line</h4>
                    <a
                      href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                      className="text-sm font-bold text-[#9e3b26] hover:underline block mt-0.5"
                    >
                      {schoolInfo.contact.primaryPhone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[8px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Electronic Mail</h4>
                    <a
                      href={`mailto:${schoolInfo.contact.email}`}
                      className="text-xs text-[#6F6046] hover:text-[#9e3b26] block mt-0.5 transition-colors"
                    >
                      {schoolInfo.contact.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[8px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#34291C]">Campus Location</h4>
                    <p className="text-xs text-[#6F6046] leading-relaxed mt-0.5">
                      {schoolInfo.address.full}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visit Planning Card (Dark) */}
            <div className="p-8 rounded-[20px] bg-[#34291C] text-[#f6eddd] border border-[#483928] shadow-xl space-y-4">
              <div className="flex items-center gap-3 border-b border-[#483928] pb-4 mb-2">
                <Clock className="w-5 h-5 text-[#e28743]" />
                <h3 className="text-lg font-bold font-['Space_Grotesk'] text-[#f6eddd]">
                  Visiting Timings
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#d5cabb] leading-relaxed">
                We strongly recommend fixing a prior appointment for a comprehensive guided tour by our academic coordinators.
              </p>
              <div className="pt-2">
                <strong className="block text-sm font-bold text-[#f6eddd]">{schoolInfo.contact.officeHours}</strong>
                <span className="text-[11px] text-[#a09079]">Excluding national holidays.</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
