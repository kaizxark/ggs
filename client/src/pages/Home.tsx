import React, { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  ArrowRight,
  BookOpen,
  Users,
  Compass,
  Lightbulb,
  Phone,
  GraduationCap,
  Clock,
  MapPin,
  Calendar,
  ShieldCheck,
  Award,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Quote
} from "lucide-react";

export default function Home() {
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);

  const milestones = [
    {
      year: "2011",
      title: "Founding Global Kids School",
      desc: "Established with a visionary cohort of 45 students in Puttanapalya, Vokkodi, dedicated to child-centric inquiry and holistic foundations.",
      badge: "Inception",
      detail: "Created small, ventilated learning spaces with a 1:12 teacher ratio to pioneer stress-free, phonetic learning in Tumakuru."
    },
    {
      year: "2016",
      title: "Primary Wing Expansion & STEM Labs",
      desc: "Inaugurated our dedicated STEM discovery labs, open play arena, and creative arts studio for Grades 1 through 5.",
      badge: "Growth",
      detail: "Integrated hands-on science experiments and concrete mathematical manipulatives into everyday daily inquiry blocks."
    },
    {
      year: "2021",
      title: "CBSE High School Wing & Digital Smart Hub",
      desc: "Expanded to full secondary grade levels (Grades 6 to 10) with complete Physics, Chemistry, and Biology practical laboratories.",
      badge: "Academics",
      detail: "Enhanced career mentoring, debate councils, and structured talent test preparation with dedicated subject faculty."
    },
    {
      year: "2026",
      title: "Campus Modernization & Holistic Leadership",
      desc: "Over 600+ students and 40+ dedicated educators thriving in an integrated campus ecosystem with GPS transport across Tumakuru.",
      badge: "Current Milestone",
      detail: "Admissions open for Academic Year 2026-27 across all wings from Playgroup to Class 10."
    }
  ];

  const stats = [
    { value: "15+", label: "Years of Educational Nurturing", sub: "Serving Tumakuru families since 2011" },
    { value: "600+", label: "Enrolled Active Learners", sub: "Playgroup to Grade 10" },
    { value: "1:15", label: "Educator to Student Ratio", sub: "Personalized mentorship and care" },
    { value: "100%", label: "Board & Grade Transition Rate", sub: "Excellence in holistic outcomes" },
  ];

  const differentiators = [
    {
      icon: Lightbulb,
      title: "Inquiry-First Pedagogy",
      tag: "Academics",
      desc: "Questions drive classroom dialogue rather than passive rote memorization. Students learn mathematics with manipulatives and science with hands-on lab experiments."
    },
    {
      icon: Award,
      title: "Confidence & Public Voice",
      tag: "Character",
      desc: "Every student actively participates in regular stage assemblies, debate circles, drama, and sports, nurturing self-assurance from an early age."
    },
    {
      icon: Compass,
      title: "Moral Compass & Empathy",
      tag: "Values",
      desc: "Kindness, environmental stewardship, civic responsibility, and mutual respect are practiced naturally through collaborative school projects."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      {/* Hero Banner with Gradient / Tone Overlay */}
      <section className="relative pt-12 pb-20 border-b border-[#e5d8c3] overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12">
          <div className="rounded-[20px] bg-[#34291C] text-[#f6eddd] p-8 sm:p-14 relative overflow-hidden shadow-xl border border-[#483928]">
            {/* Background Texture & Ambient Accent */}
            <div className="absolute -right-16 -top-16 w-96 h-96 rounded-full bg-[#9e3b26] opacity-25 blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-80 h-80 rounded-full bg-[#2C5B6B] opacity-20 blur-3xl pointer-events-none" />

            <div className="max-w-3xl space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#483928] border border-[#5d4a36] text-[#e28743] text-xs font-bold tracking-wide uppercase">
                <span className="w-2 h-2 rounded-full bg-[#9e3b26]" />
                <span>Our Journey So Far</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-['Space_Grotesk'] text-[#f6eddd] tracking-tight leading-[1.1]">
                Where active curiosity builds lifelong character.
              </h1>

              <p className="text-base sm:text-lg text-[#d5cabb] leading-relaxed max-w-2xl">
                Global Kids School provides purposeful, joyful education from Playgroup to Grade 10 in Tumakuru. We replace rote memorization with conceptual inquiry, mentor guidance, and moral grounding.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[10px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Schedule a Campus Walk</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[10px] bg-[#F9F1E0] hover:bg-[#ece4d4] text-[#34291C] font-bold text-sm transition-all border border-[#d8cbb5]"
                >
                  <span>Our Story & Philosophy</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5:7 Split Grid: Left Intro Note & Right Milestone Rail */}
      <section className="py-20 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Left Intro Note Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
            <span className="text-xs font-bold uppercase tracking-widest text-[#9e3b26] block">
              Institutional Evolution
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight leading-tight">
              A decade and a half of purposeful school leadership.
            </h2>
            <p className="text-sm sm:text-base text-[#6F6046] leading-relaxed">
              From our humble beginnings with 45 young learners to an expansive K-10 institution in Vokkodi, our mission remains unaltered: providing a calm, nurturing, and intellectually challenging sanctuary for every child.
            </p>

            <div className="p-6 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center font-bold">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#34291C] font-['Space_Grotesk']">
                    Admissions Desk 2026-27
                  </h4>
                  <span className="text-xs text-[#6F6046]">Direct admissions line • Vokkodi Campus</span>
                </div>
              </div>
              <p className="text-xs text-[#6F6046] leading-relaxed">
                Tour our classrooms, observe learning sessions, and consult with our academic coordinators.
              </p>
              <div className="pt-1">
                <a
                  href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                  className="text-sm font-bold text-[#9e3b26] hover:underline flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4" />
                  <span>{schoolInfo.contact.primaryPhone}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Right Milestone Rail Column (7 cols) */}
          <div className="lg:col-span-7 space-y-8 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#ded1bc]">
            {milestones.map((m, idx) => {
              const isExpanded = selectedMilestone === idx;
              return (
                <div key={idx} className="relative pl-10 group">
                  {/* Rail Dot */}
                  <div className="absolute left-0 top-2 w-7 h-7 rounded-full bg-[#f6eddd] border-2 border-[#9e3b26] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9e3b26]" />
                  </div>

                  {/* Milestone Card */}
                  <div className="p-6 sm:p-7 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] hover:border-[#9e3b26]/50 transition-all shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-[6px] bg-[#ece4d4] text-[#9e3b26] border border-[#ded4c0]">
                        {m.year}
                      </span>
                      <span className="text-[11px] font-semibold text-[#6F6046] uppercase tracking-wider">
                        {m.badge}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                      {m.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                      {m.desc}
                    </p>

                    {isExpanded && (
                      <div className="pt-3 mt-3 border-t border-[#e8ddc9] text-xs text-[#34291C] font-medium leading-relaxed bg-[#f2e9d8] p-3 rounded-[8px]">
                        {m.detail}
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedMilestone(isExpanded ? null : idx)}
                        className="text-xs font-bold text-[#9e3b26] hover:text-[#802a18] flex items-center gap-1 transition-colors"
                      >
                        <span>{isExpanded ? "Hide detail" : "View detail"}</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </button>

                      <span className="text-[11px] text-[#8e7e65]">CBSE Pattern Standard</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 4-Column Stat Cards */}
      <section className="py-16 bg-[#F9F1E0] border-y border-[#e2d5c0]">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, idx) => (
              <div key={idx} className="p-6 rounded-[16px] bg-[#f6eddd] border border-[#e2d5c0] space-y-2 shadow-xs">
                <div className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                  {s.value}
                </div>
                <h4 className="font-bold text-sm text-[#34291C] font-['Space_Grotesk']">
                  {s.label}
                </h4>
                <p className="text-xs text-[#6F6046]">
                  {s.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full-Width Dark Testimonial Quote Card */}
      <section className="py-20 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="rounded-[20px] bg-[#34291C] text-[#f6eddd] p-8 sm:p-14 relative overflow-hidden shadow-xl border border-[#483928]">
          <div className="max-w-3xl space-y-6 relative z-10">
            <Quote className="w-10 h-10 text-[#9e3b26]" />
            <blockquote className="text-xl sm:text-2xl font-medium font-['Space_Grotesk'] text-[#f6eddd] leading-snug">
              "Sending our two children to Global Kids School in Vokkodi was the single best decision we made. The teachers listen, they encourage curiosity rather than fear of examinations, and the campus environment is warm and disciplined."
            </blockquote>
            <div className="pt-2 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#9e3b26] text-white flex items-center justify-center font-bold text-sm">
                RS
              </div>
              <div>
                <strong className="block text-sm font-bold text-[#f6eddd]">Ramesh & Shobha Sharma</strong>
                <span className="text-xs text-[#c4b6a1]">Parents of Grade 4 & Grade 7 Learners • Tumakuru</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Column: What Makes Us Different */}
      <section className="py-16 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="max-w-2xl mb-12 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#9e3b26]">
            Our Educational Pillars
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
            What makes our classrooms different.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {differentiators.map((d, idx) => {
            const Icon = d.icon;
            return (
              <div key={idx} className="p-7 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] hover:border-[#9e3b26]/50 transition-all shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-[10px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#6F6046] block">
                    {d.tag}
                  </span>
                  <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                    {d.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                    {d.desc}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#e2d5c0] text-xs font-bold text-[#9e3b26] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Holistic Development</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dark CTA Band */}
      <section className="py-16 bg-[#34291C] text-[#f6eddd] border-t border-[#483928]">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
              Be part of the next chapter.
            </h2>
            <p className="text-sm text-[#c7baa6]">
              Admissions are now open for the 2026-27 academic session from Playgroup to Grade 10.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              href="/contact"
              className="px-6 py-3.5 rounded-[10px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-sm shadow-md transition-all"
            >
              Book a Campus Visit
            </Link>
            <Link
              href="/about"
              className="px-6 py-3.5 rounded-[10px] bg-[#F9F1E0] hover:bg-[#ece4d4] text-[#34291C] font-bold text-sm transition-all"
            >
              Who We Are
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
