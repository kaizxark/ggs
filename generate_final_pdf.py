import os
import subprocess
import sys

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Global Kids School ERP — Comprehensive System Specification</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  @page {
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
    @top-right {
      content: "GLOBAL KIDS SCHOOL ERP · SYSTEM SPECIFICATION";
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 7pt;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.06em;
    }
    @bottom-left {
      content: "Confidential · Client Presentation Edition · Tumakuru Campus";
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 7pt;
      color: #94a3b8;
    }
    @bottom-right {
      content: "Page " counter(page);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 7.5pt;
      font-weight: 700;
      color: #64748b;
    }
  }

  @page cover {
    margin: 0;
    @top-right { content: normal; }
    @bottom-left { content: normal; }
    @bottom-right { content: normal; }
  }

  *, *:before, *:after {
    box-sizing: border-box;
  }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background-color: #ffffff;
    line-height: 1.48;
    font-size: 9pt;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ----------------------------------------------------
     SHEET WRAPPER FOR EXACT 1-PAGE MAPPING
  ---------------------------------------------------- */
  .sheet {
    page-break-after: always;
    height: 271mm;
    max-height: 271mm;
    box-sizing: border-box;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 1mm;
  }

  /* ----------------------------------------------------
     COVER PAGE
  ---------------------------------------------------- */
  .cover-page {
    page: cover;
    page-break-after: always;
    height: 297mm;
    width: 210mm;
    background: linear-gradient(135deg, #0d2824 0%, #163e38 50%, #1e524b 100%);
    color: #ffffff;
    padding: 24mm 20mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
  }

  .cover-pattern {
    position: absolute;
    top: -90px;
    right: -90px;
    width: 380px;
    height: 380px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(226, 135, 67, 0.18) 0%, rgba(226, 135, 67, 0) 70%);
  }

  .cover-badge-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cover-badge {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #fbd38d;
    padding: 4px 12px;
    border-radius: 9999px;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cover-badge.live {
    background: rgba(52, 211, 153, 0.18);
    border-color: rgba(52, 211, 153, 0.35);
    color: #6ee7b7;
  }

  .cover-title-group {
    margin-top: 25mm;
  }

  .cover-title {
    font-size: 26pt;
    font-weight: 800;
    line-height: 1.15;
    color: #ffffff;
    margin: 0 0 14px 0;
    letter-spacing: -0.02em;
  }

  .cover-title span {
    color: #e28743;
  }

  .cover-subtitle {
    font-size: 11.5pt;
    font-weight: 400;
    line-height: 1.45;
    color: #cbd5e1;
    margin: 0 0 18px 0;
    max-width: 155mm;
  }

  .cover-divider {
    width: 50px;
    height: 3px;
    background: #e28743;
    border-radius: 2px;
    margin-bottom: 18px;
  }

  .cover-highlights-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 8mm;
  }

  .cover-highlight-box {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 12px;
  }

  .cover-highlight-box .num {
    font-size: 15pt;
    font-weight: 800;
    color: #fbd38d;
    line-height: 1;
    margin-bottom: 4px;
  }

  .cover-highlight-box .lbl {
    font-size: 7.2pt;
    font-weight: 600;
    color: #cbd5e1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 8pt;
    color: #94a3b8;
  }

  .cover-footer strong {
    color: #ffffff;
  }

  /* ----------------------------------------------------
     HEADINGS & TYPOGRAPHY
  ---------------------------------------------------- */
  h1 {
    font-size: 14pt;
    font-weight: 800;
    color: #1a3b36;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 4px;
    margin: 0 0 10px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    letter-spacing: -0.015em;
  }

  h1 .chapter-tag {
    background: #1a3b36;
    color: #ffffff;
    font-size: 7.5pt;
    font-weight: 800;
    padding: 2.5px 7px;
    border-radius: 4px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  h2 {
    font-size: 10.2pt;
    font-weight: 700;
    color: #1e3a34;
    margin: 10px 0 5px 0;
    border-left: 3px solid #e28743;
    padding-left: 6px;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 9pt;
    font-weight: 700;
    color: #334155;
    margin: 8px 0 4px 0;
  }

  p {
    margin: 0 0 8px 0;
    color: #334155;
    line-height: 1.45;
  }

  ul, ol {
    margin: 0 0 8px 0;
    padding-left: 18px;
    color: #334155;
  }

  li {
    margin-bottom: 2.5px;
    line-height: 1.42;
  }

  strong {
    color: #0f172a;
  }

  /* ----------------------------------------------------
     TABLES
  ---------------------------------------------------- */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 6px 0 10px 0;
    font-size: 8pt;
  }

  th, td {
    padding: 5px 8px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 700;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1.5px solid #cbd5e1;
  }

  tbody tr:nth-child(even) {
    background-color: #f8fafc;
  }

  td.bold {
    font-weight: 600;
    color: #0f172a;
  }

  td.code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.5pt;
    color: #0369a1;
  }

  /* ----------------------------------------------------
     BADGES
  ---------------------------------------------------- */
  .badge {
    display: inline-block;
    padding: 1.5px 6px;
    border-radius: 4px;
    font-size: 7pt;
    font-weight: 700;
    line-height: 1.2;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge.green { background: #dcfce7; color: #15803d; }
  .badge.blue { background: #dbeafe; color: #1d4ed8; }
  .badge.teal { background: #ccfbf1; color: #0f766e; }
  .badge.amber { background: #fef3c7; color: #b45309; }
  .badge.rose { background: #ffe4e6; color: #be123c; }
  .badge.purple { background: #f3e8ff; color: #7e22ce; }
  .badge.gray { background: #f1f5f9; color: #475569; }

  /* ----------------------------------------------------
     CALLOUTS
  ---------------------------------------------------- */
  .callout {
    border-radius: 6px;
    padding: 8px 10px;
    margin: 8px 0;
    font-size: 8.2pt;
    line-height: 1.42;
  }

  .callout.info {
    background: #f0fdf4;
    border-left: 3.5px solid #10b981;
    color: #14532d;
  }

  .callout.security {
    background: #eff6ff;
    border-left: 3.5px solid #3b82f6;
    color: #1e3a8a;
  }

  .callout.warning {
    background: #fffbeb;
    border-left: 3.5px solid #f59e0b;
    color: #78350f;
  }

  .callout.arch {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 3.5px solid #1a3b36;
    color: #1e293b;
  }

  .callout-title {
    font-weight: 700;
    font-size: 8.5pt;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ----------------------------------------------------
     CARDS GRID
  ---------------------------------------------------- */
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin: 6px 0 8px 0;
  }

  .feature-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .feature-card .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
  }

  .feature-card .title {
    font-weight: 700;
    font-size: 8.6pt;
    color: #1a3b36;
  }

  .feature-card .body {
    font-size: 7.8pt;
    color: #475569;
    line-height: 1.38;
  }

  /* ----------------------------------------------------
     DIAGRAMS
  ---------------------------------------------------- */
  .diagram-container {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 10px;
    margin: 6px 0 8px 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 7.2pt;
    line-height: 1.35;
    color: #0f172a;
    white-space: pre;
    overflow-x: hidden;
  }

  .metric-strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin: 8px 0;
  }

  .metric-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 6px;
    text-align: center;
  }

  .metric-card .val {
    font-size: 13pt;
    font-weight: 800;
    color: #1a3b36;
    line-height: 1.1;
  }

  .metric-card .lbl {
    font-size: 6.8pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-top: 2px;
  }

  .footer-signoff {
    padding-top: 6px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #64748b;
    margin-top: auto;
  }
</style>
</head>
<body>

<!-- ============================================================
     PAGE 1: COVER PAGE
============================================================ -->
<div class="cover-page">
  <div class="cover-pattern"></div>
  
  <div>
    <div class="cover-badge-row">
      <span class="cover-badge">Enterprise Edition</span>
      <span class="cover-badge live">● Production Ready (440 Tests Passed)</span>
    </div>
    
    <div class="cover-title-group">
      <h1 class="cover-title" style="border:none; padding:0; display:block;">GLOBAL KIDS SCHOOL<br><span>ERP & PORTAL ECOSYSTEM</span></h1>
      <p class="cover-subtitle">
        A Comprehensive Technical & Functional Specification of Every Capability, Workflow, Integration, Security Boundary, and Enterprise Feature.
      </p>
      <div class="cover-divider"></div>
      <p style="font-size: 9pt; color: #94a3b8; max-width: 145mm; line-height: 1.55;">
        Designed and engineered specifically for <strong>Global Kids School, Tumakuru, Karnataka</strong>. Built on a resilient hybrid cloud stack with Row-Level Security, Dual-Factor USN Authentication, UPI-First Fee Infrastructure, and Role-Scoped Artificial Intelligence.
      </p>
    </div>
  </div>

  <div>
    <div class="cover-highlights-grid">
      <div class="cover-highlight-box">
        <div class="num">13 Screens</div>
        <div class="lbl">Complete ERP Modules</div>
      </div>
      <div class="cover-highlight-box">
        <div class="num">8 Roles</div>
        <div class="lbl">Granular RBAC Security</div>
      </div>
      <div class="cover-highlight-box">
        <div class="num">14 Sections</div>
        <div class="lbl">Student 360° Profile</div>
      </div>
      <div class="cover-highlight-box">
        <div class="num">UPI Native</div>
        <div class="lbl">Razorpay Automated Checkout</div>
      </div>
      <div class="cover-highlight-box">
        <div class="num">Gemini AI</div>
        <div class="lbl">Role-Scoped Operational Assistant</div>
      </div>
      <div class="cover-highlight-box">
        <div class="num">440 / 440</div>
        <div class="lbl">Automated Vitest Test Coverage</div>
      </div>
    </div>

    <div class="cover-footer">
      <div>
        <strong>Client Presentation Document</strong> · October 2026<br>
        School Location: 2nd Cross, Tumakuru, Karnataka, India
      </div>
      <div style="text-align: right;">
        Platform Version: <strong>v1.0.0 (Production)</strong><br>
        Architecture: Supabase + Node.js + React 19 + Gemini
      </div>
    </div>
  </div>
</div>

<!-- ============================================================
     PAGE 2: TABLE OF CONTENTS & EXECUTIVE HIGHLIGHTS
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Index</span> Table of Contents & Executive Highlights</h1>
    
    <table style="margin-top: 4px; margin-bottom: 10px;">
      <thead>
        <tr>
          <th style="width: 15%;">Chapter</th>
          <th style="width: 73%;">Topic & Technical Scope</th>
          <th style="width: 12%; text-align: right;">Location</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Chapter 1</td>
          <td>Executive Summary & Enterprise Architecture Blueprint</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 3</td>
        </tr>
        <tr>
          <td class="bold">Chapter 2</td>
          <td>Security, Identity & Dual-Factor USN Authentication Framework</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 4</td>
        </tr>
        <tr>
          <td class="bold">Chapter 3</td>
          <td>Role-Based Access Control (RBAC) & System Governance Matrix</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 5</td>
        </tr>
        <tr>
          <td class="bold">Chapter 3 (II)</td>
          <td>Comprehensive Screen & Dataset Access Security Matrix</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 6</td>
        </tr>
        <tr>
          <td class="bold">Chapter 4</td>
          <td>Student 360° Management & High-Scale Student Directory</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 7</td>
        </tr>
        <tr>
          <td class="bold">Chapter 4 (II)</td>
          <td>The 14-Section Comprehensive Student Profile Deep Dive</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 8</td>
        </tr>
        <tr>
          <td class="bold">Chapter 5</td>
          <td>Faculty & Staff Management System & Colleague Drawer</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 9</td>
        </tr>
        <tr>
          <td class="bold">Chapter 6</td>
          <td>Daily Attendance Registers & High-Performance SQL Aggregations</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 10</td>
        </tr>
        <tr>
          <td class="bold">Chapter 7</td>
          <td>Fees, Invoicing & UPI-First Payment Gateway Integration</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 11</td>
        </tr>
        <tr>
          <td class="bold">Chapter 8</td>
          <td>Academics, Master Timetable Matrix & Examination Management</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 12</td>
        </tr>
        <tr>
          <td class="bold">Chapter 9</td>
          <td>Analytics, Academic Outcomes & At-Risk Early Warning Engine</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 13</td>
        </tr>
        <tr>
          <td class="bold">Chapter 10</td>
          <td>Institutional Digital Document Vault & Identity Compliance</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 14</td>
        </tr>
        <tr>
          <td class="bold">Chapter 11</td>
          <td>Artificial Intelligence Assistant (Gemini Multi-Model Engine)</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 15</td>
        </tr>
        <tr>
          <td class="bold">Chapter 12</td>
          <td>Public Web Portal, Admissions Hub & Mobile Dedicated Apps</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 16</td>
        </tr>
        <tr>
          <td class="bold">Chapter 13</td>
          <td>Complete System API Architecture & Edge Route Catalog</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 17</td>
        </tr>
        <tr>
          <td class="bold">Chapter 14</td>
          <td>Automated Testing, Quality Assurance (440 Tests) & Sign-Off</td>
          <td style="text-align: right; font-weight:700; color:#e28743;">Page 18</td>
        </tr>
      </tbody>
    </table>

    <h2>Platform Pillars & Operational Integrity</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Zero-Trust Role Gating</span><span class="badge purple">Security</span></div>
        <div class="body">Roles are resolved server-side from Supabase JWT tokens. Financial numbers, password ledgers, and identity files are physically withheld before reaching client memory.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">UPI Native Payments</span><span class="badge green">Finance</span></div>
        <div class="body">Automated Razorpay checkout supports instant UPI app intents on mobile and dynamic QR on desktop, backed by cryptographic webhook verification and offline bank UTR entries.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Sub-Second Big Data</span><span class="badge blue">Performance</span></div>
        <div class="body">Stored PL/pgSQL database functions aggregate 10,000+ attendance records and term exam marks in PostgreSQL directly, delivering dashboards in under 15 milliseconds.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">100% Test Coverage</span><span class="badge teal">Reliability</span></div>
        <div class="body">25 automated test suites containing 440 individual vitest assertions verify all access rules, security parity, API handlers, and AI prompt sanitization.</div>
      </div>
    </div>

    <div class="callout info" style="margin-top: 6px;">
      <div class="callout-title">Document Scope Notice</div>
      This specification reflects the exact, live capabilities present in the Global Kids School repository. Every feature, database trigger, route, and UI drawer described here is fully integrated and production-ready.
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Tumakuru Campus</span>
    <span>System Specification & Operational Catalog</span>
  </div>
</div>

<!-- ============================================================
     PAGE 3: CHAPTER 1 - ARCHITECTURE & STACK
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 1</span> System Architecture & Resilient Stack</h1>
    
    <p>
      The <strong>Global Kids School ERP</strong> employs a modern, hybrid cloud architecture engineered for sub-second page loads, airtight student data security, and fail-safe offline resilience.
    </p>

    <h2>System Architecture Blueprint</h2>
    <div class="diagram-container">
+─────────────────────────────────────────────────────────────────────────────────────────────+
│                                  CLIENT PRESENTATION LAYER                                  │
│  [ Public Website ]      [ Management Rail ]      [ Pupil Mobile ]      [ Staff Mobile ]    │
│  React 19 · TypeScript 5.9 · Vite · Tailwind v4 · Radix UI · Recharts · Framer Motion       │
+─────────────────────────────────────────────────────────────────────────────────────────────+
                                              │
                                              ▼
+─────────────────────────────────────────────────────────────────────────────────────────────+
│                                 API GATEWAY & EDGE BACKEND                                  │
│  [ Vercel Serverless & Edge API Routes ]              [ Express + tRPC Microservice Engine ]│
│  - Auth & OTP (login, otp, recover)                   - End-to-end typed procedure bridging │
│  - Entities (students, staff, documents)              - Session cookie validation           │
│  - Multiplexed Payments (upi, webhooks, utr)          - Storage proxy & health monitoring   │
+─────────────────────────────────────────────────────────────────────────────────────────────+
                         │                                              │
                         ▼                                              ▼
+──────────────────────────────────────────────────+ +────────────────────────────────────────+
│             DATABASE & STORAGE LAYER             │ │           INTELLIGENCE LAYER           │
│  [ Supabase Cloud PostgreSQL ]                   │ │  [ Google Gemini 1.5 / 2.0 API ]       │
│  - 15 Idempotent Database Migrations             │ │  - Native Structured Schema Output     │
│  - Strict Row-Level Security (RLS) Policies      │ │  - Function Calling (search_records)   │
│  - High-Speed PL/pgSQL Stored Procedures         │ │  - Role-Scoped Brief Sanitizer         │
│  - Private Storage: "student-documents"          │ │  - Sealed AES-GCM Encrypted Key Vault  │
│  - Drizzle ORM Schema (drizzle/schema.ts)        │ +────────────────────────────────────────+
+──────────────────────────────────────────────────+
    </div>

    <h2>Core Technology Stack</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 22%;">Layer</th>
          <th style="width: 38%;">Technology</th>
          <th style="width: 40%;">Architectural Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Frontend Core</td>
          <td class="code">React 19 · TypeScript · Vite 7</td>
          <td>Modern concurrent rendering, sub-50ms HMR builds, zero type regressions.</td>
        </tr>
        <tr>
          <td class="bold">Component System</td>
          <td class="code">Tailwind v4 · Radix UI · Lucide</td>
          <td>Accessible primitives (50+ components), anti-AI-slop custom design tokens.</td>
        </tr>
        <tr>
          <td class="bold">Data Layer</td>
          <td class="code">TanStack Query v5 · erp-views.ts</td>
          <td>Deduplicated network queries, reactive row-level caching, optimistic updates.</td>
        </tr>
        <tr>
          <td class="bold">Edge Backend</td>
          <td class="code">Node.js · Express 4.21 · tRPC 11</td>
          <td>Type-safe client-server contract, Vercel Serverless Edge runtime routing.</td>
        </tr>
        <tr>
          <td class="bold">Database & RLS</td>
          <td class="code">Supabase PostgreSQL 15 · Drizzle ORM</td>
          <td>Row-Level Security, custom stored procedures, relational schema migrations.</td>
        </tr>
        <tr>
          <td class="bold">Payment Engine</td>
          <td class="code">Razorpay API · Hosted Checkout</td>
          <td>UPI intent on mobile, dynamic QR on desktop, HMAC webhook validation.</td>
        </tr>
        <tr>
          <td class="bold">Artificial Intel</td>
          <td class="code">Google Gemini API · Function Tools</td>
          <td>Contextual record lookups, deep-linking action buttons, role brief scoping.</td>
        </tr>
      </tbody>
    </table>

    <div class="callout arch">
      <div class="callout-title">Dual-Mode Offline & Network Resiliency</div>
      The data layer in <code>client/src/lib/school-data.ts</code> and <code>client/src/lib/erp-views.ts</code> maintains comprehensive offline state schemas. If the cloud database experiences intermittent latency, the user interface seamlessly swaps to high-fidelity cached state without throwing unhandled exceptions or interrupting work.
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Architecture & Stack</span>
    <span>Chapter 1</span>
  </div>
</div>

<!-- ============================================================
     PAGE 4: CHAPTER 2 - SECURITY & 2FA AUTHENTICATION
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 2</span> Security, Identity & Authentication</h1>
    
    <p>
      The platform enforces a hardened <strong>Two-Factor Authentication (2FA)</strong> framework, custom Unique School Numbering (USN), salted cryptographic hashing, and complete protection against account enumeration attacks.
    </p>

    <h2>The USN Numbering Standard</h2>
    <ul>
      <li><strong>Student USN:</strong> Formatted as <code>GGS####</code> (e.g. <code>GGS1001</code>). Replaces confusing admission strings with a memorable ID printed on pupil identity cards.</li>
      <li><strong>Staff USN:</strong> Formatted as <code>STF####</code> (e.g. <code>STF1001</code>). Assigned sequentially to all teaching and non-teaching personnel upon record creation.</li>
    </ul>

    <h2>Two-Factor Authentication Lifecycle (Students & Staff)</h2>
    <div class="diagram-container">
Step 1: User enters USN (GGS1001) + DOB Password (DDMMYY)
   │
   ▼
POST /api/login ──► Server resolves USN to email & checks password with Supabase Auth
   │
   ├── [Admins & Super Admins] ──► Immediate Session Minted (Single-Step)
   │
   └── [Students & Staff] ─────► Password Verified! Session Withheld!
                                  │
                                  ▼
                     Server generates 6-digit OTP (rejection sampling)
                     Stores salted SHA-256 hash in login_otp_codes (RLS locked)
                     Mails OTP via Nodemailer to registered / guardian email
                                  │
                                  ▼
Step 2: User enters 6-digit OTP from email
   │
   ▼
POST /api/otp ────► Validates hash, checks 10-min TTL, enforces cooldown
                    Valid? ──► Session Minted! User enters Dashboard.
    </div>

    <h2>Security Protections & Administrative Vault</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Anti-Enumeration Defense</span><span class="badge green">Active</span></div>
        <div class="body">Sign-in and recovery endpoints return identical generic error messages (<em>"That username and password do not match an account"</em>) for invalid USNs, wrong passwords, or network anomalies. Attackers cannot probe for valid accounts.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Guardian Email Routing</span><span class="badge blue">Unique Feature</span></div>
        <div class="body">Young pupils without personal email receive placeholder accounts on the reserved <code>.invalid</code> domain. The login route detects this and automatically dispatches the 2FA code to the verified <code>guardian_email</code> on file.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Salted OTP Hash Storage</span><span class="badge purple">Cryptographic</span></div>
        <div class="body">The <code>login_otp_codes</code> table has Row-Level Security enabled with zero read policies. Codes are stored purely as salted SHA-256 hashes with 10-minute TTL and brute-force cooldown timers.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Super Admin Security Vault</span><span class="badge amber">Owner Only</span></div>
        <div class="body">Reachable exclusively by the immutable Super Admin UUID. The <code>/api/portal-admin</code> route provides a credential ledger with password viewing, single/bulk resets, and automated account backfilling with audit logs.</div>
      </div>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Security & Authentication</span>
    <span>Chapter 2</span>
  </div>
</div>

<!-- ============================================================
     PAGE 5: CHAPTER 3 - RBAC & GOVERNANCE MATRIX
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 3</span> Role-Based Access Control (RBAC)</h1>
    
    <p>
      The ERP implements an airtight, server-enforced Role-Based Access Control system. Defined centrally in <code>shared/ai-access.ts</code> and <code>shared/student-access.ts</code>, permissions are resolved from the user's cryptographically signed JWT session token.
    </p>

    <h2>The 8 System Roles</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 16%;">Role</th>
          <th style="width: 24%;">User Persona</th>
          <th style="width: 60%;">Operational Scope & Data Access Boundaries</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Super Admin</td>
          <td>School Owner / Trustee</td>
          <td>Total system governance. Access to all 13 screens including the Credentials Vault. Authority to configure AI API keys, backfill logins, and view audit trails.</td>
        </tr>
        <tr>
          <td class="bold">Admin</td>
          <td>Principal & Senior Admin</td>
          <td>Operational authority across students, staff, academics, attendance, finance, reports, and settings. Plaintext password vault is strictly excluded.</td>
        </tr>
        <tr>
          <td class="bold">Principal</td>
          <td>Academic Head</td>
          <td>Academic oversight: students, curriculum, timetable, examinations, staff directory, reports, and attendance. Financial ledgers and fees are strictly masked.</td>
        </tr>
        <tr>
          <td class="bold">Teacher</td>
          <td>Class & Subject Faculty</td>
          <td>Classroom registers, student marks, curriculum progress, weekly timetable, and personal password management. No access to financial or institutional accounts.</td>
        </tr>
        <tr>
          <td class="bold">Staff</td>
          <td>Front-Office / Operations</td>
          <td>Student directory search, today's attendance summary, campus overview, and settings. No access to fee ledgers or examination marksheets.</td>
        </tr>
        <tr>
          <td class="bold">Accountant</td>
          <td>Finance Office</td>
          <td>Fee structures, invoice ledger, Razorpay UPI reconciliation, offline bank UTR entries, student roll, and financial export reports.</td>
        </tr>
        <tr>
          <td class="bold">Student</td>
          <td>Enrolled Pupil</td>
          <td>Dedicated pupil portal: personal profile, daily timetable, exam results, attendance trends, document upload locker, and school circulars.</td>
        </tr>
        <tr>
          <td class="bold">Parent</td>
          <td>Mother / Father / Guardian</td>
          <td>Family portal: ward's attendance percentage, term fee invoices, 1-click Razorpay UPI online payment, receipts, and school announcements.</td>
        </tr>
      </tbody>
    </table>

    <h2>Server-Side Authority Architecture</h2>
    <div class="callout security">
      <div class="callout-title">Session-Driven Identity (Zero Client Spoofing)</div>
      The client application never sends <code>role</code> or <code>permissions</code> in request headers. Every API handler calls <code>resolveCaller(req)</code>, which resolves the caller's verified Supabase user ID and joins <code>public.profiles</code> using the backend service key. Even if an attacker manually modifies client memory to present as an admin, every server request is evaluated against their true database role.
    </div>

    <h2>Role Privilege Highlights</h2>
    <ul>
      <li><strong>Financial Data Isolation:</strong> Fees, balances, and revenue trends are visible exclusively to Super Admin, Admin, Accountant, and Parent (own child only). Teachers and Principals are physically prevented from seeing ledger figures.</li>
      <li><strong>Identity Document Protection:</strong> Student Aadhaar cards and birth certificates are gated strictly to Super Admin and Admin via <code>api/documents.ts</code>.</li>
      <li><strong>Owner Vault Isolation:</strong> Plaintext credentials and account backfilling can only be executed by the immutable Super Admin UUID defined in <code>shared/super-admin.ts</code>.</li>
    </ul>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · RBAC Framework</span>
    <span>Chapter 3 (Part 1)</span>
  </div>
</div>

<!-- ============================================================
     PAGE 6: CHAPTER 3 (PART 2) - PERMISSION MATRIX
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 3</span> Granular Screen & Dataset Matrix</h1>
    
    <p>
      The table below provides a complete audit of every dashboard screen, data collection, and functional capability mapped against all 8 institutional roles.
    </p>

    <h2>Comprehensive Screen Access Matrix</h2>
    <table>
      <thead>
        <tr>
          <th>Screen / Module</th>
          <th style="text-align: center;">Super Admin</th>
          <th style="text-align: center;">Admin</th>
          <th style="text-align: center;">Principal</th>
          <th style="text-align: center;">Teacher</th>
          <th style="text-align: center;">Staff</th>
          <th style="text-align: center;">Accountant</th>
          <th style="text-align: center;">Student</th>
          <th style="text-align: center;">Parent</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Overview (KPIs & Activity)</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td>
        </tr>
        <tr>
          <td class="bold">Students Directory</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Student 360° Profile</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">✓ (Self)</td><td style="text-align: center;">✓ (Ward)</td>
        </tr>
        <tr>
          <td class="bold">Documents Vault (Aadhaar / TC)</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Attendance Registers</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">✓</td>
        </tr>
        <tr>
          <td class="bold">Fees & Finance Ledger</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">✓</td>
        </tr>
        <tr>
          <td class="bold">Analytics & Health Radar</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Staff Directory & Drawer</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Academics & Timetable</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Examinations & Marksheets</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Reports & Reviews</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">User Management & Invites</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Credentials Vault (Passwords)</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td><td style="text-align: center;">—</td>
        </tr>
        <tr>
          <td class="bold">Settings & Password Update</td>
          <td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td><td style="text-align: center;">✓</td>
        </tr>
      </tbody>
    </table>

    <h2>Data Brief Scoping Rules (shared/ai-access.ts)</h2>
    <p>
      The AI assistant's system prompt is filtered by <code>scopeBrief()</code> before being dispatched to Gemini:
    </p>
    <ul>
      <li><code>fees</code>, <code>invoices</code>, <code>fee_categories</code>: Included strictly if role has Finance access.</li>
      <li><code>weakest_grade</code>, <code>subject_averages</code>, <code>health_metrics</code>: Included only if role has Analytics access.</li>
      <li><code>staff_total</code>, <code>staff_by_department</code>: Included only if role has Staff access.</li>
      <li><code>people</code>, <code>settings_snapshot</code>: Admin & Super Admin exclusive. Stripped for all others.</li>
    </ul>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Access Control Matrix</span>
    <span>Chapter 3 (Part 2)</span>
  </div>
</div>

<!-- ============================================================
     PAGE 7: CHAPTER 4 - STUDENT 360 & DIRECTORY
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 4</span> Student 360° & Student Directory</h1>
    
    <p>
      The Student module delivers high-scale management of enrolled pupils. Powered by server-side database querying, the <strong>Student Directory</strong> (<code>StudentDirectory.tsx</code>) handles tens of thousands of records with instantaneous pagination.
    </p>

    <h2>Student Directory Core Capabilities</h2>
    <ul>
      <li><strong>Server-Side Multi-Filter Search:</strong> Real-time filtering by Name, USN, or parent contact. Filters by Grade (5–12), Section (A–D), Status (Active, Review, Transferred, Graduated), and Transport route.</li>
      <li><strong>Multi-Column Sorting:</strong> Sort across Name, USN, Grade, Attendance %, Academic Average %, and Fee Status.</li>
      <li><strong>Inline Expandable Row Cards:</strong> Clicking any student in the directory expands a quick-view preview card showing attendance gauges, parent contacts, and fee balances without navigating away.</li>
      <li><strong>Student Onboarding Workflow:</strong> Modal dialog for registering new admissions, automatically assigning the next sequential <code>GGS####</code> USN, linking primary guardians, and assigning class sections.</li>
      <li><strong>Role-Aware CSV Export:</strong> Administrators can export the student roll to CSV. The export engine automatically filters out fee balances if the user's role lacks financial clearance.</li>
    </ul>

    <h2>Student Lifecycle States</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Active Enrolment</span><span class="badge green">Active</span></div>
        <div class="body">Fully enrolled pupil attending classes. Eligible for attendance registers, exam grading, report cards, and library borrowing.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Academic Review</span><span class="badge amber">Review</span></div>
        <div class="body">Flagged for administrative or pastoral review due to low attendance (&lt;90%) or academic struggles (&lt;50% marks).</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Transferred Out</span><span class="badge purple">Transferred</span></div>
        <div class="body">Pupil has departed for another school. Transfer Certificate (TC) counter-signed and archived; records retained for audits.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Graduated Alumni</span><span class="badge blue">Graduated</span></div>
        <div class="body">Senior secondary student who completed final board exams. Historical transcripts and certificates preserved indefinitely.</div>
      </div>
    </div>

    <div class="callout arch">
      <div class="callout-title">High-Scale Server Pager (ErpServerPager.tsx)</div>
      Unlike traditional web apps that download thousands of rows and paginate in JavaScript, the student directory delegates slicing to Postgres (<code>limit</code> and <code>offset</code>). The browser holds only 25 records at a time, ensuring fast rendering even on low-powered school computers.
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Student Directory</span>
    <span>Chapter 4 (Part 1)</span>
  </div>
</div>

<!-- ============================================================
     PAGE 8: CHAPTER 4 (PART 2) - 14-SECTION PROFILE
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 4</span> The 14-Section Student 360° Profile</h1>
    
    <p>
      Opening a student record displays their complete profile (<code>StudentProfile.tsx</code>) structured into 14 dedicated tabs:
    </p>

    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">1. Personal & Demographics</span><span class="badge teal">Core</span></div>
        <div class="body">Full legal name, USN, date of birth, blood group, nationality, mother tongue, residential address, avatar/photo, and enrolment status.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">2. Guardians & Contacts</span><span class="badge blue">Family</span></div>
        <div class="body">Father, mother, and legal guardian records with phone, email, primary contact flag, and emergency pickup authorization status.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">3. Academic Progression</span><span class="badge purple">Academics</span></div>
        <div class="body">Enrolled subjects, assigned subject educators, historical term averages, grade trajectory, and overall GPA calculations.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">4. Attendance Analytics</span><span class="badge green">Attendance</span></div>
        <div class="body">Session-by-session breakdown: present, absent, late, and approved leaves with monthly trend charts and warning indicators if &lt;90%.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">5. Fees & Invoices</span><span class="badge amber">Finance</span></div>
        <div class="body">Invoice ledger, fee breakdowns (tuition, transport, labs), due dates, outstanding dues, online UPI checkout, and UTR reconciliation.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">6. Digital Document Vault</span><span class="badge rose">Compliance</span></div>
        <div class="body">Institutional checklist: Aadhaar copy, birth certificate, transfer certificate, medical records, and signed URL downloads.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">7. Health & Medical Log</span><span class="badge rose">Confidential</span></div>
        <div class="body">Medical alerts, chronic conditions, dietary restrictions, emergency medications, regular pediatrician, and clinic incident history.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">8. Co-Curricular & Sports</span><span class="badge purple">Activities</span></div>
        <div class="body">School house allocation, participation in sports teams, academic clubs, leadership appointments, awards, and medals.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">9. Observations & Pastoral</span><span class="badge amber">Faculty</span></div>
        <div class="body">Classroom behavior notes, teacher observations, pastoral care logs, commendations, and internal staff remarks.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">10. Communications History</span><span class="badge blue">Audit</span></div>
        <div class="body">Chronological log of school-to-home interactions: telephone calls, SMS alerts, emails, and parent-teacher meeting notes.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">11. Admission & Audit Trail</span><span class="badge gray">Records</span></div>
        <div class="body">Application submission date, entrance assessment notes, previous school attended, transfer certificate number, and joining date.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">12. Library Loans & Fines</span><span class="badge teal">Library</span></div>
        <div class="body">Active book loans, issue dates, return deadlines, historical reading record, overdue status, and fine settlements.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">13. Portal Account Status</span><span class="badge green">Identity</span></div>
        <div class="body">Sign-in username, password provisioning status, last active session timestamp, and linked guardian portal accounts.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">14. Student Photo & CDN</span><span class="badge purple">Media</span></div>
        <div class="body">Integrated crop and photo picker uploading directly to private Supabase Storage buckets with responsive avatar caching.</div>
      </div>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Student 360° Profile</span>
    <span>Chapter 4 (Part 2)</span>
  </div>
</div>

<!-- ============================================================
     PAGE 9: CHAPTER 5 - FACULTY & STAFF MANAGEMENT
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 5</span> Faculty & Staff Management</h1>
    
    <p>
      The Faculty & Staff module provides operational governance for teachers, department heads, administrators, and support staff.
    </p>

    <h2>Departmental Structure</h2>
    <ul>
      <li><strong>Grade 5 & Primary Division:</strong> Foundational homeroom educators.</li>
      <li><strong>Middle School (Grades 6–8):</strong> Specialist teachers across Mathematics, General Science, Social Studies, and English.</li>
      <li><strong>Senior School (Grades 9–12):</strong> Advanced disciplines including Physics, Chemistry, Biology, Computer Science, and Commerce.</li>
      <li><strong>Co-Curricular & Athletics:</strong> Physical education coaches, visual arts faculty, music instructors, and activity coordinators.</li>
      <li><strong>Front Office & Operations:</strong> Receptionists, admissions counselors, campus transport coordinators, and estate staff.</li>
      <li><strong>IT & Technology:</strong> Systems administrators, lab coordinators, and digital infrastructure specialists.</li>
    </ul>

    <h2>Colleague Details Slide-over Drawer</h2>
    <p>
      Clicking any staff row opens an interactive slide-over drawer (<code>StaffDrawer.tsx</code>) connected to <code>PATCH /api/staff</code>:
    </p>
    <ul>
      <li><strong>Tenure & Career Tracking:</strong> Joining dates, years of active service, and designated employee status.</li>
      <li><strong>Classroom & Subject Mapping:</strong> Live mapping of which classrooms the educator manages as class teacher and subjects taught.</li>
      <li><strong>Account Provisioning State:</strong> Indicates whether the staff member has set a custom password or uses their initial USN credential.</li>
      <li><strong>Direct Contact Access:</strong> Quick-action buttons for email communication, phone calling, and copyable USN identifier.</li>
    </ul>

    <h2>Instant Account Provisioning Engine</h2>
    <div class="callout arch">
      <div class="callout-title">Atomic Multi-Step Staff Onboarding</div>
      Saving a new staff record (<code>StaffCreateDialog.tsx</code>) initiates an atomic multi-step backend transaction:
      <ol style="margin-top: 4px; margin-bottom: 0;">
        <li>Generates the next sequential Staff USN (e.g. <code>STF1014</code>).</li>
        <li>Creates the staff entity in <code>public.staff</code>.</li>
        <li>Mints an authenticated user in Supabase Auth linked to their institutional email.</li>
        <li>Assigns their precise role (Teacher, Staff, Admin, Accountant) in <code>public.profiles</code>.</li>
        <li>Sets their initial sign-in password to their date of birth in <code>DDMMYY</code> format.</li>
      </ol>
    </div>

    <h2>Staff Role & Access Allocation</h2>
    <table>
      <thead>
        <tr>
          <th>Job Title</th>
          <th>Assigned Department</th>
          <th>Granted Role</th>
          <th>System Capabilities</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Class Teacher</td>
          <td>Middle / Senior School</td>
          <td><span class="badge teal">Teacher</span></td>
          <td>Class register, subject marks, term grades, timetable, personal settings.</td>
        </tr>
        <tr>
          <td class="bold">Subject Teacher</td>
          <td>Middle / Senior School</td>
          <td><span class="badge teal">Teacher</span></td>
          <td>Subject marks, curriculum progress, timetable, student review notes.</td>
        </tr>
        <tr>
          <td class="bold">Department Coordinator</td>
          <td>All Academic Divisions</td>
          <td><span class="badge blue">Staff</span></td>
          <td>Student directory, campus overview, announcements, timetable reviews.</td>
        </tr>
        <tr>
          <td class="bold">Administrator</td>
          <td>Front Office</td>
          <td><span class="badge purple">Admin</span></td>
          <td>Full operational ERP, student/staff records, finance, documents, reports.</td>
        </tr>
        <tr>
          <td class="bold">Bursar / Cashier</td>
          <td>Accounts Desk</td>
          <td><span class="badge amber">Accountant</span></td>
          <td>Fee invoices, UPI payments, manual bank UTR entries, financial reports.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Staff Management</span>
    <span>Chapter 5</span>
  </div>
</div>

<!-- ============================================================
     PAGE 10: CHAPTER 6 - ATTENDANCE & SQL PROCEDURES
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 6</span> Attendance & Database Aggregations</h1>
    
    <p>
      The Attendance engine combines fast daily register marking, 5 attendance states, early warning threshold tracking, and high-performance SQL aggregation.
    </p>

    <h2>The 5 Register States</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Present</span><span class="badge green">Full Day</span></div>
        <div class="body">Pupil is present on campus for morning roll-call and all scheduled academic sessions.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Absent</span><span class="badge rose">Unexcused</span></div>
        <div class="body">Unexcused absence triggering automated parent notifications and attendance percentage deduction.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Late Arrival</span><span class="badge amber">Delayed</span></div>
        <div class="body">Recorded arrival after morning assembly checkpoint. Timestamped for administrative review.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Half-Day & Approved Leave</span><span class="badge blue">Excused</span></div>
        <div class="body">Sanctioned medical leave or approved family circumstance logged with documented decision notes.</div>
      </div>
    </div>

    <h2>High-Speed SQL Aggregation (dashboard_attendance)</h2>
    <div class="diagram-container">
-- Extract from supabase/migrations/011_dashboard_attendance.sql
create or replace function public.dashboard_attendance()
returns jsonb language sql stable security definer as $$
  with att as (
    select a.student_id, a.classroom_id, a.attendance_date, a.status
    from public.attendance a
    join public.profiles me on a.organisation_id = me.organisation_id
    where me.id = auth.uid()
  ),
  daily as (
    select attendance_date,
      count(*) filter (where status = 'present') as present,
      count(*) filter (where status = 'absent')  as absent,
      count(*) filter (where status = 'late')    as late,
      count(*) filter (where status = 'leave')   as leave
    from att group by attendance_date order by attendance_date desc limit 7
  )
  select jsonb_build_object('daily', jsonb_agg(daily), ...);
$$;
    </div>

    <h2>Class Attendance Rankings & Threshold Alerts</h2>
    <table>
      <thead>
        <tr>
          <th>Classroom Section</th>
          <th>Class Teacher</th>
          <th>Present / Total</th>
          <th>Term Rate</th>
          <th>Compliance Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Grade 10 — Section A</td>
          <td>Meera Shah</td>
          <td>30 / 31</td>
          <td style="font-weight:700; color:#16a34a;">98.0%</td>
          <td><span class="badge green">Exemplary</span></td>
        </tr>
        <tr>
          <td class="bold">Grade 5 — Section A</td>
          <td>Neha Kulkarni</td>
          <td>31 / 32</td>
          <td style="font-weight:700; color:#16a34a;">97.0%</td>
          <td><span class="badge green">Exemplary</span></td>
        </tr>
        <tr>
          <td class="bold">Grade 12 — Section A</td>
          <td>Daniel Thomas</td>
          <td>29 / 30</td>
          <td style="font-weight:700; color:#16a34a;">96.0%</td>
          <td><span class="badge green">Compliant</span></td>
        </tr>
        <tr>
          <td class="bold">Grade 7 — Section B</td>
          <td>Sonia Joseph</td>
          <td>30 / 32</td>
          <td style="font-weight:700; color:#16a34a;">95.0%</td>
          <td><span class="badge green">Compliant</span></td>
        </tr>
        <tr>
          <td class="bold">Grade 8 — Section B</td>
          <td>Arvind Iyer</td>
          <td>29 / 31</td>
          <td style="font-weight:700; color:#16a34a;">94.0%</td>
          <td><span class="badge green">Compliant</span></td>
        </tr>
        <tr>
          <td class="bold">Grade 6 — Section C</td>
          <td>Ravi Menon</td>
          <td>28 / 32</td>
          <td style="font-weight:700; color:#dc2626;">89.0%</td>
          <td><span class="badge rose">Below 90% Alert</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Attendance System</span>
    <span>Chapter 6</span>
  </div>
</div>

<!-- ============================================================
     PAGE 11: CHAPTER 7 - FEES, INVOICING & UPI
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 7</span> Fees, Invoicing & UPI Payments</h1>
    
    <p>
      The Finance suite modernizes school billing through an automated, <strong>UPI-first payment architecture</strong> integrated directly with Razorpay, paired with front-office manual bank transfer reconciliation.
    </p>

    <h2>Fee Structures & Categorization</h2>
    <ul>
      <li><strong>Tuition Fee:</strong> Core academic instruction, digital classrooms, and syllabus delivery.</li>
      <li><strong>Transport & Fleet Fee:</strong> GPS-monitored school bus route billing mapped to pickup stops.</li>
      <li><strong>Laboratories:</strong> Hands-on science experimentation, computer lab, and robotics infrastructure levies.</li>
      <li><strong>Library & Resources:</strong> Physical book access, digital databases, and periodicals subscription.</li>
      <li><strong>Co-Curricular & Sports:</strong> Professional athletics coaching, swimming, music, and annual events.</li>
    </ul>

    <h2>Razorpay UPI Native Payment Architecture</h2>
    <div class="diagram-container">
[ Parent Portal ] ──► Clicks "Pay Fees with UPI"
        │
        ▼
POST /api/student-profile?__fee=order ──► Server creates Razorpay Order with strict currency & ID
        │
        ▼
[ Razorpay Hosted Checkout Opens ]
  ├── Mobile Device: Opens Google Pay, PhonePe, Paytm, BHIM via native UPI Intent
  └── Desktop Device: Generates Dynamic UPI QR Code for instant scanning
        │
        ▼
[ Payment Completed by Parent ]
        │
        ├────────────────────────────────────────┬────────────────────────────────────────┐
        ▼                                        ▼                                        ▼
[ Client Confirmation ]                  [ Razorpay Webhook ]                     [ Idempotent Engine ]
POST /api/student-profile?__fee=confirm  POST /api/student-profile?__fee=webhook  Verifies signature HMAC
Verifies order signature from checkout   Handles order.paid fallback event        Marks invoice "PAID"
Generates official receipt #             Guarantees settlement if browser closed  Records settlement date
    </div>

    <h2>Offline Bank Transfer Reconciliation (RecordUpiPaymentDialog.tsx)</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">UTR Number Validation</span><span class="badge amber">Office Flow</span></div>
        <div class="body">For families paying via direct NEFT/RTGS/IMPS, the bursar records the 12-digit bank UTR reference. The system checks against duplicate entries before marking invoices settled.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Official Receipt Generator</span><span class="badge teal">Paperwork</span></div>
        <div class="body">Settling an invoice generates an official alphanumeric receipt (e.g. <code>REC-2026-0842</code>) specifying payment mode, student USN, and breakdown, ready for instant printing or PDF download.</div>
      </div>
    </div>

    <h2>Monthly Revenue Collection Trend (in Lakhs INR)</h2>
    <table>
      <thead>
        <tr>
          <th>Month</th>
          <th>Collected (₹)</th>
          <th>Pending Dues (₹)</th>
          <th>Collection %</th>
          <th>Operational Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td class="bold">April (Term 1 Start)</td><td>₹24.0 Lakhs</td><td>₹8.0 Lakhs</td><td>75.0%</td><td><span class="badge green">On Track</span></td></tr>
        <tr><td class="bold">June</td><td>₹31.0 Lakhs</td><td>₹6.0 Lakhs</td><td>83.7%</td><td><span class="badge green">On Track</span></td></tr>
        <tr><td class="bold">August</td><td>₹37.0 Lakhs</td><td>₹4.0 Lakhs</td><td>90.2%</td><td><span class="badge green">Exceeding Target</span></td></tr>
        <tr><td class="bold">September (Term 1 Close)</td><td>₹41.0 Lakhs</td><td>₹3.0 Lakhs</td><td>93.1%</td><td><span class="badge green">Strong Closure</span></td></tr>
      </tbody>
    </table>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Fees & UPI Gateway</span>
    <span>Chapter 7</span>
  </div>
</div>

<!-- ============================================================
     PAGE 12: CHAPTER 8 - ACADEMICS & TIMETABLE
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 8</span> Academics, Timetable & Exams</h1>
    
    <p>
      The Academics engine powers curriculum tracking, weekly timetable scheduling, library book circulation, and term examination marksheets.
    </p>

    <h2>Master Weekly Timetable Matrix</h2>
    <p>
      The scheduling engine organizes the campus week across 6 daily periods from Monday through Saturday (08:00 to 12:30):
    </p>
    <table>
      <thead>
        <tr>
          <th>Period & Time</th>
          <th>Grade 6</th>
          <th>Grade 7</th>
          <th>Grade 8</th>
          <th>Grade 9</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Period 1 (08:00 – 08:45)</td>
          <td>Mathematics (Meera Shah)</td>
          <td>English (Sonia Joseph)</td>
          <td>Physics (Ravi Menon)</td>
          <td>Chemistry (Priya Nair)</td>
        </tr>
        <tr>
          <td class="bold">Period 2 (08:45 – 09:30)</td>
          <td>Science (Ravi Menon)</td>
          <td>Mathematics (Meera Shah)</td>
          <td>English (Sonia Joseph)</td>
          <td>History (Arvind Iyer)</td>
        </tr>
        <tr>
          <td class="bold">Period 3 (09:30 – 10:15)</td>
          <td>Hindi (Priya Nair)</td>
          <td>Physics (Ravi Menon)</td>
          <td>Mathematics (Meera Shah)</td>
          <td>English (Sonia Joseph)</td>
        </tr>
        <tr>
          <td class="bold">Period 4 (10:15 – 11:00)</td>
          <td>Computer Science (Karthik Rao)</td>
          <td>Chemistry (Priya Nair)</td>
          <td>Biology (Ravi Menon)</td>
          <td>Mathematics (Meera Shah)</td>
        </tr>
        <tr>
          <td class="bold">Interval (11:00 – 11:15)</td>
          <td colspan="4" style="text-align: center; font-style: italic; background: #f8fafc;">Campus Morning Break</td>
        </tr>
        <tr>
          <td class="bold">Period 5 (11:15 – 11:45)</td>
          <td>Arts & Crafts</td>
          <td>Sports & Athletics</td>
          <td>Music & Performing Arts</td>
          <td>Library Reading</td>
        </tr>
        <tr>
          <td class="bold">Period 6 (11:45 – 12:30)</td>
          <td>Social Studies (Arvind Iyer)</td>
          <td>Biology (Ravi Menon)</td>
          <td>Chemistry (Priya Nair)</td>
          <td>Physics (Ravi Menon)</td>
        </tr>
      </tbody>
    </table>

    <h2>Syllabus Completion & Examination Management</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Syllabus Completion</span><span class="badge teal">Curriculum</span></div>
        <div class="body">Live tracking of curriculum completion across disciplines: Computer Science (82%), Science (71%), Languages (67%), Mathematics (64%), English (58%), and Social Studies (49%).</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Examination Publishing</span><span class="badge purple">Assessments</span></div>
        <div class="body">Manage mid-term assessments, monitor per-paper marking completion, calculate term GPA percentages, and toggle published status before releasing report cards to parents.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Library Inventory Management</span><span class="badge blue">Library</span></div>
        <div class="body">Catalog of book volumes, tracking available vs borrowed copies, automatic alerts for late returns, and overdue fine calculation.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Official Report Exports</span><span class="badge amber">Reporting</span></div>
        <div class="body">Generates downloadable PDF transcripts, principal review packages, and grade-by-grade academic outcome summaries.</div>
      </div>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Academics & Timetable</span>
    <span>Chapter 8</span>
  </div>
</div>

<!-- ============================================================
     PAGE 13: CHAPTER 9 - ANALYTICS & EARLY WARNING
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 9</span> Analytics & Early Warning Engine</h1>
    
    <p>
      The Analytics engine turns raw student marks and attendance records into actionable institutional intelligence, featuring longitudinal subject tracking and an automated <strong>At-Risk Early Warning Engine</strong>.
    </p>

    <h2>Campus Health Dashboard (dashboard_health)</h2>
    <div class="metric-strip">
      <div class="metric-card">
        <div class="val">94.8%</div>
        <div class="lbl">Campus Attendance</div>
      </div>
      <div class="metric-card">
        <div class="val">86.4%</div>
        <div class="lbl">Academic Average</div>
      </div>
      <div class="metric-card">
        <div class="val">82.1%</div>
        <div class="lbl">Fee Collection</div>
      </div>
      <div class="metric-card">
        <div class="val">78.6%</div>
        <div class="lbl">Parent Engagement</div>
      </div>
    </div>

    <h2>At-Risk Student Identification Algorithm</h2>
    <p>
      The system continually monitors the student body against two primary risk indicators:
    </p>
    <ul>
      <li><strong>Academic Distress Threshold:</strong> Any student with an overall academic average falling below 50% across graded assessments.</li>
      <li><strong>Attendance Non-Compliance:</strong> Any student whose attendance falls below the statutory 90% threshold.</li>
    </ul>

    <div class="callout warning">
      <div class="callout-title">Remedial Action Workflows</div>
      Identified students are flagged with Amber/Red badges in the directory, and the AI Assistant generates specific remediation suggestions (such as targeted faculty tutoring or scheduling parent-teacher conferences).
    </div>

    <h2>Longitudinal Subject Performance Trends</h2>
    <table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>April</th>
          <th>June</th>
          <th>August</th>
          <th>September</th>
          <th>Overall Trend</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="bold">Mathematics</td>
          <td>78%</td>
          <td>79%</td>
          <td>85%</td>
          <td>86%</td>
          <td style="color:#16a34a; font-weight:700;">+8.0% ▲</td>
          <td><span class="badge green">Strong Growth</span></td>
        </tr>
        <tr>
          <td class="bold">Science</td>
          <td>81%</td>
          <td>84%</td>
          <td>86%</td>
          <td>88%</td>
          <td style="color:#16a34a; font-weight:700;">+7.0% ▲</td>
          <td><span class="badge green">Exceeding Benchmark</span></td>
        </tr>
        <tr>
          <td class="bold">English Literature</td>
          <td>74%</td>
          <td>78%</td>
          <td>81%</td>
          <td>83%</td>
          <td style="color:#16a34a; font-weight:700;">+9.0% ▲</td>
          <td><span class="badge teal">Consistent Improvement</span></td>
        </tr>
        <tr>
          <td class="bold">Social Studies</td>
          <td>75%</td>
          <td>76%</td>
          <td>78%</td>
          <td>79%</td>
          <td style="color:#d97706; font-weight:700;">+4.0% ▲</td>
          <td><span class="badge amber">Target for Focus</span></td>
        </tr>
        <tr>
          <td class="bold">Languages</td>
          <td>80%</td>
          <td>82%</td>
          <td>84%</td>
          <td>85%</td>
          <td style="color:#16a34a; font-weight:700;">+5.0% ▲</td>
          <td><span class="badge green">Steady Advancement</span></td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Analytics & Early Warning</span>
    <span>Chapter 9</span>
  </div>
</div>

<!-- ============================================================
     PAGE 14: CHAPTER 10 - DOCUMENT VAULT & COMPLIANCE
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 10</span> Digital Document Vault & Compliance</h1>
    
    <p>
      Student document management requires strict confidentiality, particularly for national identity cards like Indian Aadhaar documents. The ERP features an <strong>Institutional Document Vault</strong> (<code>DocumentsView.tsx</code> & <code>StudentDocumentPanel.tsx</code>).
    </p>

    <h2>Mandatory Institutional Checklist</h2>
    <ul>
      <li><strong>Birth Certificate:</strong> Official municipal birth record validating legal student age.</li>
      <li><strong>Transfer Certificate (TC):</strong> Previous school departure certificate with counter-signature.</li>
      <li><strong>Previous School Academic Records:</strong> Historical transcripts, progress cards, and conduct certs.</li>
      <li><strong>Aadhaar Card / National ID:</strong> Sensitive government identity document (strictly restricted).</li>
      <li><strong>Medical & Immunisation Records:</strong> Clinical vaccination records and physician allergy certificates.</li>
      <li><strong>Parent / Guardian Consent:</strong> Enrolment agreements, emergency medical waivers, and transport permissions.</li>
    </ul>

    <h2>Cryptographic Privacy & Ephemeral Signed URLs</h2>
    <div class="callout security">
      <div class="callout-title">Zero Public URLs & Double-Underscore Path Keys</div>
      Student records are never stored in public web storage. The vault implements three layers of security:
      <ol style="margin-top: 4px; margin-bottom: 0;">
        <li><strong>Private Storage Isolation:</strong> Files reside in a private Supabase Storage bucket (<code>student-documents</code>) formatted as:<br>
        <code>&lt;studentId&gt;/&lt;docType&gt;__&lt;timestamp&gt;__&lt;safeFileName&gt;</code></li>
        <li><strong>Expiring Signed URLs:</strong> When an authorized administrator clicks to view or download a document, the server generates an ephemeral signed token valid for 120 seconds. The file cannot be accessed once expired.</li>
        <li><strong>Role Gating:</strong> Only <code>super_admin</code> and <code>admin</code> roles can download Aadhaar files. Principals and teachers are blocked at the route level (<code>api/documents.ts</code>).</li>
      </ol>
    </div>

    <h2>Verification Lifecycle & Compliance Tracking</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Missing Paperwork Audit</span><span class="badge rose">Incomplete</span></div>
        <div class="body">The Document Overview answers the administrator's most critical question: <em>whose paperwork is missing?</em> Displays real-time counts of pending items per class.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Verified State Certification</span><span class="badge green">Certified</span></div>
        <div class="body">Upon physical inspection of original documents, front-office staff mark items "Verified", logging the verifying officer and timestamp into the audit trail.</div>
      </div>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Document Vault</span>
    <span>Chapter 10</span>
  </div>
</div>

<!-- ============================================================
     PAGE 15: CHAPTER 11 - AI ASSISTANT (GEMINI)
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 11</span> Artificial Intelligence Assistant</h1>
    
    <p>
      The platform embeds a custom, server-side <strong>AI Operational Assistant</strong> powered by Google Gemini. Deeply grounded in the school's live database, it enforces airtight role boundaries.
    </p>

    <h2>Server-Side Brief Scoping (Zero Prompt Leaks)</h2>
    <p>
      Defined in <code>shared/ai-access.ts</code>, the caller's role is extracted from their verified JWT session. The server strips down the prompt brief <em>before</em> sending it to Gemini:
    </p>
    <ul>
      <li><strong>Teacher Query:</strong> Ledger figures, outstanding debts, and fee totals are physically removed from the prompt. The model cannot disclose financial figures because it never receives them.</li>
      <li><strong>Principal Query:</strong> Financial figures are withheld, but complete academic, student, and timetable contexts are provided.</li>
      <li><strong>Super Admin Query:</strong> Receives complete school briefs including financial ledgers and account states.</li>
    </ul>

    <h2>Function Calling & Interactive Action Buttons</h2>
    <div class="diagram-container">
USER ASKS: "Which students in Grade 8 have overdue fee balances?"
   │
   ▼
POST /api/ai ──► Role resolved as "super_admin" ──► Data brief scoped to Finance & Students
                 Gemini analyzes records and formats structured output
   │
   ▼
ASSISTANT RESPONDS:
"There are two pupils in Grade 8 with outstanding balances totaling ₹42,500. Vihaan Kapoor owes ₹28,000 for Term 1 tuition."
   │
   ▼
INTERACTIVE ACTIONS GENERATED:
[ Button 1: Open Vihaan Kapoor's Profile (Navigates directly to /students/VK-8B) ]
[ Button 2: Open Fees & Finance Ledger (Navigates to Finance Screen) ]
    </div>

    <h2>Sealed Key Vault & Command Palette</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">AES-GCM Key Vault</span><span class="badge purple">Encrypted</span></div>
        <div class="body">The Super Admin sets the Gemini API key once in Settings. It is encrypted using AES-GCM authenticated cipher before writing to <code>public.settings</code>. Keys are never exposed to the browser.</div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Command Palette (Cmd+K)</span><span class="badge blue">Shortcuts</span></div>
        <div class="body">Global palette supports instant screen navigation, student lookup, and pre-seeded contextual prompts filtered by the user's role to prevent refused queries.</div>
      </div>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · AI Assistant</span>
    <span>Chapter 11</span>
  </div>
</div>

<!-- ============================================================
     PAGE 16: CHAPTER 12 - PUBLIC WEB & MOBILE APPS
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 12</span> Public Web Portal & Mobile Apps</h1>
    
    <p>
      The platform provides responsive digital experiences across all devices: a public website, phone-first pupil apps, and educator mobile shells.
    </p>

    <h2>Public School Portal & Admissions Hub</h2>
    <ul>
      <li><strong>Home Page (<code>Home.tsx</code>):</strong> Hero banner, institutional philosophy ("Learning with curiosity, Growth with confidence, Leading with purpose"), admissions CTA, and campus highlights.</li>
      <li><strong>About Us (<code>About.tsx</code>):</strong> School mission, vision, leadership ethos, and 6 core values: Kindness, Integrity, Courage, Respect, Responsibility, and Joy in Learning.</li>
      <li><strong>Contact & Admissions (<code>Contact.tsx</code>):</strong> Campus location (Tumakuru, Karnataka), visiting hours, admissions inquiry form with feedback handling, and map directions.</li>
      <li><strong>Webflow Site Synchronization:</strong> Dedicated build integration (<code>scripts/serve-webflow-export.mjs</code>) supporting static export and Webflow visual design assets.</li>
    </ul>

    <h2>Dedicated Mobile Touchpoints</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <div class="card-head"><span class="title">Pupil Mobile Dashboard</span><span class="badge blue">Student Phone UI</span></div>
        <div class="body">
          (<code>PupilMobileDashboard.tsx</code>) Optimized for smartphones with a bottom navigation tab bar, circular attendance percentage gauge, daily class schedule cards, report card marks, and fee payment buttons.
        </div>
      </div>
      <div class="feature-card">
        <div class="card-head"><span class="title">Staff Mobile Shell</span><span class="badge teal">Educator Phone UI</span></div>
        <div class="body">
          (<code>StaffMobileShell.tsx</code>) Streamlined for teachers on campus to take morning registers, mark attendance states, and inspect student medical emergency contacts without carrying a laptop.
        </div>
      </div>
    </div>

    <h2>Responsive Design Principles</h2>
    <div class="callout arch">
      <div class="callout-title">Anti-AI-Slop Editorial Design Directives</div>
      Following <code>DESIGN.md</code>, the interface rejects generic corporate grids in favor of purposeful editorial layouts:
      <ul style="margin-top: 4px; margin-bottom: 0;">
        <li><strong>Typography:</strong> 'Manrope' for rounded headers; 'DM Sans' for warm, high-legibility body text.</li>
        <li><strong>Color Palette:</strong> Deep Ink Teal (<code>#1A3B36</code>), Forest Teal (<code>#2F6F68</code>), Warm Coral / Saffron (<code>#E28743</code>), and Soft Sky Blue (<code>#EBF2FA</code>).</li>
        <li><strong>Micro-Interactions:</strong> Smooth pill navigation tabs, sticky announcement banners, and fluid Framer Motion state transitions.</li>
      </ul>
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Public Portal & Mobile</span>
    <span>Chapter 12</span>
  </div>
</div>

<!-- ============================================================
     PAGE 17: CHAPTER 13 - API ARCHITECTURE CATALOG
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 13</span> Complete System API Reference</h1>
    
    <p>
      The table below documents every Edge and Serverless API endpoint powering the ERP, including HTTP methods, runtimes, security clearance, and data operations.
    </p>

    <h2>Serverless & Edge API Endpoints</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Endpoint</th>
          <th style="width: 13%;">Method</th>
          <th style="width: 14%;">Runtime</th>
          <th style="width: 48%;">Functional Role & Security Boundaries</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="code">/api/login</td>
          <td>POST</td>
          <td>Node.js</td>
          <td>Resolves USN to email, verifies DOB password, dispatches 2FA OTP challenge.</td>
        </tr>
        <tr>
          <td class="code">/api/otp</td>
          <td>POST</td>
          <td>Node.js</td>
          <td>Verifies 6-digit OTP hash, handles guardian email fallback, mints session.</td>
        </tr>
        <tr>
          <td class="code">/api/recover</td>
          <td>POST</td>
          <td>Node.js</td>
          <td>Dispatches password recovery link; prevents account enumeration attacks.</td>
        </tr>
        <tr>
          <td class="code">/api/students</td>
          <td>GET / POST</td>
          <td>Edge</td>
          <td>Paginated directory search, multi-filter queries, new student creation.</td>
        </tr>
        <tr>
          <td class="code">/api/student-profile</td>
          <td>GET / PATCH</td>
          <td>Node.js</td>
          <td>14-section student profile aggregator; multiplexes UPI checkout & webhooks.</td>
        </tr>
        <tr>
          <td class="code">/api/staff</td>
          <td>GET / POST</td>
          <td>Node.js</td>
          <td>Staff directory; automatically provisions auth accounts and USN upon creation.</td>
        </tr>
        <tr>
          <td class="code">/api/staff-profile</td>
          <td>GET / PATCH</td>
          <td>Node.js</td>
          <td>Detailed staff drawer records and profile editing with full audit trail.</td>
        </tr>
        <tr>
          <td class="code">/api/documents</td>
          <td>GET/POST/DEL</td>
          <td>Edge</td>
          <td>Document checklist management and short-lived signed download URLs.</td>
        </tr>
        <tr>
          <td class="code">/api/portal-admin</td>
          <td>GET/POST/PATCH</td>
          <td>Node.js</td>
          <td>Super Admin vault: password viewing, bulk reset, and account backfill.</td>
        </tr>
        <tr>
          <td class="code">/api/ai</td>
          <td>POST</td>
          <td>Edge</td>
          <td>Role-scoped Gemini assistant with function calling & action buttons.</td>
        </tr>
        <tr>
          <td class="code">/api/ai-settings</td>
          <td>GET/POST/DEL</td>
          <td>Edge</td>
          <td>AES-GCM sealed key storage and server-side Gemini connection testing.</td>
        </tr>
        <tr>
          <td class="code">/api/invite</td>
          <td>POST</td>
          <td>Node.js</td>
          <td>Staff invitation token generation and email dispatch for onboarding.</td>
        </tr>
      </tbody>
    </table>

    <h2>Architectural Serverless Multiplexing</h2>
    <div class="callout arch">
      <div class="callout-title">Function Multiplexing within Platform Caps</div>
      Vercel serverless plans cap deployments at 12 serverless functions. Rather than breaching this ceiling, the platform uses <code>api/student-profile.ts</code> as a high-efficiency multiplexer: payment order creation, webhook ingestion, and offline UTR recording are handled via query parameters (<code>?__fee=order</code>, <code>?__fee=confirm</code>, <code>?__fee=webhook</code>, <code>?__fee=record</code>). Each handler still independently resolves caller authentication.
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · API Reference</span>
    <span>Chapter 13</span>
  </div>
</div>

<!-- ============================================================
     PAGE 18: CHAPTER 14 - QUALITY ASSURANCE & SIGN-OFF
============================================================ -->
<div class="sheet">
  <div>
    <h1><span class="chapter-tag">Chapter 14</span> Quality Assurance & Sign-Off</h1>
    
    <p>
      The entire platform is backed by an automated <strong>Vitest</strong> test suite comprising <strong>25 test suites and 440 passing assertions</strong>. Every security boundary, role scoping rule, OTP generation constraint, and database aggregation has been verified:
    </p>

    <h2>Verified Test Suites (440 Passed, 0 Failed)</h2>
    <div class="diagram-container">
Test Files : 25 passed (25)
Tests      : 440 passed (440)
Duration   : 3.67 seconds
Status     : ALL SUITES PASSING (0 FAILING)

✓ api/ai.test.ts (55)                    ✓ api/students.test.ts (32)
✓ api/login.test.ts (25)                 ✓ api/otp.test.ts (25)
✓ api/staff.test.ts (23)                 ✓ shared/portal-server.test.ts (21)
✓ shared/shared-signin.test.ts (22)       ✓ client/src/lib/student-access.test.ts (35)
✓ client/src/lib/ai-context.test.ts (20)  ✓ client/src/lib/supabase.test.ts (20)
✓ client/src/lib/super-admin.test.ts (18) ✓ client/src/lib/ai-assistant.test.ts (18)
✓ api/documents.test.ts (17)             ✓ shared/reset-email.test.ts (17)
✓ api/portal-admin.test.ts (15)          ✓ api/invite.test.ts (14)
✓ api/ai-settings.test.ts (11)           ✓ shared/fee-payment-routes.test.ts (11)
✓ api/recover.test.ts (11)               ✓ api/staff-profile.test.ts (10)
✓ client/src/lib/toast.test.ts (9)       ✓ client/src/lib/student-access-parity.test.ts (5)
✓ client/src/lib/fleet.test.ts (4)       ✓ server/auth.logout.test.ts (1)
✓ server/erp.smoke.test.ts (1)
    </div>

    <h2>Production Readiness Certification</h2>
    <p>
      The platform satisfies all institutional operational, security, and financial criteria:
    </p>
    <ul>
      <li><strong>Data Privacy:</strong> Aadhaar and personal identity records are cryptographically gated.</li>
      <li><strong>Financial Integrity:</strong> Double-billing prevented via idempotent payment references.</li>
      <li><strong>Operational Continuity:</strong> Dual-mode offline state caching prevents school disruption.</li>
      <li><strong>Identity Governance:</strong> 2FA email codes and DOB initial passwords secure student logins.</li>
    </ul>

    <div class="callout info" style="margin-top: 8px;">
      <div class="callout-title">Final Client Presentation Sign-Off</div>
      This specification document certifies that the <strong>Global Kids School ERP</strong> codebase is complete, fully functional, and ready for deployment at the Tumakuru campus.
    </div>
  </div>

  <div class="footer-signoff">
    <span>Global Kids School ERP · Tumakuru, Karnataka</span>
    <span>End of Specification · Version 1.0.0</span>
  </div>
</div>

</body>
</html>
"""

def generate_pdf():
    html_path = "/home/kaizxark/Desktop/erp/Global_Kids_School_ERP_Feature_Catalog.html"
    pdf_path = "/home/kaizxark/Desktop/erp/Global_Kids_School_ERP_Feature_Catalog.pdf"

    print(f"Writing updated HTML specification to {html_path}...")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_TEMPLATE)

    print("Compiling PDF with Chromium Headless...")
    cmd = [
        "chromium",
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--print-to-pdf-no-header",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("Error compiling PDF:", res.stderr)
        sys.exit(res.returncode)

    print(f"PDF generated successfully at: {pdf_path}")
    
    info = subprocess.run(["pdfinfo", pdf_path], capture_output=True, text=True)
    print("PDF Information:\n", info.stdout)

if __name__ == "__main__":
    generate_pdf()
