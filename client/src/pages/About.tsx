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
  CheckCircle2,
  Smile,
  Shield,
  Award
} from "lucide-react";

export default function About() {
  const values = [
    { name: "Kindness", icon: HeartHandshake, desc: "Building empathy, gentle support, and mutual grace." },
    { name: "Integrity", icon: ShieldCheck, desc: "Honesty and sound moral consistency in every action." },
    { name: "Courage", icon: Target, desc: "Empowering children to take intellectual risks without fear." },
    { name: "Respect", icon: Users, desc: "Honor for self, diversity of thought, and shared spaces." },
    { name: "Responsibility", icon: Compass, desc: "Active stewardship of our work, peers, and environment." },
    { name: "Joy in learning", icon: Lightbulb, desc: "Curiosity and excitement in every daily discovery." },
  ];

  const approaches = [
    {
      title: "Learn with curiosity",
      desc: "Hands-on science experiments, mathematical manipulatives, and daily reading circles replace rote memorization."
    },
    {
      title: "Grow with confidence",
      desc: "Daily stage assemblies, debate councils, sports, and cultural arts nurture poise and clear public communication."
    },
    {
      title: "Lead with purpose",
      desc: "Community projects, civic awareness, and guided ethical discussions prepare students to become empathetic leaders."
    }
  ];

  return (
    <div className="min-h-screen bg-[#f6eddd] text-[#34291C] font-['Schibsted_Grotesk',sans-serif] selection:bg-[#9e3b26] selection:text-white">
      <Navbar />

      {/* Hero Banner with Photographic Background */}
      <section className="pt-6 pb-12 sm:pt-8 sm:pb-16 max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="relative rounded-[20px] overflow-hidden min-h-[340px] sm:min-h-[420px] flex items-end p-6 sm:p-12 shadow-lg border border-[#e5d8c3]">
          {/* Hero Background Image */}
          <img
            src="https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1800&q=80"
            alt="Global Kids School Classroom"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1f1911]/90 via-[#1f1911]/60 to-transparent" />

          {/* Hero Caption / Content */}
          <div className="relative z-10 max-w-2xl space-y-3 text-[#f6eddd]">
            <h1 className="text-3xl sm:text-5xl font-bold font-['Space_Grotesk'] tracking-tight leading-tight">
              Who we are
            </h1>
            <p className="text-sm sm:text-base text-[#e5dbcc] leading-relaxed max-w-xl">
              A calm, purposeful school in Tumakuru dedicated to building foundational literacy, active curiosity, and moral character.
            </p>
          </div>
        </div>
      </section>

      {/* 7:5 Split Story Grid: Core Values & Principal Note */}
      <section className="py-12 max-w-[1240px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

          {/* Left Column (7 cols): Story & Core Values */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#34291C] tracking-tight leading-tight">
                A school where children learn, participate, and grow
              </h2>
              <p className="text-sm text-[#6F6046] leading-relaxed">
                Global Kids School was established with a singular conviction: every child deserves a learning environment that respects their natural curiosity, nurtures emotional resilience, and sets high standards for foundational excellence.
              </p>
              <p className="text-sm text-[#6F6046] leading-relaxed">
                Located in Vokkodi, Tumakuru, our campus is structured to give learners space to breathe, question, experiment, and develop lifelong confidence under caring mentors.
              </p>
            </div>

            {/* Core Values 2x3 Grid */}
            <div className="pt-2 space-y-4">
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-[#34291C]">
                Our Guiding Values
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {values.map((v, i) => {
                  const Icon = v.icon;
                  return (
                    <div
                      key={i}
                      className="p-4 rounded-[12px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-[6px] bg-[#9e3b26] text-[#f6eddd] flex items-center justify-center">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="text-sm font-bold font-['Space_Grotesk'] text-[#34291C]">
                          {v.name}
                        </h4>
                      </div>
                      <p className="text-[11px] sm:text-xs text-[#6F6046] leading-relaxed">
                        {v.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Principal's Note Card */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <div className="p-7 rounded-[18px] bg-[#F9F1E0] border border-[#e2d5c0] shadow-xs space-y-5">
              <Quote className="w-7 h-7 text-[#9e3b26]" />
              <h3 className="text-lg font-bold font-['Space_Grotesk'] text-[#34291C]">
                A note from the leadership
              </h3>
              <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                "Every child who enters our campus carries immense promise. Our role as educators is not to lecture from above, but to provide the warmth, structure, and intellectual fuel they need to grow into capable, compassionate citizens."
              </p>

              <div className="pt-3 border-t border-[#e2d5c0] flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#9e3b26] text-white flex items-center justify-center font-bold text-xs">
                  GK
                </div>
                <div>
                  <strong className="block text-xs sm:text-sm font-bold text-[#34291C]">Academic Directorate</strong>
                  <span className="text-[11px] text-[#8e7e65]">Global Kids School, Tumakuru</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3-Column Approach Cards */}
      <section className="py-14 bg-[#F9F1E0] border-y border-[#e2d5c0]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8">
          <div className="max-w-xl mb-10 space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold font-['Space_Grotesk'] text-[#34291C]">
              Our approach
            </h2>
            <p className="text-xs sm:text-sm text-[#6F6046]">
              Three ideas behind every classroom day.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {approaches.map((app, idx) => (
              <div
                key={idx}
                className="p-6 rounded-[16px] bg-[#f6eddd] border border-[#e2d5c0] shadow-xs space-y-2.5"
              >
                <h3 className="text-base font-bold font-['Space_Grotesk'] text-[#34291C]">
                  {app.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#6F6046] leading-relaxed">
                  {app.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dark CTA Banner */}
      <section className="py-14 bg-[#34291C] text-[#f6eddd] border-t border-[#483928]">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold font-['Space_Grotesk'] text-[#f6eddd]">
              Come and see a school day for yourself.
            </h2>
            <p className="text-xs sm:text-sm text-[#c7baa6]">
              Schedule a guided walk through our classrooms and meet our educators.
            </p>
          </div>
          <Link
            href="/contact"
            className="px-6 py-3 rounded-[20px] bg-[#9e3b26] hover:bg-[#832e1d] text-[#f6eddd] font-bold text-xs sm:text-sm shadow-md transition-all shrink-0 flex items-center gap-2"
          >
            <span>Enquire about admissions</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
