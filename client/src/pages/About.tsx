import React from "react";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { Link } from "wouter";
import {
  HeartHandshake,
  ShieldCheck,
  Target,
  Users,
  Compass,
  Lightbulb,
  ArrowRight,
  BookOpen,
  Award,
  Sparkles
} from "lucide-react";

export default function About() {
  const values = [
    { name: "Kindness", icon: HeartHandshake, color: "text-rose-600", desc: "Building an environment of gentle, proactive empathy and grace." },
    { name: "Integrity", icon: ShieldCheck, color: "text-emerald-700", desc: "Upholding honesty, consistency, and sound character in every action." },
    { name: "Courage", icon: Target, color: "text-amber-700", desc: "Empowering children to take intellectual risks and learn from every challenge." },
    { name: "Respect", icon: Users, color: "text-blue-700", desc: "Honor for self, diversity, and the communal space we share." },
    { name: "Responsibility", icon: Compass, color: "text-indigo-700", desc: "Active stewardship of our work, our environment, and our collective progress." },
    { name: "Joy", icon: Lightbulb, color: "text-teal-700", desc: "Finding genuine excitement and curiosity in every learning discovery." },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f5] text-[#122824] font-['DM_Sans',sans-serif]">
      <Navbar />

      {/* Hero: Editorial Typographic Header */}
      <section className="py-24 border-b border-[#e5ebe7] relative bg-gradient-to-tr from-[#f2f7f4] via-[#faf9f5] to-[#fcfcfb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="max-w-3xl space-y-6">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#1f5e54] bg-[#e4efe9] px-3.5 py-1 rounded-full">
              Our Institutional Story
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold font-['Manrope'] tracking-tight leading-[1.05] text-[#122824]">
              Nurturing the next generation of thinkers, doers, and leaders.
            </h1>
            <p className="text-lg text-[#556c65] leading-relaxed">
              Global Kids School, Tumakuru, is built on the belief that children thrive when education feels purposeful, secure, and genuinely curious. We move beyond textbooks to foster mastery, confidence, and character.
            </p>
          </div>
        </div>
      </section>

      {/* The Pedagogy Block: Subtle, editorial layout */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-5 relative">
          <div className="sticky top-32 space-y-6">
            <h2 className="text-3xl font-extrabold font-['Manrope'] text-[#122824] leading-tight">
              An ecosystem designed for curiosity.
            </h2>
            <p className="text-sm text-[#556c65] leading-relaxed">
              We move beyond traditional rote learning by integrating conceptual mastery with hands-on labs, creative expression, and active physical play.
            </p>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#edf3ef] border border-[#d6e5e1]">
                <Lightbulb className="w-6 h-6 text-[#1f5e54] mt-1 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-sm text-[#122824]">Inquiry-first learning</h4>
                  <p className="text-xs text-[#556c65] mt-1">Questions drive our classroom dialogue, not teacher-led monologues.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-12">
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-['Manrope'] text-[#122824]">Our Origin</h3>
            <p className="text-sm text-[#556c65] leading-relaxed">
              Born from a local vision in Tumakuru, Global Kids School serves families who prioritize quality, safe, and holistic education. We are situated in a quiet, nurturing pocket of Vokkodi, providing the perfect distance from distractions while remaining accessible to the central city. Our facility is purposely built to reflect a child’s scale, with open classroom arrangements, dedicated exploration corners, and ventilated spaces.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold font-['Manrope'] text-[#122824]">A Multi-Sensory Approach</h3>
            <p className="text-sm text-[#556c65] leading-relaxed">
              From our Early Year learners discovering phonetic sounds with wooden blocks, to our High School experts running chemistry experiments in the lab, our pedagogy is hands-on. By engaging more than just the eyes and ears—we activate the tactile and analytical mind through continuous doing.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-bold font-['Manrope'] text-[#122824]">The Teacher as Mentor</h3>
            <p className="text-sm text-[#556c65] leading-relaxed">
              Our faculty members undergo rigorous developmental training. We select for pedagogical empathy as much as subject command. In every wing, our teachers act as guides, assessing each student's unique pace and providing support that challenges without overwhelming.
            </p>
          </div>
        </div>
      </section>

      {/* Core Values: Grid of Values */}
      <section className="py-24 bg-white border-y border-[#e5ebe7]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <header className="text-center mb-16 max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#1f5e54]">Principles</span>
            <h2 className="text-3xl font-extrabold font-['Manrope'] text-[#122824]">Our Guiding Compass</h2>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={i} className="group p-8 rounded-3xl bg-[#faf9f5] border border-[#edf3ef] hover:border-[#1f5e54]/30 hover:shadow-lg transition-all">
                  <div className={`w-12 h-12 rounded-2xl bg-white border border-[#edf3ef] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${v.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-extrabold font-['Manrope'] text-[#122824] mb-3">{v.name}</h4>
                  <p className="text-xs text-[#556c65] leading-relaxed">{v.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Community CTA */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-8">
        <div className="rounded-[40px] bg-[#122824] text-white p-12 lg:p-20 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="space-y-6 max-w-xl">
              <h2 className="text-3xl lg:text-4xl font-extrabold font-['Manrope'] tracking-tight">Become a part of our learning circle.</h2>
              <p className="text-sm text-[#a5c5bd] leading-relaxed">
                Whether you are a prospective parent, an educator looking for a nurturing place to grow, or a member of the Tumakuru community, we invite you to reach out.
              </p>
            </div>
            <Link
              href="/contact"
              className="px-8 py-4 rounded-xl bg-[#e68a2e] text-[#122824] font-extrabold text-sm shadow-md hover:bg-[#ffc87a] transition-all shrink-0 flex items-center gap-2"
            >
              Start the Conversation
              <ArrowRight className="w-4 h-4" />
            </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
