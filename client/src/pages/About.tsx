import React from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import {
  HeartHandshake,
  Target,
  Lightbulb,
  Smile,
  ShieldCheck,
  Compass,
  Users
} from "lucide-react";
import { Link } from "wouter";

export default function About() {
  const values = [
    { name: "Kindness", icon: HeartHandshake, color: "text-rose-500", bg: "bg-rose-50" },
    { name: "Integrity", icon: ShieldCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
    { name: "Courage", icon: Target, color: "text-amber-600", bg: "bg-amber-50" },
    { name: "Respect", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
    { name: "Responsibility", icon: Compass, color: "text-indigo-600", bg: "bg-indigo-50" },
    { name: "Joy in Learning", icon: Smile, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#2c3d37] font-['DM_Sans',sans-serif]">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-b from-[#24463f] to-[#1e3b35] text-white pt-16 pb-24 px-4 sm:px-8 border-b border-[#25423c]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <span className="text-xs font-bold uppercase tracking-widest text-[#fbd38d] block font-['Manrope'] mb-2">
            About Global Kids School
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-['Manrope'] tracking-tight leading-tight">
            Nurturing the Next Generation of Leaders and Thinkers
          </h1>
          <p className="text-sm sm:text-base text-[#b1c7c2] leading-relaxed max-w-3xl mx-auto font-normal">
            We believe education is more than academics. It is the joyful process of discovering who you are, what you are capable of, and how you can contribute to the world.
          </p>
        </div>
      </section>

      {/* Who We Are & Approach */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a2d28] font-['Manrope'] flex items-center gap-3 border-l-4 border-[#2f6f68] pl-4">
              Who We Are
            </h2>
            <div className="text-sm text-[#546b65] leading-relaxed space-y-4">
              <p>
                Situated in the heart of Tumakuru, Global Kids School is a vibrant and caring educational ecosystem dedicated to shaping intelligent, empathetic, and confident young individuals.
              </p>
              <p>
                From lively early-years classrooms that spark wonder to middle school labs that foster critical inquiry, our campus is designed to support every phase of a child's developmental journey.
              </p>
              <p>
                We do not just drill facts; we build strong conceptual foundations in mathematics, sciences, languages, and the arts, while actively integrating physical fitness and moral education.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1a2d28] font-['Manrope'] flex items-center gap-3 border-l-4 border-[#d97706] pl-4">
              Our Educational Approach
            </h2>
            <div className="space-y-5">
              <div className="flex gap-4 p-5 rounded-2xl bg-white border border-[#e4ede8] shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-[#eef7f4] flex flex-shrink-0 items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-[#2f6f68]" />
                </div>
                <div>
                  <h4 className="font-bold text-[#233833] text-sm mb-1.5 font-['Manrope']">Curiosity-Driven Pedagogy</h4>
                  <p className="text-xs text-[#637a74] leading-relaxed">Children learn best when they are asking the questions. Our lesson plans prioritize interactive experiments, discussions, and project-based learning.</p>
                </div>
              </div>

              <div className="flex gap-4 p-5 rounded-2xl bg-white border border-[#e4ede8] shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-[#fdf5eb] flex flex-shrink-0 items-center justify-center">
                  <Target className="w-5 h-5 text-[#d97706]" />
                </div>
                <div>
                  <h4 className="font-bold text-[#233833] text-sm mb-1.5 font-['Manrope']">Structured Foundations</h4>
                  <p className="text-xs text-[#637a74] leading-relaxed">While we encourage free thought, we couple it with a rigorous academic framework aligning with the CBSE pattern to ensure deep mastery of core subjects.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 md:py-24 bg-white border-y border-[#e2ece7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#eef7f4] px-3 py-1 rounded-full mb-4 inline-block">
            Our Core Values
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight mb-12">
            The principles that guide our community
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((val, idx) => {
              const Icon = val.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-[#fbfdfc] border border-[#eef5f1] hover:shadow-md hover:border-[#2f6f68]/30 transition-all flex flex-col items-center text-center">
                  <div className={`w-14 h-14 rounded-full ${val.bg} ${val.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h4 className="font-extrabold text-[#243530] text-base font-['Manrope']">{val.name}</h4>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Our Community & Mentorship */}
      <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="bg-[#24463f] rounded-3xl p-8 sm:p-12 lg:p-16 flex flex-col lg:flex-row items-center gap-12 shadow-xl shadow-[#24463f]/10 overflow-hidden relative">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-[#2c584f] rounded-full blur-3xl opacity-50 pointer-events-none" />

          <div className="lg:w-1/2 space-y-6 relative z-10 text-white">
            <h2 className="text-2xl sm:text-4xl font-extrabold font-['Manrope'] leading-tight">
              A partnership between passionate educators and supportive parents.
            </h2>
            <p className="text-sm text-[#b9ceca] leading-relaxed">
              Our educators are mentors first. We hire teachers who exhibit deep patience, subject expertise, and a genuine love for working with children. Small class sizes allow them to recognize a child's unique talents or struggles early.
              <br/><br/>
              Furthermore, we consider parents as active partners in education, ensuring clear and consistent communication regarding a child's holistic progress through our unified staff portal.
            </p>
            <div className="pt-4">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#fbd38d] hover:bg-[#f2c16c] text-[#24463f] font-bold text-sm shadow-md transition-colors"
              >
                Join Our School Community
              </Link>
            </div>
          </div>

          <div className="lg:w-1/2 relative w-full h-[320px] rounded-2xl bg-[#f4f7f6] overflow-hidden flex items-center justify-center border-4 border-[#2c584f]/50">
            {/* Visual representation placeholder */}
            <div className="text-center p-6 space-y-3">
              <Users className="w-12 h-12 text-[#2f6f68] mx-auto opacity-30" />
              <p className="text-sm font-bold text-[#627772]">Dedicated Mentorship</p>
              <p className="text-[11px] text-[#869f9a]">Safe, nurturing environments fostering deep connections.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
