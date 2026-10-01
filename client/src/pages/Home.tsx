import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { schoolInfo } from "@/data/school";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Sun,
  Users,
  Quote
} from "lucide-react";

// Emil Kowalski inspired transition easing curves
const easeOutQuint = [0.22, 1, 0.36, 1];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      ease: easeOutQuint
    }
  })
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

export default function Home() {
  const [activeModal, setActiveModal] = useState<number | null>(null);

  const timelineItems = [
    {
      year: "2011",
      title: "Founded in Vokkodi",
      desc: "Started with 45 students in a small learning environment focused on inquiry and foundational skills.",
    },
    {
      year: "2016",
      title: "Primary wing opened",
      desc: "Expanded campus to include dedicated STEM discovery labs and open play areas for Grades 1 to 5.",
    },
    {
      year: "2021",
      title: "CBSE High School wing added",
      desc: "Secondary classrooms, advanced science laboratories, and structured academic mentorship.",
    },
    {
      year: "Today",
      title: "A vibrant learning community",
      desc: "600+ students, 40+ dedicated teachers, and a thriving campus culture in Tumakuru.",
    }
  ];

  const milestoneCards = [
    {
      id: 1,
      year: "2011",
      title: "New school building",
      desc: "Designed for natural light, ventilation, and collaborative learning spaces.",
      image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=600&q=80",
      detail: "Our Vokkodi campus was purpose-built with airy classrooms, child-scale furniture, and safe enclosed courtyards."
    },
    {
      id: 2,
      year: "2016",
      title: "Growth in the classroom",
      desc: "Deepening inquiry-led learning, science manipulatives, and individualized mentorship.",
      image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80",
      detail: "Integrated practical STEM blocks and hands-on experiments into daily coursework for early grades."
    },
    {
      id: 3,
      year: "2021",
      title: "Beyond the textbooks",
      desc: "Dedicated arts studio, sports field, debate councils, and civic engagement.",
      image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80",
      detail: "Comprehensive sports coaching, cultural arts participation, and stage assemblies to build lifelong confidence."
    }
  ];

  const stats = [
    { value: "15+", label: "Years of education", sub: "Tumakuru campus since 2011" },
    { value: "600+", label: "Students enrolled", sub: "Playgroup to Grade 10" },
    { value: "40+", label: "Dedicated faculty", sub: "Low 1:15 educator ratio" },
    { value: "4", label: "Learning wings", sub: "Pre-primary to High School" },
  ];

  const differentiators = [
    {
      icon: Heart,
      title: "Child-centred learning",
      desc: "Curiosity-first pedagogy where students ask questions, conduct hands-on experiments, and build genuine conceptual understanding."
    },
    {
      icon: Sun,
      title: "Consistent calm routines",
      desc: "Structured school days with balanced academic focus, physical outdoor movement, and mindful reflection without exam stress."
    },
    {
      icon: Users,
      title: "Open parent partnership",
      desc: "Regular educator touchpoints, transparent student progress tracking, and an approachable, communicative leadership team."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      {/* Hero Banner with Photographic Background */}
      <section className="pt-6 pb-12 sm:pt-8 sm:pb-16 max-w-[1240px] mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOutQuint }}
          className="relative rounded-[20px] overflow-hidden min-h-[340px] sm:min-h-[420px] flex items-end p-6 sm:p-12 shadow-lg border border-[#e5d8c3]"
        >
          {/* Hero Background Image */}
          <motion.img
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.2, ease: easeOutQuint }}
            src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1800&q=80"
            alt="Global Kids School Campus"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Subtle dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1f1911]/90 via-[#1f1911]/60 to-transparent" />

          {/* Hero Caption / Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: easeOutQuint }}
            className="relative z-10 max-w-2xl space-y-3 text-[#f6eddd]"
          >
            <h1 className="text-3xl sm:text-5xl font-bold font-['Space_Grotesk'] tracking-tight leading-tight">
              Our journey so far
            </h1>
            <p className="text-sm sm:text-base text-[#e5dbcc] leading-relaxed max-w-xl">
              How a small school grew into a vibrant, compassionate learning community across Tumakuru.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* 5:7 Split Section: Milestones in Order */}
      <section className="py-12 max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/* Left Column (5 cols): Milestones Intro */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={fadeInUp}
            className="lg:col-span-5 space-y-5 lg:sticky lg:top-24"
          >
            <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
              Milestones, in order
            </h2>
            <p className="text-sm text-[#6F6046] leading-relaxed">
              The decision to build a new Tumakuru school community began with a simple observation: children thrive when learning feels intentional, unhurried, and calm.
            </p>
            <p className="text-sm text-[#6F6046] leading-relaxed">
              What began as a handful of classrooms in Puttanapalya, Vokkodi has grown into a school of four active wings, without losing the personal touch and mentorship that shaped our earliest days.
            </p>

            <div className="pt-2">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9e3b26] hover:text-[#7d2c1c] transition-colors group"
              >
                <span>Admissions for next academic year</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>

          {/* Right Column (7 cols): Timeline Rail */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
            className="lg:col-span-7 space-y-7 relative before:absolute before:inset-0 before:left-2 before:w-[2px] before:bg-[#ded1bc]"
          >
            {timelineItems.map((item, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                custom={idx}
                className="relative pl-8 group"
              >
                {/* Timeline Dot */}
                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-[#9e3b26] border-2 border-[#f6eddd] shadow-xs group-hover:scale-125 transition-transform" />

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono font-bold text-[#9e3b26]">
                      {item.year}
                    </span>
                    <span className="text-xs text-[#8e7e65]">•</span>
                    <h3 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C]">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* 3 Milestone Thumbnail Cards */}
      <section className="py-10 max-w-[1240px] mx-auto px-4 sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {milestoneCards.map((card, idx) => (
            <motion.div
              key={card.id}
              variants={fadeInUp}
              custom={idx}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: easeOutQuint }}
              className="p-5 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-xs flex flex-col justify-between hover:border-[#9e3b26]/40 hover:shadow-md transition-all space-y-4 group"
            >
              <div className="space-y-3">
                <div className="relative w-full h-44 rounded-[10px] overflow-hidden bg-[#ece4d4]">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-[4px] bg-[#34291C]/80 backdrop-blur-xs text-[#f6eddd] text-[10px] font-mono font-bold">
                    {card.year}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C]">
                    {card.title}
                  </h4>
                  <p className="text-xs text-[#6F6046] leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#e2d5c0]/60">
                <button
                  type="button"
                  onClick={() => setActiveModal(activeModal === card.id ? null : card.id)}
                  className="text-xs font-bold text-[#9e3b26] hover:text-[#7d2c1c] flex items-center gap-1 transition-colors"
                >
                  <span>{activeModal === card.id ? "Close detail" : "View detail"}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${activeModal === card.id ? "rotate-90" : ""}`} />
                </button>
                <AnimatePresence>
                  {activeModal === card.id && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 8 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.25, ease: easeOutQuint }}
                      className="overflow-hidden text-xs text-[#34291C] bg-[#f0e5d1] p-2.5 rounded-[6px] leading-relaxed"
                    >
                      {card.detail}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 4-Column Stat row */}
      <section className="py-14 bg-[#F9F1E0] border-y border-[#e2d5c0]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8"
          >
            {stats.map((s, idx) => (
              <motion.div
                key={idx}
                variants={fadeInUp}
                custom={idx}
                className="space-y-1"
              >
                <div className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#9e3b26] tracking-tight">
                  {s.value}
                </div>
                <h4 className="font-bold text-xs sm:text-sm text-[#34291C] font-['Space_Grotesk']">
                  {s.label}
                </h4>
                <p className="text-[11px] sm:text-xs text-[#6F6046]">
                  {s.sub}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonial Quote Card (Dark Charcoal) */}
      <section className="py-16 max-w-[1240px] mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: easeOutQuint }}
          className="rounded-[20px] bg-[#34291C] text-[#f6eddd] p-8 sm:p-12 shadow-xl border border-[#483928] space-y-6"
        >
          <Quote className="w-8 h-8 text-[#9e3b26]" />
          <blockquote className="text-lg sm:text-2xl font-medium font-['Space_Grotesk'] text-[#f6eddd] leading-snug">
            "Sending our two children to Global Kids School in Vokkodi was the single best decision we made. The teachers listen, they encourage curiosity rather than fear of examinations, and the campus environment is warm and disciplined."
          </blockquote>
          <div className="pt-2 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#9e3b26] text-white flex items-center justify-center font-bold text-xs">
              RS
            </div>
            <div>
              <strong className="block text-sm font-bold text-[#f6eddd]">Ramesh & Shobha Sharma</strong>
              <span className="text-xs text-[#c4b6a1]">Parents of Grade 4 & Grade 7 Learners • Tumakuru</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* What Makes Us Different (3 Columns) */}
      <section className="py-12 max-w-[1240px] mx-auto px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.4, ease: easeOutQuint }}
          className="max-w-xl mb-8 space-y-1.5"
        >
          <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
            What makes us different
          </h2>
          <p className="text-xs sm:text-sm text-[#6F6046]">
            Three foundational commitments that define every day at Global Kids School.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {differentiators.map((d, idx) => {
            const Icon = d.icon;
            return (
              <motion.div
                key={idx}
                variants={fadeInUp}
                custom={idx}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2, ease: easeOutQuint }}
                className="p-6 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-xs space-y-3 hover:shadow-md transition-all"
              >
                <div className="w-9 h-9 rounded-[8px] bg-[#ece4d4] text-[#9e3b26] flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C]">
                  {d.title}
                </h3>
                <p className="text-xs text-[#6F6046] leading-relaxed">
                  {d.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Dark CTA Band */}
      <section className="py-14 bg-[#34291C] text-[#f6eddd] border-t border-[#483928]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: easeOutQuint }}
          className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6"
        >
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
              Be part of the next chapter.
            </h2>
            <p className="text-xs sm:text-sm text-[#c7baa6]">
              Admissions open for the upcoming academic year across all grade wings.
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/contact"
              className="px-6 py-3 rounded-[20px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-xs sm:text-sm shadow-md transition-colors shrink-0 whitespace-nowrap flex items-center gap-2 group"
            >
              <span>Enquire about admissions</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
