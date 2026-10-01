import React, { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  MoveRight,
  Compass,
  Heart,
  Sun,
  ShieldCheck,
  ChevronDown
} from "lucide-react";

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export default function Home() {
  const [activeAccordion, setActiveAccordion] = useState<number | null>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parallax Scroll Tracking
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const heroImageScale = useTransform(smoothProgress, [0, 0.2], [1, 1.15]);
  const heroImageY = useTransform(smoothProgress, [0, 0.2], [0, -40]);

  const timelineItems = [
    {
      year: "2011",
      title: "Foundations in Vokkodi",
      desc: "Started with 45 students in a small learning environment focused on inquiry and foundational skills.",
      tag: "Origins"
    },
    {
      year: "2016",
      title: "Primary Wing Expansion",
      desc: "Expanded campus to include dedicated STEM discovery labs and open play areas for Grades 1 to 5.",
      tag: "Infrastructure"
    },
    {
      year: "2021",
      title: "CBSE High School Addition",
      desc: "Secondary classrooms, advanced science laboratories, and structured academic mentorship.",
      tag: "Academics"
    },
    {
      year: "Present",
      title: "A Vibrant Learning Community",
      desc: "Over 600 students, 40 dedicated teachers, and a thriving campus culture in Tumakuru.",
      tag: "Today"
    }
  ];

  const differentiators = [
    {
      id: 0,
      title: "Child-Centred Inquiry",
      subtitle: "Curiosity First",
      desc: "Where students ask questions, conduct hands-on experiments, and build genuine conceptual understanding without the pressure of rote exams.",
      image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: 1,
      title: "Structured, Calm Routines",
      subtitle: "Rhythm & Balance",
      desc: "Balanced academic focus paired with daily outdoor movement, arts, and mindful reflection to nurture steady emotional resilience.",
      image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=1200&q=80"
    },
    {
      id: 2,
      title: "Transparent Parent Partnership",
      subtitle: "Open Community",
      desc: "Regular educator touchpoints, transparent student progress tracking, and an approachable, communicative leadership team.",
      image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80"
    }
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white overflow-hidden">

      {/* 1. INITIAL CURTAIN REVEAL */}
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: "-100%" }}
        transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1], delay: 0.1 }}
        className="fixed inset-0 z-50 bg-[#34291C] flex items-center justify-center pointer-events-none"
      >
        <motion.div
          initial={{ opacity: 1, scale: 1 }}
          animate={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-[#f6eddd] font-['Space_Grotesk'] text-xl sm:text-2xl font-bold tracking-tight"
        >
          Global Kids School
        </motion.div>
      </motion.div>

      <Navbar />

      {/* 2. KINETIC EDITORIAL HERO */}
      <section className="relative pt-8 pb-16 sm:pt-14 sm:pb-24 max-w-[1400px] mx-auto px-4 sm:px-8">

        {/* Top Meta Line */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ded1bc] pb-4 mb-8 sm:mb-12">
          <div className="flex items-center gap-2 text-xs font-mono text-[#6F6046]">
            <span className="w-2 h-2 rounded-full bg-[#9e3b26] animate-pulse" />
            <span>TUMAKURU, KARNATAKA</span>
          </div>
          <div className="text-xs font-mono text-[#6F6046]">
            CBSE PATTERN · NURSERY TO GRADE 10
          </div>
        </div>

        {/* Massive Typography Statement */}
        <div className="space-y-2 mb-12 sm:mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.3 }}
            className="text-5xl sm:text-7xl lg:text-[7.5vw] font-bold font-['Space_Grotesk'] tracking-tighter leading-[0.9] text-[#34291C]"
          >
            WHERE CURIOUS <br />
            <span className="italic font-serif font-normal text-[#9e3b26]">MINDS GROW</span> INTO <br />
            CONFIDENT DOERS.
          </motion.h1>
        </div>

        {/* Asymmetric Hero Media & Manifesto Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">

          {/* Manifesto Left (5 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: easeOutExpo, delay: 0.5 }}
            className="lg:col-span-5 space-y-6"
          >
            <p className="text-base sm:text-lg text-[#6F6046] leading-relaxed">
              We provide a calm, intentional, and joyful school environment in Tumakuru. Here, education is not an assembly line—it is a personal journey of discovery, empathy, and foundational rigor.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#9e3b26] text-[#f6eddd] font-bold text-xs sm:text-sm shadow-md hover:bg-[#832e1d] transition-all group"
              >
                <span>Book a Campus Tour</span>
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#ded1bc] text-[#34291C] font-bold text-xs sm:text-sm hover:bg-[#ece4d4] transition-all"
              >
                <span>Our Philosophy</span>
              </Link>
            </div>
          </motion.div>

          {/* Large Hero Frame Right (7 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: easeOutExpo, delay: 0.4 }}
            className="lg:col-span-7 relative h-[360px] sm:h-[480px] rounded-[24px] overflow-hidden border border-[#ded1bc] shadow-xl"
          >
            <motion.img
              style={{ scale: heroImageScale, y: heroImageY }}
              src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1800&q=80"
              alt="Global Kids School Campus"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1f1911]/80 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-[#f6eddd]">
              <span className="text-xs font-mono">Vokkodi, Tumakuru Campus</span>
              <span className="text-xs font-mono">Est. 2011</span>
            </div>
          </motion.div>

        </div>
      </section>

      {/* 3. RUNNING STATS BANNER */}
      <section className="border-y border-[#ded1bc] bg-[#F9F1E0] py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl sm:text-6xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                15+
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#34291C] mt-1">Years in Tumakuru</div>
              <p className="text-[11px] text-[#6F6046]">Nurturing foundational learners since 2011</p>
            </div>
            <div>
              <div className="text-4xl sm:text-6xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                600+
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#34291C] mt-1">Scholars Enrolled</div>
              <p className="text-[11px] text-[#6F6046]">Playgroup to Secondary Class 10</p>
            </div>
            <div>
              <div className="text-4xl sm:text-6xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                1:15
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#34291C] mt-1">Teacher Ratio</div>
              <p className="text-[11px] text-[#6F6046]">Individual attention and mentorship</p>
            </div>
            <div>
              <div className="text-4xl sm:text-6xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                4
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#34291C] mt-1">Learning Wings</div>
              <p className="text-[11px] text-[#6F6046]">Purpose-built developmental stages</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE STICKY JOURNEY (EDITORIAL TIMELINE) */}
      <section className="py-20 sm:py-32 max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Sticky Left Column */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
            <span className="text-xs font-mono uppercase text-[#9e3b26] tracking-widest font-bold">
              Evolution & Milestones
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight leading-tight">
              A decade of unhurried growth.
            </h2>
            <p className="text-sm text-[#6F6046] leading-relaxed max-w-md">
              From a humble set of classrooms in Vokkodi to an expansive campus of discovery labs and creative studios.
            </p>
          </div>

          {/* Timeline Cards Right */}
          <div className="lg:col-span-7 space-y-6">
            {timelineItems.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, ease: easeOutExpo }}
                className="p-6 sm:p-8 rounded-[20px] bg-[#F9F1E0] border border-[#ded1bc] shadow-xs flex flex-col sm:flex-row gap-6 justify-between items-start"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[#9e3b26] bg-[#ece4d4] px-2.5 py-1 rounded-[6px]">
                      {item.year}
                    </span>
                    <span className="text-xs text-[#8e7e65] font-mono uppercase tracking-wider">{item.tag}</span>
                  </div>
                  <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed max-w-lg">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. INTERACTIVE ACCORDION SHOWCASE */}
      <section className="py-20 bg-[#34291C] text-[#f6eddd]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8">

          <div className="max-w-2xl mb-12 sm:mb-16 space-y-3">
            <span className="text-xs font-mono uppercase text-[#e28743] tracking-widest font-bold">
              Pedagogical Pillars
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold font-['Space_Grotesk'] tracking-tight">
              Three commitments behind every classroom day.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

            {/* Accordion Tabs Left (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              {differentiators.map((diff) => {
                const isActive = activeAccordion === diff.id;
                return (
                  <div
                    key={diff.id}
                    onClick={() => setActiveAccordion(diff.id)}
                    className={`cursor-pointer p-6 rounded-[16px] border transition-all ${
                      isActive
                        ? "bg-[#453726] border-[#9e3b26]"
                        : "bg-[#3d3122]/50 border-[#4e402f] hover:border-[#6b5841]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-xs font-mono text-[#e28743]">{diff.subtitle}</span>
                        <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
                          {diff.title}
                        </h3>
                      </div>
                      <div className={`w-8 h-8 rounded-full border border-[#6b5841] flex items-center justify-center transition-transform ${isActive ? "rotate-90 bg-[#9e3b26] border-[#9e3b26]" : ""}`}>
                        <MoveRight className="w-4 h-4 text-[#f6eddd]" />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          transition={{ duration: 0.35, ease: easeOutExpo }}
                          className="overflow-hidden border-t border-[#5a4833] pt-4"
                        >
                          <p className="text-xs sm:text-sm text-[#d5cabb] leading-relaxed">
                            {diff.desc}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Image Display Right (6 cols) */}
            <div className="lg:col-span-6">
              <div className="relative h-[340px] sm:h-[460px] rounded-[20px] overflow-hidden border border-[#5a4833]">
                <AnimatePresence mode="wait">
                  {differentiators.map((diff) => {
                    if (diff.id !== activeAccordion) return null;
                    return (
                      <motion.img
                        key={diff.id}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.5, ease: easeOutExpo }}
                        src={diff.image}
                        alt={diff.title}
                        className="absolute inset-0 w-full h-full object-cover object-center"
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. CALL TO ACTION / ADMISSIONS */}
      <section className="py-24 sm:py-32 max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="rounded-[28px] bg-[#F9F1E0] border border-[#ded1bc] p-8 sm:p-16 text-center space-y-6 relative overflow-hidden shadow-sm">

          <div className="inline-block px-3 py-1 rounded-full bg-[#ece4d4] text-[#9e3b26] text-xs font-mono font-bold">
            ADMISSIONS OPEN 2026-27
          </div>

          <h2 className="text-3xl sm:text-6xl font-bold font-['Space_Grotesk'] text-[#34291C] max-w-2xl mx-auto tracking-tight leading-tight">
            Be part of our next chapter.
          </h2>

          <p className="text-sm sm:text-base text-[#6F6046] max-w-lg mx-auto leading-relaxed">
            Take the first step toward a calm, curiosity-led school journey for your child in Tumakuru.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#9e3b26] text-[#f6eddd] font-bold text-sm shadow-md hover:bg-[#832e1d] transition-all group"
            >
              <span>Enquire for Admissions</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

        </div>
      </section>

      <Footer />
    </div>
  );
}
