import React, { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Heart,
  Users,
  Compass,
  Lightbulb,
  Target,
  Calendar,
  Phone,
  GraduationCap,
  Palette,
  Trophy,
  Clock,
  MapPin,
  ArrowUpRight,
  Sun,
  Coffee,
  Activity,
  Layers,
  Check,
  Award,
  FileCheck
} from "lucide-react";

export default function Home() {
  const [selectedWing, setSelectedWing] = useState<"early" | "primary" | "secondary">("early");
  const [activeTimeIndex, setActiveTimeIndex] = useState(0);

  const dailySchedule = [
    {
      time: "08:45 AM",
      title: "Morning Assembly & Value Meditation",
      desc: "Community songs, news sharing, mindful breathing, and theme-of-the-day discussions that build morning readiness.",
      icon: Sun,
      tag: "Social Connection"
    },
    {
      time: "09:30 AM",
      title: "Interactive Core Conceptual Blocks",
      desc: "Mathematics, Languages, and General Science taught using physical manipulatives, phonics kits, and interactive inquiry.",
      icon: BookOpen,
      tag: "Foundational Academics"
    },
    {
      time: "11:30 AM",
      title: "Nutritious Snack & Free Play",
      desc: "Structured social recess under teacher supervision where etiquette, peer cooperation, and sharing are practiced naturally.",
      icon: Coffee,
      tag: "Wellbeing & Life Skills"
    },
    {
      time: "01:00 PM",
      title: "STEM Discovery & Creative Arts",
      desc: "Hands-on model building, art & craft, environmental science observations, and language storytelling circles.",
      icon: Lightbulb,
      tag: "Experiential Inquiry"
    },
    {
      time: "03:00 PM",
      title: "Physical Sports, Drills & Yoga",
      desc: "Agility workouts, team sport drills, obstacle coordination, and relaxing cooldown sessions before dismissal.",
      icon: Trophy,
      tag: "Physical Agility"
    },
  ];

  const wingsData = {
    early: {
      badge: "Ages 3 to 6 Years",
      title: "Foundational Playgroup, Nursery & Kindergarten",
      desc: "We prioritize joyful sensory discovery, phonetic language immersion, numeracy play, fine motor skills, and social confidence in a warm, child-safe setup.",
      outcomes: [
        "Phonics & early bilingual vocabulary acquisition",
        "Sensory motor coordination & tactile activities",
        "Social sharing, emotional security & self-expression",
        "No high-stakes testing — continuous joyful observation"
      ],
      ratio: "1:15 Teacher-Child Attention",
      timing: "9:00 AM – 1:00 PM"
    },
    primary: {
      badge: "Grades 1 to 5",
      title: "Primary Wing: Conceptual Mastery & Curiosity",
      desc: "Transitioning from play-based discovery into structured inquiry, mathematical thinking, environmental studies, expressive English, and creative arts.",
      outcomes: [
        "Strong foundation in mental math & problem solving",
        "Reading fluency, cursive writing & creative journaling",
        "General science practical demonstrations & nature studies",
        "Introductory computer skills & logical reasoning"
      ],
      ratio: "Individualized Student Mentoring",
      timing: "9:00 AM – 3:30 PM"
    },
    secondary: {
      badge: "Grades 6 to 10",
      title: "Middle & High School: Purpose & Academic Excellence",
      desc: "Aligning rigorous CBSE-pattern curriculum with critical analysis, science laboratory practicals, debate, leadership roles, and holistic board readiness.",
      outcomes: [
        "In-depth physics, chemistry, biology & advanced mathematics",
        "Debate, public speaking, drama & cultural presentations",
        "Leadership clubs, quiz leagues & competitive exam preparedness",
        "Comprehensive character and career readiness"
      ],
      ratio: "Subject Specialist Educators",
      timing: "9:00 AM – 4:00 PM"
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#1a2d28] font-['DM_Sans',sans-serif] selection:bg-[#ffc87a] selection:text-[#122824]">
      <Navbar />

      {/* Hero Section: Editorial & Prestigious */}
      <section className="relative overflow-hidden pt-10 pb-20 lg:pt-16 lg:pb-28 border-b border-[#e5ebe7] bg-gradient-to-b from-[#f2f7f4] via-[#faf9f5] to-[#faf9f5]">
        {/* Subtle Decorative Grid Pattern Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1b433b0a_1px,transparent_1px),linear-gradient(to_bottom,#1b433b0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">

            {/* Left Main Editorial Text */}
            <div className="lg:col-span-7 space-y-7">
              {/* Institution Seal Ribbon */}
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#e8f1ed] border border-[#cbdcd5] text-[#122824] text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#e68a2e]" />
                <span className="tracking-wide uppercase text-[11px] font-extrabold text-[#122824]">
                  Puttanapalya, Vokkodi • Tumakuru
                </span>
              </div>

              {/* Editorial Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight leading-[1.12]">
                Where <span className="text-[#1f5e54] underline decoration-[#ffc87a] decoration-4 underline-offset-8">curious minds</span> grow into confident doers.
              </h1>

              {/* Subtext */}
              <p className="text-base sm:text-lg text-[#4a5f59] leading-relaxed max-w-2xl font-normal">
                A nurturing school community in Tumakuru built around authentic learning, character, moral integrity, and joy. From early years to Grade 10, we make education meaningful, active, and inspiring.
              </p>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2.5 px-6 py-4 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white font-extrabold text-sm shadow-lg shadow-[#122824]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Enquire About Admissions</span>
                  <ArrowRight className="w-4 h-4 text-[#ffc87a]" />
                </Link>

                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-[#f2f7f4] text-[#122824] border border-[#cad9d3] font-bold text-sm shadow-2xs transition-all hover:border-[#122824]"
                >
                  <span>Our Educational Philosophy</span>
                </Link>
              </div>

              {/* Quick Trust Highlights */}
              <div className="pt-6 border-t border-[#e2eae6] grid grid-cols-3 gap-4">
                <div>
                  <div className="text-lg font-extrabold text-[#122824] font-['Manrope']">CBSE Pattern</div>
                  <div className="text-xs text-[#627771]">Curriculum & Pedagogy</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[#122824] font-['Manrope']">Safe Campus</div>
                  <div className="text-xs text-[#627771]">Vokkodi, Tumakuru</div>
                </div>
                <div>
                  <div className="text-lg font-extrabold text-[#122824] font-['Manrope']">Nursery – X</div>
                  <div className="text-xs text-[#627771]">Complete Schooling</div>
                </div>
              </div>
            </div>

            {/* Right Interactive Campus Overview Slate */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-[#122824] text-white p-7 sm:p-8 shadow-2xl border border-[#23453f] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#1f5e54] rounded-full blur-3xl opacity-30 pointer-events-none" />

                <div className="flex items-center justify-between pb-6 border-b border-[#23453f] relative z-10">
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-[#ffc87a] uppercase block">
                      Academic Session 2026–2027
                    </span>
                    <h3 className="text-xl font-bold font-['Manrope'] text-white mt-0.5">
                      Admissions Desk
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#1f5e54] text-[#ffc87a] text-xs font-bold border border-[#2d7d71]">
                    Open Now
                  </span>
                </div>

                {/* Information Rows */}
                <div className="py-6 space-y-4 relative z-10 text-xs">
                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a]">
                    <div className="w-8 h-8 rounded-xl bg-[#ffc87a]/20 text-[#ffc87a] flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold text-sm">Pre-Primary to High School</strong>
                      <p className="text-[#a5c5bd] mt-0.5">
                        Accepting applications for Playgroup, Nursery, LKG, UKG and Grades 1 through 10.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a]">
                    <div className="w-8 h-8 rounded-xl bg-[#ffc87a]/20 text-[#ffc87a] flex items-center justify-center shrink-0 mt-0.5">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold text-sm">Direct Admission Lines</strong>
                      <a href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`} className="text-[#ffc87a] font-bold block hover:underline text-sm mt-0.5">
                        {schoolInfo.contact.primaryPhone}
                      </a>
                      <span className="text-[#8baea5] text-[11px]">Office Desk: {schoolInfo.contact.secondaryPhone}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a]">
                    <div className="w-8 h-8 rounded-xl bg-[#ffc87a]/20 text-[#ffc87a] flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <strong className="block text-white font-bold text-sm">Campus Visiting Hours</strong>
                      <p className="text-[#a5c5bd] mt-0.5">
                        Monday to Saturday • 9:00 AM to 4:30 PM
                      </p>
                    </div>
                  </div>
                </div>

                {/* Direct Action */}
                <div className="pt-2 relative z-10">
                  <Link
                    href="/contact"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#e68a2e] hover:bg-[#f2993d] text-[#122824] text-xs font-extrabold shadow-md transition-colors"
                  >
                    <span>Schedule an In-Person Campus Walk</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The 3 Core Pillars: Contrast against standard rote learning */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1f5e54] bg-[#e4efe9] px-3.5 py-1 rounded-full">
              Foundational Philosophy
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
              Moving beyond memorization to genuine understanding.
            </h2>
          </div>
          <p className="text-sm text-[#556c65] max-w-md">
            At Global Kids School, learning is an active conversation. We build students who reason, question, experiment, and articulate their thoughts with clarity.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="rounded-3xl bg-white border border-[#e5ebe7] p-8 shadow-sm hover:shadow-xl hover:border-[#1f5e54]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#eaf4f0] text-[#1f5e54] flex items-center justify-center font-bold text-lg font-['Manrope'] group-hover:scale-105 transition-transform">
                01
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#e68a2e] block mb-1">
                  Active Pedagogy
                </span>
                <h3 className="text-xl font-extrabold text-[#122824] font-['Manrope']">
                  Learn with Curiosity
                </h3>
              </div>
              <p className="text-sm text-[#556c65] leading-relaxed">
                Rather than dictating answers, our teachers pose open-ended challenges. Children build mathematical concepts through manipulatives, science through lab observation, and language through reading circles.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-[#f0f4f2] text-xs font-bold text-[#1f5e54] flex items-center gap-1">
              <span>Inquiry-based classrooms</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="rounded-3xl bg-white border border-[#e5ebe7] p-8 shadow-sm hover:shadow-xl hover:border-[#1f5e54]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#fff3e0] text-[#b45309] flex items-center justify-center font-bold text-lg font-['Manrope'] group-hover:scale-105 transition-transform">
                02
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#b45309] block mb-1">
                  Emotional & Public Courage
                </span>
                <h3 className="text-xl font-extrabold text-[#122824] font-['Manrope']">
                  Grow with Confidence
                </h3>
              </div>
              <p className="text-sm text-[#556c65] leading-relaxed">
                Every child gets stage opportunities, group presentation roles, and individual mentor guidance. We celebrate effort, build resilience against failure, and cultivate confident speakers.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-[#f0f4f2] text-xs font-bold text-[#b45309] flex items-center gap-1">
              <span>Small-group mentoring</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="rounded-3xl bg-white border border-[#e5ebe7] p-8 shadow-sm hover:shadow-xl hover:border-[#1f5e54]/40 transition-all flex flex-col justify-between group">
            <div className="space-y-5">
              <div className="w-12 h-12 rounded-2xl bg-[#ebf4ff] text-[#1d4ed8] flex items-center justify-center font-bold text-lg font-['Manrope'] group-hover:scale-105 transition-transform">
                03
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8] block mb-1">
                  Moral & Civic Compass
                </span>
                <h3 className="text-xl font-extrabold text-[#122824] font-['Manrope']">
                  Lead with Purpose
                </h3>
              </div>
              <p className="text-sm text-[#556c65] leading-relaxed">
                Education is incomplete without high character. Kindness, empathy, environmental responsibility, respect for peers, and community service are practiced daily across all grades.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-[#f0f4f2] text-xs font-bold text-[#1d4ed8] flex items-center gap-1">
              <span>Values & community action</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Grade & Wing Navigator */}
      <section className="py-20 bg-white border-y border-[#e5ebe7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1f5e54] bg-[#e4efe9] px-3.5 py-1 rounded-full">
              Comprehensive Schooling
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
              A curriculum tailored for every developmental stage
            </h2>
          </div>

          {/* Wing Selector Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-2xl bg-[#edf3ef] border border-[#dbe6df] gap-1">
              <button
                type="button"
                onClick={() => setSelectedWing("early")}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "early"
                    ? "bg-[#122824] text-white shadow-md font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Pre-Primary (Nursery, LKG, UKG)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWing("primary")}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "primary"
                    ? "bg-[#122824] text-white shadow-md font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Primary Wing (Grades 1 – 5)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWing("secondary")}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "secondary"
                    ? "bg-[#122824] text-white shadow-md font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Middle & High (Grades 6 – 10)
              </button>
            </div>
          </div>

          {/* Wing Details Card */}
          <div className="p-8 sm:p-12 rounded-3xl bg-[#faf9f5] border border-[#e0e8e3] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ffc87a]/20 text-[#b45309] text-xs font-bold">
                {wingsData[selectedWing].badge}
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#122824] font-['Manrope']">
                {wingsData[selectedWing].title}
              </h3>
              <p className="text-sm text-[#556c65] leading-relaxed">
                {wingsData[selectedWing].desc}
              </p>

              <div className="space-y-2.5 pt-2">
                <strong className="text-xs font-bold uppercase tracking-wider text-[#122824] block">
                  Key Learning Milestones:
                </strong>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#415550]">
                  {wingsData[selectedWing].outcomes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#1f5e54] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white p-7 rounded-2xl border border-[#dce6e0] shadow-xs space-y-4">
              <h4 className="text-sm font-extrabold text-[#122824] font-['Manrope'] border-b border-[#edf3f0] pb-3">
                Wing Specifications
              </h4>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                  <span className="text-[#6d827c]">Daily Timings</span>
                  <span className="font-bold text-[#122824]">{wingsData[selectedWing].timing}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                  <span className="text-[#6d827c]">Attention Model</span>
                  <span className="font-bold text-[#122824]">{wingsData[selectedWing].ratio}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                  <span className="text-[#6d827c]">Co-Curriculars</span>
                  <span className="font-bold text-[#122824]">Sports, Art, Music & Yoga</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#6d827c]">Evaluation</span>
                  <span className="font-bold text-[#122824]">Continuous Growth Tracking</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/contact"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#122824] text-white text-xs font-bold hover:bg-[#1a3a34] transition-colors"
                >
                  <span>Enquire for this Grade</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#ffc87a]" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* A Day in the Life: Interactive Timeline */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="max-w-2xl space-y-3 mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-[#1f5e54] bg-[#e4efe9] px-3.5 py-1 rounded-full">
            Campus Daily Rhythm
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
            A Day in the Life at Global Kids School
          </h2>
          <p className="text-sm text-[#556c65]">
            Every day is structured to balance focused academic blocks, hands-on lab experiments, creative playtime, and physical sports.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Timeline Buttons on Left */}
          <div className="lg:col-span-5 space-y-2.5">
            {dailySchedule.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTimeIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTimeIndex(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-[#122824] text-white border-[#122824] shadow-md"
                      : "bg-white text-[#1a2d28] border-[#e2eae6] hover:border-[#1f5e54]/30"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? "bg-white/15 text-[#ffc87a]" : "bg-[#edf4f0] text-[#1f5e54]"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider block ${isActive ? "text-[#ffc87a]" : "text-[#718680]"}`}>
                        {item.time}
                      </span>
                      <strong className="text-sm font-bold font-['Manrope'] block">
                        {item.title}
                      </strong>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isActive ? "text-[#ffc87a] translate-x-1" : "text-[#b0c4bd]"}`} />
                </button>
              );
            })}
          </div>

          {/* Timeline Active Spotlight on Right */}
          <div className="lg:col-span-7 bg-[#1f5e54] text-white p-8 sm:p-12 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-white/15 text-[#ffc87a] text-xs font-bold border border-white/10">
                  {dailySchedule[activeTimeIndex].time}
                </span>
                <span className="text-xs font-bold text-[#b5ded4] uppercase tracking-wider">
                  {dailySchedule[activeTimeIndex].tag}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold font-['Manrope'] leading-snug">
                {dailySchedule[activeTimeIndex].title}
              </h3>

              <p className="text-sm text-[#d1eee6] leading-relaxed">
                {dailySchedule[activeTimeIndex].desc}
              </p>

              <div className="pt-4 border-t border-white/15 flex items-center justify-between text-xs text-[#b5ded4]">
                <span>Supervised by certified educators</span>
                <span className="text-[#ffc87a] font-bold">Vokkodi Campus</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Admissions Document Checklist & CTA */}
      <section className="py-20 bg-[#122824] text-white border-t border-[#1c3a34]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-7 space-y-6">
              <span className="text-xs font-extrabold uppercase tracking-widest text-[#ffc87a] bg-white/10 px-3 py-1 rounded-full">
                Admissions Blueprint
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-['Manrope'] tracking-tight leading-tight">
                Transparent & hassle-free admission process.
              </h2>
              <p className="text-sm text-[#a5c5bd] leading-relaxed max-w-xl">
                We believe in simple, welcoming enrollment. Reach out online or visit our campus in Vokkodi, Tumakuru to secure your child’s seat for the upcoming academic year.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#1a3832] border border-[#274f46] space-y-2">
                  <FileCheck className="w-5 h-5 text-[#ffc87a]" />
                  <h4 className="text-sm font-bold text-white">Documents Checklist</h4>
                  <p className="text-xs text-[#8eaead]">
                    Birth Certificate, Transfer Certificate (if applicable), Passport photos, and previous report card.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#1a3832] border border-[#274f46] space-y-2">
                  <Users className="w-5 h-5 text-[#ffc87a]" />
                  <h4 className="text-sm font-bold text-white">Friendly Interaction</h4>
                  <p className="text-xs text-[#8eaead]">
                    No stressful tests for young children. An informal conversational session to understand readiness.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Visit Scheduler Card */}
            <div className="lg:col-span-5 bg-white text-[#122824] p-8 rounded-3xl shadow-2xl space-y-5">
              <h3 className="text-xl font-extrabold font-['Manrope']">
                Book a Campus Tour
              </h3>
              <p className="text-xs text-[#586f68] leading-relaxed">
                Experience our classrooms, meet teachers, and review the academic curriculum in person.
              </p>

              <div className="space-y-3 pt-2">
                <a
                  href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#faf9f5] border border-[#e0e8e3] hover:border-[#1f5e54] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#e68a2e]" />
                    <div>
                      <span className="text-[10px] text-[#788e88] block">Admissions Coordinator</span>
                      <strong className="text-xs text-[#122824]">{schoolInfo.contact.primaryPhone}</strong>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#1f5e54]" />
                </a>

                <Link
                  href="/contact"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white font-extrabold text-xs shadow-md transition-colors"
                >
                  <span>Submit Online Enquiry</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#ffc87a]" />
                </Link>
              </div>

              <p className="text-[11px] text-center text-[#829993]">
                Office Timings: Mon – Sat (9:00 AM – 4:30 PM)
              </p>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
