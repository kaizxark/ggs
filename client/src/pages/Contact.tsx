import React, { useState } from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Calendar,
  MessageSquare
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
    <div className="min-h-screen bg-[#faf9f5] text-[#122824] font-['DM_Sans',sans-serif]">
      <Navbar />

      {/* Hero Header */}
      <section className="py-20 border-b border-[#e5ebe7] bg-gradient-to-tr from-[#f2f7f4] via-[#faf9f5] to-[#fcfcfb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#1f5e54] bg-[#e4efe9] px-3.5 py-1 rounded-full">
              Admissions & Connect
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold font-['Manrope'] tracking-tight text-[#122824]">
              Start your child’s journey at Global Kids School.
            </h1>
            <p className="text-base sm:text-lg text-[#556c65] leading-relaxed">
              We welcome families to schedule campus tours, converse with educators, and discover our learning environment in Tumakuru firsthand.
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid: Details + Contact Form */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Left Column: Campus Info & Timings */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-3">
              <h2 className="text-2xl font-extrabold font-['Manrope'] text-[#122824]">
                Campus & Contact Info
              </h2>
              <p className="text-sm text-[#556c65]">
                Reach us via phone or stop by during our designated admissions desk hours.
              </p>
            </div>

            <div className="space-y-4">
              {/* Phone Card */}
              <div className="p-6 rounded-3xl bg-white border border-[#e5ebe7] space-y-2 hover:border-[#1f5e54]/30 transition-all shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3ef] text-[#1f5e54] flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#122824] pt-2">Admissions Helpline</h3>
                <div className="space-y-1">
                  <a
                    href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                    className="text-base font-extrabold text-[#1f5e54] hover:underline block"
                  >
                    {schoolInfo.contact.primaryPhone}
                  </a>
                  <p className="text-xs text-[#637a74]">Office Line: {schoolInfo.contact.secondaryPhone}</p>
                </div>
              </div>

              {/* Address Card */}
              <div className="p-6 rounded-3xl bg-white border border-[#e5ebe7] space-y-2 hover:border-[#1f5e54]/30 transition-all shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3ef] text-[#1f5e54] flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#122824] pt-2">Campus Location</h3>
                <p className="text-xs text-[#556c65] leading-relaxed">
                  {schoolInfo.address.full}
                </p>
              </div>

              {/* Hours Card */}
              <div className="p-6 rounded-3xl bg-white border border-[#e5ebe7] space-y-2 hover:border-[#1f5e54]/30 transition-all shadow-xs">
                <div className="w-10 h-10 rounded-2xl bg-[#edf3ef] text-[#1f5e54] flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#122824] pt-2">Office & Visiting Hours</h3>
                <p className="text-xs text-[#556c65]">
                  {schoolInfo.contact.officeHours}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-7 bg-white p-8 sm:p-12 rounded-[32px] border border-[#e2eae6] shadow-xl shadow-[#122824]/5">
            {success ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-[#e4efe9] text-[#1f5e54] flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-extrabold font-['Manrope'] text-[#122824]">
                  Enquiry Received
                </h3>
                <p className="text-sm text-[#556c65] max-w-sm leading-relaxed">
                  Thank you for your interest in Global Kids School. A member of our admissions team will contact you shortly with details.
                </p>
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="mt-4 px-6 py-2.5 rounded-xl border border-[#d2dfd8] text-xs font-bold text-[#122824] hover:bg-[#faf9f5]"
                >
                  Send another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="text-2xl font-extrabold font-['Manrope'] text-[#122824]">
                    Book a Visit or Enquire
                  </h3>
                  <p className="text-xs text-[#556c65] mt-1">
                    Fill out the form below to receive syllabus information and schedule an on-campus tour.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#344843]">Parent / Guardian Name *</label>
                    <input
                      required
                      placeholder="e.g. Anjali Sharma"
                      className="w-full px-4 py-3 rounded-xl border border-[#d2dfd8] focus:border-[#1f5e54] focus:ring-1 focus:ring-[#1f5e54] outline-none text-xs bg-[#faf9f5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#344843]">Mobile Number *</label>
                    <input
                      required
                      type="tel"
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-4 py-3 rounded-xl border border-[#d2dfd8] focus:border-[#1f5e54] focus:ring-1 focus:ring-[#1f5e54] outline-none text-xs bg-[#faf9f5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#344843]">Child's Name</label>
                    <input
                      placeholder="e.g. Aarav"
                      className="w-full px-4 py-3 rounded-xl border border-[#d2dfd8] focus:border-[#1f5e54] focus:ring-1 focus:ring-[#1f5e54] outline-none text-xs bg-[#faf9f5]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#344843]">Grade of Interest *</label>
                    <select
                      required
                      className="w-full px-4 py-3 rounded-xl border border-[#d2dfd8] focus:border-[#1f5e54] focus:ring-1 focus:ring-[#1f5e54] outline-none text-xs bg-[#faf9f5]"
                    >
                      <option value="">Select Grade</option>
                      <option value="playgroup">Playgroup / Nursery</option>
                      <option value="kindergarten">LKG / UKG</option>
                      <option value="primary">Grade 1 to 5</option>
                      <option value="middle">Grade 6 to 8</option>
                      <option value="high">Grade 9 to 10</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#344843]">Questions or Specific Requirements</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us what you are looking for, or any specific questions about admissions..."
                    className="w-full px-4 py-3 rounded-xl border border-[#d2dfd8] focus:border-[#1f5e54] focus:ring-1 focus:ring-[#1f5e54] outline-none text-xs bg-[#faf9f5]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white font-extrabold text-xs shadow-md transition-colors disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Details...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Admissions Enquiry</span>
                      <ArrowRight className="w-4 h-4 text-[#ffc87a]" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
