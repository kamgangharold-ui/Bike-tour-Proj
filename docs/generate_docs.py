#!/usr/bin/env python3
"""Barcelona CycleGuide — full documentation generator (python-docx)."""

from docx import Document
from docx.shared import Pt, RGBColor, Inches, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

# ── colour palette ──────────────────────────────────────────────────────────
C_NAVY   = RGBColor(0x1A, 0x23, 0x7E)
C_BLUE   = RGBColor(0x15, 0x65, 0xC0)
C_DGREY  = RGBColor(0x42, 0x42, 0x42)
C_WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
C_BLACK  = RGBColor(0x00, 0x00, 0x00)
C_AMBER  = RGBColor(0xF5, 0x7F, 0x17)
C_RED    = RGBColor(0xB7, 0x1C, 0x1C)
C_GREEN  = RGBColor(0x1B, 0x5E, 0x20)

HEX_YELLOW  = "FFF9C4"   # 5-yr-old box bg
HEX_LBLUE   = "E3F2FD"   # illustration box bg
HEX_NAVY    = "1A237E"   # header rows
HEX_ALTROW  = "EEF2FF"   # table alternate row
HEX_COVER   = "1565C0"   # cover page bg strip

# ── XML helpers ─────────────────────────────────────────────────────────────

def _set_cell_shading(cell, fill_hex):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  fill_hex)
    tcPr.append(shd)

def _set_cell_border(cell, color_hex="1565C0", width="12"):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"),   "single")
        b.set(qn("w:sz"),    width)
        b.set(qn("w:space"), "0")
        b.set(qn("w:color"), color_hex)
        tcBorders.append(b)
    tcPr.append(tcBorders)

def _set_cell_margins(cell, top=100, left=150, bottom=100, right=150):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for side, val in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        m = OxmlElement(f"w:{side}")
        m.set(qn("w:w"),    str(val))
        m.set(qn("w:type"), "dxa")
        tcMar.append(m)
    tcPr.append(tcMar)

def _remove_table_borders(table):
    tbl  = table._tbl
    tblPr = tbl.find(qn("w:tblPr"))
    if tblPr is None:
        tblPr = OxmlElement("w:tblPr")
        tbl.insert(0, tblPr)
    tblBorders = OxmlElement("w:tblBorders")
    for side in ("top","left","bottom","right","insideH","insideV"):
        b = OxmlElement(f"w:{side}")
        b.set(qn("w:val"), "none")
        tblBorders.append(b)
    tblPr.append(tblBorders)

def _set_para_spacing(para, before=0, after=120, line=276):
    pPr = para._p.get_or_add_pPr()
    spc = OxmlElement("w:spacing")
    spc.set(qn("w:before"), str(before))
    spc.set(qn("w:after"),  str(after))
    spc.set(qn("w:line"),   str(line))
    spc.set(qn("w:lineRule"), "auto")
    pPr.append(spc)

# ── document-level helpers ───────────────────────────────────────────────────

def add_page_break(doc):
    doc.add_page_break()

def add_heading(doc, text, level=1):
    """H1=part/chapter title  H2=section  H3=subsection."""
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    if level == 1:
        run.font.size = Pt(22)
        run.font.color.rgb = C_NAVY
        _set_para_spacing(p, before=300, after=120)
    elif level == 2:
        run.font.size = Pt(15)
        run.font.color.rgb = C_BLUE
        _set_para_spacing(p, before=200, after=80)
    elif level == 3:
        run.font.size = Pt(12)
        run.font.color.rgb = C_DGREY
        run.italic = True
        _set_para_spacing(p, before=140, after=60)
    run.font.name = "Calibri"
    return p

def add_body(doc, text, italic=False, color=None, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.name  = "Calibri"
    run.font.size  = Pt(size)
    run.italic     = italic
    if color:
        run.font.color.rgb = color
    _set_para_spacing(p, before=0, after=100, line=288)
    return p

def add_bullet(doc, text, level=0, bold_prefix=None):
    p = doc.add_paragraph(style="List Bullet")
    if bold_prefix:
        r = p.add_run(bold_prefix)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(11)
    r2 = p.add_run(text)
    r2.font.name = "Calibri"
    r2.font.size = Pt(11)
    _set_para_spacing(p, before=0, after=60, line=276)
    return p

def add_box(doc, emoji, label, text, bg_hex, border_hex):
    """One-cell coloured box with bold label + body text."""
    table = doc.add_table(rows=1, cols=1)
    _remove_table_borders(table)
    cell = table.cell(0, 0)
    _set_cell_shading(cell, bg_hex)
    _set_cell_border(cell, border_hex, "18")
    _set_cell_margins(cell, 120, 200, 120, 200)
    p = cell.paragraphs[0]
    r1 = p.add_run(f"{emoji}  {label}  ")
    r1.bold = True
    r1.font.size = Pt(11)
    r1.font.name = "Calibri"
    r2 = p.add_run(text)
    r2.font.size = Pt(11)
    r2.font.name = "Calibri"
    _set_para_spacing(p, before=60, after=60, line=276)
    # blank line after box
    sp = doc.add_paragraph()
    _set_para_spacing(sp, before=0, after=60, line=240)
    return table

def kid_box(doc, text):
    return add_box(doc, "🧒", "5-Year-Old Explanation:", text,
                   HEX_YELLOW, "F9A825")

def illus_box(doc, text):
    return add_box(doc, "📐", "Illustration Placeholder:", text,
                   HEX_LBLUE, "1565C0")

def add_table(doc, headers, rows, col_widths=None):
    """Styled table: navy header row, alternating body rows."""
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.style = "Table Grid"
    # header
    hdr = t.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        _set_cell_shading(cell, HEX_NAVY)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.bold = True
        r.font.color.rgb = C_WHITE
        r.font.size = Pt(10)
        r.font.name = "Calibri"
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    # data rows
    for ri, row in enumerate(rows):
        bg = HEX_ALTROW if ri % 2 == 0 else "FFFFFF"
        for ci, val in enumerate(row):
            cell = t.rows[ri + 1].cells[ci]
            _set_cell_shading(cell, bg)
            p = cell.paragraphs[0]
            # allow bold via **text**
            if "**" in str(val):
                parts = str(val).split("**")
                for pi, part in enumerate(parts):
                    r = p.add_run(part)
                    r.bold = (pi % 2 == 1)
                    r.font.size = Pt(10)
                    r.font.name = "Calibri"
            else:
                r = p.add_run(str(val))
                r.font.size = Pt(10)
                r.font.name = "Calibri"
    if col_widths:
        for ri in range(len(t.rows)):
            for ci, w in enumerate(col_widths):
                t.rows[ri].cells[ci].width = Inches(w)
    sp = doc.add_paragraph()
    _set_para_spacing(sp, before=0, after=80, line=240)
    return t

def add_divider(doc):
    p = doc.add_paragraph()
    p.add_run("─" * 80).font.color.rgb = RGBColor(0xBD, 0xBD, 0xBD)
    _set_para_spacing(p, before=60, after=60, line=240)

def add_part_title(doc, part_num, part_name):
    add_page_break(doc)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(f"PART {part_num}")
    r.font.name  = "Calibri"
    r.font.size  = Pt(13)
    r.font.color.rgb = C_WHITE
    r.bold = True
    _set_para_spacing(p, before=0, after=0)
    # shade the paragraph
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  HEX_COVER)
    pPr.append(shd)
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run(f"— {part_name.upper()} —")
    r2.font.name  = "Calibri"
    r2.font.size  = Pt(22)
    r2.font.color.rgb = C_NAVY
    r2.bold = True
    _set_para_spacing(p2, before=100, after=200)

# ════════════════════════════════════════════════════════════════════════════
# CONTENT
# ════════════════════════════════════════════════════════════════════════════

