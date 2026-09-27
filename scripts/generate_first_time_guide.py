from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "home-hero-first-time-guide.pdf"

NAVY = HexColor("#102B55")
NAVY_SOFT = HexColor("#294E80")
GREEN = HexColor("#4C861F")
PURPLE = HexColor("#7750AE")
GOLD = HexColor("#F4B820")
CREAM = HexColor("#F7F3E8")
INK = HexColor("#17233D")
MUTED = HexColor("#667089")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#DED9CC")


PARTY_STEPS = [
    ("Create the household.", "Choose Party Leader, create an account, confirm your email, and sign in. Create a household, or join one with an invitation code from another adult."),
    ("Enroll each Hero.", "From Home, choose Enroll Hero. Add the child's display name, username, birth date, and six-digit PIN. Share the username and PIN privately."),
    ("Choose quests from the library.", "Open Quests > Quest library, choose Add, review the age range, schedule, coins, XP, timer, and Hero assignments, then add it to My quests."),
    ("Create a family quest.", "Open Quests and choose +. Add its name, description, emoji, type, schedule, coin value, optional timer, age range, and Hero assignments."),
    ("Choose or create rewards.", "Open Rewards > Reward library to add and customise an idea, or choose + for a household-only reward. Active rewards appear in the Hero Shop."),
    ("Review activity.", "Open Review for submitted quests and reward requests. Quest approval awards coins and XP. Reward approval deducts coins only when approved."),
    ("Add another Party Leader.", "On Home, open Party Leaders (or Household access on mobile), create an email-bound invite, and share its one-time code privately. It expires after seven days."),
]

HERO_STEPS = [
    ("Sign in.", "Choose Hero and enter the username and six-digit PIN supplied by your Party Leader. Heroes do not need an email address."),
    ("Complete today's quests.", "Open Today and select a finished quest. Timed quests become approvable only after the countdown reaches zero. Every submission waits for review."),
    ("Follow your progress.", "Week shows weekly activity. The shared header and Hero tab show level, lifetime XP, coin balance, and badges. XP is permanent; coins can be spent."),
    ("Request a reward.", "Open Hero Shop and choose Buy. The button activates only when you have enough coins. Coins are deducted only after Party Leader approval."),
    ("Ask for help.", "A Party Leader can change your username, reset your PIN, and manage the age-appropriate quests and household rewards available to you."),
]


def paragraph_style(name: str, **kwargs):
    defaults = dict(fontName="Helvetica", fontSize=7.6, leading=10.1, textColor=INK)
    defaults.update(kwargs)
    return ParagraphStyle(name, **defaults)


BODY = paragraph_style("body")
ROLE = paragraph_style("role", fontSize=7.4, leading=9.2, textColor=MUTED)
STEP = paragraph_style("step", fontSize=7.5, leading=10.0)


def draw_wrapped(c: canvas.Canvas, text: str, style: ParagraphStyle, x: float, y_top: float, width: float):
    p = Paragraph(text, style)
    _, height = p.wrap(width, 200)
    p.drawOn(c, x, y_top - height)
    return height


def draw_role_card(c: canvas.Canvas, x: float, y: float, width: float, color, letter: str, title: str, description: str):
    c.setFillColor(WHITE)
    c.roundRect(x, y, width, 38, 10, fill=1, stroke=0)
    c.setFillColor(color)
    c.roundRect(x + 9, y + 8, 22, 22, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(x + 20, y + 15, letter)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 8.2)
    c.drawString(x + 39, y + 23, title)
    draw_wrapped(c, description, ROLE, x + 39, y + 18, width - 50)


def draw_steps(c: canvas.Canvas, x: float, y_top: float, width: float, color, steps):
    y = y_top
    text_x = x + 22
    text_width = width - 22
    for number, (title, description) in enumerate(steps, 1):
        html = f"<b>{title}</b> {description}"
        p = Paragraph(html, STEP)
        _, height = p.wrap(text_width, 100)
        c.setFillColor(color)
        c.circle(x + 7, y - 6, 6.5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 6.4)
        c.drawCentredString(x + 7, y - 8.2, str(number))
        p.drawOn(c, text_x, y - height)
        y -= max(height, 13) + 7
    return y


def build_pdf():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    page_width, page_height = landscape(A4)
    c = canvas.Canvas(str(OUTPUT), pagesize=(page_width, page_height), pageCompression=1, invariant=1)
    c.setTitle("Home Hero First-Time Guide")
    c.setAuthor("Home Hero")
    c.setSubject("Quick-start instructions for Party Leaders and Heroes")

    c.setFillColor(CREAM)
    c.rect(0, 0, page_width, page_height, fill=1, stroke=0)

    header_height = 86
    c.setFillColor(NAVY)
    c.rect(0, page_height - header_height, page_width, header_height, fill=1, stroke=0)
    c.setFillColor(NAVY_SOFT)
    c.circle(page_width - 15, page_height - 5, 75, fill=1, stroke=0)

    c.setStrokeColor(GOLD)
    c.setLineWidth(2.4)
    c.roundRect(29, page_height - 67, 43, 47, 12, fill=0, stroke=1)
    c.setFillColor(GREEN)
    c.roundRect(31, page_height - 65, 39, 43, 10, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(50.5, page_height - 51, "H")

    c.setFont("Helvetica-Bold", 19)
    c.setFillColor(WHITE)
    c.drawString(82, page_height - 43, "HOME")
    home_width = stringWidth("HOME", "Helvetica-Bold", 19)
    c.setFillColor(GOLD)
    c.drawString(89 + home_width, page_height - 43, "HERO")

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(page_width - 34, page_height - 39, "YOUR FIRST QUEST STARTS HERE")
    c.setFont("Helvetica", 8)
    c.drawRightString(page_width - 34, page_height - 57, "A one-page guide for adults and children")

    margin = 31
    gutter = 18
    left_width = 421
    right_x = margin + left_width + gutter
    right_width = page_width - right_x - margin
    card_y = page_height - header_height - 49

    draw_role_card(c, margin, card_y, left_width, GREEN, "P", "PARTY LEADER", "A trusted adult who enrolls Heroes, chooses quests and rewards, and approves results.")
    draw_role_card(c, right_x, card_y, right_width, PURPLE, "H", "HERO", "A child who completes quests, earns XP, badges and coins, and requests rewards.")

    section_y = card_y - 18
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 13.5)
    c.drawString(margin, section_y, "PARTY LEADER QUICK START")
    c.drawString(right_x, section_y, "HERO QUICK START")
    c.setStrokeColor(GREEN)
    c.setLineWidth(2)
    c.line(margin, section_y - 6, margin + 52, section_y - 6)
    c.setStrokeColor(PURPLE)
    c.line(right_x, section_y - 6, right_x + 42, section_y - 6)

    steps_y = section_y - 19
    left_bottom = draw_steps(c, margin + 1, steps_y, left_width - 3, GREEN, PARTY_STEPS)
    right_bottom = draw_steps(c, right_x + 1, steps_y, right_width - 3, PURPLE, HERO_STEPS)

    footer_y = 24
    c.setFillColor(NAVY)
    c.roundRect(margin, footer_y, page_width - 2 * margin, 30, 9, fill=1, stroke=0)
    footer = "THE FAMILY RHYTHM: Party Leaders set the choices and approve results. Heroes take action and watch consistent effort become coins, XP, levels, and badges."
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7.3)
    c.drawString(margin + 14, footer_y + 11, footer)

    if min(left_bottom, right_bottom) < footer_y + 38:
        raise RuntimeError("Guide content overlaps the footer")

    c.save()


if __name__ == "__main__":
    build_pdf()
