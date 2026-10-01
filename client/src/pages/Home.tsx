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
  Award,
  Smile,
  ChevronRight,
  MapPin,
  Clock,
  ArrowUpRight
} from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"all" | "classrooms" | "activities" | "sports">("all");

  const pillars = [
    {
      title: "Learn with curiosity",
      tagline: "Active Inquiry & Discovery",
      description: "Encouraging children to ask questions, explore hands-on concepts, and develop lifelong passion for learning rather than rote memorization.",
      icon: Lightbulb,
      color: "bg-[#eef8f5] text-[#2f6f68] border-[#cbe5dc]",
      badge: "Foundational Pedagogy",
    },
    {
      title: "Grow with confidence",
      tagline: "Safe & Supportive Environment",
      description: "Small class sizes and empathetic educators help each child build stage courage, public speaking skills, emotional intelligence, and resilience.",
      icon: Sparkles,
      color: "bg-[#fdf6ec] text-[#b7791f] border-[#fae2c0]",
      badge: "Child-Centric Focus",
    },
    {
      title: "Lead with purpose",
      tagline: "Character, Values & Teamwork",
      description: "Instilling core values of kindness, integrity, environmental consciousness, and community spirit to prepare students for real-world leadership.",
      icon: Target,
      color: "bg-[#eff6ff] text-[#2b6cb0] border-[#bee3f8]",
      badge: "Holistic Development",
    },
  ];

  const experiences = [
    {
      title: "Experiential Classrooms",
      desc: "Interactive learning aids, digital audio-visual resources, and student-led group activities designed to make concepts memorable.",
      icon: BookOpen,
    },
    {
      title: "Sports & Physical Wellness",
      desc: "Daily fitness routines, structured outdoor sports, yoga, and games that promote motor skills, agility, and true sportsmanship.",
      icon: Trophy,
    },
    {
      title: "Arts, Music & Performance",
      desc: "Creative expression through drawing, crafts, cultural festivities, dance, and annual theatrical performances.",
      icon: Palette,
    },
    {
      title: "STEM & Digital Literacy",
      desc: "Age-appropriate introduction to science experiments, logical puzzles, mathematics manipulatives, and modern learning tools.",
      icon: Compass,
    },
    {
      title: "Value Education & Empathy",
      desc: "Character building, moral ethics, hygiene habits, and respectful interaction taught through everyday school practices.",
      icon: Heart,
    },
    {
      title: "Parent-School Synergy",
      desc: "Transparent progress reporting, active parent-teacher interactions, and regular workshops ensuring continuous growth.",
      icon: Users,
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Submit Enquiry",
      desc: "Fill our online form or call our admissions team to express interest in the upcoming academic year.",
    },
    {
      step: "02",
      title: "Campus Interaction & Tour",
      desc: "Visit our campus in Vokkodi, Tumakuru to meet our teachers and explore learning spaces.",
    },
    {
      step: "03",
      title: "Student Readiness",
      desc: "An informal, friendly conversational interaction to understand the child's strengths and learning stage.",
    },
    {
      step: "04",
      title: "Admission Confirmation",
      desc: "Complete simple documentation and welcome your child into the Global Kids School family!",
    },
  ];

  const galleryItems = [
    {
      category: "classrooms",
      title: "Interactive Early Learning Spaces",
      desc: "Bright, airy classrooms with child-safe furnishings and rich activity corners.",
      tag: "Pre-Primary & Primary",
      bgGradient: "from-[#2f6f68] to-[#1f4e48]"
    },
    {
      category: "activities",
      title: "Hands-on Science & Math Corner",
      desc: "Manipulatives and discovery kits that make abstract concepts clear and fun.",
      tag: "Experiential Learning",
      bgGradient: "from-[#d97706] to-[#b45309]"
    },
    {
      category: "sports",
      title: "Outdoor Play & Physical Fitness",
      desc: "Safe, open grounds for athletics, team games, drills, and physical coordination.",
      tag: "Sports & Wellness",
      bgGradient: "from-[#2563eb] to-[#1d4ed8]"
    },
    {
      category: "activities",
      title: "Art, Craft & Creative Expression",
      desc: "Dedicated creative tables where young imaginations take vivid, colorful shapes.",
      tag: "Creative Arts",
      bgGradient: "from-[#7c3aed] to-[#6d28d9]"
    },
    {
      category: "classrooms",
      title: "Reading & Storytelling Nook",
      desc: "Curated storybooks and reading journals that spark the joy of literature early.",
      tag: "Library & Literacy",
      bgGradient: "from-[#0d9488] to-[#0f766e]"
    },
    {
      category: "activities",
      title: "Cultural Events & Assemblies",
      desc: "Celebrating diversity, national heritage, and student achievements on stage.",
      tag: "School Celebrations",
      bgGradient: "from-[#e11d48] to-[#be123c]"
    },
  ];

  const filteredGallery = activeTab === "all"
    ? galleryItems
    : galleryItems.filter(item => item.category === activeTab);

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#2c3d37] font-['DM_Sans',sans-serif]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-[#e4ede8] bg-gradient-to-b from-[#f2f8f5] via-[#f7faf8] to-[#ffffff]">
        {/* Subtle Decorative Background Blobs */}
        <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-[#dbeee7]/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[5%] left-[-10%] w-[400px] h-[400px] rounded-full bg-[#faedd8]/40 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e3f2ec] border border-[#c3e3d7] text-[#205e56] text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
                <span>Nurturing Excellence in Tumakuru, Karnataka</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight leading-[1.12]">
                Where <span className="text-[#2f6f68] underline decoration-[#fbd38d] decoration-wavy decoration-2 underline-offset-8">curious minds</span> grow into confident doers.
              </h1>

              {/* Subheading */}
              <p className="text-base sm:text-lg text-[#556963] max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                A nurturing school community in Tumakuru built around meaningful learning, confidence, character, and possibility. We inspire every child to learn joyfully and achieve their highest potential.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#2f6f68] hover:bg-[#235852] text-white font-bold text-sm shadow-md shadow-[#2f6f68]/25 hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Enquire About Admissions</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-[#f3f8f5] text-[#2c4e47] border border-[#cbdcd5] font-bold text-sm shadow-xs transition-all hover:border-[#2f6f68]"
                >
                  <span>Explore School Story</span>
                  <ChevronRight className="w-4 h-4 text-[#2f6f68]" />
                </Link>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#eaf4f0] hover:bg-[#d8ece5] text-[#225750] text-xs font-bold transition-colors"
                >
                  <span>Staff / ERP Login</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Key Trust Highlights */}
              <div className="pt-4 grid grid-cols-3 gap-3 border-t border-[#e2ece7] max-w-lg mx-auto lg:mx-0 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#2f6f68] shrink-0" />
                  <span className="text-xs font-semibold text-[#3b504a]">Safe & Caring Campus</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#d97706] shrink-0" />
                  <span className="text-xs font-semibold text-[#3b504a]">CBSE Pattern Model</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4 text-[#2b6cb0] shrink-0" />
                  <span className="text-xs font-semibold text-[#3b504a]">Holistic Growth</span>
                </div>
              </div>
            </div>

            {/* Right Card / Visual Showcase */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl bg-white p-6 sm:p-7 shadow-xl shadow-[#244b44]/8 border border-[#d9e6e0] overflow-hidden">
                <div className="flex items-center justify-between pb-5 border-b border-[#ebf2ee]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#2f6f68] text-white flex items-center justify-center font-bold font-['Manrope'] shadow-md">
                      GK
                    </div>
                    <div>
                      <h2 className="font-extrabold text-base text-[#1e302b] font-['Manrope']">
                        Global Kids School
                      </h2>
                      <p className="text-xs text-[#718680] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#2f6f68]" />
                        Vokkodi, Tumakuru
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-[#edf7f3] text-[#24635b] text-[11px] font-bold">
                    AY 2026–27
                  </span>
                </div>

                {/* Card Body with Key Program Highlights */}
                <div className="py-5 space-y-3.5">
                  <div className="p-3.5 rounded-xl bg-[#f5f9f7] border border-[#e4eeea] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2f6f68]/10 text-[#2f6f68] flex items-center justify-center shrink-0 mt-0.5">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#1f332e]">Early Years & Primary Wing</h3>
                      <p className="text-[11px] text-[#5e736d] mt-0.5">
                        Focus on foundational language, numeracy, sensory activities, and social-emotional development.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#fef9f2] border border-[#faecd8] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#d97706]/10 text-[#d97706] flex items-center justify-center shrink-0 mt-0.5">
                      <Palette className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#38260b]">Middle & High School Wing</h3>
                      <p className="text-[11px] text-[#715c3d] mt-0.5">
                        Deep conceptual understanding, problem-solving, science practicals, and leadership mentoring.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#f0f7ff] border border-[#d6e7fc] flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#102a45]">Admissions Helpline</h3>
                      <p className="text-[11px] text-[#4b6a8a] mt-0.5">
                        Call <strong className="text-[#102a45]">+91 86600 66542</strong> or visit between 9:00 AM – 4:30 PM.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA on card */}
                <div className="pt-2">
                  <Link
                    href="/contact"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#2f6f68] hover:bg-[#245b55] text-white text-xs font-bold shadow-md transition-colors"
                  >
                    <span>Schedule a Campus Walkthrough</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars / Learning Philosophy Section */}
      <section className="py-16 md:py-24 bg-white border-b border-[#e5ece8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#eef7f4] px-3 py-1 rounded-full">
              Our Core Philosophy
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight">
              Three Pillars of Every Child's Journey
            </h2>
            <p className="text-sm text-[#5d736d] leading-relaxed">
              We focus on cultivating children who are not just test-ready, but life-ready with high character, resilience, and curiosity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl p-7 border bg-[#fbfdfc] border-[#e2ece7] hover:border-[#2f6f68]/40 hover:shadow-lg transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${pillar.color}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f0f4f2] text-[#4f6760]">
                        {pillar.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-extrabold text-[#192b26] font-['Manrope'] group-hover:text-[#2f6f68] transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-xs font-semibold text-[#7d928c] mt-0.5">
                        {pillar.tagline}
                      </p>
                    </div>

                    <p className="text-sm text-[#556963] leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-4 border-t border-[#edf3f0]">
                    <Link
                      href="/about"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2f6f68] hover:text-[#1e4e48] transition-colors"
                    >
                      <span>Read pedagogical approach</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Experience & Enrichment Section */}
      <section className="py-16 md:py-24 bg-[#f6faf8] border-b border-[#e5ece8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-28">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#eef7f4] px-3 py-1 rounded-full">
                Holistic Education
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight">
                Designed for well-rounded, joyful growth.
              </h2>
              <p className="text-sm text-[#5d736d] leading-relaxed">
                Academic rigor is combined with creative arts, physical wellness, moral values, and real-world collaboration.
              </p>
              <div className="pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2f6f68] text-white text-xs font-bold shadow-sm hover:bg-[#255b55] transition-colors"
                >
                  <span>Book a Campus Tour</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {experiences.map((exp, idx) => {
                const Icon = exp.icon;
                return (
                  <div
                    key={idx}
                    className="p-6 rounded-2xl bg-white border border-[#e0ebe5] shadow-xs hover:border-[#2f6f68]/40 hover:shadow-md transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#eaf4f0] text-[#2f6f68] flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-extrabold text-base text-[#1b2f29] font-['Manrope'] mb-2">
                      {exp.title}
                    </h3>
                    <p className="text-xs text-[#556963] leading-relaxed">
                      {exp.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Campus Life & Activity Gallery */}
      <section className="py-16 md:py-24 bg-white border-b border-[#e5ece8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#eef7f4] px-3 py-1 rounded-full">
                Campus Spaces
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight">
                Spaces built for joyful exploration
              </h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 bg-[#f0f5f2] p-1.5 rounded-xl border border-[#e2ede8]">
              {(["all", "classrooms", "activities", "sports"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    activeTab === tab
                      ? "bg-white text-[#2f6f68] shadow-xs"
                      : "text-[#5e736d] hover:text-[#214e49]"
                  }`}
                >
                  {tab === "all" ? "All Spaces" : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGallery.map((item, idx) => (
              <div
                key={idx}
                className="group rounded-2xl border border-[#e2ebe6] bg-[#fbfdfc] overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col"
              >
                {/* Visual Header Mockup */}
                <div className={`h-48 bg-gradient-to-br ${item.bgGradient} p-6 flex flex-col justify-between text-white relative overflow-hidden`}>
                  <div className="absolute right-[-20px] bottom-[-20px] opacity-10 font-black text-8xl font-['Manrope'] select-none">
                    GK
                  </div>
                  <span className="inline-block px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold w-max">
                    {item.tag}
                  </span>
                  <div>
                    <h4 className="font-extrabold text-lg text-white font-['Manrope'] leading-snug">
                      {item.title}
                    </h4>
                  </div>
                </div>

                {/* Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-[#556963] leading-relaxed">
                    {item.desc}
                  </p>
                  <div className="pt-3 border-t border-[#edf4f0] flex items-center justify-between text-xs text-[#2f6f68] font-bold">
                    <span>Verified Campus Environment</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4-Step Admissions Pathway */}
      <section className="py-16 md:py-24 bg-[#f4f9f6] border-b border-[#e5ece8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#e3f0eb] px-3 py-1 rounded-full">
              Admissions Roadmap
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight">
              Simple 4-Step Enrollment Process
            </h2>
            <p className="text-sm text-[#5d736d] leading-relaxed">
              We ensure a smooth, welcoming admission experience for parents and children.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((st, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-[#dfeae4] shadow-xs relative flex flex-col justify-between"
              >
                <div>
                  <span className="text-2xl font-black text-[#2f6f68]/30 font-['Manrope'] block mb-3">
                    {st.step}
                  </span>
                  <h3 className="font-extrabold text-base text-[#1b2d28] font-['Manrope'] mb-2">
                    {st.title}
                  </h3>
                  <p className="text-xs text-[#596e67] leading-relaxed">
                    {st.desc}
                  </p>
                </div>

                <div className="mt-6 pt-3 border-t border-[#eef5f1] flex items-center gap-1 text-[11px] font-bold text-[#2f6f68]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#38a169]" />
                  <span>Step {idx + 1} of 4</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Action Strip */}
          <div className="mt-12 p-8 rounded-2xl bg-[#234e48] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-xl font-extrabold font-['Manrope']">
                Have questions regarding grades, fees or transport?
              </h3>
              <p className="text-xs text-[#b8d9d2]">
                Our admissions counselors are available Monday through Saturday (9:00 AM – 4:30 PM).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                className="px-5 py-3 rounded-xl bg-[#fbd38d] hover:bg-[#f6c367] text-[#234e48] font-bold text-xs shadow-md transition-colors flex items-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Call {schoolInfo.contact.primaryPhone}</span>
              </a>
              <Link
                href="/contact"
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition-colors"
              >
                <span>Submit Online Form</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Parent & Community Voice */}
      <section className="py-16 md:py-24 bg-white border-b border-[#e5ece8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#2f6f68] bg-[#eef7f4] px-3 py-1 rounded-full">
              Community Voice
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192b26] font-['Manrope'] tracking-tight">
              What Families Say About Global Kids
            </h2>
            <p className="text-sm text-[#5d736d] leading-relaxed">
              Real reflections from parents in Tumakuru on the positive changes they notice in their children.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-2xl bg-[#fbfdfc] border border-[#e2ece7] shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex text-[#f6ad55] gap-1">
                  {"★★★★★".split("").map((star, i) => (
                    <span key={i} className="text-base">{star}</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#4d635c] italic leading-relaxed">
                  "The individual attention my child receives is remarkable. The teachers are polite, approachable, and truly care about bringing out each student's curiosity."
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#edf4f0] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#dcf0ea] text-[#2f6f68] font-bold flex items-center justify-center text-xs">
                  P1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#233530]">Parent of Grade 3 Student</h4>
                  <p className="text-[11px] text-[#819690]">Tumakuru</p>
                </div>
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-[#fbfdfc] border border-[#e2ece7] shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex text-[#f6ad55] gap-1">
                  {"★★★★★".split("").map((star, i) => (
                    <span key={i} className="text-base">{star}</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#4d635c] italic leading-relaxed">
                  "I love the balance between academics and extra activities. My daughter comes home excited every single day to share what new project she worked on."
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#edf4f0] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#faecd8] text-[#b7791f] font-bold flex items-center justify-center text-xs">
                  P2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#233530]">Parent of UKG Student</h4>
                  <p className="text-[11px] text-[#819690]">Tumakuru</p>
                </div>
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-[#fbfdfc] border border-[#e2ece7] shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex text-[#f6ad55] gap-1">
                  {"★★★★★".split("").map((star, i) => (
                    <span key={i} className="text-base">{star}</span>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-[#4d635c] italic leading-relaxed">
                  "The campus environment is safe, disciplined, and very child-friendly. The school staff communicates promptly through digital channels."
                </p>
              </div>
              <div className="pt-4 mt-6 border-t border-[#edf4f0] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#dbeafe] text-[#2563eb] font-bold flex items-center justify-center text-xs">
                  P3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#233530]">Parent of Grade 6 Student</h4>
                  <p className="text-[11px] text-[#819690]">Tumakuru</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
