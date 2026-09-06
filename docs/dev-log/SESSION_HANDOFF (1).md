# SESSION HANDOFF — Pink Ducks Study Guide Project

> **Purpose of this file.** It stores the full context and history of the Claude Code
> conversation that produced the Pink Ducks study guide, so the work can be resumed from
> **any Claude Code account or machine**. If you switch accounts or lose the chat, open this
> file and tell Claude Code: *"Read SESSION_HANDOFF.md and continue."*
>
> *Faithful structured reconstruction written by the assistant — Claude Code chats are
> ephemeral and cannot be exported verbatim, but every substantive request, decision, number,
> and deliverable is captured below. Last updated: June 2026 (after the speaker-notes / §12.8 round).*

---

## 0. ⚠️ Read this first — where the files actually live

- The **latest** study guide (19 chapters), its Markdown source, the Word build, the builder
  script, the plan, and this handoff are **committed locally** on branch
  **`claude/fervent-hopper-yB1mC`** (commits `ff85bd5` → `81d6923` → `0bb8415` → `73888ec`)
  **but were never pushed** — the GitHub push is blocked because the GitHub authorization was
  never completed (see §4). A local-only commit is lost when the ephemeral container is reclaimed.
- What **is** safely on the remote: earlier in the session the **three `.md` files**
  (`Pink_Ducks_Study_Guide.md`, `SESSION_HANDOFF.md`, `STUDY_GUIDE_PLAN.md`) were **manually
  uploaded via github.com** to branch **`claude/elegant-shannon-Ybnzo`** — but that copy is the
  **older version** (before the Finance chapter, the 20-question Q&A, §12.8, and Chapter 19).
- The **guaranteed** copies are the files the assistant **sent you directly in chat**
  (the latest `.docx` and `.md`, plus this handoff). **Keep those**, or push/upload them to the
  repo to make them durable.

**To make the latest work durable (pick one):**
1. Complete the GitHub authorization (§4) and let the assistant run `git push` — everything goes up automatically; **or**
2. On **github.com/kamgangharold-ui/Bike-tour-Proj → Add file → Upload files**, drag in the
   files the assistant sent you, and **Commit** (no authorization needed — this is how the `.md`
   trio was saved before).

---

## 1. How to resume on another account

1. Sign in to the new Claude Code account (web `claude.ai/code`, or desktop/CLI/IDE).
2. Connect the repo `kamgangharold-ui/Bike-tour-Proj`.
3. Open the branch that has your files (`claude/elegant-shannon-Ybnzo` for the uploaded `.md`
   trio, or `claude/fervent-hopper-yB1mC` if the local commits get pushed).
4. Open `SESSION_HANDOFF.md` + `Pink_Ducks_Study_Guide.md` + `STUDY_GUIDE_PLAN.md`.
5. Tell the session: *"Read SESSION_HANDOFF.md and Pink_Ducks_Study_Guide.md, then continue from Next Steps."*

---

## 2. Project overview

- **Who:** Bulbuli Bala (teammates Harold Steve Kamgang Sielayap & Gracia Muhune Nyota).
- **What:** EAE Business School (Universitat de Lleida) MSc International Business — Final Master Thesis.
- **Thesis title:** *Partner-Led Growth Strategy for Pink Ducks: A B2B Distribution Strategy for an Urban Guided E-Bike Tour Operator in Barcelona.*
- **Deadlines:** Submission **12 June 2026** · Defense **6 July 2026**.
- **Goal:** A single, self-contained study/mastery guide that explains every concept from scratch
  (ELI5), prepares Bulbuli for submission **and** defense, mirrors the heading style + Table of
  Contents of `BarcelonaCycleGuide_Documentation.docx`, includes an Annex of all key data, and
  grounds **every number** in the FMT Final Submission.

---

## 3. Source documents (uploads, not repo files)

- **Authoritative source of truth:** `FMT…Final_Submission.docx` — the main thesis.
- **Style/template reference:** `BarcelonaCycleGuide_Documentation.docx` — heading hierarchy
  (PART → Chapter → numbered subsections), TOC style, coloured-box pedagogy.
- **Supporting:** `Pink_Ducks__A_PartnerLed_B2B_EBike_Growth_Strategy.docx` — the 10-minute
  presentation flow (sections I–V), used for the presentation map (Ch 18).
- **User-edited build:** an edited `.docx` where Bulbuli changed the **font to Tw Cen MT** and
  added a **centered footer page number** — both now reproduced by the builder.

> To make these durable, add them to the repo (e.g. `/source_docs`) or re-upload them in a new session.

---

## 4. Conversation log (chronological)

1. **Exploration & first draft.** Assistant explored the FMT material, then drafted a 3-part study
   guide (ELI5 blueprint, pre-submission sprint, pre-defense bootcamp), flagging where it was
   *estimating* (AI-app framing, "Trust-First" wording).
2. **Connection hiccups.** A GitHub OAuth flow was started; a retired **Google Drive MCP** page
   ("Server Turned Down") kept appearing because Chrome auto-completed to it.
3. **Real documents provided.** Bulbuli uploaded the Pink Ducks B2B strategy + CycleGuide docs, then
   the **FMT Final Submission**, instructing that **all numbers must come from it**. Assistant read
   it in full and corrected its estimates.
4. **Plan + clarifications (plan mode).** Decisions locked: **Markdown first → then Word `.docx`**;
   **four callout boxes** (🧒 ELI5, 🎤 Defense Soundbite, ⚠️ Examiner Trap, 📊 Key Number).
5. **Guide built.** Full Markdown guide written (Parts One–Nine + Annex), CycleGuide template, all
   figures grounded in the Final Submission.
6. **First handoff + storage request.** Bulbuli asked to store the conversation in the repo for
   cross-account access → this file was created; the `.md` trio was committed (`ff85bd5`).
