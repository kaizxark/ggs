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
  Sparkles,
  Quote,
  CheckCircle2
} from "lucide-react";

export default function About() {
  const values = [
    { name: "Kindness", icon: HeartHandshake, desc: "Building an environment of empathy, gentle support, and genuine mutual grace." },
    { name: "Integrity", icon: ShieldCheck, desc: "Upholding honesty, consistency, and sound moral character in every action." },
    { name: "Courage", icon: Target, desc: "Empowering children to take intellectual risks and learn from every challenge." },
    { name: "Respect", icon: Users, desc: "Honor for self, diversity of thought, and the communal space we share." },
    { name: "Responsibility", icon: Compass, desc: "Active stewardship of our work, our environment, and collective progress." },
    { name: "Joy in Learning", icon: Lightbulb, desc: "Finding genuine excitement and active curiosity in every learning discovery." },
  ];

  const approaches = [
    {
      title: "Learn with curiosity",
      tag: "Foundational Inquiry",
      desc: "We replace rote memorization with hands-on questions. Science experiments, mathematical manipulatives, and open library circles awaken natural intellect."
    },
    {
      title: "Grow with confidence",
      tag: "Personal Voice",
      desc: "Every student gains regular stage presence through daily assemblies, debate, sports, and cultural arts, building poise without self-doubt."
    },
    {
      title: "Lead with purpose",
      tag: "Character & Civic Sense",
      desc: "Mentors nurture ethical awareness, teamwork, and social stewardship, preparing students to become empathetic leaders in their community."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      {/* Hero: Editorial Typographic Header */}
      <section className="pt-12 pb-20 border-b border-[#e5d8c3]">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12">
          <div className="rounded-[20px] bg-[#34291C] text-[#f6eddd] p-8 sm:p-14 relative overflow-hidden shadow-xl border border-[#483928]">
            <div className="absolute -right-16 -top-16 w-96 h-96 rounded-full bg-[#9e3b26] opacity-25 blur-3xl pointer-events-none" />

            <div className="max-w-3xl space-y-6 relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-[#e28743] bg-[#483928] border border-[#5d4a36] px-3.5 py-1 rounded-full inline-block">
                Who We Are
              </span>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold font-['Space_Grotesk'] text-[#f6eddd] tracking-tight leading-[1.1]">
                Nurturing the next generation of thinkers, doers, and leaders.
              </h1>
              <p className="text-base sm:text-lg text-[#d5cabb] leading-relaxed">
                Global Kids School, Tumakuru, is built on the belief that children thrive when education feels purposeful, secure, and genuinely curious. We move beyond textbooks to foster mastery, confidence, and character.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7:5 Split Story Grid: Core Values & Principal Note */}
      <section className="py-20 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

          {/* Left Column (7 cols): Story & Core Values */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#9e3b26]">
                Our Philosophy & Origin
              </span>
              <h2 className="text-3xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight">
                An ecosystem designed for meaningful discovery.
              </h2>
              <p className="text-sm sm:text-base text-[#6F6046] leading-relaxed">
                Founded in Vokkodi, Tumakuru, Global Kids School serves families who prioritize quality, character-driven, and holistic education. Our facility is purposely built to reflect a child’s scale, with open classroom arrangements, dedicated science laboratories, and ventilated green play spaces.
              </p>
            </div>

            {/* Guiding Compass / Value Chips Grid */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                Our Guiding Values
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {values.map((v, i) => {
                  const Icon = v.icon;
                  return (
                    <div key={i} className="p-5 rounded-[16px] bg-[#F9F1E0] border border-[#e2d5c0] hover:border-[#9e3b26]/40 transition-all shadow-xs space-y-2">
                      <div className="w-8 h-8 rounded-[8px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C]">{v.name}</h4>
                      <p className="text-xs text-[#6F6046] leading-relaxed">{v.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Principal's Note Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <div className="p-8 rounded-[20px] bg-[#34291C] text-[#f6eddd] border border-[#483928] shadow-xl space-y-6">
              <Quote className="w-8 h-8 text-[#9e3b26]" />
              <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
                A Message from the Leadership
              </h3>
              <p className="text-xs sm:text-sm text-[#d5cabb] leading-relaxed">
                "Every child walks through our school gates with infinite capacity. Our responsibility as educators is not to fill a vessel with facts, but to kindle an enduring flame of inquiry, moral courage, and self-belief."
              </p>

              <div className="pt-4 border-t border-[#483928] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#9e3b26] text-white flex items-center justify-center font-bold text-sm">
                  GK
                </div>
                <div>
                  <strong className="block text-sm font-bold text-[#f6eddd]">Academic Directorate</strong>
                  <span className="text-xs text-[#a09079]">Global Kids School, Tumakuru</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3-Column Approach Cards */}
      <section className="py-20 bg-[#F9F1E0] border-y border-[#e2d5c0]">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#9e3b26]">
              Our Educational Framework
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold font-['Space_Grotesk'] text-[#34291C]">
              How we nurture young minds.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {approaches.map((app, idx) => (
              <div key={idx} className="p-8 rounded-[16px] bg-[#f6eddd] border border-[#e2d5c0] shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e3b26] block">
                    {app.tag}
                  </span>
                  <h3 className="text-xl font-bold font-['Space_Grotesk'] text-[#34291C]">
                    {app.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                    {app.desc}
                  </p>
                </div>
                <div className="pt-4 border-t border-[#e2d5c0] text-xs font-bold text-[#9e3b26] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>CBSE Pedagogical Standard</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community CTA Band */}
      <section className="py-20 max-w-[1280px] mx-auto px-6 sm:px-12">
        <div className="rounded-[20px] bg-[#34291C] text-[#f6eddd] p-8 sm:p-14 flex flex-col md:flex-row items-center justify-between gap-8 border border-[#483928] shadow-xl">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
              Become part of our learning circle.
            </h2>
            <p className="text-xs sm:text-sm text-[#d5cabb] leading-relaxed">
              Whether you are a prospective parent, an educator looking for a nurturing place to grow, or a community partner in Tumakuru, we welcome you.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-6 py-3.5 rounded-[10px] bg-[#9e3b26] text-[#f6eddd] font-bold text-sm shadow-md hover:bg-[#832e1d] transition-all shrink-0 flex items-center gap-2"
          >
            <span>Start the Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
