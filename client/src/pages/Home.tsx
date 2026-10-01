import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  BookOpen,
  Users,
  Compass,
  Lightbulb,
  Phone,
  GraduationCap,
  Clock,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Sun,
  Coffee,
  Trophy,
  Microscope,
  Music,
  HeartHandshake
} from "lucide-react";

export default function Home() {
  const [selectedWing, setSelectedWing] = useState<"early" | "primary" | "secondary">("early");
  const [activeTimeIndex, setActiveTimeIndex] = useState(0);

  const dailySchedule = [
    {
      time: "08:45 AM",
      title: "Morning Circle & Mindful Values",
      desc: "Community assembly, patriotic songs, student news sharing, and daily reflection circles that build morning focus.",
      category: "Social Connection",
      accent: "#e68a2e"
    },
    {
      time: "09:30 AM",
      title: "Core Concept Inquiry Blocks",
      desc: "Mathematics, Languages, and Environmental Studies taught with physical models, phonics kits, and collaborative problem solving.",
      category: "Foundational Academics",
      accent: "#1f5e54"
    },
    {
      time: "11:30 AM",
      title: "Nutritious Snack & Free Play",
      desc: "Teacher-guided social recess where sharing, conversational etiquette, and physical coordination occur naturally in our open play area.",
      category: "Wellbeing & Life Skills",
      accent: "#d97706"
    },
    {
      time: "01:00 PM",
      title: "STEM Discovery Lab & Creative Expression",
      desc: "Hands-on science experiments, environmental tracking, pottery, visual arts, and dramatic storytelling.",
      category: "Experiential Learning",
      accent: "#0284c7"
    },
    {
      time: "03:00 PM",
      title: "Athletics, Team Sports & Cooldown",
      desc: "Structured football drills, athletics, yoga coordination, and guided reflection before the school day concludes.",
      category: "Physical Agility",
      accent: "#16a34a"
    }
  ];

  const wingsData = {
    early: {
      tag: "Ages 3 to 6 Years",
      title: "Foundational Wing (Playgroup, Nursery, LKG & UKG)",
      lead: "Sensory discovery, phonetic immersion, and social security in a warm, child-scale space.",
      narrative: "Our early childhood classrooms are built around gentle transitions from home to school. We emphasize spoken vocabulary, fine-motor coordination through wooden blocks and clay, and natural curiosity without high-stakes examinations.",
      features: [
        "Phonetic English reading and bilingual communication",
        "Sensory motor labs and tactile discovery corners",
        "Small cohort groups with 1:15 educator ratio",
        "Continuous qualitative development tracking"
      ],
      timing: "9:00 AM - 1:00 PM",
      focus: "Curiosity & Emotional Comfort"
    },
    primary: {
      tag: "Grades 1 to 5",
      title: "Primary Wing (Grades 1 to 5)",
      lead: "Structured conceptual inquiry, mathematical reasoning, and expressive language arts.",
      narrative: "In the primary years, curiosity translates into structured thinking. Students explore mental mathematics, science through observation, and expressive writing, building confidence in presentation and collaborative projects.",
      features: [
        "Conceptual math with concrete manipulatives",
        "Library reading circles and creative writing",
        "Basic science lab demonstrations and nature study",
        "Introductory digital literacy and logic puzzles"
      ],
      timing: "9:00 AM - 3:30 PM",
      focus: "Conceptual Mastery & Expression"
    },
    secondary: {
      tag: "Grades 6 to 10",
      title: "Middle & High School (Grades 6 to 10)",
      lead: "CBSE curriculum alignment, laboratory practicals, debate, and character leadership.",
      narrative: "Our secondary wing provides rigorous academic grounding alongside critical reasoning, competitive exam preparation, debate clubs, and leadership responsibilities to ensure board excellence and mature self-discipline.",
      features: [
        "Full Physics, Chemistry, and Biology laboratory practicals",
        "Debate, public speaking, and community leadership initiatives",
        "Focused guidance for board examinations and talent tests",
        "Dedicated mentorship for holistic adolescent growth"
      ],
      timing: "9:00 AM - 4:00 PM",
      focus: "Academic Rigor & Purposeful Leadership"
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#122824] font-['DM_Sans',sans-serif] selection:bg-[#ffc87a] selection:text-[#122824]">
      <Navbar />

      {/* Hero Section: Editorial Split Screen */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-[#e2eae5] bg-gradient-to-b from-[#f2f7f4] via-[#faf9f5] to-[#faf9f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

            {/* Left Content Column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#e3eee8] border border-[#cbdcd4] text-[#122824] text-xs font-bold shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#e68a2e]" />
                <span className="tracking-wide uppercase text-[11px] font-extrabold text-[#122824]">
                  Puttanapalya, Vokkodi • Tumakuru
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight leading-[1.1]">
                Where active curiosity builds lifelong character.
              </h1>

              <p className="text-base sm:text-lg text-[#475e58] leading-relaxed max-w-2xl font-normal">
                Global Kids School provides purposeful, joyful education from Playgroup to Grade 10 in Tumakuru. We replace rote memorization with inquiry, mentor guidance, and moral grounding.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2.5 px-6 py-4 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white font-extrabold text-sm shadow-md shadow-[#122824]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Schedule a Campus Walk</span>
                  <ArrowRight className="w-4 h-4 text-[#ffc87a]" />
                </Link>

                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white hover:bg-[#f0f6f3] text-[#122824] border border-[#cbdcd5] font-bold text-sm shadow-2xs transition-all hover:border-[#122824]"
                >
                  <span>Our Educational Story</span>
                </Link>
              </div>

              {/* Institution Quick Facts */}
              <div className="pt-6 border-t border-[#e2eae6] grid grid-cols-3 gap-6">
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#122824] font-['Manrope']">CBSE</div>
                  <div className="text-xs text-[#5e746e] mt-0.5">Aligned Pedagogy</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#122824] font-['Manrope']">1:15</div>
                  <div className="text-xs text-[#5e746e] mt-0.5">Teacher-Student Ratio</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#122824] font-['Manrope']">Pre-K - 10</div>
                  <div className="text-xs text-[#5e746e] mt-0.5">Full Continuum</div>
                </div>
              </div>
            </motion.div>

            {/* Right Card: Verified Admissions Portal & Desk */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5"
            >
              <div className="rounded-[32px] bg-[#122824] text-white p-7 sm:p-9 shadow-2xl border border-[#23453f] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#1f5e54] rounded-full blur-3xl opacity-35 pointer-events-none" />

                <div className="flex items-center justify-between pb-5 border-b border-[#23453f] relative z-10">
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-[#ffc87a] uppercase block">
                      Admissions Open
                    </span>
                    <h3 className="text-xl font-extrabold font-['Manrope'] text-white mt-0.5">
                      Academic Year 2026-27
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#1f5e54] text-[#ffc87a] text-xs font-bold border border-[#2e8276]">
                    Enrolling Now
                  </span>
                </div>

                <div className="py-5 space-y-3.5 relative z-10 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a] flex items-start gap-3">
                    <GraduationCap className="w-4 h-4 text-[#ffc87a] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold text-sm">Available Wings</strong>
                      <p className="text-[#a5c5bd] mt-0.5 leading-relaxed">
                        Playgroup, Nursery, LKG, UKG and Grades 1 through 10.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a] flex items-start gap-3">
                    <Phone className="w-4 h-4 text-[#ffc87a] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold text-sm">Direct Contact</strong>
                      <a href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`} className="text-[#ffc87a] font-bold block hover:underline text-sm mt-0.5">
                        {schoolInfo.contact.primaryPhone}
                      </a>
                      <span className="text-[#8baea5] text-[11px]">Direct admissions line • Vokkodi Campus</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#1a3832] border border-[#28524a] flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[#ffc87a] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block font-bold text-sm">Admissions Desk Hours</strong>
                      <p className="text-[#a5c5bd] mt-0.5">
                        Monday to Saturday: 9:00 AM to 4:30 PM
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 relative z-10">
                  <Link
                    href="/contact"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#e68a2e] hover:bg-[#f2993d] text-[#122824] text-xs font-extrabold shadow-md transition-colors"
                  >
                    <span>Book an In-Person Campus Tour</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Asymmetric Core Pedagogy Section */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="space-y-4 mb-14 max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
            How learning happens at Global Kids School
          </h2>
          <p className="text-sm sm:text-base text-[#556c65] leading-relaxed">
            We focus on developing children who think independently, express themselves clearly, and act with integrity.
          </p>
        </div>

        {/* Asymmetric Layout: 1 Large Hero Card + 2 Stacked Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">

          {/* Featured Anchor Card */}
          <div className="lg:col-span-7 rounded-[32px] bg-[#122824] text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden shadow-xl border border-[#23453f]">
            <div className="space-y-6 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#1f5e54] text-[#ffc87a] flex items-center justify-center font-bold">
                <Lightbulb className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#ffc87a] block">
                  Inquiry-Driven Academics
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-['Manrope'] leading-snug">
                  Hands-on experimentation replaces passive lectures.
                </h3>
              </div>
              <p className="text-sm text-[#a5c5bd] leading-relaxed">
                Rather than memorizing textbooks, our students learn mathematics with manipulatives, investigate biological specimens under laboratory microscopes, and debate historical causes in guided circles. Every child is invited to ask "why" before they are given "what."
              </p>
            </div>

            <div className="pt-8 mt-8 border-t border-[#23453f] flex items-center justify-between text-xs text-[#a5c5bd] relative z-10">
              <span>Interactive science & math labs</span>
              <span className="text-[#ffc87a] font-bold">Inquiry First</span>
            </div>
          </div>

          {/* Right 2 Stacked Companion Cards */}
          <div className="lg:col-span-5 flex flex-col gap-6">

            {/* Companion Card 1 */}
            <div className="p-8 rounded-[32px] bg-white border border-[#e2eae5] shadow-xs flex flex-col justify-between flex-1 hover:border-[#1f5e54]/40 transition-all">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-[#e4efe9] text-[#1f5e54] flex items-center justify-center font-bold">
                  <Award className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-[#122824] font-['Manrope']">
                  Confidence & Public Voice
                </h3>
                <p className="text-xs text-[#556c65] leading-relaxed">
                  Every student participates in regular stage assemblies, debates, elocution, and drama productions, nurturing self-assurance from an early age.
                </p>
              </div>
              <div className="pt-4 border-t border-[#f0f4f2] text-xs font-bold text-[#1f5e54] flex items-center gap-1.5">
                <span>Inclusive stage participation</span>
              </div>
            </div>

            {/* Companion Card 2 */}
            <div className="p-8 rounded-[32px] bg-white border border-[#e2eae5] shadow-xs flex flex-col justify-between flex-1 hover:border-[#1f5e54]/40 transition-all">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-2xl bg-[#fef3c7] text-[#b45309] flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-extrabold text-[#122824] font-['Manrope']">
                  Moral & Civic Compass
                </h3>
                <p className="text-xs text-[#556c65] leading-relaxed">
                  Empathy, environmental care, collaborative teamwork, and mutual respect are practiced naturally through real school responsibilities.
                </p>
              </div>
              <div className="pt-4 border-t border-[#f0f4f2] text-xs font-bold text-[#b45309] flex items-center gap-1.5">
                <span>Character & community values</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Interactive Wings Continuum */}
      <section className="py-20 bg-white border-y border-[#e2eae5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
              Academic Continuum Across Every Age
            </h2>
            <p className="text-sm text-[#556c65]">
              Select a division to review developmental goals, curricula, and daily schedules.
            </p>
          </div>

          {/* Segmented Pill Selector */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-2xl bg-[#edf3ef] border border-[#dce6e0] gap-1">
              <button
                type="button"
                onClick={() => setSelectedWing("early")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "early"
                    ? "bg-[#122824] text-white shadow-sm font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Pre-Primary (Ages 3-6)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWing("primary")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "primary"
                    ? "bg-[#122824] text-white shadow-sm font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Primary (Grades 1-5)
              </button>
              <button
                type="button"
                onClick={() => setSelectedWing("secondary")}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedWing === "secondary"
                    ? "bg-[#122824] text-white shadow-sm font-extrabold"
                    : "text-[#556c65] hover:text-[#122824]"
                }`}
              >
                Middle & High (Grades 6-10)
              </button>
            </div>
          </div>

          {/* Wing Content Showcase */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedWing}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="p-8 sm:p-12 rounded-[32px] bg-[#faf9f5] border border-[#dce6e0] grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              <div className="lg:col-span-7 space-y-5">
                <span className="inline-block px-3 py-1 rounded-full bg-[#e3eee8] text-[#1f5e54] text-xs font-bold">
                  {wingsData[selectedWing].tag}
                </span>

                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#122824] font-['Manrope']">
                  {wingsData[selectedWing].title}
                </h3>

                <p className="text-sm font-medium text-[#1f5e54] leading-relaxed">
                  {wingsData[selectedWing].lead}
                </p>

                <p className="text-sm text-[#556c65] leading-relaxed">
                  {wingsData[selectedWing].narrative}
                </p>

                <div className="space-y-3 pt-2">
                  <strong className="text-xs font-extrabold uppercase tracking-wider text-[#122824] block">
                    Key Academic & Co-Curricular Highlights:
                  </strong>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-[#3d504b]">
                    {wingsData[selectedWing].features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#1f5e54] shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white p-7 rounded-2xl border border-[#dbe6df] shadow-xs space-y-4">
                <h4 className="text-sm font-extrabold text-[#122824] font-['Manrope'] border-b border-[#edf3f0] pb-3">
                  Program Structure
                </h4>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                    <span className="text-[#6d827c]">Campus Timings</span>
                    <span className="font-bold text-[#122824]">{wingsData[selectedWing].timing}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                    <span className="text-[#6d827c]">Pedagogy Focus</span>
                    <span className="font-bold text-[#122824]">{wingsData[selectedWing].focus}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#f4f7f5]">
                    <span className="text-[#6d827c]">Campus Location</span>
                    <span className="font-bold text-[#122824]">Vokkodi, Tumakuru</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6d827c]">Curriculum Pattern</span>
                    <span className="font-bold text-[#122824]">CBSE Pattern Standard</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/contact"
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white text-xs font-bold transition-colors"
                  >
                    <span>Enquire for this Grade</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#ffc87a]" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Daily Routine: Dynamic Interactive Schedule */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="max-w-2xl space-y-3 mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#122824] font-['Manrope'] tracking-tight">
            A Day at Global Kids School
          </h2>
          <p className="text-sm text-[#556c65] leading-relaxed">
            Every school day is thoughtfully balanced between deep conceptual focus, creative exploration, social lunches, and physical play.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Time Selector Buttons */}
          <div className="lg:col-span-5 space-y-2.5">
            {dailySchedule.map((item, idx) => {
              const isActive = activeTimeIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTimeIndex(idx)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-[#122824] text-white border-[#122824] shadow-md"
                      : "bg-white text-[#122824] border-[#e2eae5] hover:border-[#1f5e54]/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-extrabold font-mono px-2 py-1 rounded-lg ${isActive ? "bg-white/15 text-[#ffc87a]" : "bg-[#edf4f0] text-[#1f5e54]"}`}>
                      {item.time}
                    </span>
                    <strong className="text-xs sm:text-sm font-bold font-['Manrope'] truncate">
                      {item.title}
                    </strong>
                  </div>
                  <ArrowRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-[#ffc87a] translate-x-1" : "text-[#a5c5bd]"}`} />
                </button>
              );
            })}
          </div>

          {/* Active Period Card */}
          <div className="lg:col-span-7 bg-[#1f5e54] text-white p-8 sm:p-12 rounded-[32px] relative overflow-hidden shadow-xl min-h-[300px] flex flex-col justify-between">
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3.5 py-1 rounded-full bg-white/15 text-[#ffc87a] text-xs font-bold border border-white/10 font-mono">
                  {dailySchedule[activeTimeIndex].time}
                </span>
                <span className="text-xs font-bold text-[#b5ded4] uppercase tracking-wider">
                  {dailySchedule[activeTimeIndex].category}
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold font-['Manrope'] leading-snug">
                {dailySchedule[activeTimeIndex].title}
              </h3>

              <p className="text-sm text-[#d1eee6] leading-relaxed">
                {dailySchedule[activeTimeIndex].desc}
              </p>
            </div>

            <div className="pt-6 border-t border-white/15 flex items-center justify-between text-xs text-[#b5ded4] relative z-10">
              <span>Supervised by certified subject mentors</span>
              <span className="text-[#ffc87a] font-bold">Vokkodi Campus</span>
            </div>
          </div>
        </div>
      </section>

      {/* Admissions Checklist & Tour Booking */}
      <section className="py-20 bg-[#122824] text-white border-t border-[#1c3a34]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-7 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-extrabold font-['Manrope'] tracking-tight leading-tight">
                Simple, welcoming admission process.
              </h2>
              <p className="text-sm text-[#a5c5bd] leading-relaxed max-w-xl">
                We believe joining a school should be a warm, transparent experience. We invite families to meet our educators and explore our classrooms firsthand.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-2xl bg-[#1a3832] border border-[#274f46] space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#ffc87a]" />
                    Document Checklist
                  </h4>
                  <p className="text-xs text-[#8eaead] leading-relaxed">
                    Child's Birth Certificate, previous class report card, passport photos, and transfer certificate (if applicable).
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#1a3832] border border-[#274f46] space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-[#ffc87a]" />
                    Friendly Interaction
                  </h4>
                  <p className="text-xs text-[#8eaead] leading-relaxed">
                    No stressful entrance tests for early ages. A conversational interaction to understand your child's interests and readiness.
                  </p>
                </div>
              </div>
            </div>

            {/* Direct Tour Booking Card */}
            <div className="lg:col-span-5 bg-white text-[#122824] p-8 sm:p-10 rounded-[32px] shadow-2xl space-y-5">
              <h3 className="text-xl font-extrabold font-['Manrope']">
                Schedule a Campus Visit
              </h3>
              <p className="text-xs text-[#586f68] leading-relaxed">
                Tour our classrooms, observe learning sessions, and consult with our academic coordinators.
              </p>

              <div className="space-y-3 pt-2">
                <a
                  href={`tel:${schoolInfo.contact.primaryPhone.replace(/\s+/g, '')}`}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#faf9f5] border border-[#dbe6df] hover:border-[#1f5e54] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#e68a2e]" />
                    <div>
                      <span className="text-[10px] text-[#788e88] block">Admissions Desk</span>
                      <strong className="text-xs text-[#122824]">{schoolInfo.contact.primaryPhone}</strong>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#1f5e54]" />
                </a>

                <Link
                  href="/contact"
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#122824] hover:bg-[#1a3a34] text-white font-extrabold text-xs shadow-md transition-colors"
                >
                  <span>Submit Online Admissions Enquiry</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#ffc87a]" />
                </Link>
              </div>

              <p className="text-[11px] text-center text-[#829993]">
                Campus Visits: Mon to Sat (9:00 AM - 4:30 PM)
              </p>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