7. **Word build.** Assistant installed `python-docx`, wrote `build_study_guide_docx.py`, and
   produced the `.docx` with real Heading 1–3 styles, an auto-TOC field, and the four shaded boxes
   (`81d6923`). Push blocked on missing GitHub credentials → OAuth link shared; Chrome kept hijacking
   it to the dead Google Drive page → advised **Incognito** or **web upload**.
8. **User saved the `.md` trio** to the remote via github.com (branch `claude/elegant-shannon-Ybnzo`).
9. **Font + content round.** Bulbuli uploaded an edited `.docx` (**Tw Cen MT** + **centered footer
   page numbers**) and asked to **add a financial-maths chapter** and **expand the Q&A to 20**.
   Assistant added **Chapter 12 · The Financial Maths**, expanded the Q&A to **20 questions**
   (Chapter 17), renumbered downstream chapters + TOC, and updated the builder to apply Tw Cen MT
   across all styles + a centered footer PAGE field (`0bb8415`).
10. **Speaker notes + contribution round.** Bulbuli asked for **speaker notes for the 10-minute deck**
    and **guide costs to show true contribution per tour**. Assistant added **§12.8 · True
    Contribution Per Tour** (VAT ÷1.21, fixed guide cost, Camp Nou entry, group-size lever) and
    **Chapter 19 · Speaker Notes** (timed, 12-slide script) (`73888ec`).
11. **Product question.** Bulbuli asked (in French) the difference between Claude / Claude Cowork /
    Claude Code — answered with web research (general Q, not a project deliverable).
12. **This update.** Bulbuli asked to refresh this handoff and receive it as a file for safekeeping.

---

## 5. Decisions (locked)

- **Source of truth:** FMT Final Submission (wins any conflict).
- **Delivery:** Markdown first for review → then styled `.docx`.
- **Four callout boxes:** 🧒 ELI5 (yellow `#FFF2CC`) · 🎤 Defense Soundbite (blue `#DEEAF6`) ·
  ⚠️ Examiner Trap (red `#FBE4D5`) · 📊 Key Number (green `#E2EFDA`).
- **Word formatting (user's choices):** **font Tw Cen MT** on all styles; **centered footer page
  number**; **A4**, **2.5 cm** margins; real Heading 1–3 styles → auto-updating TOC field.
- **Build:** `build_study_guide_docx.py` (python-docx 1.2.0) regenerates the `.docx` from the `.md`
  and re-applies the font + footer automatically.

---

## 6. Numbers banked from the Final Submission (accuracy anchors)

- Three incentive **models** (not a simple ladder): Net Rate **25–35%** below retail · Relationship
  **0%** (luxury 5★, highest margin) · Volume Commission **Bronze 20% / Silver 25% / Gold 30%**;
  **28% blended ceiling**.
- Market: TAM **€17.5–48.7M** · SAM **€5.25–14.6M** · SOM **€1–2M** (**multi-year** ceiling).
- Year 1 outcome: **€38.5k–€75.7k** incremental B2B net revenue, ~3–4× passengers.
- Scenarios: Pessimistic 6/240/**€13k** · Base 12/700/**€38.5k** (21% blended) · Optimistic 15/1,400/**€75.7k**.
- Baseline: ~252 pax/yr · 80% OTA · net €45/€40/€100 → retail €60/€53/€133 · blended **€69** ·
  VAT 21% · guide €50/€80 · Camp Nou €30 · fleet 18→120 in 2 months.
- Asymmetry: **DMC retention 70–80% vs OTA repeat 10–20%** · first-mover window **12–18 months**.
- Pilot KPIs: DMC ≥4/≥95%/NPS≥75 · Hotel ≥10/≥90%/≥75 · Hostel ≥20/≥65%/≥60 · COMMIT/PIVOT/STOP at 28%.

---

## 7. Deliverables in the repo (latest = local branch `claude/fervent-hopper-yB1mC`)

| File | What it is | Status |
|---|---|---|
| `Pink_Ducks_Study_Guide.md` | Self-contained study guide — **9 parts, 19 chapters + Annex** | Current |
| `Pink_Ducks_Study_Guide.docx` | Word build — Tw Cen MT, footer page numbers, auto-TOC, 4 boxes | Current |
| `build_study_guide_docx.py` | Rebuilds the `.docx` from the `.md` | Current |
| `STUDY_GUIDE_PLAN.md` | The approved build plan | Final |
| `SESSION_HANDOFF.md` | This file | Current |

**Chapter map:** P1 Story (Ch 0–1) · P2 Market (2–3) · P3 Frameworks (4–5) · P4 Method (6) ·
P5 Findings (7) · P6 Strategy (8–10) · P7 Feasibility (**11 Scenarios · 12 Financial Maths inc.
§12.8 contribution-per-tour · 13 Pilot · 14 SO5**) · P8 Exam Room (**15 Sprint · 16 Bootcamp ·
17 Q&A 20-questions · 18 Presentation map · 19 Speaker notes**) · P9 Annex (A–F).

---

## 8. Next steps (resume here)

1. **Make the latest work durable** — push (after GitHub auth) or web-upload the assistant-sent
   files (see §0). The local commits are otherwise volatile.
2. **Apply the three thesis fixes** in the Final Submission before submission:
   - Unify **NPS threshold to ≥75** (Section 2.7 still says 70).
   - Fix the **I3/I4** Almanac concierge numbering in Finding 2.
   - Always state **€1–2M SOM as multi-year**, never Year 1.
3. **Optional extras offered (not yet built):** a one-page printable cheat-sheet; per-slide design
   layouts for the 12 slides; rehearsal flashcards from the Q&A bank; a worked contribution example
   per channel (commission/net-rate, not just full-retail).