def build_document():
    doc = Document()

    # page margins
    for section in doc.sections:
        section.top_margin    = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin   = Cm(3.0)
        section.right_margin  = Cm(2.5)

    # ── COVER PAGE ──────────────────────────────────────────────────────────
    doc.add_paragraph()
    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("BARCELONA CYCLEGUIDE")
    r.font.name  = "Calibri"
    r.font.size  = Pt(36)
    r.font.color.rgb = C_NAVY
    r.bold = True
    _set_para_spacing(p, before=0, after=60)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run("Complete Project Documentation")
    r2.font.name  = "Calibri"
    r2.font.size  = Pt(18)
    r2.font.color.rgb = C_BLUE
    r2.italic = True
    _set_para_spacing(p2, before=0, after=20)

    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = p3.add_run("Technical Handover  ·  Educational Guide  ·  Developer Reference")
    r3.font.name  = "Calibri"
    r3.font.size  = Pt(12)
    r3.font.color.rgb = C_DGREY
    _set_para_spacing(p3, before=0, after=200)

    add_divider(doc)

    meta = [
        ("Project",     "Barcelona CycleGuide — Location-Aware Digital Tour Guide for Cyclists"),
        ("Version",     "1.0  ·  June 2026"),
        ("Author",      "Harold Kamgang  ·  AI Development Partner: Claude Code (Anthropic)"),
        ("Repository",  "kamgangharold-ui/bike-tour-proj"),
        ("Branch",      "claude/elegant-shannon-Ybnzo"),
        ("App ID",      "com.biketourguide.app"),
        ("Platform",    "iOS + Android  (React Native · Expo SDK 54)"),
        ("Backend",     "Firebase Firestore (Google Cloud)"),
    ]
    for label, value in meta:
        p = doc.add_paragraph()
        r1 = p.add_run(f"{label}:  ")
        r1.bold = True; r1.font.name = "Calibri"; r1.font.size = Pt(11)
        r2 = p.add_run(value)
        r2.font.name = "Calibri"; r2.font.size = Pt(11)
        _set_para_spacing(p, before=0, after=60)

    add_page_break(doc)

    # ── HOW TO READ THIS DOCUMENT ─────────────────────────────────────────
    add_heading(doc, "How to Read This Document", 1)
    add_body(doc,
        "This document has two types of readers in mind, and it serves both at the same time.")
    add_body(doc,
        "If you are a developer joining the project or picking it up in the future — read "
        "everything. The technical sections give you what you need to understand, run, and "
        "extend the codebase without any prior briefing.")
    add_body(doc,
        "If you are a business owner, investor, product manager, or curious non-technical "
        "person — pay special attention to the two types of highlighted boxes that appear "
        "throughout every chapter:")

    kid_box(doc,
        "These yellow boxes take every complex idea and explain it using an everyday analogy. "
        "You never need to understand how a car engine works to know how to drive one — and "
        "you never need to understand how code works to understand what this app does and "
        "why it was built the way it was.")

    illus_box(doc,
        "These blue boxes are visual placeholders. They describe exactly what a diagram, "
        "screenshot, or illustration should look like at that point in the document, so you "
        "or a designer can add the image later.")

    add_divider(doc)

    # ── CENTRAL METAPHOR ─────────────────────────────────────────────────
    add_heading(doc, "The Central Metaphor: Your Knowledgeable Cycling Friend", 1)
    add_body(doc,
        "Before we explain a single technical concept, we give you one image to carry "
        "through the entire document.")
    add_body(doc,
        "Imagine you have a very special friend. This friend knows every street, every "
        "monument, every hidden courtyard, and every bike-parking rack in Barcelona. "
        "They ride beside you — invisibly, silently, always present. They:")

    bullets = [
        "Tap you on the shoulder the moment you get close to something interesting",
        "Warn you calmly — before you make a mistake that could cost you €500",
        "Answer any question you ask, in whatever language you speak",
        "Remember every place you've visited and quietly celebrate your progress",
        "Always know where the nearest safe bike parking is, even in an unfamiliar street",
    ]
    for b in bullets:
        add_bullet(doc, b)

    add_body(doc, "\nThis friend IS the Barcelona CycleGuide app. Every technical piece of the "
        "app is one part of this friend's body:", italic=True)

    add_table(doc,
        ["Part of the Friend", "Part of the App", "Technical Name"],
        [
            ("Their memory",          "Where all data is stored",              "Firebase Firestore"),
            ("Their eyes",            "Knowing exactly where you are",         "GPS + Geofencing"),
            ("Their voice",           "Speaking to you at the right moment",   "Push Notifications"),
            ("Their brain",           "Answering complex questions",           "Claude AI (Anthropic)"),
            ("Their notebook",        "The visual map of the city",            "Map Screen (react-native-maps)"),
            ("Their guidebook",       "Curated facts, quizzes, rules",         "FAQs, Quizzes, LandmarkCard"),
            ("Their parking know-how","Finding safe bike spots nearby",        "Parking Locator (Open Data BCN)"),
            ("Their trusty face",     "What you see on your screen",           "React Native + Expo"),
        ],
        col_widths=[2.0, 2.2, 2.4]
    )

    illus_box(doc,
        "A friendly cartoon cyclist riding through a Barcelona street. Floating around them "
        "is a glowing smartphone. Around the phone, eight small icons arranged in a circle, "
        "each connected by a dotted line to a labelled box: Memory (Firebase), Eyes (GPS), "
        "Voice (Notifications), Brain (AI Chat), Notebook (Map), Guidebook (FAQs), "
        "Parking Knowledge (Open Data), Face (React Native). Warm comic-book style.")

    add_body(doc,
        "We will return to this friend at the beginning of every chapter. By the time you "
        "finish reading, you will have a complete picture of how every part of them works — "
        "whether or not you have ever written a single line of code.", italic=True)

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "ONE", "THE IDEA")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 0 · Before We Write a Single Line of Code", 1)
    add_body(doc,
        "Our knowledgeable cycling friend does not exist yet. Right now they are just an "
        "idea — a dream. Before we can bring them to life, we must answer three very important "
        "questions. These are not technical questions. They are human questions.", italic=True)

    add_heading(doc, "0.1 · The Problem", 2)
    add_body(doc,
        "Picture this. You are a tourist or a local resident in Barcelona. You have rented "
        "a bike, you are excited, and you set off through the city. You pass the Sagrada "
        "Família — and you had no idea there is a perfect viewpoint to see it from the other "
        "side. You cycle through the Gothic Quarter — and you had no idea that cycling is "
        "illegal there and could cost you €500. You want to park near the beach — and you "
        "circle the block three times before giving up.")
    add_body(doc,
        "Information exists. Maps exist. Google exists. But none of it is hands-free, "
        "context-aware, and in-the-moment. You cannot safely open a guidebook while cycling. "
        "You cannot pull out your phone to search while in motion. You need someone to speak "
        "to you, at exactly the right moment, without you having to do anything at all.")
    add_body(doc, "That is the problem we are solving.")

    kid_box(doc,
        "Imagine you are walking through a big zoo with your hands full of ice cream. "
        "Wouldn't it be amazing if someone just whispered in your ear 'Hey! Look left — "
        "there's a lion!' right when you walked past? That is the problem we're solving. "
        "The cyclist's hands are on the handlebars. We need someone to do the whispering.")

    add_heading(doc, "0.2 · The User", 2)
    add_body(doc,
        "We built this app for one person: the urban cyclist in an unfamiliar or "
        "semi-familiar city. They might be:")
    for b in [
        "A tourist visiting Barcelona for a week, exploring by rental bike",
        "A resident who cycles daily but barely knows the history of the city they live in",
        "An expat who wants to discover Barcelona more deeply",
        "A cycling enthusiast who wants to learn while they ride",
    ]:
        add_bullet(doc, b)
    add_body(doc,
        "What they all share: their hands are on the handlebars, their attention is on the "
        "road, they want to discover rather than research, they want to stay safe and legal, "
        "and they want to park without stress.")
    add_body(doc,
        "One core design principle: the app must work for them, not make them work for it. "
        "Everything happens automatically. The user rides; the app does the rest.")

    kid_box(doc,
        "Think of the difference between a museum with no signs (confusing, you have to "
        "ask strangers) and a museum that hands you a little earpiece that starts talking "
        "exactly when you walk up to each painting. We are building the earpiece — "
        "for cyclists — for an entire city.")

    add_heading(doc, "0.3 · The Success Criteria", 2)
    add_body(doc,
        "Before writing any code, we defined five clear conditions that would tell us "
        "the app is finished and good:")
    add_table(doc,
        ["#", "Condition", "What It Means in Practice"],
        [
            ("1", "Works hands-free",        "The cyclist never taps the screen to receive information"),
            ("2", "Location-aware",          "The right content appears at the right physical place, every time"),
            ("3", "Educates and warns",      "The user learns something AND avoids legal trouble"),
            ("4", "Works on both platforms", "iOS and Android — not just one phone brand"),
            ("5", "Scales beyond Barcelona", "Any city can be added later; Barcelona is not hardcoded"),
        ],
        col_widths=[0.4, 2.0, 4.2]
    )

    add_heading(doc, "0.4 · The Three Fundamental Layers of Any App", 2)
    add_body(doc,
        "Almost every app ever built — from Instagram to Google Maps — shares the same "
        "three-layer architecture. Understanding this concept is the single most important "
        "thing a non-technical reader can take away from this document.")
    add_table(doc,
        ["Layer", "Plain-English Name", "What We Built"],
        [
            ("Layer 1", "What you see",          "React Native + Expo — the screens on your phone"),
            ("Layer 2", "Where data lives",      "Firebase Firestore — all landmarks, quizzes, FAQs, users"),
            ("Layer 3", "Borrowed superpowers",  "GPS, AI, Notifications, Barcelona Open Data"),
        ],
        col_widths=[1.0, 2.0, 3.6]
    )

    kid_box(doc,
        "Building an app is like building a LEGO city. Layer 1 is the buildings you can "
        "see and touch. Layer 2 is the underground pipes and wires — invisible, but nothing "
        "works without them. Layer 3 is the electricity company and the water company — you "
        "did not build them yourself, you just plugged into them.")

    illus_box(doc,
        "A LEGO city cross-section. Top layer: colourful buildings labelled 'What You See "
        "(React Native screens)'. Underground layer: pipe network labelled 'Where Data Lives "
        "(Firebase)'. Arriving from outside the city: electric cables labelled 'Borrowed "
        "Superpowers (GPS, AI, Notifications)'. Friendly, colourful, non-technical style.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "TWO", "THE ARCHITECTURE — THE BLUEPRINT")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 1 · How a Modern Mobile App Is Built", 1)
    add_body(doc,
        "Our cycling friend needs a body before they can exist. In this chapter we explain "
        "the overall blueprint — how all the pieces fit together — before diving into each "
        "piece in later chapters.", italic=True)

    add_heading(doc, "1.1 · The Three-Layer Cake", 2)
    add_body(doc,
        "We described the three layers in Chapter 0. Here we make them concrete for our app:")
    for b in [
        ("Top layer — The Screen (React Native + Expo): ", "This is everything the user sees and taps. "
         "The map, the chat window, the parking list, the quiz cards. It lives on the user's phone."),
        ("Middle layer — The Database (Firebase Firestore): ", "This is where information is stored. "
         "Every landmark name, every quiz question, every user's points total. It lives in Google's "
         "cloud servers — not on the phone."),
        ("Bottom layer — Cloud Services: ", "These are specialist services we rented rather than built. "
         "GPS tracking (Expo Location), AI answers (Anthropic Claude), government parking data "
         "(Barcelona Open Data), and app distribution (EAS Build)."),
    ]:
        add_bullet(doc, b[1], bold_prefix=b[0])

    illus_box(doc,
        "A tall three-layer cake. Top layer (light blue): labelled 'Screen / UI — React Native'. "
        "Middle layer (orange): labelled 'Database — Firebase Firestore'. Bottom layer (dark blue): "
        "labelled 'Cloud Services — GPS · AI · Notifications · Open Data'. An arrow on the side "
        "reads: 'Data flows up and down between layers in real time'.")

    add_heading(doc, "1.2 · Why We Use a Framework Instead of Writing from Scratch", 2)
    add_body(doc,
        "Writing a mobile app completely from scratch — pixel by pixel, interaction by "
        "interaction — would take years. Frameworks give developers a solid foundation of "
        "pre-built, pre-tested tools so they can focus on what makes their app unique.")
    add_body(doc,
        "We chose React Native + Expo as our framework. React Native lets you write one "
        "set of code that runs on both iPhone and Android. Expo adds a layer of tools "
        "on top that handle the most complex parts: camera, GPS, notifications, maps, "
        "and deployment — all without needing a Mac for iOS or a complex Android Studio "
        "setup just to get started.")

    kid_box(doc,
        "A framework is like a pre-built kitchen. We did not invent the oven, the "
        "refrigerator, or the sink. We just decided what to cook. Without the pre-built "
        "kitchen, we would spend two years installing plumbing before making the first "
        "omelette.")

    add_heading(doc, "1.3 · Why Not Native iOS and Android Separately?", 2)
    add_body(doc,
        "Building two separate native apps — one in Swift for iOS and one in Kotlin for "
        "Android — would require two separate codebases, two separate developer skill sets, "
        "twice the bugs to fix, and twice the time to update any feature. For a project "
        "at this scale and budget, that would be impractical.")
    add_body(doc,
        "React Native achieves approximately 95% code sharing between platforms. The 5% "
        "that differs (small platform-specific adjustments) is handled inside the same "
        "codebase with simple conditional checks.")

    add_heading(doc, "1.4 · Why Not Flutter?", 2)
    add_body(doc,
        "Flutter (Google's framework) was our original choice. We even had a working "
        "FlutterFlow prototype. However, FlutterFlow's free plan blocked third-party "
        "packages — meaning we could not add the GPS, Geofencing, or AI libraries we "
        "needed. Rather than pay for a plan that would still limit our flexibility, "
        "we migrated to React Native + Expo, which is fully open-source, free, and "
        "has first-class support for every library we needed. "
        "Chapter 13 tells the full story of this pivot.")

    # ── Chapter 2 ────────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 2 · The Technology Stack — Every Tool Named", 1)
    add_body(doc,
        "Here is the complete list of technologies that make our cycling friend exist. "
        "Think of this as the toolbox. Each chapter that follows opens one of these "
        "drawers and explains it in depth.", italic=True)

    add_table(doc,
        ["Tool / Library", "Version", "Plain-English Purpose"],
        [
            ("React Native",              "0.81",      "Builds the phone screens — works on iPhone and Android from one codebase"),
            ("Expo SDK",                  "54",        "Gives React Native superpowers: GPS, notifications, camera, maps, deployment"),
            ("Expo Router",               "v6",        "Decides which screen appears when — like chapters in a book"),
            ("Firebase Firestore",        "v10.12",    "The cloud database — stores all landmarks, quizzes, users, parking data"),
            ("Firebase Auth",             "v10.12",    "Handles sign-in: anonymous guest or email/password"),
            ("expo-location",             "v19",       "Reads the phone's GPS position continuously"),
            ("expo-task-manager",         "v14",       "Runs code in the background even when the app is not open"),
            ("expo-notifications",        "v0.32",     "Sends the tap-on-the-shoulder notification when you enter a landmark"),
            ("react-native-maps",         "v1.20",     "Draws the interactive city map"),
            ("OpenStreetMap (OSM)",       "free",      "Provides the map tiles (the visual street layer) — completely free"),
            ("Zustand",                   "v5",        "Remembers the current app state: which landmark is active, parking data, etc."),
            ("Anthropic Claude API",      "claude-sonnet-4-6", "The AI brain that answers questions intelligently and contextually"),
            ("Barcelona Open Data (CKAN)","public API","Free government database of all Bicibox and Bicipark parking stations"),
            ("@react-native-async-storage","v2.2",     "Saves the user's login state so they don't have to sign in every time"),
            ("TypeScript",                "v5.3",      "A stricter version of JavaScript — catches mistakes before they become bugs"),
            ("EAS Build",                 "Expo cloud","Builds the installable APK (Android) and IPA (iOS) files in the cloud"),
        ],
        col_widths=[2.2, 1.5, 3.0]
    )

    kid_box(doc,
        "Think of the technology stack as a toolbox. The hammer (React Native) does the "
        "heavy lifting. The measuring tape (GPS) tells us where we are. The notebook "
        "(Firebase) remembers everything. The encyclopaedia (Claude AI) answers hard "
        "questions. Every tool has one clear job, and together they build the whole house.")

    illus_box(doc,
        "An open toolbox viewed from above. Each tool is labelled with a technology name "
        "and its plain-English job: Hammer = React Native, Notebook = Firebase, "
        "Magnifying glass = GPS, Encyclopaedia = Claude AI, Blueprint = Expo Router, "
        "Map = react-native-maps, Padlock = Firebase Auth. Colourful, friendly illustration.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "THREE", "THE BACKEND — OUR FRIEND'S MEMORY")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 3 · Firebase — Our Friend's Memory", 1)
    add_body(doc,
        "Remember our knowledgeable cycling friend? Their memory is Firebase — specifically "
        "a service inside Firebase called Firestore. Without memory, the friend knows "
        "nothing: no landmarks, no quiz questions, no user progress. This chapter explains "
        "what Firebase is, why we chose it, and how we structured the information inside it.",
        italic=True)

    add_heading(doc, "3.1 · What Is a Database?", 2)
    add_body(doc,
        "A database is simply a very organised place to store information so it can be "
        "retrieved quickly. Imagine a public library. The library holds thousands of books "
        "(the data). Each book belongs to a specific shelf and section (a collection). "
        "When you want a book, you use the catalogue (a query) to find it instantly "
        "rather than searching every shelf yourself.")
    add_body(doc,
        "Our app's database holds: every landmark in Barcelona, every quiz question, "
        "every FAQ answer, every user's progress, and every parking station. "
        "The catalogue is our code — it retrieves exactly what is needed, "
        "exactly when it is needed.")

    kid_box(doc,
        "A database is like a giant, magic notebook. You can write anything in it, "
        "find any page instantly, and update any entry without a rubber — the old "
        "version is just replaced by the new one. And the notebook lives in a safe "
        "place in the cloud, not on one specific phone.")

    add_heading(doc, "3.2 · NoSQL vs SQL — Why Firebase, Not a Spreadsheet", 2)
    add_body(doc,
        "There are two main families of databases. Traditional SQL databases (like "
        "PostgreSQL or MySQL) store data in rigid tables — like a spreadsheet with "
        "fixed columns. Every row must have the same columns. This is great for "
        "financial data where every transaction looks identical.")
    add_body(doc,
        "Firebase Firestore is a NoSQL database. Instead of tables, it stores "
        "'documents' (like pages in a notebook). Each document can have its own "
        "set of fields. A landmark document might have a regulatory_alert field "
        "with a fine amount — but a landmark with no regulations simply has no "
        "such field at all. No empty columns, no null padding. Just the data "
        "that exists.")

    add_table(doc,
        ["Feature", "SQL (e.g. PostgreSQL)", "NoSQL (Firebase Firestore — what we use)"],
        [
            ("Structure",    "Fixed columns per table",         "Flexible fields per document"),
            ("Best for",     "Financial records, analytics",    "Apps with varied, nested data"),
            ("Scaling",      "Complex — requires database admin","Automatic (Google manages it)"),
            ("Real-time",    "Requires extra setup",            "Built-in real-time listeners"),
            ("Cost",         "Server required",                 "Free tier, pay-as-you-grow"),
            ("Our choice",   "No",                              "Yes — perfect for our use case"),
        ],
        col_widths=[1.8, 2.3, 2.5]
    )

    kid_box(doc,
        "SQL is like a notebook where every page must have exactly 10 lines, "
        "even if you only write 2. NoSQL is like a notebook where each page "
        "can be as long or as short as what you want to write. Our data — "
        "landmarks, quizzes, parking spots — is all different shapes. "
        "NoSQL fits us perfectly.")

    add_heading(doc, "3.3 · Our Five Collections (The Five Notebooks)", 2)
    add_body(doc,
        "Our Firestore database is organised into five collections. Think of each "
        "collection as one notebook on the shelf — each covering a different topic.")

    add_heading(doc, "Collection 1: locations — Every Place Worth Knowing", 3)
    add_body(doc,
        "This is the most important collection. Every landmark, POI, and geofence "
        "trigger in the city lives here. Each document represents one place.")
    add_table(doc,
        ["Field", "Type", "Example", "Purpose"],
        [
            ("name",                   "Text",    "Sagrada Família",         "Display name"),
            ("slug",                   "Text",    "sagrada-familia",         "Unique identifier used in all other collections"),
            ("category",               "Text",    "landmark",                "landmark | dismount_zone | parking | hazard | viewpoint"),
            ("coordinates",            "GeoPoint","41.4036, 2.1744",         "Exact GPS latitude and longitude"),
            ("geofence_radius_metres", "Number",  "40",                      "How close the user must get to trigger the alert"),
            ("short_description",      "Text",    "Gaudí's masterpiece...",  "Shown in the notification banner"),
            ("regulatory_alert",       "Map",     "{fine_eur: 500, ...}",    "Legal warning — triggers red banner in app"),
            ("getyourguide_url",       "Text",    "https://...",             "Affiliate link — future revenue stream"),
            ("is_active",              "Boolean", "true",                    "Set to false to hide without deleting"),
        ],
        col_widths=[1.8, 0.9, 1.8, 2.1]
    )

    add_heading(doc, "Collection 2: quizzes — One Question Per Place", 3)
    add_body(doc,
        "Every landmark has one multiple-choice quiz question. Getting it right "
        "earns the user points and shows an explanation.")
    add_table(doc,
        ["Field", "Example"],
        [
            ("location_slug",       "sagrada-familia"),
            ("question",            "In what year did Gaudí die?"),
            ("options",             '["1916", "1926", "1936", "1946"]'),
            ("correct_option_index","1  (zero-based, so '1926')"),
            ("explanation",         "Gaudí was struck by a tram in 1926, aged 73."),
            ("points_reward",       "15"),
            ("is_active",           "true"),
        ],
        col_widths=[2.0, 4.6]
    )

    add_heading(doc, "Collection 3: faqs — Answers to Common Questions", 3)
    add_body(doc,
        "Each landmark can have up to six FAQs. Some are free, some require a "
        "subscription. They appear as a collapsible accordion in the LandmarkCard.")
    add_table(doc,
        ["Field", "Example"],
        [
            ("location_slug", "sagrada-familia"),
            ("question",      "Can I lock my bike outside the Sagrada Família?"),
            ("answer",        "Yes — there are Bicipark racks on Carrer de Mallorca (east side). Arrive before 9 am on weekends to get a spot."),
            ("sort_order",    "10  (lower = shown first)"),
            ("is_premium",    "false  (visible to all users)"),
            ("is_active",     "true"),
        ],
        col_widths=[2.0, 4.6]
    )

    add_heading(doc, "Collection 4: users — Every User's Progress", 3)
    add_body(doc,
        "One document per user, identified by their Firebase Auth UID. "
        "Tracks everything about the user's journey through the app.")
    add_table(doc,
        ["Field", "Purpose"],
        [
            ("total_points",            "Increases by 10–15 each time the user answers a quiz correctly"),
            ("visited_location_slugs",  "Array of all landmark slugs the user has entered"),
            ("completed_quiz_ids",      "Array of Firestore document IDs — prevents re-answering the same quiz"),
            ("subscription_status",     "'free' or 'active' — gates premium FAQs"),
            ("auth_provider",           "'anonymous' or 'email' — how the user signed in"),
            ("push_notifications_enabled","Whether the user granted notification permission"),
        ],
        col_widths=[2.4, 4.2]
    )

    add_heading(doc, "Collection 5: logistics — Parking, Rules, Fines", 3)
    add_body(doc,
        "Reference data about physical infrastructure: Bicibox stations, Bicipark "
        "racks, legal fines, speed rules. Used primarily to answer FAQ questions "
        "and by the parking locator screen.")

    illus_box(doc,
        "Five filing cabinets side by side, each a different colour, each labelled "
        "with a collection name (locations, quizzes, faqs, users, logistics). "
        "From each cabinet, a sample 'file card' sticks out with 2-3 field names "
        "visible. Dotted lines connect the cards to show how 'location_slug' links "
        "the collections together — like a reference in a real filing system.")

    add_heading(doc, "3.4 · How Data Gets In — The Seed Script", 2)
    add_body(doc,
        "A 'seed script' is a program that loads an initial set of data into an "
        "empty database. Think of it as filling a brand-new library with its first "
        "books. Our seed script (firebase/seed/seed.js) loads:")
    for b in [
        "8 landmark locations (Sagrada Família, Park Güell, Gothic Quarter, Camp Nou, La Barceloneta, Palau de la Música, Casa Batlló, La Rambla)",
        "18 quiz questions — one per landmark (some landmarks have bonus quizzes)",
        "18 FAQ entries across all landmarks",
        "9 logistics entries: Bicibox stations, Bicipark racks, repair stations, fines",
    ]:
        add_bullet(doc, b)
    add_body(doc,
        "The script runs once on a developer's machine with administrator access to "
        "the database. Normal users of the app cannot run it — they can only read data, "
        "not write it in bulk. This is enforced by Firestore Security Rules.")

    add_heading(doc, "3.5 · Security Rules — The Bouncer at the Door", 2)
    add_body(doc,
        "Firebase Security Rules decide who can read or write each collection. "
        "Our rules follow a simple principle: anyone can look, but only the right "
        "person can touch.")
    add_table(doc,
        ["Collection", "Who Can Read", "Who Can Write"],
        [
            ("locations",  "Any signed-in user",            "Admin only (seed script / Firebase Console)"),
            ("quizzes",    "Any signed-in user",            "Admin only"),
            ("faqs",       "Any signed-in user",            "Admin only"),
            ("logistics",  "Any signed-in user",            "Admin only"),
            ("users",      "The user themselves only",      "The user themselves — BUT protected fields (points, subscription) can only be changed by Cloud Functions"),
        ],
        col_widths=[1.5, 1.8, 3.3]
    )

    kid_box(doc,
        "Imagine the database is a museum. Anyone with a ticket (being signed in) "
        "can look at the exhibits. But only the museum director (the admin) can "
        "add or remove exhibits. And each visitor's personal locker (their user "
        "document) can only be opened by them — no one else can peek inside.")

    add_heading(doc, "3.6 · Authentication — Who Are You?", 2)
    add_body(doc,
        "Before a user can read any data, they must be authenticated — the app "
        "must know who they are. We support two types:")
    add_table(doc,
        ["Type", "How It Works", "Best For"],
        [
            ("Anonymous (Guest)",  "Firebase creates a temporary account automatically. No email required. Instant access.", "Users who want to explore immediately without committing"),
            ("Email / Password",   "User provides email and password. Account persists across devices and app reinstalls.",    "Users who want to track progress permanently"),
        ],
        col_widths=[1.6, 2.8, 2.2]
    )
    add_body(doc,
        "In both cases the user receives a unique ID (a UID — like a membership number). "
        "This UID is the key to their personal data in the users collection. "
        "Auth state is saved locally using AsyncStorage, so users stay logged in "
        "across app restarts — they don't need to sign in again every time they open the app.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "FOUR", "THE FRONTEND — WHAT YOU SEE")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 4 · React Native + Expo — One App, Two Phones", 1)
    add_body(doc,
        "If Firebase is the memory of our cycling friend, React Native + Expo is their "
        "body — everything the user can see, tap, and interact with. This chapter explains "
        "what the app looks like structurally and why we chose this framework.", italic=True)

    add_heading(doc, "4.1 · What Is React Native?", 2)
    add_body(doc,
        "React Native is an open-source framework created by Meta (Facebook) that lets "
        "developers write one application that runs natively on both iOS (iPhone) and "
        "Android — without any performance compromise. It translates JavaScript code "
        "into true native UI components: a React Native button becomes a real UIButton "
        "on iOS and a real Button widget on Android.")

    kid_box(doc,
        "React Native is like a universal power adapter. You write one plug shape "
        "— one set of code — and it fits both European and American sockets (iPhone "
        "and Android). Without it, you would need to build two completely separate "
        "plugs from scratch.")

    illus_box(doc,
        "One phone wireframe in the centre. A forking arrow: left branch goes to an "
        "iPhone (iOS logo), right branch goes to an Android phone (Android logo). "
        "Above the wireframe: a single code file icon. Label: 'One codebase → "
        "Two platforms'. The fork is the key visual message.")

    add_heading(doc, "4.2 · What Is Expo?", 2)
    add_body(doc,
        "Expo is a platform built on top of React Native. It adds two things: "
        "a curated library of pre-built native modules (for GPS, notifications, "
        "camera, maps, etc.) and a set of tools that make building and sharing "
        "the app dramatically faster. Without Expo, getting GPS to work on both "
        "iPhone and Android would require writing native code in Swift and Kotlin. "
        "With Expo, it is three lines of JavaScript.")
    add_body(doc,
        "Expo also provides EAS Build — a cloud service that compiles the final "
        "installable app file (the APK for Android, IPA for iOS) without needing "
        "a Mac or a full Android Studio setup. We cover this in Chapter 12.")

    add_heading(doc, "4.3 · Expo Router — The App's Table of Contents", 2)
    add_body(doc,
        "Expo Router handles navigation — deciding which screen appears when. "
        "It uses file-based routing: each screen is a file, and the file path "
        "determines the URL. This is the same idea as a website's folder structure.")

    add_table(doc,
        ["File Path", "Screen", "What the User Sees"],
        [
            ("app/index.tsx",            "Auth Gate",    "Checks if user is logged in. Redirects to map or auth."),
            ("app/auth.tsx",             "Auth Screen",  "Sign in as guest, email login, or email sign-up."),
            ("app/(tabs)/map.tsx",       "Map Tab",      "The interactive city map — the heart of the app."),
            ("app/(tabs)/parking.tsx",   "Parking Tab",  "List of Bicibox and Bicipark stations nearby."),
            ("app/(tabs)/chat.tsx",      "Chat Tab",     "AI assistant — ask anything about Barcelona cycling."),
            ("app/(tabs)/profile.tsx",   "Profile Tab",  "User's points, visited landmarks, sign-out button."),
        ],
        col_widths=[2.2, 1.3, 3.1]
    )

    add_heading(doc, "4.4 · State Management — Zustand", 2)
    add_body(doc,
        "When a user enters a geofence, the app needs to show the landmark's card. "
        "But the geofence detection happens in a background task — completely separate "
        "from the map screen. How do they communicate?")
    add_body(doc,
        "Zustand is our answer. It is a tiny global state library: a shared "
        "whiteboard that any part of the app can read or write. When the background "
        "task detects a geofence entry, it writes the landmark's name and details "
        "onto the whiteboard. The map screen is constantly watching the whiteboard — "
        "when it changes, the card appears instantly.")

    kid_box(doc,
        "Imagine a cork board in the office. Anyone can pin a note. Anyone can "
        "read the notes. When the GPS watchman (background task) pins a note "
        "saying 'We just arrived at Sagrada Família!', the map screen sees it "
        "and immediately shows the information card. That cork board is Zustand.")

    # ── Chapter 5 ────────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 5 · The Map Screen — Seeing Barcelona", 1)
    add_body(doc,
        "The map screen is the heart of the app — the cyclist's window onto the city. "
        "It is always the first tab they see after signing in, and it does more than "
        "simply show a map.", italic=True)

    add_heading(doc, "5.1 · The Map Itself", 2)
    add_body(doc,
        "We use react-native-maps — the most widely used mapping library for React Native. "
        "On Android it uses Google Maps as the rendering engine. On iOS it uses Apple Maps. "
        "Both are the same native map technology the user's phone already uses — familiar, "
        "fast, and gesture-friendly.")
    add_body(doc,
        "We chose not to use a separate paid tile provider (like Mapbox). The native "
        "maps look perfect, require no billing setup, and load faster than any overlay.")

    add_heading(doc, "5.2 · Landmark Markers — Colour-Coded by Category", 2)
    add_body(doc,
        "Every active landmark from the locations collection is shown as a coloured "
        "pin on the map. The colour tells the user what kind of place it is at a glance:")
    add_table(doc,
        ["Category", "Pin Colour", "Examples"],
        [
            ("landmark",       "Blue  (#1565C0)",   "Sagrada Família, Park Güell, Camp Nou"),
            ("dismount_zone",  "Red   (#B71C1C)",   "Gothic Quarter — cycling prohibited"),
            ("parking",        "Green (#2E7D32)",   "Bicipark racks, Bicibox stations"),
            ("hazard",         "Orange (#E65100)",  "Dangerous intersections, road works"),
            ("viewpoint",      "Purple (#4A148C)",  "Scenic overlooks, photo spots"),
        ],
        col_widths=[1.6, 1.8, 3.2]
    )

    add_heading(doc, "5.3 · Real-Time User Location", 2)
    add_body(doc,
        "The app tracks the user's GPS position continuously using "
        "Location.watchPositionAsync() with a 10-metre movement threshold. "
        "This means the map updates the blue 'you are here' dot whenever the "
        "user moves more than 10 metres — frequent enough to feel real-time, "
        "infrequent enough not to drain the battery.")

    add_heading(doc, "5.4 · The Two-Tier Interaction", 2)
    add_body(doc,
        "There are two ways a landmark card can appear on screen:")
    add_table(doc,
        ["Trigger", "What Appears", "How to Dismiss"],
        [
            ("User taps a landmark pin",        "Preview sheet: name, category, distance, short description. Two buttons: 'Ask AI' and 'Full Details'.",  "Tap anywhere outside the sheet"),
            ("User enters the geofence (40m)",  "Full LandmarkCard automatically: quiz, all FAQs, regulatory banner, audio guide, affiliate link.",         "Tap the X button or swipe down"),
        ],
        col_widths=[2.0, 2.6, 2.0]
    )

    add_heading(doc, "5.5 · Bicing Station Overlay", 2)
    add_body(doc,
        "Barcelona's public bike-share system is Bicing. The map shows all Bicing "
        "stations within 1 kilometre of the user's position. Each station appears "
        "as a small circular badge — green if bikes are available, red if empty. "
        "Tapping a Bicing station shows a callout with the count of mechanical "
        "bikes and e-bikes currently docked.")

    illus_box(doc,
        "A screenshot-style mockup of the map screen. Labels pointing to: "
        "a blue dot = 'Your live GPS position', a blue pin = 'Landmark marker', "
        "a red pin = 'Dismount zone (Gothic Quarter)', a green circle badge = "
        "'Bicing station (bikes available)', a red circle badge = 'Bicing station "
        "(empty)', a bottom sheet partially visible = 'Preview sheet on tap'. "
        "The map background shows recognisable Barcelona streets.")

    # ── Chapter 6 ────────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 6 · The LandmarkCard — Deep-Diving Into a Place", 1)
    add_body(doc,
        "The LandmarkCard is the richest UI component in the app. It is the full "
        "information experience for any landmark — the moment where our cycling "
        "friend shares everything they know about a place.", italic=True)

    add_heading(doc, "6.1 · What the Card Contains", 2)
    for item in [
        ("Category chip: ",        "A small coloured label at the top — 'Landmark', 'Dismount Zone', etc."),
        ("Regulatory banner: ",    "A red warning strip (when applicable) — displays the legal rule and fine amount."),
        ("Landmark name + description: ", "The full name and a longer description than the notification."),
        ("Quiz section: ",         "One multiple-choice question. User taps their answer, sees instant feedback and an explanation."),
        ("FAQ accordion: ",        "Up to 6 collapsible questions and answers. Premium FAQs show a lock icon for free users."),
        ("Audio guide button: ",   "Placeholder for a recorded audio guide (future feature)."),
        ("GetYourGuide button: ",  "An affiliate link to book a related guided tour — future revenue stream."),
    ]:
        add_bullet(doc, item[1], bold_prefix=item[0])

    add_heading(doc, "6.2 · The Regulatory Banner", 2)
    add_body(doc,
        "Not every landmark triggers a warning — but when one does, it is unmissable. "
        "A bright red banner appears at the top of the card with the warning message "
        "and fine amount. The banner is triggered by the regulatory_alert field in "
        "the locations collection. Two examples from real Barcelona law:")
    add_table(doc,
        ["Location", "Warning", "Fine"],
        [
            ("Gothic Quarter",    "Do not cycle here. Dismount and walk.",   "€500"),
            ("Park Güell",        "No cycling inside the park boundaries.",  "€500"),
            ("Anywhere in BCN",   "Both earphones while cycling — illegal.", "€100"),
        ],
        col_widths=[2.0, 3.0, 1.6]
    )

    add_heading(doc, "6.3 · The Quiz Flow", 2)
    add_body(doc,
        "The quiz is the gamification heart of the app. The flow works as follows:")
    for step in [
        "User sees the question and four answer options",
        "User taps one option",
        "If correct: the option turns green, an explanation appears, and points are added to their total in Firestore using increment()",
        "If incorrect: the chosen option turns red, the correct option turns green, the explanation still appears (learning happens regardless)",
        "The quiz ID is added to completed_quiz_ids — the user cannot answer the same quiz twice",
    ]:
        add_bullet(doc, step)

    illus_box(doc,
        "An annotated mockup of the LandmarkCard component. Arrows point to each "
        "section with labels: '1 — Red regulatory banner (€500 fine)', "
        "'2 — Category chip (Dismount Zone)', '3 — Name and description', "
        "'4 — Quiz with 4 answer buttons', '5 — FAQ accordion (3 items shown)', "
        "'6 — Audio guide button (greyed out — future)', "
        "'7 — GetYourGuide affiliate button'. The card has a clean white background "
        "with subtle shadows, resembling a hotel information card.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "FIVE", "THE SUPERPOWERS — BORROWED CLOUD SERVICES")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 7 · Geofencing — The Magic Invisible Fence", 1)
    add_body(doc,
        "Geofencing is the single most important technology in this app. Without it, "
        "Barcelona CycleGuide is just a map with some information cards. With it, "
        "the app becomes a proactive guide that speaks without being asked.", italic=True)

    add_heading(doc, "7.1 · What Is Geofencing?", 2)
    add_body(doc,
        "Geofencing means drawing an invisible circular boundary on the map around "
        "a real-world location. When a device crosses that boundary — either entering "
        "or exiting — a piece of code is executed automatically.")
    add_body(doc,
        "In our app: the invisible circle has a radius of 40 metres around each "
        "landmark. The moment the cyclist enters that circle, the geofence fires, "
        "a notification appears, and the full information card is shown — even if "
        "the app is running in the background with the screen off.")

    kid_box(doc,
        "Some pet owners use an invisible electric fence to keep their dog in the "
        "garden. The dog wears a collar. When the dog gets too close to the fence "
        "line, the collar beeps. Our app works exactly the same way — except instead "
        "of a dog collar it is your phone, instead of a beep it is a notification "
        "that says 'You are now entering the Sagrada Família zone!', and instead "
        "of keeping you in, it is welcoming you in.")

    illus_box(doc,
        "A bird's-eye illustration of a Barcelona neighbourhood. Around each "
        "landmark (Sagrada Família, Gothic Quarter, Park Güell) a transparent "
        "circle is drawn — like a spotlight from above, with a dotted border "
        "and the radius labelled '40 m'. A small bicycle icon moves along a "
        "street and is about to cross into the Sagrada Família circle. "
        "An arrow shows the sequence: 'Enters circle → Notification fires → "
        "Information card appears on phone'.")

    add_heading(doc, "7.2 · The 40-Metre Radius — Why That Number?", 2)
    add_body(doc,
        "40 metres is roughly the distance across four car lengths. At cycling speed "
        "(15 km/h) the cyclist crosses 40 metres in about 10 seconds. This gives just "
        "enough time for the notification to appear and the user to react before "
        "they have already passed the landmark.")
    add_body(doc,
        "Some locations use a larger radius. The Gothic Quarter dismount zone uses "
        "100 metres — giving the cyclist time to slow down and dismount before "
        "they are technically inside the prohibited cycling area.")

    add_heading(doc, "7.3 · The Three-Part System", 2)
    add_body(doc,
        "Our geofencing system has three distinct components that work together:")
    add_table(doc,
        ["Component", "File", "What It Does"],
        [
            ("Permission Hook",    "src/hooks/useGeofencing.ts",   "Asks the user for location permission. Fetches all active landmarks from Firestore. Converts them into geofence regions and starts monitoring."),
            ("Background Task",    "src/tasks/geofenceTask.ts",    "Runs silently, even when the app is not in the foreground. On geofence entry: fetches landmark data from Firestore, updates Zustand, fires notification."),
            ("UI Reaction",        "app/(tabs)/map.tsx",           "Watches the Zustand store. When activeSlug changes (geofence entered), fetches quiz and FAQ data and displays the full LandmarkCard."),
        ],
        col_widths=[1.6, 2.0, 3.0]
    )

    add_heading(doc, "7.4 · A Critical Technical Constraint", 2)
    add_body(doc,
        "The background task definition (TaskManager.defineTask) must be written "
        "at the very top of the geofenceTask.ts file — at module level, outside "
        "of any function. This is an absolute requirement of the Expo Task Manager "
        "system. If the task definition is moved inside a function or a class, "
        "it will never execute in the background. This is the single most "
        "important constraint in the entire codebase.")

    add_heading(doc, "7.5 · Why We Abandoned Radar.io", 2)
    add_body(doc,
        "Our original plan was to use Radar.io — a dedicated geofencing-as-a-service "
        "platform. It would have simplified our implementation. However, Radar.io's "
        "enterprise signup form rejected Gmail addresses and required a work email "
        "address from a company domain. Since this project started as an individual "
        "initiative, we had no company email to provide.")
    add_body(doc,
        "Rather than let a signup form stop us, we built our own geofencing engine "
        "using the Haversine formula (see Chapter 10) combined with Expo's native "
        "location APIs. The result is equally precise, completely free, and we have "
        "full control over every aspect of the behaviour.")

    kid_box(doc,
        "We went to buy a ready-made GPS alarm system but the shop required a "
        "business card to buy it. We said: 'Fine — we'll build one ourselves.' "
        "And it turned out to be better than the shop version anyway.")

    # ── Chapter 8 ────────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 8 · Notifications — The Tap on the Shoulder", 1)
    add_body(doc,
        "Our cycling friend's voice reaches you through notifications. This chapter "
        "explains how notifications work technically, and why we chose local "
        "notifications over server-sent push notifications.", italic=True)

    add_heading(doc, "8.1 · Local vs Push Notifications", 2)
    add_table(doc,
        ["Type", "How It Works", "Requires Server?", "Our Choice"],
        [
            ("Local Notification",  "The phone itself decides to show a notification — triggered by code running on the device (e.g. geofence entry).",    "No", "Yes ✓"),
            ("Push Notification",   "A server sends a message to Apple/Google servers, which relay it to the device. Used for marketing emails, breaking news alerts.", "Yes", "No"),
        ],
        col_widths=[1.6, 2.8, 1.3, 0.9]
    )
    add_body(doc,
        "We use local notifications exclusively. When the geofence task detects a "
        "boundary crossing, it immediately schedules a local notification on the "
        "device itself. No internet connection is required. No server is involved. "
        "The notification appears in under one second.")

    add_heading(doc, "8.2 · Two Notification Channels", 2)
    add_body(doc,
        "Android requires notifications to be categorised into channels, which allows "
        "users to control which types they receive. We defined two:")
    add_table(doc,
        ["Channel ID", "Name", "Priority", "Used For"],
        [
            ("landmark-discovery", "Nearby Landmarks", "Default", "Regular landmark entry — 'You are near Sagrada Família!'"),
            ("regulatory-alert",   "Safety Warnings",  "High",    "Legal warnings — 'Gothic Quarter: cycling prohibited. Fine: €500.'"),
        ],
        col_widths=[1.6, 1.6, 0.9, 2.5]
    )

    add_heading(doc, "8.3 · The Permission Flow", 2)
    add_body(doc,
        "On first launch, the app asks for notification permission. "
        "This is mandatory on both iOS and Android — the OS will not allow "
        "notifications without explicit user consent. If the user declines:")
    for b in [
        "Geofencing still works — the user's position is still tracked",
        "The LandmarkCard still appears on screen when a geofence is entered",
        "Only the notification banner is suppressed — the in-app experience is unchanged",
    ]:
        add_bullet(doc, b)

    kid_box(doc,
        "A notification is like a friend tapping you on the shoulder and whispering "
        "'Hey! Did you know that building behind you was designed by Gaudí?' "
        "You can tell a friend 'please don't tap me on the shoulder' — and they will "
        "respect that. But they will still walk alongside you and show you the "
        "information card when you ask for it.")

    illus_box(doc,
        "A phone screen with a notification banner sliding down from the top. "
        "The banner reads: 'You are near Sagrada Família — Tap to learn more'. "
        "Below it, a second banner in red reads: 'REGULATORY ALERT: Gothic Quarter — "
        "No cycling. Fine: €500.' An arrow from the second banner points to a "
        "small icon of an invisible fence circle on a mini-map.")

    # ── Chapter 9 ────────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 9 · The AI Chat — Our Friend's Brain", 1)
    add_body(doc,
        "Our cycling friend is not just a tour guide — they are also a conversationalist. "
        "Ask them anything about Barcelona cycling, and they answer intelligently, "
        "in your language, with full awareness of where you are standing.", italic=True)

    add_heading(doc, "9.1 · What Is a Large Language Model?", 2)
    add_body(doc,
        "A Large Language Model (LLM) is an AI system trained on an enormous amount "
        "of text — books, websites, scientific papers, conversations — until it "
        "develops a deep, flexible understanding of language and knowledge. When "
        "you ask it a question, it generates a human-quality answer based on "
        "patterns it learned during training.")
    add_body(doc,
        "We use Claude, made by Anthropic — one of the leading AI safety companies. "
        "Claude is known for being careful, honest, and context-aware. We access "
        "it via the Anthropic API: we send a request with the user's question "
        "(plus context) and receive a written response.")

    kid_box(doc,
        "Imagine a friend who has read every book, guidebook, news article, and "
        "travel blog about Barcelona ever written. Then imagine they also know "
        "exactly where you are standing right now, and they speak every language "
        "fluently. That friend is the AI. The difference from a real friend: "
        "the AI friend never gets tired, never charges by the hour, and is always "
        "ready to help.")

    add_heading(doc, "9.2 · The System Prompt — Giving the AI Its Personality", 2)
    add_body(doc,
        "An LLM like Claude has no memory of who you are or where you are by default. "
        "Every conversation starts fresh. To make Claude act as a Barcelona cycling "
        "expert who knows your location, we send a 'system prompt' at the start of "
        "every conversation. The system prompt is a block of text that sets the context.")
    add_body(doc,
        "Our system prompt includes:")
    for item in [
        ("User coordinates: ",        "The user's exact GPS latitude and longitude at the moment they open the chat"),
        ("Nearby landmarks: ",        "Names, distances, categories, and descriptions of all landmarks within 500 metres"),
        ("Active geofence: ",         "If the user is currently inside a geofence, the full landmark details are included"),
        ("Cycling regulations: ",     "The €500 sidewalk fine, the €100 earphones fine, Gothic Quarter dismount rules"),
        ("Language instruction: ",    "Respond in the same language as the user's message"),
        ("Persona instruction: ",     "You are a friendly, knowledgeable Barcelona cycling guide"),
    ]:
        add_bullet(doc, item[1], bold_prefix=item[0])

    add_heading(doc, "9.3 · Language Detection", 2)
    add_body(doc,
        "Barcelona attracts visitors from dozens of countries. Our AI chat "
        "automatically responds in whatever language the user writes in. "
        "Write in French — get a French reply. Write in Spanish — Spanish reply. "
        "Write in Catalan — Catalan reply. This required no extra code: we simply "
        "include 'Respond in the same language as the user' in the system prompt, "
        "and Claude handles the rest natively.")

    add_heading(doc, "9.4 · The Ask AI Button on the Map", 2)
    add_body(doc,
        "When a user taps 'Ask AI about this place' on a landmark preview sheet, "
        "the chat tab opens automatically with a pre-filled question about that "
        "specific landmark. This is implemented via Zustand's chatPrefill field: "
        "the map screen writes the prefill message, the chat screen reads it "
        "and populates the input.")

    add_heading(doc, "9.5 · Why Direct Fetch Instead of the Official SDK", 2)
    add_body(doc,
        "Anthropic provides an official JavaScript SDK (@anthropic-ai/sdk). "
        "However, the SDK imports Node.js built-in modules (like 'net' and 'tls') "
        "that do not exist in a React Native environment. Using the SDK directly "
        "causes crashes. Our solution: a direct fetch() call to the Anthropic REST "
        "API, bypassing the SDK entirely. This is fully supported and documented "
        "by Anthropic for mobile environments.")

    illus_box(doc,
        "A chat conversation mockup. Left side: user message in French — "
        "'Puis-je stationner mon vélo ici?' (Can I park my bike here?). "
        "Right side: AI response in French, referring to a Bicipark station "
        "100 metres away. Below: a callout showing the invisible system prompt "
        "— a grey box with small text: 'User is at 41.3836, 2.1734. Nearest "
        "landmark: Sagrada Família (85m). Cycling rule: €500 fine on sidewalks.'")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "SIX", "THE UTILITY FEATURES")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 10 · Parking — Finding a Safe Spot", 1)
    add_body(doc,
        "A cyclist's worst nightmare: arriving at a destination with no safe place "
        "to lock their bike. The parking screen solves this with real-time data "
        "from Barcelona's own government open-data platform.", italic=True)

    add_heading(doc, "10.1 · Two Types of Parking", 2)
    add_table(doc,
        ["Type", "What It Is", "How to Use It", "Security"],
        [
            ("Bicibox",  "A secure, enclosed metal locker for one bicycle.", "Reserve via the Bicibox mobile app. The app gives you a PIN. Enter the PIN at the station.",   "High — fully enclosed, PIN-protected"),
            ("Bicipark", "An open metal rack. Lock your own bike to it.",    "No reservation needed. Ride up, lock your bike with your own lock to the stand, leave.",      "Medium — open air, requires your own lock"),
        ],
        col_widths=[1.0, 2.0, 2.2, 1.4]
    )

    add_heading(doc, "10.2 · Barcelona Open Data — Free Government Data", 2)
    add_body(doc,
        "Barcelona City Council publishes its data publicly through a platform "
        "called CKAN (the same open-data standard used by the EU, the UK government, "
        "and dozens of cities worldwide). The Bicibox and Bicipark datasets are "
        "updated regularly and accessible with a simple HTTP request — completely free, "
        "no API key required.")
    add_body(doc,
        "We fetch both datasets on every screen load and filter the results "
        "to show only stations within 1 kilometre of the user's current position.")

    add_heading(doc, "10.3 · The Haversine Formula — Distance on a Sphere", 2)
    add_body(doc,
        "GPS coordinates are points on the surface of a sphere (the Earth). "
        "You cannot calculate the distance between two GPS coordinates using "
        "simple subtraction — the Earth's curvature means straight-line math "
        "gives the wrong answer. The Haversine formula is the standard mathematical "
        "equation for calculating the shortest distance between two points on a sphere.")

    kid_box(doc,
        "Calculating distance from GPS coordinates is like measuring the shortest "
        "path between two cities on a globe — not following roads, not measuring "
        "a flat map, but finding the actual curved path along the Earth's surface. "
        "Haversine is the maths that solves this correctly.")

    add_heading(doc, "10.4 · The Comma-Decimal Bug — A Real Story", 2)
    add_body(doc,
        "During development, the parking screen showed 'No bike parking within 500m' "
        "for every user — even in central Barcelona. After investigation, we discovered "
        "the cause: Barcelona's open-data platform stores GPS coordinates in the "
        "Spanish locale format, using commas as decimal separators instead of dots.")
    add_body(doc,
        "The coordinate 41.38567 (the standard format) was stored as 41,38567. "
        "When our code read the value and converted it to a number, JavaScript "
        "interpreted it as 41 (stopping at the comma). The resulting distance "
        "calculation showed all parking stations as being ~42 km away — completely "
        "outside our 1 km filter radius.")
    add_body(doc,
        "The fix was one line of code in parkingFilter.ts:")
    add_body(doc,
        "parseFloat(String(s['LATITUD']).replace(',', '.'))",
        italic=True, color=C_BLUE)
    add_body(doc,
        "This converts '41,38567' to '41.38567' before parsing. Simple fix, "
        "but it required careful debugging to find. This is a good example of "
        "how real-world data can have unexpected formats that break otherwise "
        "correct code.")

    kid_box(doc,
        "Imagine you asked someone to write down a number and they wrote '3,14' "
        "instead of '3.14'. If your calculator reads the comma as a separator, "
        "it thinks the number is just '3' — completely wrong. We had to teach "
        "our app to always check for Spanish commas and replace them with dots "
        "before doing any maths.")

    illus_box(doc,
        "Two parking card mockups side by side. Left card labelled 'Bicibox': "
        "shows a lock icon, name 'Bicibox Plaça Catalunya', distance '320m', "
        "a PIN badge, and a button 'Get PIN Code'. Right card labelled 'Bicipark': "
        "shows an open rack icon, name 'Bicipark Passeig de Gràcia', distance '180m', "
        "and a button 'Get Directions'. Cards have subtle colour coding: "
        "Bicibox in blue, Bicipark in green.")

    # ── Chapter 11 ───────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 11 · Authentication and User Progress", 1)
    add_body(doc,
        "Every cycling friend remembers where you've been together. Our app does "
        "the same — tracking your progress, rewarding your curiosity, and keeping "
        "your data private.", italic=True)

    add_heading(doc, "11.1 · Two Ways to Sign In", 2)
    add_table(doc,
        ["Method", "How It Works", "Data Persistence", "Best For"],
        [
            ("Explore as Guest\n(Anonymous)", "Firebase automatically creates a temporary account. No email, no password, instant access.",      "Saved on this device only. Lost if app is uninstalled.", "Tourists who want immediate access"),
            ("Email / Password",              "User provides an email and password. A permanent account is created in Firebase Auth.",            "Permanent. Syncs across devices and reinstalls.",        "Repeat users who want lasting progress"),
        ],
        col_widths=[1.6, 2.2, 1.7, 1.1]
    )

    add_heading(doc, "11.2 · What Gets Tracked", 2)
    for item in [
        ("Total Points: ", "Increases by 10–15 each time the user answers a quiz question correctly. Displayed on the Profile screen."),
        ("Visited Locations: ", "An array of landmark slugs the user has physically entered (triggered by geofence). Also displayed on Profile."),
        ("Completed Quizzes: ", "An array of quiz document IDs. Prevents the same quiz appearing twice — the user always gets a fresh challenge."),
        ("Subscription Status: ", "'free' (default) or 'active' (paid). Controls which FAQs are visible."),
    ]:
        add_bullet(doc, item[1], bold_prefix=item[0])

    add_heading(doc, "11.3 · Gamification — Why Points Matter", 2)
    add_body(doc,
        "Gamification is the use of game-like mechanics (points, progress bars, "
        "achievements) in a non-game context to increase engagement. Research shows "
        "that people are more likely to continue an activity when they can see "
        "measurable progress.")
    add_body(doc,
        "In our app, earning points for correctly answering quiz questions about "
        "Barcelona's history encourages users to pay attention to the landmarks "
        "they encounter — not just cycle past them. The visited-landmark counter "
        "on the Profile screen gives a sense of accomplishment and motivates "
        "users to explore more of the city.")

    add_heading(doc, "11.4 · Subscription Model", 2)
    add_body(doc,
        "Premium FAQs (marked is_premium: true in the faqs collection) are visible "
        "only to users with subscription_status: 'active'. Free users see a lock "
        "icon on premium FAQs. A 'Upgrade' button links to a Stripe payment page "
        "(placeholder — not yet fully implemented in v1.0).")

    illus_box(doc,
        "Two parallel flow diagrams. Left path: 'Explore as Guest' button → "
        "anonymous account created instantly → map appears. Right path: 'Sign Up' "
        "button → email/password form → permanent account created → map appears. "
        "Both paths end at the same map screen. A badge at the top of each path "
        "shows what the user gets: left = 'Progress saved on device', "
        "right = 'Progress saved forever, syncs across phones'.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "SEVEN", "DEPLOYMENT — FROM CODE TO PHONE")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 12 · Sharing the App — From Code to Phone", 1)
    add_body(doc,
        "Our cycling friend is built. Now we need to send them into the world — "
        "onto the phones of real users without requiring everyone to be a developer "
        "or to connect their phone to a computer.", italic=True)

    add_heading(doc, "12.1 · The Challenge of Mobile Distribution", 2)
    add_body(doc,
        "Unlike a website (where you just share a URL), mobile apps must be compiled "
        "into a specific file format for each platform before they can be installed:")
    add_table(doc,
        ["Platform", "File Format", "Normal Route", "Our Route"],
        [
            ("Android", "APK or AAB", "Google Play Store (days of review)", "Direct APK download link — instant"),
            ("iOS",     "IPA",        "Apple App Store (weeks of review + $99/year)", "Expo Go app + EAS Update (minutes)"),
        ],
        col_widths=[1.0, 1.3, 2.3, 2.0]
    )

    add_heading(doc, "12.2 · EAS Build — Cloud Compilation", 2)
    add_body(doc,
        "EAS Build (Expo Application Services) is a cloud service provided by Expo. "
        "Instead of needing a Mac with Xcode or a Windows machine with Android Studio "
        "to compile the app, you push your code to Expo's servers and they compile "
        "it for you in the cloud. The result is a download link — a file that anyone "
        "can install on their phone.")
    add_body(doc,
        "For Android testers: they receive the download link, tap it on their "
        "Android phone, approve the 'install from unknown sources' prompt, and "
        "the app installs exactly like any Play Store app — with all features working.")

    add_heading(doc, "12.3 · iOS Distribution via Expo Go", 2)
    add_body(doc,
        "For iPhone users during testing, we use Expo Go — a free app available "
        "on the App Store. Testers install Expo Go once, then scan a QR code to "
        "load our app. The QR code changes each time we publish an update via "
        "EAS Update — so testers always get the latest version automatically.")
    add_body(doc,
        "Limitation: Background geofencing does not work inside Expo Go. "
        "For full geofencing in the background on iOS, a proper EAS Build "
        "with Apple Developer Program enrollment ($99/year) is required. "
        "For the foreground experience and all other features, Expo Go works perfectly.")

    add_heading(doc, "12.4 · Environment Variables — Never Hardcode a Secret", 2)
    add_body(doc,
        "Our app connects to Firebase, Google Maps, and Anthropic AI — all of which "
        "require API keys (secret access codes). We never write these keys directly "
        "in the code. Instead, they live in a file called .env that is never "
        "committed to the git repository.")
    add_table(doc,
        ["Variable Name", "What It Does"],
        [
            ("EXPO_PUBLIC_FIREBASE_API_KEY",            "Authenticates our app with Firebase"),
            ("EXPO_PUBLIC_FIREBASE_PROJECT_ID",         "Identifies which Firebase project to use (bike-tour-d0334)"),
            ("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",         "Enables Google Maps on Android"),
            ("EXPO_PUBLIC_ANTHROPIC_API_KEY",           "Authenticates our Claude AI requests"),
        ],
        col_widths=[3.2, 3.4]
    )
    add_body(doc,
        "The EXPO_PUBLIC_ prefix tells Expo to include the variable in the compiled "
        "app bundle. This is acceptable for Firebase client keys (access is controlled "
        "by Firestore Security Rules, not by the key alone). The Google Maps and "
        "Anthropic keys should be restricted by platform in their respective consoles.")

    add_heading(doc, "12.5 · The Package Name — Designed to Scale", 2)
    add_body(doc,
        "Every mobile app has a unique package name: com.biketourguide.app. "
        "We deliberately chose a generic name rather than com.barcelonacycleguide. "
        "This reflects our scalability goal: the same app, with the same codebase, "
        "can eventually serve cyclists in Paris, London, Amsterdam, or any other "
        "city — just by adding new data to Firebase. The package name does not "
        "limit us to one city.")

    illus_box(doc,
        "A flow diagram showing the deployment pipeline. Left: developer's laptop "
        "with code. Arrow labelled 'git push' goes to a GitHub repository. "
        "Arrow from GitHub goes to 'EAS Cloud Build Servers'. Two output arrows: "
        "one goes to an Android phone icon with label 'APK download link → "
        "Android testers install directly', the other goes to an iPhone with "
        "Expo Go logo and label 'QR code → iOS testers scan with Expo Go'.")

    kid_box(doc,
        "Imagine you baked a cake (your app) and want to send pieces to friends "
        "around the world. EAS Build is the bakery that packages each slice "
        "perfectly for each country's postal system. Android friends get their "
        "slice in a box they can open right away. iPhone friends get a special "
        "voucher they can redeem at a local pickup point (Expo Go).")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "EIGHT", "THE DEVELOPMENT JOURNEY — THE FULL STORY")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 13 · How We Built This — The Full Story", 1)
    add_body(doc,
        "No software project goes in a straight line from idea to finished product. "
        "This chapter tells the honest, chronological story of how Barcelona CycleGuide "
        "was built — including every wrong turn, every blocked road, and every "
        "smarter route we found instead.", italic=True)

    illus_box(doc,
        "A winding road map viewed from above. The road has labelled forks and "
        "detours: 'Start: The Idea' → 'FlutterFlow (blocked: free plan limits)' → "
        "fork right to 'React Native + Expo' → 'Radar.io (blocked: no Gmail)' → "
        "fork right to 'Custom Geofencing' → 'Bicibox data bug (commas)' → "
        "fixed → 'Composite index error' → fixed → 'Map tile flickering' → "
        "fixed → 'Destination: Working App'. Each detour is a different colour. "
        "The final destination has a checkered flag.")

    steps = [
        ("Step 1 — The Original Plan: FlutterFlow",
         "We began with FlutterFlow — a visual, no-code/low-code builder for Flutter apps. "
         "It was fast to prototype and required minimal coding. We had a working Firebase "
         "connection and a map screen within days."),
        ("Step 2 — The First Blocked Road: Third-Party Packages",
         "FlutterFlow's free plan blocked all third-party packages. We needed "
         "expo-location for GPS, expo-task-manager for background geofencing, and "
         "the Anthropic AI SDK. None of these could be added on the free plan without "
         "paying for an enterprise subscription. Rather than pay for limited flexibility, "
         "we made the decision to fully migrate."),
        ("Step 3 — The Pivot: Flutter Export → React Native",
         "We exported the Flutter code from FlutterFlow and then rebuilt the entire "
         "app in React Native + Expo. This was a significant effort — rebuilding every "
         "screen, reconnecting Firebase, and restructuring the navigation — but it gave "
         "us complete freedom to use any library we needed."),
        ("Step 4 — Firebase Setup",
         "We set up Firebase Firestore from scratch: created the 5 collections, "
         "designed the schema, wrote the security rules, and created the seed script "
         "to load initial data. We also configured Firebase Auth with anonymous sign-in "
         "and email/password."),
        ("Step 5 — The Second Blocked Road: Radar.io",
         "We attempted to use Radar.io for geofencing. Radar.io's enterprise signup "
         "form required a work email address — Gmail was rejected. We pivoted immediately "
         "to building our own geofencing engine using expo-location, expo-task-manager, "
         "and the Haversine formula."),
        ("Step 6 — Geofencing Implementation",
         "We built the three-part geofencing system: the useGeofencing hook (permissions "
         "and startup), the geofenceTask background handler, and the Zustand store "
         "connecting them to the map UI. In Expo Go, geofencing works only in the "
         "foreground — background support requires an EAS development build."),
        ("Step 7 — The Parking Comma-Decimal Bug",
         "Barcelona's Open Data platform returned coordinates as '41,38567' (Spanish "
         "locale with comma decimals). JavaScript's parseFloat() stopped at the comma, "
         "treating all coordinates as ~41°, making every parking station appear 42 km "
         "away. Fixed with a .replace(',','.') call before parsing."),
        ("Step 8 — Firestore Composite Index Error",
         "Our FAQ query combined where('location_slug') + where('is_active') + "
         "orderBy('sort_order') — which Firestore requires a composite index for. "
         "Rather than wait 10 minutes for an index to build (and create a dependency "
         "on the Firebase Console), we removed the server-side filters and performed "
         "the filtering and sorting client-side instead."),
        ("Step 9 — Map Tile Flickering",
         "OpenStreetMap UrlTile overlay caused a black-and-white flickering effect "
         "on pinch-zoom. The fix: remove the UrlTile overlay entirely and use the "
         "native Apple Maps / Google Maps rendering, which is smoother and "
         "better-looking without any additional configuration."),
        ("Step 10 — Duplicate Markers from Double Seeding",
         "Running the seed script twice created duplicate landmark documents in "
         "Firestore. On the map, Sagrada Família appeared twice. Fix: added "
         "client-side deduplication using a Set of slugs — only the first occurrence "
         "of each slug is rendered."),
        ("Step 11 — AI Chat Integration",
         "We integrated the Anthropic Claude API using a direct fetch() call (bypassing "
         "the SDK to avoid Node.js built-in conflicts). The system prompt gives Claude "
         "the user's coordinates, nearby landmarks, and Barcelona regulations. Auto-language "
         "detection works out of the box."),
        ("Step 12 — EAS Build for Android Distribution",
         "We installed eas-cli, created eas.json with an 'internal' distribution preview "
         "profile, and ran eas build to compile the first Android APK in the cloud. "
         "Android testers can now download and install the app directly via a link."),
    ]
    for step_title, step_body in steps:
        add_heading(doc, step_title, 2)
        add_body(doc, step_body)

    kid_box(doc,
        "Every great explorer tries some roads that turn out to be dead ends. "
        "Columbus was looking for India. He found America. We were building with "
        "FlutterFlow. We found React Native. Dead ends are not failures — they "
        "are redirections toward better routes.")

    # ════════════════════════════════════════════════════════════════════════
    add_part_title(doc, "NINE", "REFERENCE — JUSTIFICATION LOG & GLOSSARY")
    # ════════════════════════════════════════════════════════════════════════

    add_heading(doc, "Chapter 14 · Technical Justification Log", 1)
    add_body(doc,
        "For every major technology decision in this project, we record the reason "
        "it was chosen, what alternatives were considered, and why those alternatives "
        "were not selected. This log serves as a future-proof record that prevents "
        "the same evaluation being repeated from scratch.", italic=True)

    justifications = [
        (
            "React Native + Expo",
            "Mobile UI Framework",
            ["Write once, run on both iOS and Android — no duplicate codebase",
             "Expo provides first-class support for GPS, notifications, maps, and deployment",
             "Massive community, excellent documentation, actively maintained by Meta + Expo",
             "Free and open-source — no licensing cost"],
            "Free tier — open source",
            "Flutter (Google), Native iOS/Android",
            "Flutter/FlutterFlow blocked third-party packages on the free plan. Native iOS "
            "and Android would require two separate codebases, two skill sets, and double "
            "the development time."
        ),
        (
            "Expo Router v6",
            "Navigation",
            ["File-based routing — every screen is a file, navigation is self-documenting",
             "Deep linking built in — any screen can be opened from a notification URL",
             "Part of the Expo ecosystem — zero configuration needed"],
            "Free (included with Expo)",
            "React Navigation",
            "React Navigation is excellent but requires manual configuration of navigators "
            "and routes. Expo Router handles this automatically based on file names, "
            "reducing boilerplate and making the codebase easier to navigate."
        ),
        (
            "Firebase Firestore",
            "Database (Backend)",
            ["No server to manage — Google handles all infrastructure",
             "Real-time listeners — UI updates instantly when data changes",
             "Flexible NoSQL schema — different landmarks can have different fields",
             "Generous free tier (Spark plan) covers our full development phase"],
            "Free tier: 50k reads/day, 20k writes/day, 20k deletes/day",
            "PostgreSQL (Supabase), PlanetScale (MySQL), MongoDB Atlas",
            "SQL databases (Supabase, PlanetScale) require a fixed schema and more "
            "complex setup for real-time subscriptions. MongoDB Atlas is comparable "
            "but Firebase has tighter integration with React Native via the JS SDK "
            "and handles auth + database in one product."
        ),
        (
            "Firebase Auth",
            "Authentication",
            ["Anonymous sign-in — users can try the app without registering",
             "Email/password built in — no extra service needed",
             "UID integrates directly with Firestore Security Rules",
             "Session persistence via AsyncStorage — users stay logged in"],
            "Free (included with Firebase)",
            "Auth0, Clerk, Supabase Auth, Custom JWT",
            "Auth0 and Clerk add external dependencies and cost. Supabase Auth is "
            "tied to a PostgreSQL backend we are not using. Custom JWT requires "
            "server infrastructure. Firebase Auth integrates natively with Firestore "
            "with zero additional setup."
        ),
        (
            "Custom Haversine Geofencing\n(expo-location + expo-task-manager)",
            "Location Awareness",
            ["Full control over geofence logic — radius, timing, data source",
             "No third-party SaaS dependency — works offline",
             "No signup or API key required",
             "Expo's Location API is well-maintained and battle-tested on both platforms"],
            "Free — uses device GPS only",
            "Radar.io, Google Places Geofencing API",
            "Radar.io rejected our Gmail address during signup. Google Places Geofencing "
            "requires a paid Maps Platform billing account and has per-call pricing. "
            "Our custom implementation is simpler, cheaper, and fully within our control."
        ),
        (
            "Zustand v5",
            "State Management",
            ["Minimal boilerplate — a store is just a function",
             "No Provider wrapper required — any component can access state directly",
             "Works across background tasks and UI components (critical for geofencing)",
             "Tiny bundle size (~1KB)"],
            "Free — open source",
            "Redux Toolkit, React Context API, Jotai",
            "Redux requires significant boilerplate for simple state. React Context "
            "re-renders all consumers on any state change — too expensive for a map "
            "that constantly updates. Jotai is comparable but Zustand's API is "
            "slightly more natural for background-to-UI communication."
        ),
        (
            "react-native-maps + Native Maps",
            "Map Rendering",
            ["Uses Apple Maps on iOS and Google Maps on Android — the same maps users already know",
             "No additional billing — native maps have no per-tile cost",
             "Fastest possible rendering — hardware-accelerated by the OS",
             "No flickering — native rendering is smoother than tile overlays"],
            "Free (native — no tile billing)",
            "Mapbox, Google Maps SDK (explicit), OpenStreetMap UrlTile overlay",
            "Mapbox charges per map load after free tier. An explicit Google Maps SDK "
            "setup requires API key billing configuration. Our original OSM UrlTile "
            "overlay caused black-and-white flickering on pinch-zoom — removed in favour "
            "of native maps which have no overlay and no flickering."
        ),
        (
            "Anthropic Claude API\n(claude-sonnet-4-6)",
            "AI Chat / Intelligence",
            ["Context window large enough to hold full system prompt + conversation history",
             "Excellent multilingual performance — critical for international users",
             "Careful, safety-aware responses — appropriate for a public-facing consumer app",
             "Direct REST API access — no SDK required in mobile environment"],
            "Pay-per-token — approximately $0.003 per 1,000 input tokens",
            "OpenAI GPT-4, Google Gemini, On-device LLM",
            "OpenAI GPT-4 is comparable in quality but lacks Anthropic's specific focus on "
            "safety and careful factual responses. Google Gemini has weaker multilingual "
            "performance in testing. On-device LLMs (e.g. Llama 3) are too large to embed "
            "in a mobile app and have significantly lower quality."
        ),
        (
            "Barcelona Open Data CKAN API",
            "Parking Data Source",
            ["Official government data — always up-to-date with city infrastructure changes",
             "Completely free — no API key, no rate limiting for reasonable use",
             "Covers all Bicibox (secure lockers) and Bicipark (open racks) in the city"],
            "Free — public government API",
            "Bicing GBFS API (api.bsmsa.eu), Manual database entry",
            "The Bicing GBFS API (Barcelona's bike-share system) returned HTML responses "
            "instead of JSON when accessed from a mobile device — indicating the endpoint "
            "blocks non-browser user agents. Manual database entry would require constant "
            "maintenance as parking infrastructure changes."
        ),
        (
            "EAS Build",
            "App Compilation & Distribution",
            ["Cloud build — no Mac or Android Studio required on the developer's machine",
             "Produces both APK (Android direct install) and IPA (iOS App Store)",
             "Free tier: 30 builds per month — more than sufficient for testing phase",
             "Seamless integration with Expo ecosystem"],
            "Free tier: 30 builds/month",
            "Local Xcode/Android Studio build, Bitrise, Fastlane",
            "Local builds require a Mac for iOS (we work on Windows/Linux), "
            "a full Android Studio setup for Android, and significant configuration time. "
            "Bitrise and Fastlane are powerful CI/CD tools but have steeper learning curves "
            "and are designed for larger teams with existing pipelines."
        ),
    ]

    for tool, category, reasons, cost, alternatives, why_not in justifications:
        add_heading(doc, tool, 2)
        add_table(doc,
            ["Field", "Details"],
            [
                ("Category",             category),
                ("Cost",                 cost),
                ("Alternative Considered", alternatives),
                ("Why We Didn't Use It", why_not),
            ],
            col_widths=[1.8, 4.8]
        )
        add_body(doc, "Why we chose it:")
        for r in reasons:
            add_bullet(doc, r)
        add_divider(doc)

    # ── Chapter 15 ───────────────────────────────────────────────────────────
    add_heading(doc, "Chapter 15 · Master Glossary", 1)
    add_body(doc,
        "Every technical term used in this document and in the codebase is defined "
        "here in plain English. Use this chapter as a reference whenever you encounter "
        "an unfamiliar word.", italic=True)

    glossary = [
        ("API (Application Programming Interface)",
         "A set of rules that allows two software systems to talk to each other. When our app asks "
         "Anthropic for an AI response, it uses Anthropic's API — like a waiter (the API) taking "
         "our order (the request) to the kitchen (Anthropic's servers) and bringing back the food (the response)."),
        ("APK (Android Package Kit)",
         "The file format for Android applications. Like a .exe file on Windows, but for Android phones. "
         "You can install an APK directly on an Android device without going through the Play Store."),
        ("AsyncStorage",
         "A simple key-value storage system built into React Native for saving small pieces of data "
         "on the device permanently — like the user's login state. Similar to cookies in a web browser."),
        ("Anonymous Auth (Anonymous Authentication)",
         "A Firebase feature that creates a temporary user account automatically without requiring any "
         "email or password. The user gets a unique ID immediately and can use all app features. "
         "If they uninstall the app, the account is gone."),
        ("Background Task",
         "A piece of code that runs even when the app is not visibly on screen — for example, when the "
         "phone's screen is off or another app is open. Background tasks require special permission "
         "from the operating system."),
        ("CKAN",
         "The Comprehensive Knowledge Archive Network — an open-source platform used by governments "
         "and organisations worldwide to publish their data publicly. Barcelona City Council uses CKAN "
         "to share its transport, parking, and infrastructure data for free."),
        ("Client-Side Filtering",
         "Downloading all data from the server and then filtering it locally on the user's device, "
         "as opposed to sending a filtered query to the server. Simpler to implement but uses more "
         "data bandwidth."),
        ("Component",
         "A reusable building block of a mobile or web interface. Like a LEGO brick — a component "
         "is designed once (e.g. ParkingCard, LandmarkCard) and can be placed on any screen any "
         "number of times."),
        ("Composite Index (Firestore)",
         "A pre-built lookup structure that Firebase creates to speed up queries that filter on "
         "more than one field simultaneously. Without a composite index, Firestore refuses to run "
         "the query."),
        ("Deduplication",
         "The process of removing duplicate entries from a list. In our app, we deduplicate landmarks "
         "by their slug before rendering — so if a landmark accidentally exists twice in the database, "
         "only one marker appears on the map."),
        ("EAS Build (Expo Application Services)",
         "A cloud service from Expo that compiles your React Native code into an installable app file "
         "(APK for Android, IPA for iOS) without needing a local Mac or Android Studio. The build "
         "happens on Expo's servers, and you receive a download link when it is done."),
        ("Environment Variable (.env)",
         "A variable whose value is set outside the application code — typically in a file called .env. "
         "Used to store secrets like API keys so they are never accidentally committed to a public "
         "code repository."),
        ("Expo",
         "A platform built on top of React Native that adds a library of pre-built native modules "
         "(GPS, camera, notifications, etc.) and a suite of tools for building and distributing apps "
         "faster. Think of it as React Native with superpowers pre-installed."),
        ("Expo Go",
         "A free app (available on the App Store and Play Store) that lets you preview a React Native "
         "app without installing it. You scan a QR code and the app loads immediately. Used for testing "
         "and sharing work-in-progress builds."),
        ("Expo Router",
         "A file-based navigation library for React Native. The file path of each screen file "
         "determines its URL/route in the app — similar to how a website's folder structure "
         "determines its URLs."),
        ("Firebase",
         "A platform made by Google that provides a suite of cloud services for mobile and web apps: "
         "a database (Firestore), authentication (Auth), file storage (Storage), and more. "
         "The free tier is generous enough for development and early growth."),
        ("Firestore",
         "Firebase's cloud database. It stores data as documents (like pages in a notebook) organised "
         "into collections (like bookshelves). It supports real-time listeners — the app's UI can "
         "update the moment data changes, without refreshing."),
        ("Foreground vs Background (task)",
         "Foreground: the app is open and visible on screen. Background: the app is running but "
         "not visible — the screen may be off, or another app is in front. Background tasks "
         "continue executing in the background, but require special OS permission to do so."),
        ("GBFS (General Bikeshare Feed Specification)",
         "An open data standard for bike-share systems. Bicing (Barcelona's public bike-share) "
         "publishes its station data in GBFS format. However, their API endpoint was found to "
         "return HTML (not JSON) when accessed from a mobile device — so we used Open Data BCN instead."),
        ("GeoPoint",
         "A Firestore data type that stores a geographic coordinate: one latitude value and one "
         "longitude value, representing a precise point on the Earth's surface."),
        ("Geofence / Geofencing",
         "An invisible virtual boundary drawn around a real-world location. When a device enters "
         "or exits the boundary, a piece of code is triggered. Our geofences are circles with a "
         "40-metre radius centred on each landmark."),
        ("Geofence Radius",
         "The size of the invisible circle around a geofence location. Our default is 40 metres "
         "(roughly four car lengths). The Gothic Quarter dismount zone uses 100 metres — large "
         "enough to give cyclists time to slow down and dismount before entering."),
        ("Haversine Formula",
         "A mathematical formula for calculating the great-circle distance between two points on "
         "a sphere (such as the Earth) given their GPS coordinates. Essential for measuring real-world "
         "distances between coordinates accurately, accounting for the Earth's curvature."),
        ("Hook (React Hook)",
         "A function in React that lets a component access special features like state, lifecycle "
         "events, or shared logic. Our useGeofencing hook, for example, handles all permission "
         "requests and geofence setup in one reusable function."),
        ("IPA (iOS App Archive)",
         "The file format for iOS applications. Like an APK for Android, but for iPhones. "
         "Distributing an IPA outside the App Store requires an Apple Developer account."),
        ("Latency",
         "The time delay between sending a request and receiving a response. Low latency = fast. "
         "High latency = slow. In our app, we minimise latency by using local notifications "
         "(no server round-trip) and client-side geofencing (no API call to check boundaries)."),
        ("LLM (Large Language Model)",
         "An AI system trained on vast amounts of text that can understand and generate human language. "
         "Examples: Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google). In our app, Claude "
         "acts as an intelligent Q&A assistant."),
        ("Metro Bundler",
         "The JavaScript bundler used by React Native. It takes all your code files and bundles "
         "them into a single file that the phone can run. Think of it as a packaging machine "
         "that wraps all your code into one deliverable."),
        ("Navigation Stack",
         "In mobile apps, a navigation stack is like a pile of cards. When you navigate to a new "
         "screen, a card is added to the top of the pile. When you go back, the top card is removed "
         "and you see the one below it."),
        ("NoSQL",
         "A family of databases that store data in flexible formats (documents, key-value pairs, "
         "graphs) rather than the rigid table structure of traditional SQL databases. Firebase "
         "Firestore is a NoSQL document database."),
        ("npm",
         "Node Package Manager — the tool used to install JavaScript libraries and dependencies. "
         "When you run 'npm install', it reads the package.json file and downloads all the "
         "libraries the project needs."),
        ("node_modules",
         "The folder where npm stores all downloaded library code. It can be very large (hundreds "
         "of megabytes) and is never committed to git — it is always regenerated by running 'npm install'."),
        ("Legacy Peer Deps",
         "A flag used with npm install (--legacy-peer-deps) that tells npm to ignore version "
         "conflicts between packages. Required in our project because React Native 0.81 has minor "
         "version conflicts with some Expo libraries."),
        ("OSM (OpenStreetMap)",
         "A free, community-built alternative to Google Maps. Anyone can contribute to the map data. "
         "The map tiles (the visual street images) can be used freely. We originally used OSM tiles "
         "as an overlay but switched to native Apple/Google Maps to eliminate flickering."),
        ("Prompt (AI Prompt)",
         "The text sent to an AI model as a question or instruction. The quality of the prompt "
         "heavily influences the quality of the AI's response. In our app, we carefully engineer "
         "the system prompt to give Claude the right context (location, landmarks, regulations)."),
        ("React Native",
         "An open-source framework created by Meta that allows developers to write one JavaScript "
         "codebase that runs as a native app on both iOS and Android. 'Native' means it uses the "
         "real UI components of each platform — not a web view."),
        ("Regulatory Alert",
         "A field in our locations database that contains a legal warning: a message, a fine amount, "
         "and a priority level. When this field exists on a landmark, the app shows a red warning "
         "banner and sends a high-priority notification."),
        ("SDK (Software Development Kit)",
         "A collection of tools, libraries, and documentation provided by a company to help "
         "developers build applications that use their service. The Anthropic SDK, for example, "
         "would provide helper functions for calling the Claude API — though we chose to use "
         "direct fetch() calls instead for mobile compatibility."),
        ("Seed Script",
         "A program that loads an initial set of data into an empty database — like stocking a "
         "brand-new library with its first books. Our seed script (firebase/seed/seed.js) loads "
         "8 landmarks, 18 quizzes, 18 FAQs, and 9 logistics entries into Firestore."),
        ("Security Rules (Firestore)",
         "Code that runs on Firebase's servers and decides whether to allow or deny each database "
         "read or write request. Our rules allow any signed-in user to read landmarks, but only "
         "a user's own document can be written by that user."),
        ("Slug",
         "A URL-friendly version of a name, using lowercase letters and hyphens instead of spaces "
         "or special characters. 'Sagrada Família' becomes 'sagrada-familia'. Slugs are used as "
         "unique identifiers to link documents across different collections."),
        ("SQL (Structured Query Language)",
         "A language for managing data in relational databases, which store data in rigid tables "
         "with fixed columns. SQL databases (like PostgreSQL and MySQL) are excellent for structured, "
         "consistent data but less flexible than NoSQL for varied schemas."),
        ("State Management",
         "The practice of tracking and sharing data across different parts of an application. "
         "In our app, Zustand manages the 'state' — which landmark is currently active, "
         "what parking data has been loaded, and what message to pre-fill in the chat."),
        ("Subscription Tier",
         "A pricing level that controls which features a user can access. Our app has two tiers: "
         "Free (all core features, up to 6 FAQs per landmark) and Active/Premium (all FAQs, "
         "future exclusive features). Subscription status is stored in the users collection."),
        ("System Prompt",
         "A special instruction given to an AI model at the start of every conversation, before "
         "the user's first message. It sets the AI's persona, knowledge context, and rules. "
         "In our app, the system prompt gives Claude the user's location, nearby landmarks, "
         "and Barcelona cycling regulations."),
        ("Tab Bar",
         "The row of icons at the bottom of a mobile app that lets users switch between main "
         "sections. Our app has four tabs: Map, Parking, Chat, and Profile."),
        ("Token (AI Token)",
         "The unit of measurement for text in AI models. Roughly, one token equals three-quarters "
         "of a word. API pricing is based on the number of tokens sent and received. Our chat "
         "messages are capped at 500 output tokens to control costs."),
        ("TypeScript",
         "A programming language that adds strict type checking to JavaScript. 'Type' refers to "
         "what kind of value a variable holds (a number, a string, a list, etc.). TypeScript "
         "catches many errors at write time rather than at run time — preventing bugs before "
         "they reach the user."),
        ("UID (User ID)",
         "A unique identifier automatically assigned to every user by Firebase Auth. It looks "
         "like a random string of letters and numbers. The UID is used as the document ID in "
         "the users collection, linking the auth account to the user's data."),
        ("UI/UX (User Interface / User Experience)",
         "UI is what the user sees (buttons, colours, layout). UX is how the user feels "
         "while using it (is it intuitive? is it fast? is it pleasant?). Good UI without "
         "good UX is like a beautiful restaurant with terrible service."),
        ("URL Tile",
         "A technique for displaying map images by fetching small square image tiles from a "
         "tile server (like OpenStreetMap) and assembling them into a full map. We originally "
         "used this but removed it because it caused flickering on zoom interactions."),
        ("Zustand",
         "A tiny, fast state management library for React and React Native. It creates a "
         "global store — like a shared whiteboard — that any component or background task "
         "can read from or write to. We use it to pass landmark data from the geofence "
         "background task to the map UI."),
    ]

    add_table(doc,
        ["Term / Abbreviation", "Definition"],
        [(term, defn) for term, defn in glossary],
        col_widths=[2.2, 4.4]
    )

    # ── CLOSING PAGE ─────────────────────────────────────────────────────────
    add_page_break(doc)
    add_divider(doc)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("End of Documentation")
    r.font.name = "Calibri"; r.font.size = Pt(14); r.font.color.rgb = C_DGREY; r.italic = True
    _set_para_spacing(p, before=200, after=60)

    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = p2.add_run("Barcelona CycleGuide  ·  v1.0  ·  June 2026")
    r2.font.name = "Calibri"; r2.font.size = Pt(11); r2.font.color.rgb = C_DGREY
    _set_para_spacing(p2, before=0, after=60)

    p3 = doc.add_paragraph()
    p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r3 = p3.add_run("Built with care by Harold Kamgang  ·  AI Development Partner: Claude Code (Anthropic)")
    r3.font.name = "Calibri"; r3.font.size = Pt(10); r3.font.color.rgb = C_DGREY
    _set_para_spacing(p3, before=0, after=0)

    return doc


if __name__ == "__main__":
    out = "/home/user/Bike-tour-Proj/BarcelonaCycleGuide_Documentation.docx"
    print("Building document …")
    doc = build_document()
    doc.save(out)
    print(f"Saved → {out}")
