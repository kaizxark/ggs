import React, { useState } from "react";
import { Link } from "wouter";
import { useSession } from "../lib/supabase";

export default function Home() {
  const { isAuthenticated } = useSession();
  const [activeTab, setActiveTab] = useState<"routine" | "curriculum" | "transit" | "fees">("routine");
  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [selectedRoute, setSelectedRoute] = useState<number>(1);

  // Bell Schedule Data (Factual, precise, 4-point aligned)
  const bellSchedule = [
    { time: "08:30 – 08:55", event: "Morning Assembly & Campus Gathering", detail: "Roll verification, state anthem, thought for the day, and brief student reading.", room: "Central Courtyard" },
    { time: "08:55 – 09:45", event: "Period 1 · Foundational Language", detail: "English comprehension, grammar structures, and guided reading circles.", room: "Primary & Middle Classrooms" },
    { time: "09:45 – 10:35", event: "Period 2 · Mathematical Sciences", detail: "Arithmetic foundations, manipulative problem-solving, and geometry labs.", room: "Mathematics & Academic Wings" },
    { time: "10:35 – 10:50", event: "Morning Refreshment Break", detail: "Supervised outdoor recreation and fruit nutrition interval.", room: "Campus Grounds" },
    { time: "10:50 – 11:40", event: "Period 3 · General Science & Discovery", detail: "Environmental studies for primary; laboratory demonstrations for middle school.", room: "Science Wing & Demo Lab" },
    { time: "11:40 – 12:30", event: "Period 4 · Regional Language (Kannada)", detail: "State board Kannada literacy, script fluency, and regional literature.", room: "Academic Classrooms" },
    { time: "12:30 – 13:20", event: "Mid-Day Meal & Recess", detail: "Nutritious lunch break with staff dining supervision and free play.", room: "Dining Hall & Shaded Lawns" },
    { time: "13:20 – 14:10", event: "Period 5 · Social Sciences & Civics", detail: "Indian history, world geography, regional culture, and civic duties.", room: "Academic Classrooms" },
    { time: "14:10 – 15:00", event: "Period 6 · Computer Foundations & Hindi", detail: "Keyboarding and digital literacy alternating with Hindi third-language study.", room: "Computer Lab (25 Terminals)" },
    { time: "15:00 – 15:45", event: "Period 7 · Physical Education & Arts", detail: "Kho-kho, volleyball, athletics, drawing, and classical cultural activities.", room: "Sports Ground & Arts Room" },
    { time: "15:45", event: "Campus Dismissal", detail: "Organized vehicle boarding and teacher-supervised bus dispatch.", room: "East Transit Gate" },
  ];

  // Curriculum by Grade Data (Factual, specific, zero marketing fluff)
  const gradeCurriculum: Record<number, { wing: string; syllabus: string; subjects: string[]; periodsPerWeek: number; maxStrength: number; focus: string }> = {
    1: { wing: "Primary Wing", syllabus: "Karnataka State Early Primary + Foundational English", subjects: ["English Literacy", "Kannada (First Steps)", "Foundational Mathematics", "Environmental Studies", "Art & Craft", "Physical Activity"], periodsPerWeek: 35, maxStrength: 24, focus: "Phonetic reading, basic handwriting, number sense up to 100, and collaborative play." },
    2: { wing: "Primary Wing", syllabus: "Karnataka State Primary Syllabus", subjects: ["English Reader", "Kannada", "Mathematics", "Environmental Studies", "General Knowledge", "Physical Education"], periodsPerWeek: 35, maxStrength: 24, focus: "Sentence building, subtraction and basic multiplication, daily reading habit, nature observation." },
    3: { wing: "Primary Wing", syllabus: "Karnataka State Primary Syllabus", subjects: ["English Prose & Poetry", "Kannada", "Mathematics (Manipulatives)", "Environmental Science", "Computer Awareness", "Arts & Physical Ed"], periodsPerWeek: 35, maxStrength: 24, focus: "Mental arithmetic, regional geography of Tumakuru district, basic typing, expressive drawing." },
    4: { wing: "Primary Wing", syllabus: "Karnataka State Primary Syllabus", subjects: ["English Comprehension", "Kannada Language", "Mathematics", "General Science Basics", "Social Studies", "Physical Training"], periodsPerWeek: 35, maxStrength: 24, focus: "Formal paragraph composition, fractions and measurements, local history, organized sports rules." },
    5: { wing: "Middle School Wing", syllabus: "State Syllabus + Integrated Science Foundations", subjects: ["English (First Language)", "Kannada", "Hindi (Third Language)", "General Mathematics", "Integrated General Science", "Social Science", "Computer Lab"], periodsPerWeek: 42, maxStrength: 26, focus: "Introduction to 3-language formula, hands-on scientific experiments, algebra concepts, map reading." },
    6: { wing: "Middle School Wing", syllabus: "State Syllabus + Pre-High School Transition", subjects: ["English Literature & Grammar", "Kannada", "Hindi", "Mathematics", "Basic Physics & Chemistry", "Biology & Life Sciences", "History & Civics", "IT"], periodsPerWeek: 42, maxStrength: 26, focus: "Formal lab reports, geometry proofs, medieval Indian history, computer programming logic." },
    7: { wing: "Middle School Wing", syllabus: "State Syllabus + High School Foundation", subjects: ["English", "Kannada", "Hindi", "Mathematics", "Physical Sciences", "Natural Sciences", "Geography & Civics", "Computer Studies"], periodsPerWeek: 42, maxStrength: 26, focus: "Linear equations, ecosystem science, constitution basics, spreadsheet and document tools." },
    8: { wing: "High School Wing", syllabus: "Karnataka Secondary Education Examination Board (KSEEB)", subjects: ["English", "Kannada", "Hindi", "Mathematics (Algebra & Geometry)", "Science (Physics, Chemistry, Biology)", "Social Science", "Physical Ed"], periodsPerWeek: 44, maxStrength: 28, focus: "Rigorous board preparation, individual science practicals, advanced algebraic methods, civic law." },
    9: { wing: "High School Wing", syllabus: "Karnataka Secondary Education Examination Board (KSEEB)", subjects: ["English Core", "Kannada Core", "Hindi", "Mathematics", "Physics", "Chemistry", "Biology", "History, Geography, Economics"], periodsPerWeek: 44, maxStrength: 28, focus: "Mock unit testing, board question bank analysis, laboratory record maintenance, seminar presentation." },
    10: { wing: "High School Wing", syllabus: "Karnataka SSLC Board Exam Curriculum", subjects: ["First Language", "Second Language", "Third Language", "Mathematics", "Science Theory & Practical", "Social Science"], periodsPerWeek: 44, maxStrength: 28, focus: "Comprehensive SSLC board syllabus mastery, previous 10-year paper solutions, weekly diagnostic assessments." }
  };

  // Bus Routes Data (Authentic Tumakuru geography)
  const busRoutes = [
    { id: 1, name: "Route 1 · Kyatsandra & Siddaganga Hub", vehicle: "KA-06-B-4102", driver: "Ramesh Gowda", phone: "+91 94812 34001", stops: ["07:40 Kyatsandra Toll Gate", "07:50 Siddaganga Mutt Arch", "07:58 Batawadi Flyover", "08:12 Campus East Gate"] },
    { id: 2, name: "Route 2 · Bheemasandra & NH Corridor", vehicle: "KA-06-B-4105", driver: "Narayana Swamy", phone: "+91 94812 34002", stops: ["07:45 Bheemasandra Railway Gate", "07:55 Gangothri Nagar", "08:05 Ring Road Cross", "08:15 Campus East Gate"] },
    { id: 3, name: "Route 3 · SS Puram & Town Hall", vehicle: "KA-06-B-4108", driver: "Manjunatha K.", phone: "+91 94812 34003", stops: ["07:35 Tumakuru Town Hall", "07:45 Ashoka Road Junction", "07:55 SS Puram 5th Main", "08:05 SIT Main Gate", "08:18 Campus East Gate"] },
    { id: 4, name: "Route 4 · Mandipet & Gubbi Gate", vehicle: "KA-06-B-4112", driver: "Prasanna Kumar", phone: "+91 94812 34004", stops: ["07:40 Gubbi Gate Circle", "07:50 Mandipet Market", "08:00 Chickpet Road", "08:16 Campus East Gate"] },
    { id: 5, name: "Route 5 · Batawadi & Ring Road", vehicle: "KA-06-B-4115", driver: "Suresh Babu", phone: "+91 94812 34005", stops: ["07:40 Batawadi KSRTC Bus Stop", "07:50 Shanthi Nagar", "08:02 Maralur Dinnne", "08:15 Campus East Gate"] },
    { id: 6, name: "Route 6 · Melekote & University Belt", vehicle: "KA-06-B-4118", driver: "Shivakumar T.", phone: "+91 94812 34006", stops: ["07:45 Tumkur University Gate", "07:55 Melekote Main Road", "08:05 Heggere Junction", "08:18 Campus East Gate"] },
  ];

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-[#141918] selection:bg-[#163832] selection:text-[#FBF9F5]" style={{ fontFamily: "var(--font-sans)" }}>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Header / Navigation: Clean, left-anchored, zero emojis, one CTA */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-[#E8E2D5] bg-[#FBF9F5] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          {/* Brand lockup */}
          <Link href="/" className="flex items-center gap-3">
            <img src="/global-kids-logo.svg" alt="Global Kids School Crest" className="h-9 w-9 object-contain" />
            <div className="flex flex-col">
              <span className="font-serif text-lg font-bold tracking-tight text-[#141918] leading-none">
                Global Kids School
              </span>
              <span className="font-mono text-[11px] text-[#6A726F] mt-1 leading-none">
                Tumakuru · K–10 Day School
              </span>
            </div>
          </Link>

          {/* Clean text nav (no emojis) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#4A524F]">
            <a href="#curriculum" className="hover:text-[#141918] transition-colors">Academics</a>
            <a href="#routine" className="hover:text-[#141918] transition-colors">School Routine</a>
            <a href="#fleet" className="hover:text-[#141918] transition-colors">Transportation</a>
            <a href="#tuition" className="hover:text-[#141918] transition-colors">Tuition & Fees</a>
            <a href="#contact" className="hover:text-[#141918] transition-colors">Location</a>
          </nav>

          {/* Single primary button */}
          <div>
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#163832] text-[#FBF9F5] text-xs font-semibold hover:bg-[#102723] transition-colors"
              >
                Go to Dashboard &rarr;
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#163832] text-[#FBF9F5] text-xs font-semibold hover:bg-[#102723] transition-colors"
              >
                School Portal &rarr;
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Hero Section: Left-aligned, no pill, no gradient text, one button */}
      {/* ------------------------------------------------------------------ */}
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 max-w-6xl mx-auto px-4 sm:px-8">
        <div className="max-w-3xl">
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#141918] leading-[1.08]">
            Kindergarten through Grade 10 day school in Tumakuru.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#4A524F] leading-relaxed max-w-2xl font-sans">
            Global Kids School provides structured foundational academics aligned with the Karnataka State syllabus, verified daily bus transit across six Tumakuru corridors, and transparent term tuition.
          </p>

          {/* Exactly ONE main button + one quiet text anchor */}
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <a
              href="#terminal"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-[#163832] text-[#FBF9F5] font-sans font-semibold text-sm hover:bg-[#0F2622] transition-colors"
            >
              Explore Schedule & Curriculum
            </a>
            <a
              href="#tuition"
              className="text-sm font-sans font-medium text-[#4A524F] hover:text-[#141918] transition-colors"
            >
              View 2026–27 Fee Structure &darr;
            </a>
          </div>
        </div>

        {/* Factual Institutional Specification Strip (Not an inflated stat banner) */}
        <div className="mt-14 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E8E2D5]">
          <div className="p-4 sm:p-5">
            <span className="block text-xs font-mono text-[#6A726F]">Affiliation</span>
            <span className="block mt-1 text-sm font-semibold text-[#141918]">Karnataka State Board (K–10)</span>
            <span className="block text-xs text-[#6A726F] mt-0.5">Govt. Recognised · Tumakuru North</span>
          </div>
          <div className="p-4 sm:p-5">
            <span className="block text-xs font-mono text-[#6A726F]">Campus Hours</span>
            <span className="block mt-1 text-sm font-semibold text-[#141918]">08:30 AM – 03:45 PM</span>
            <span className="block text-xs text-[#6A726F] mt-0.5">Monday through Saturday</span>
          </div>
          <div className="p-4 sm:p-5">
            <span className="block text-xs font-mono text-[#6A726F]">Classroom Size</span>
            <span className="block mt-1 text-sm font-semibold text-[#141918]">Max 24–28 Pupils</span>
            <span className="block text-xs text-[#6A726F] mt-0.5">1:18 Teacher-Student Ratio</span>
          </div>
          <div className="p-4 sm:p-5">
            <span className="block text-xs font-mono text-[#6A726F]">Transport Fleet</span>
            <span className="block mt-1 text-sm font-semibold text-[#141918]">6 Dedicated Bus Routes</span>
            <span className="block text-xs text-[#6A726F] mt-0.5">Attendant & Speed Governors (40 km/h)</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Centerpiece: The Campus Terminal ("One moment worth looking at") */}
      {/* ------------------------------------------------------------------ */}
      <section id="terminal" className="py-12 sm:py-16 bg-[#F4F0E6] border-y border-[#E8E2D5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="max-w-2xl mb-8">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#141918]">
              Campus specifications & operational schedules
            </h2>
            <p className="mt-2 text-sm text-[#4A524F]">
              Review the exact daily bell routine, grade-wise syllabus milestones, bus corridor stops, and published term tuition.
            </p>
          </div>

          {/* Crisp, non-pill tab bar */}
          <div className="flex items-center gap-2 border-b border-[#D8D0C2] pb-px overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("routine")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "routine"
                  ? "border-[#163832] text-[#163832]"
                  : "border-transparent text-[#6A726F] hover:text-[#141918]"
              }`}
            >
              1. Daily Bell Routine (08:30–15:45)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("curriculum")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "curriculum"
                  ? "border-[#163832] text-[#163832]"
                  : "border-transparent text-[#6A726F] hover:text-[#141918]"
              }`}
            >
              2. Curriculum & Wings (Classes 1–10)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transit")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "transit"
                  ? "border-[#163832] text-[#163832]"
                  : "border-transparent text-[#6A726F] hover:text-[#141918]"
              }`}
            >
              3. Transit Corridors (6 Routes)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("fees")}
              className={`px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                activeTab === "fees"
                  ? "border-[#163832] text-[#163832]"
                  : "border-transparent text-[#6A726F] hover:text-[#141918]"
              }`}
            >
              4. Fee Schedule (AY 2026–27)
            </button>
          </div>

          {/* Tab 1: Daily Bell Routine */}
          {activeTab === "routine" && (
            <div className="mt-6 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-[#E8E2D5] bg-[#FBF9F5] flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-[#6A726F]">Standard Instructional Day · 7 Academic Periods</span>
                <span className="text-xs font-mono text-[#6A726F]">Bell Timing Standard</span>
              </div>
              <div className="divide-y divide-[#E8E2D5]">
                {bellSchedule.map((slot, index) => (
                  <div key={index} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#FDFCF9]">
                    <div className="sm:w-44 shrink-0">
                      <span className="font-mono text-xs font-semibold text-[#163832]">{slot.time}</span>
                    </div>
                    <div className="flex-1">
                      <strong className="block text-sm font-medium text-[#141918]">{slot.event}</strong>
                      <span className="text-xs text-[#525856] mt-0.5 block">{slot.detail}</span>
                    </div>
                    <div className="sm:w-56 text-left sm:text-right shrink-0">
                      <span className="text-xs text-[#6A726F] font-mono">{slot.room}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Curriculum by Grade */}
          {activeTab === "curriculum" && (
            <div className="mt-6 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] p-5 shadow-xs">
              {/* Grade Selector bar */}
              <div className="flex items-center gap-1.5 flex-wrap pb-4 border-b border-[#E8E2D5]">
                <span className="text-xs font-mono text-[#6A726F] mr-2">Select Class:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g)}
                    className={`h-7 px-2.5 text-xs font-mono font-bold rounded-md border transition-colors ${
                      selectedGrade === g
                        ? "bg-[#163832] text-[#FBF9F5] border-[#163832]"
                        : "bg-[#FBF9F5] text-[#4A524F] border-[#E8E2D5] hover:border-[#163832]"
                    }`}
                  >
                    Class {g}
                  </button>
                ))}
              </div>

              {/* Selected Grade Details */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-mono text-[#6A726F]">Educational Tier</span>
                    <h3 className="text-lg font-serif font-bold text-[#141918] mt-0.5">
                      Class {selectedGrade} · {gradeCurriculum[selectedGrade].wing}
                    </h3>
                  </div>
                  <div>
                    <span className="text-xs font-mono text-[#6A726F]">Syllabus Affiliation</span>
                    <p className="text-xs text-[#343A38] font-medium mt-0.5">{gradeCurriculum[selectedGrade].syllabus}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 border border-[#E8E2D5] rounded-md bg-[#FBF9F5]">
                      <span className="block text-[11px] font-mono text-[#6A726F]">Weekly Periods</span>
                      <span className="block text-sm font-bold text-[#141918]">{gradeCurriculum[selectedGrade].periodsPerWeek} periods</span>
                    </div>
                    <div className="p-3 border border-[#E8E2D5] rounded-md bg-[#FBF9F5]">
                      <span className="block text-[11px] font-mono text-[#6A726F]">Class Cap</span>
                      <span className="block text-sm font-bold text-[#141918]">{gradeCurriculum[selectedGrade].maxStrength} students</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2 border-t md:border-t-0 md:border-l border-[#E8E2D5] pt-4 md:pt-0 md:pl-6">
                  <div>
                    <span className="text-xs font-mono text-[#6A726F]">Core Academic Subjects</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {gradeCurriculum[selectedGrade].subjects.map((sub, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-md border border-[#E8E2D5] bg-[#FBF9F5] text-xs font-medium text-[#141918]">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3">
                    <span className="text-xs font-mono text-[#6A726F]">Pedagogical Focus & Milestones</span>
                    <p className="mt-1 text-sm text-[#4A524F] leading-relaxed">
                      {gradeCurriculum[selectedGrade].focus}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Transit Corridors */}
          {activeTab === "transit" && (
            <div className="mt-6 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] p-5 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap pb-4 border-b border-[#E8E2D5]">
                <span className="text-xs font-mono text-[#6A726F] mr-1">Select Route:</span>
                {busRoutes.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRoute(r.id)}
                    className={`h-7 px-3 text-xs font-mono font-medium rounded-md border transition-colors ${
                      selectedRoute === r.id
                        ? "bg-[#163832] text-[#FBF9F5] border-[#163832]"
                        : "bg-[#FBF9F5] text-[#4A524F] border-[#E8E2D5] hover:border-[#163832]"
                    }`}
                  >
                    Route {r.id}
                  </button>
                ))}
              </div>

              {/* Selected Route Info */}
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-mono text-[#6A726F]">Corridor Name</span>
                    <h3 className="text-base font-serif font-bold text-[#141918] mt-0.5">
                      {busRoutes.find(r => r.id === selectedRoute)?.name}
                    </h3>
                  </div>
                  <div className="p-3 border border-[#E8E2D5] rounded-md bg-[#FBF9F5] space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6A726F]">Vehicle Reg:</span>
                      <span className="font-mono font-bold text-[#141918]">{busRoutes.find(r => r.id === selectedRoute)?.vehicle}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6A726F]">Driver In-Charge:</span>
                      <span className="font-medium text-[#141918]">{busRoutes.find(r => r.id === selectedRoute)?.driver}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#6A726F]">Emergency Contact:</span>
                      <span className="font-mono text-[#163832]">{busRoutes.find(r => r.id === selectedRoute)?.phone}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#6A726F] block leading-normal">
                    Equipped with AIS-140 GPS tracker, emergency stop buzzer, first-aid kit, and dedicated female bus attendant.
                  </span>
                </div>

                <div className="md:col-span-2 border-t md:border-t-0 md:border-l border-[#E8E2D5] pt-4 md:pt-0 md:pl-6">
                  <span className="text-xs font-mono text-[#6A726F]">Designated Morning Pickup Sequence</span>
                  <div className="mt-3 space-y-2.5">
                    {busRoutes.find(r => r.id === selectedRoute)?.stops.map((st, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs p-2.5 rounded-md border border-[#E8E2D5] bg-[#FBF9F5]">
                        <span className="w-5 h-5 rounded-full bg-[#163832] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium text-[#141918]">{st}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Fee Schedule */}
          {activeTab === "fees" && (
            <div className="mt-6 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] overflow-hidden shadow-xs">
              <div className="px-5 py-3 border-b border-[#E8E2D5] bg-[#FBF9F5] flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-[#6A726F]">Institutional Fee Structure · AY 2026–27</span>
                <span className="text-xs font-mono text-[#6A726F]">Two Term Installments (50% / 50%)</span>
              </div>
              <div className="divide-y divide-[#E8E2D5] text-xs">
                <div className="p-4 grid grid-cols-12 font-mono font-semibold text-[#6A726F] bg-[#FAF8F3]">
                  <div className="col-span-4 sm:col-span-5">Cohort Wing</div>
                  <div className="col-span-3 text-right">Term 1 (June)</div>
                  <div className="col-span-2 sm:col-span-2 text-right">Term 2 (Nov)</div>
                  <div className="col-span-3 sm:col-span-2 text-right">Annual Tuition</div>
                </div>

                <div className="p-4 grid grid-cols-12 items-center hover:bg-[#FDFCF9]">
                  <div className="col-span-4 sm:col-span-5">
                    <span className="font-semibold text-[#141918] block text-sm">Primary Wing</span>
                    <span className="text-[#6A726F] text-[11px]">Classes 1, 2, 3, 4</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-[#4A524F]">₹15,000</div>
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-[#4A524F]">₹15,000</div>
                  <div className="col-span-3 sm:col-span-2 text-right font-mono font-bold text-[#163832] text-sm">₹30,000</div>
                </div>

                <div className="p-4 grid grid-cols-12 items-center hover:bg-[#FDFCF9]">
                  <div className="col-span-4 sm:col-span-5">
                    <span className="font-semibold text-[#141918] block text-sm">Middle School</span>
                    <span className="text-[#6A726F] text-[11px]">Classes 5, 6, 7</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-[#4A524F]">₹17,500</div>
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-[#4A524F]">₹17,500</div>
                  <div className="col-span-3 sm:col-span-2 text-right font-mono font-bold text-[#163832] text-sm">₹35,000</div>
                </div>

                <div className="p-4 grid grid-cols-12 items-center hover:bg-[#FDFCF9]">
                  <div className="col-span-4 sm:col-span-5">
                    <span className="font-semibold text-[#141918] block text-sm">High School</span>
                    <span className="text-[#6A726F] text-[11px]">Classes 8, 9, 10</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-[#4A524F]">₹20,000</div>
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-[#4A524F]">₹20,000</div>
                  <div className="col-span-3 sm:col-span-2 text-right font-mono font-bold text-[#163832] text-sm">₹40,000</div>
                </div>

                <div className="p-4 grid grid-cols-12 items-center hover:bg-[#FDFCF9] bg-[#FAF8F3]">
                  <div className="col-span-4 sm:col-span-5">
                    <span className="font-semibold text-[#141918] block">Transportation Service</span>
                    <span className="text-[#6A726F] text-[11px]">All 6 Tumakuru Corridors (Optional)</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-[#4A524F]">₹7,000</div>
                  <div className="col-span-2 sm:col-span-2 text-right font-mono text-[#4A524F]">₹7,000</div>
                  <div className="col-span-3 sm:col-span-2 text-right font-mono font-bold text-[#141918]">₹14,000</div>
                </div>
              </div>
              <div className="p-4 bg-[#FBF9F5] border-t border-[#E8E2D5] text-xs text-[#6A726F] flex items-center justify-between">
                <span>Tuition covers laboratory, examination charges, library, and sports. Zero donation or admission surcharge.</span>
                <span className="font-mono text-[11px]">Direct Bank Transfer / UPI Receipt</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Concrete Operational Standards (Cards that say something real)  */}
      {/* ------------------------------------------------------------------ */}
      <section id="curriculum" className="py-16 max-w-6xl mx-auto px-4 sm:px-8">
        <div className="max-w-2xl mb-10">
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#141918]">
            Educational foundations & campus governance
          </h2>
          <p className="mt-2 text-sm text-[#4A524F]">
            How teaching, safety, and operational administration are structured across all ten grades.
          </p>
        </div>

        {/* 4 dense informational cards (NO icon boxes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Card 1 */}
          <div className="border border-[#E8E2D5] rounded-md p-6 bg-[#FFFFFF] shadow-xs">
            <span className="text-xs font-mono text-[#6A726F]">Classroom Structure</span>
            <h3 className="font-serif text-lg font-bold text-[#141918] mt-1 mb-2.5">
              Capped classrooms & certified subject faculty
            </h3>
            <p className="text-xs text-[#525856] leading-relaxed mb-4">
              Sections are capped at a maximum of 24–28 students to guarantee that every pupil recites, works through calculations at the board, and receives individual writing feedback daily.
            </p>
            <ul className="text-xs text-[#343A38] space-y-2 border-t border-[#E8E2D5] pt-3 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Bilingual English & Kannada instruction in primary; specialized subject teachers in secondary.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Scheduled bi-weekly parent communication hours on Saturday mornings.</span>
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="border border-[#E8E2D5] rounded-md p-6 bg-[#FFFFFF] shadow-xs">
            <span className="text-xs font-mono text-[#6A726F]">Instructional Facilities</span>
            <h3 className="font-serif text-lg font-bold text-[#141918] mt-1 mb-2.5">
              Laboratory inquiry & practical demonstration
            </h3>
            <p className="text-xs text-[#525856] leading-relaxed mb-4">
              Learning proceeds through tangible evidence. Science concepts are verified in weekly laboratory demonstration sessions, alongside dedicated mathematics manipulative kits.
            </p>
            <ul className="text-xs text-[#343A38] space-y-2 border-t border-[#E8E2D5] pt-3 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>25-terminal air-cooled computer lab with monitored educational software and basic coding.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Curated library with over 1,800 reference titles in English, Kannada, and regional history.</span>
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="border border-[#E8E2D5] rounded-md p-6 bg-[#FFFFFF] shadow-xs">
            <span className="text-xs font-mono text-[#6A726F]">Health & Campus Safety</span>
            <h3 className="font-serif text-lg font-bold text-[#141918] mt-1 mb-2.5">
              Perimeter security, pure water & medical care
            </h3>
            <p className="text-xs text-[#525856] leading-relaxed mb-4">
              Physical well-being is non-negotiable. The campus maintains gated access control with strict visitor logging, comprehensive CCTV coverage, and quarterly lab-tested drinking water.
            </p>
            <ul className="text-xs text-[#343A38] space-y-2 border-t border-[#E8E2D5] pt-3 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Equipped first-aid medical infirmary with trained nursing assistant on duty.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Zero unmonitored exits; gate pass mandatory for any early student release to guardians.</span>
              </li>
            </ul>
          </div>

          {/* Card 4 */}
          <div className="border border-[#E8E2D5] rounded-md p-6 bg-[#FFFFFF] shadow-xs">
            <span className="text-xs font-mono text-[#6A726F]">Administrative Portal</span>
            <h3 className="font-serif text-lg font-bold text-[#141918] mt-1 mb-2.5">
              Real-time attendance & transparent accounting
            </h3>
            <p className="text-xs text-[#525856] leading-relaxed mb-4">
              Parents access our digital ERP for instantaneous morning attendance verification, fee installment records with downloadable tax receipts, and term examination report cards.
            </p>
            <ul className="text-xs text-[#343A38] space-y-2 border-t border-[#E8E2D5] pt-3 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Direct online UPI/Netbanking payments with automated receipt ledger logging.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#163832] font-bold">&bull;</span>
                <span>Instant SMS notifications when an unexcused student absence is recorded in the morning.</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. Campus Location & Direct Admissions Inquiry                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="contact" className="py-16 bg-[#F4F0E6] border-t border-[#E8E2D5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Location & Visiting hours */}
          <div className="space-y-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#141918]">
              Campus visits & admissions office
            </h2>
            <p className="text-sm text-[#4A524F] leading-relaxed">
              Admissions for Academic Year 2026–27 are open for Kindergarten through Grade 9. We encourage parents to schedule a morning campus walk to observe classroom instruction in progress.
            </p>

            <div className="p-5 border border-[#E8E2D5] rounded-md bg-[#FFFFFF] space-y-3 mt-6">
              <div>
                <span className="block text-xs font-mono text-[#6A726F]">Campus Address</span>
                <strong className="block text-sm text-[#141918] mt-0.5">
                  Global Kids School, Bheemasandra / Nagar Heggere
                </strong>
                <span className="text-xs text-[#525856]">Tumakuru, Karnataka 572106 (Near NH Bypass Corridor)</span>
              </div>

              <div className="pt-3 border-t border-[#E8E2D5] grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-mono text-[#6A726F]">Admissions Desk</span>
                  <span className="block text-xs font-mono font-bold text-[#163832] mt-0.5">+91 94812 34000</span>
                  <span className="text-[11px] text-[#6A726F]">08:00 AM – 04:30 PM</span>
                </div>
                <div>
                  <span className="block text-xs font-mono text-[#6A726F]">General Office</span>
                  <span className="block text-xs font-mono font-bold text-[#141918] mt-0.5">office@globalkids.in</span>
                  <span className="text-[11px] text-[#6A726F]">Official correspondence</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Step Admissions Procedure */}
          <div className="border border-[#E8E2D5] rounded-md bg-[#FFFFFF] p-6 shadow-xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#141918]">
              Admissions procedure in three steps
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-md bg-[#163832] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-[#141918] block font-medium">Campus Consultation & Observation</strong>
                  <span className="text-[#525856]">Meet the academic coordinator and view a typical school day session.</span>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-md bg-[#163832] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-[#141918] block font-medium">Documentation Verification</strong>
                  <span className="text-[#525856]">Submit previous academic marks card, birth certificate, transfer certificate (TC), and Aadhaar copy.</span>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-md bg-[#163832] text-[#FBF9F5] flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-[#141918] block font-medium">Enrollment & Portal Provisioning</strong>
                  <span className="text-[#525856]">Pay Term 1 fee via bank transfer; parent portal credentials and bus route allocation issued immediately.</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E8E2D5] flex items-center justify-between">
              <span className="text-xs text-[#6A726F]">Enrolled parents or staff members:</span>
              <Link
                href="/login"
                className="text-xs font-semibold text-[#163832] hover:underline"
              >
                Sign in to Portal &rarr;
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Footer: Dignified, quiet, zero slop                             */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-[#E8E2D5] py-8 bg-[#FBF9F5] text-xs text-[#6A726F]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/global-kids-logo.svg" alt="" className="h-6 w-6 object-contain" />
            <span className="font-serif font-bold text-[#141918]">Global Kids School</span>
            <span>&middot; Tumakuru, Karnataka 572106</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#terminal" className="hover:text-[#141918] transition-colors">Daily Schedule</a>
            <a href="#tuition" className="hover:text-[#141918] transition-colors">Fee Ledger</a>
            <a href="#fleet" className="hover:text-[#141918] transition-colors">Bus Routes</a>
            <Link href="/login" className="font-semibold text-[#163832] hover:underline">
              Portal Login
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
