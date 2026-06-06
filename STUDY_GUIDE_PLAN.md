# Plan — Pink Ducks "Project Mastery & Study Guide" (CycleGuide-styled, fully self-contained)

## Context
Bulbuli Bala is defending an EAE Master thesis, *Partner-Led Growth Strategy for Pink Ducks*
(submission **Jun 12 2026**, defense **Jul 6 2026**). She wants a single, self-contained study
companion that (1) explains every concept from first principles with ELI5 analogies, (2) is detailed
enough that she never needs to open another document to understand any idea, (3) includes an **Annex**
of all key data, and (4) uses a **Table of Contents + heading styles that mirror her
`BarcelonaCycleGuide_Documentation.docx`**.

**Authoritative source = `FMT…Final_Submission.docx`** (just uploaded). Every number must trace to it.
I have read it in full (663-line extract), plus the CycleGuide doc (template/style) and the
presentation-flow doc (10-minute defense map). Earlier draft numbers I *estimated* are now corrected
against the real thesis.

## Style/template to copy from CycleGuide doc
- **Heading1** = `PART ONE / PART TWO …` dividers (each followed by a bold sub-banner line, e.g. `— THE STORY —`).
- **Heading2** = `Chapter N · Title`.
- **Heading3** = `N.N · Subsection`.
- Front matter: **Title block → "How to Read This Document" → "The Central Metaphor" → TOC**.
- **Four** signature callout boxes (user-confirmed), rendered as shaded single-cell tables in Word:
  - 🧒 **5-Year-Old Explanation** — yellow `#FFF2CC` (analogy for every concept)
  - 🎤 **Defense Soundbite** — blue `#DEEAF6` (exact exam-ready sentence to say to the committee)
  - ⚠️ **Examiner Trap** — orange/red `#FBE4D5` (the likely gotcha + the safe answer)
  - 📊 **Key Number** — green `#E2EFDA` (the exact figure spotlighted)
- In the Markdown draft these render as labelled blockquotes; in Word they become the shaded boxes above.
- Word `.docx` uses real Heading1–3 styles so the **auto-TOC matches exactly**.

