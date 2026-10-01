import { Link } from "wouter";
import { motion } from "framer-motion";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { ArrowUpRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-[#1a1a1a] font-['Space_Grotesk',sans-serif] selection:bg-[#2a5a52] selection:text-white">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-24 max-w-[1200px] mx-auto px-8 sm:px-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-[#1a1a1a]">
            Education without the noise.
          </h1>
          <p className="mt-6 text-lg text-[#5a5a5a] leading-relaxed max-w-md">
            Global Kids School offers a calm, inquiry-led education in Tumakuru.
          </p>
          <div className="mt-10 flex gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#2a5a52] text-white text-sm font-medium hover:bg-[#224a43] transition-colors"
            >
              Book a Visit
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center px-6 py-3 rounded-full border border-[#e0e0e0] text-sm font-medium hover:bg-[#f8f8f8] transition-colors"
            >
              Our Philosophy
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="border-t border-[#e8e8e8] py-12">
        <div className="max-w-[1200px] mx-auto px-8 sm:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-[#2a5a52]">15+</p>
              <p className="mt-1 text-sm text-[#5a5a5a]">Years in Tumakuru</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#2a5a52]">600+</p>
              <p className="mt-1 text-sm text-[#5a5a5a]">Students Enrolled</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#2a5a52]">1:15</p>
              <p className="mt-1 text-sm text-[#5a5a5a]">Teacher Ratio</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-[#2a5a52]">4</p>
              <p className="mt-1 text-sm text-[#5a5a5a]">Learning Wings</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Journey Section */}
      <section className="py-20 sm:py-28 max-w-[1200px] mx-auto px-8 sm:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <p className="text-sm font-medium text-[#2a5a52] uppercase tracking-wider">
              Evolution & Milestones
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a]">
              A decade of steady growth.
            </h2>
            <p className="mt-4 text-[#5a5a5a] leading-relaxed">
              From a small learning space in Vokkodi to a full campus of discovery labs and creative studios.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <TimelineItem
              year="2011"
              tag="Origins"
              title="Foundations in Vokkodi"
              desc="Started with 45 students in a small learning environment focused on inquiry and foundational skills."
            />
            <TimelineItem
              year="2016"
              tag="Infrastructure"
              title="Primary Wing Expansion"
              desc="Dedicated STEM labs and open play areas for Grades 1 to 5."
            />
            <TimelineItem
              year="2021"
              tag="Academics"
              title="CBSE High School Addition"
              desc="Secondary classrooms, advanced labs, and academic mentorship."
            />
            <TimelineItem
              year="Present"
              tag="Today"
              title="A Vibrant Learning Community"
              desc="Over 600 students, 40 dedicated teachers, thriving campus culture."
            />
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-20 sm:py-28 bg-[#f8f8f8]">
        <div className="max-w-[1200px] mx-auto px-8 sm:px-12">
          <div className="max-w-lg mb-16">
            <p className="text-sm font-medium text-[#2a5a52] uppercase tracking-wider">
              Our Approach
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a]">
              What makes us different.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Differentiator
              subtitle="Curiosity First"
              title="Child-Centred Inquiry"
              desc="Students ask questions, conduct hands-on experiments, and build conceptual understanding without rote pressure."
            />
            <Differentiator
              subtitle="Rhythm & Balance"
              title="Structured, Calm Routines"
              desc="Academic focus balanced with daily outdoor movement, arts, and mindful reflection."
            />
            <Differentiator
              subtitle="Open Community"
              title="Transparent Parent Partnership"
              desc="Regular educator touchpoints, transparent progress tracking, and an approachable leadership team."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 max-w-[1200px] mx-auto px-8 sm:px-12">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#1a1a1a]">
            Be part of our next chapter.
          </h2>
          <p className="mt-4 text-[#5a5a5a] leading-relaxed">
            Take the first step toward a calm, curiosity-led school journey for your child in Tumakuru.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#2a5a52] text-white font-medium hover:bg-[#224a43] transition-colors"
          >
            Enquire for Admissions
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function TimelineItem({ year, tag, title, desc }: { year: string; tag: string; title: string; desc: string }) {
  return (
    <div className="pb-6 border-b border-[#e8e8e8] last:border-b-0">
      <div className="flex items-start gap-4">
        <span className="text-xs font-medium text-[#2a5a52] bg-[#edf2f1] px-2.5 py-1 rounded">
          {year}
        </span>
        <div className="flex-1">
          <span className="text-xs text-[#8a8a8a]">{tag}</span>
          <h3 className="mt-1 text-lg font-bold text-[#1a1a1a]">{title}</h3>
          <p className="mt-1 text-sm text-[#5a5a5a] leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function Differentiator({ subtitle, title, desc }: { subtitle: string; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-xl bg-white border border-[#e8e8e8]">
      <p className="text-xs font-medium text-[#2a5a52] uppercase tracking-wider">
        {subtitle}
      </p>
      <h3 className="mt-2 text-xl font-bold text-[#1a1a1a]">{title}</h3>
      <p className="mt-3 text-sm text-[#5a5a5a] leading-relaxed">{desc}</p>
    </div>
  );
}
