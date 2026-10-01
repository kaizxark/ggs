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
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate submission
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      toast.success("Enquiry submitted successfully! Our team will contact you soon.");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#2c3d37] font-['DM_Sans',sans-serif]">
      <Navbar />

      {/* Hero */}
      <section className="bg-[#f0f5f3] pt-16 pb-12 px-4 sm:px-8 text-center border-b border-[#e2e9e5]">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1a2d28] font-['Manrope'] tracking-tight">
            Connect with Global Kids School
          </h1>
          <p className="text-sm text-[#546b65]">
            Have questions about admissions or want to schedule a campus tour? Reach out to our team.
          </p>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* Contact Details & Info */}
          <div className="space-y-8">
            <h2 className="text-xl font-extrabold text-[#1a2d28] font-['Manrope']">Get in Touch Directly</h2>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-[#e4ede8] flex items-start gap-4 hover:border-[#2f6f68]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#eef7f4] text-[#2f6f68] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1b2d28] mb-1">Admissions & General Enquiries</h4>
                  <a href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`} className="text-sm font-semibold text-[#2f6f68] block hover:underline">
                    {schoolInfo.contact.primaryPhone}
                  </a>
                  <a href={`tel:${schoolInfo.contact.secondaryPhone.replace(/\s+/g, '')}`} className="text-xs text-[#637a74] block hover:underline">
                    {schoolInfo.contact.secondaryPhone}
                  </a>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#e4ede8] flex items-start gap-4 hover:border-[#2f6f68]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#fdf5eb] text-[#d97706] flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1b2d28] mb-1">Email Us</h4>
                  <a href={`mailto:${schoolInfo.contact.email}`} className="text-sm font-semibold text-[#2f6f68] hover:underline">
                    {schoolInfo.contact.email}
                  </a>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#e4ede8] flex items-start gap-4 hover:border-[#2f6f68]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1b2d28] mb-1">Campus Address</h4>
                  <p className="text-sm text-[#637a74] leading-relaxed">
                    {schoolInfo.address.full}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#e4ede8] flex items-start gap-4 hover:border-[#2f6f68]/30 transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#f8f9fa] text-[#637a74] flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1b2d28] mb-1">Our Working Hours</h4>
                  <p className="text-sm text-[#637a74]">{schoolInfo.contact.officeHours}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enquiry Form */}
          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-[#e8efe9] shadow-lg shadow-[#1e3b35]/5">
            {success ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-16 h-16 rounded-full bg-[#eef7f4] flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#2f6f68]" />
                </div>
                <h3 className="text-xl font-extrabold text-[#1a2d28] font-['Manrope']">Thank You!</h3>
                <p className="text-sm text-[#546b65] max-w-xs">
                  We have received your enquiry. Our admissions counselors will reach out to you shortly.
                </p>
                <button
                  onClick={() => setSuccess(false)}
                  className="mt-6 text-sm font-bold text-[#2f6f68] hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
             <form onSubmit={handleSubmit} className="space-y-5">
              <h2 className="text-xl font-extrabold text-[#1a2d28] font-['Manrope'] mb-6">Admissions Enquiry</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#556963]">Parent/Guardian Name *</label>
                  <input required className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#556963]">Mobile Number *</label>
                  <input required type="tel" className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#556963]">Child Name & Grade Interest *</label>
                <input required className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all" placeholder="e.g. Rahul, Class UKG" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#556963]">Message or Enquiry *</label>
                <textarea required rows={4} className="w-full px-4 py-3 rounded-xl border border-[#dce6e1] focus:border-[#2f6f68] focus:ring-1 focus:ring-[#2f6f68] outline-none text-sm transition-all" placeholder="What would you like to know about our school?" />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input required type="checkbox" className="mt-1 accent-[#2f6f68]" />
                <p className="text-[10px] text-[#819690] leading-tight">
                  I agree to Global Kids School contacting me with admissions information using the details provided.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#2f6f68] hover:bg-[#235852] text-white font-bold text-sm transition-all shadow-md mt-4 disabled:opacity-75"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Enquiry <ArrowRight className="w-4 h-4" /></>}
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