## Locked facts (from Final Submission — use verbatim)
- **Baseline (Table 19, I1):** ~20 pax/mo, ~252/yr; **80% OTA / 20% direct**; net prices **€45 Highlights / €40 Family / €100 Barca Spirit**; derived retail **€60 / €53 / €133**; **blended retail €69**; VAT 21%; guide cost €50 (Highlights/Family) / €80 (Barca Spirit); Camp Nou €30; fleet **10 e-bikes + 8 mechanical (18)**, expandable to **120 in 2 months**; **NPS "8–9/10" is a CSAT estimate, not measured**.
- **Market:** 16M visitors 2025 (+2.9%), 37.2M overnights, ICCA **#4** (2024), **263 km** lanes; tour price €35–65; 450k–750k est. participants.
- **Sizing (Table 5):** **TAM €17.5–48.7M**; **SAM €5.25–14.6M** (~30% of TAM); **SOM €1–2M** (multi-year ceiling at 50+ partners; 4–10×). Pink Ducks guided segment now <0.1% of TAM (~€17k retail / ~€13k net).
- **Competitors (Table 6):** Baja €1.0–1.4M (15 cap, OTA+Habitat only); Fat Tire/Unlimited €700k–1.1M (12–15 cap, 17 cities); Steel Donkey €200–400k (8 cap); Pink Ducks €200–500K (15–50, B2B under construction). Fragmented (<7% each). **12–18 month** first-mover window.
- **Theory:** Porter differentiation-focus + value chain; Kotler Challenger/flanking. Benchmarks Arival 2023, Rezdy 2021/23, DMC Quote 2025.
- **Objectives:** General + **SO1** segmentation, **SO2** incentives, **SO3** marketing toolkit, **SO4** 90-day pilot, **SO5** scalability/Year-2 decision.
- **6 informants:** I1 Falk (founder); I2 CREA DMC; I3 Cititravel DMC; I4 Almanac (5★ concierge); I5 W Barcelona (5★); I6 Generator (hostel). ⚠️ *Doc has an internal I3/I4 numbering slip around Almanac in Finding 2 — flag for the sprint.*
- **5 Findings:** (1) tri-modal incentives; (2) **5★ concierges take ZERO commission** (compliance/Les Clés d'Or) → highest-margin channel; (3) regulatory compliance = selection signal; (4) ESG = procurement threshold; (5) WhatsApp speed = conversion variable (15-min hotel/DMC, sub-5-min hostel).
- **Segmentation:** Tier 1 *Core Revenue Drivers* (DMCs+event agencies, **70–80%** of partner revenue, net rate); Tier 2a luxury 5★ (relationship, zero commission); Tier 2b 4★+hostels+boutique (volume commission); Tier 3 niche CSR. 20-partner matrix; 4-criteria scoring (Segment 30 / Volume 30 / Product-gap 20 / Access 20) → 6 informants.
- **Incentive models (Tables 15–17):** M1 Net Rate **25–35% below retail** (graduated; >50 groups quarterly bonus; NDA). M2 Relationship **zero commission** (~€50 FAM + premium collateral + 15-min SLA; full retail). M3 Volume Commission **Bronze 20% (1–20) / Silver 25% (21–75) / Gold 30% (76+)**; non-cash staff micro-incentives (hostels only); **28% hard ceiling**.
- **Marketing (SO3):** channel Sales Kits; multilingual sheets EN/ES/DE/FR; net-rate cards (never to 5★); QR → partner-specific **Shopify** landing pages; FAM rides segmented; SLAs 15-min / sub-5-min. Tours: Highlights / Barca Spirit / Family.
- **Feasibility (Tables 20–22):** Pessimistic 6 partners/240 pax/**€13,000**; Base 12/700/**€38,500** (blended **21%** dist. cost); Optimistic 15/1,400/**€75,700** (22%). Base split: NetRate 3/270/28%/€13,400; Relationship 2/80/0%/€5,520; Commission 7/350/21%/€19,580. Annual pax 252/312/670/1,111. Per-pax B2B €69 vs OTA ~€52.
- **Pilot SO4:** Month1 infra (incl. NPS instrument) → Month2 relationships/FAM → Month3 launch. 3 anchor pilots + 7 cohort. KPIs DMC ≥4 groups/show-up ≥95%/NPS ≥75; Hotel ≥10/≥90%/≥75; Hostel ≥20/≥65% (deposit)/≥60. **Unified NPS ≥75** (corrects the 70 in §2.7). 4 deal-breakers (safety, English failure, no-show >10 min, confirmation error).
- **SO5/Decision (Table 23):** DMC repeat **70–80%** vs OTA **10–20%**. COMMIT = B2B ≥30% pax by M6 + blended ≤28% + NPS ≥75; STOP if blended >28%; PIVOT triggers per row.
- **PESTLE** (political 20-cap/megaphone ban; legal 8-per-guide asset; environmental CSRD/ESG…). **SDGs 8/11/17 (+12** battery lifecycle); Green Tourism Partner Awards.
- **Limitations:** NPS untracked; sample skew; forecast assumptions benchmark-based; channel comparison = Year-1 scope. Future research: longitudinal retention; dynamic pricing; Amsterdam/Lisbon replication.
- **Presentation map:** 10 min, 10–12 slides, sections I–V; **Section IV (Strategy) ≥ 4 min**; visuals for TAM/SAM/SOM + competitive gap; master Net-Rate-vs-Commission for Q&A.

## Deliverable structure (Parts → Chapters → subsections)
- **Front matter:** Title block · How to Read This Document (box legend) · Central Metaphor ("Stop renting customers from the toll-booth; build your own trusted high-street") · **Table of Contents**.
- **PART ONE — THE STORY:** Ch0 Orientation (one-sentence thesis, problem, research question, the golden thread); Ch1 Company & Founder (baseline, brief, internal capabilities).
- **PART TWO — THE MARKET:** Ch2 Barcelona opportunity (demand, MICE, TAM/SAM/SOM); Ch3 OTA trap & uncontested channel (competitors, 12–18 mo window, SWOT).
- **PART THREE — THE FRAMEWORKS:** Ch4 theories (Porter ×2, Kotler, benchmarks); Ch5 objectives (General + SO1–SO5, each SMART-decomposed).
- **PART FOUR — THE METHOD:** Ch6 design (mixed methods, I1–I6, 5-cluster coding, validity/ethics/limits, the simulated-data integrity note).
- **PART FIVE — THE FINDINGS:** Ch7 the five findings (one subsection each).
- **PART SIX — THE STRATEGY:** Ch8 segmentation (SO1); Ch9 incentive architecture (SO2, 3 models + 28% ceiling); Ch10 marketing system (SO3).
- **PART SEVEN — THE FEASIBILITY:** Ch11 scenario income model; Ch12 90-day pilot (SO4); Ch13 B2B-vs-OTA & Year-2 decision (SO5) + PESTLE + sustainability.
- **PART EIGHT — THE EXAM ROOM:** Ch14 Pre-Submission Sprint (Jun 6–12, day-by-day, mapped to EAE rubric); Ch15 Pre-Defense Bootcamp (Jun 13–Jul 6, weekly); Ch16 Brutal Q&A bank (grounded answers); Ch17 10-minute presentation map.
- **PART NINE — REFERENCE (ANNEX):** A Master Glossary; B The Numbers Sheet (one-page all figures); C Tables Vault (segmentation, scoring, 3 incentive models, scenarios, decision matrix); D People & Partners (I1–I6 + named orgs); E Citations cheat-sheet (claim→source); F Interview-protocol highlights.

Every chapter is written **self-contained**: defines its terms inline, states the real number, gives a
🧒 analogy, and (for Part 8) an exam-ready soundbite. ELI5 boxes for: OTA commission trap, B2B/B2B2C,
the 3 tiers, net rate vs commission, the zero-commission concierge insight, TAM/SAM/SOM, NPS, blended
distribution cost, CAC/repeat-rate, commit-pivot-stop, MICE/DMC, FAM, ESG/CSRD, SLA.

## Generation approach
1. Produce the full guide as **Markdown** (with an inline TOC + boxes rendered as blockquotes) for review.
2. On approval, generate the **`.docx`** with real Heading1–3 styles, an auto-updating Word TOC, and
   coloured callout boxes — built by writing OOXML directly (python-docx isn't installed; assemble the
   zip/XML, no new dependency) so it opens cleanly in Word with the CycleGuide look.

## Verification
- Cross-check every figure in the draft against the Final Submission extract (numbers sheet = single source of truth).
- Confirm the TOC entries exactly match the Heading1–3 text (and, in the .docx, that Word's generated TOC matches).
- Spot-check the 3 incentive models, the 3 scenarios, and the SO4/SO5 thresholds for fidelity.
- Flag (not silently "fix") any internal inconsistencies found in the source (e.g., I3/I4 Almanac numbering; NPS 70 vs 75) in the Sprint chapter so the user can correct the thesis itself.

## Decisions (confirmed by user)
- **Delivery:** Markdown draft first for review → then generate the styled `.docx`.
- **Callout boxes:** all four — 🧒 ELI5, 🎤 Defense Soundbite, ⚠️ Examiner Trap, 📊 Key Number.
