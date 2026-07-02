---
name: SEOULMATE
description: A modern, trustworthy Thai-Korean dating and social exchange product.
colors:
  brand-coral: "#e9524f"
  brand-ink: "#332b5f"
  brand-mint: "#60cdb8"
  brand-honey: "#e7b846"
  brand-blush: "#fff1ef"
  brand-lilac: "#f1edff"
  background: "#fffaf2"
  foreground: "#292237"
  card: "#ffffff"
  muted: "#f1eff4"
  muted-foreground: "#7a7184"
  border: "#ecd9d5"
  accent: "#e5fbf6"
  accent-foreground: "#235d52"
  destructive: "#d83f32"
typography:
  display:
    fontFamily: "Noto Sans Thai, Noto Sans KR, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 900
    lineHeight: 1.08
    letterSpacing: "0"
  title:
    fontFamily: "Noto Sans Thai, Noto Sans KR, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "Noto Sans Thai, Noto Sans KR, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Noto Sans Thai, Noto Sans KR, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
rounded:
  sm: "7px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  xxl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-coral}"
    textColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xxl}"
    padding: "16px"
  chip-locale:
    backgroundColor: "{colors.brand-blush}"
    textColor: "{colors.brand-coral}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-intent:
    backgroundColor: "{colors.brand-lilac}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: SEOULMATE

## 1. Overview

**Creative North Star: "Clean Seoul Signal"**

SEOULMATE should feel like a polished Korean social product with Thai warmth: clear, composed, and trustworthy first, then lightly playful in the details. The interface is product-led rather than campaign-led; users should be able to scan intent, read profiles, start conversations, and understand safety states without decoding decorative design.

The system favors clean surfaces, ink/charcoal authority, and restrained connection color. Coral/rose is the signal for action, warmth, and emotional intent, but it should never flood the screen. Mint and lilac appear as soft secondary accents for freshness, safety, language exchange, and cross-cultural nuance.

**Key Characteristics:**
- Clean mobile-first product shell with a narrow focused frame.
- Trustworthy ink/charcoal text and structure before saturated color.
- Controlled coral/rose for primary actions and active states.
- Mint/lilac as light accents, never the whole identity.
- Formal enough for dating safety, friendly enough for daily social use.

## 2. Colors

The palette is clean and composed: off-white surfaces, deep ink structure, coral connection cues, and quiet mint/lilac accents.

### Primary
- **Controlled Coral** (#e9524f / `--brand-coral`): Use for primary actions, active navigation, brand marks, and connection moments. Keep it rare enough that it still feels meaningful.
- **Trust Ink** (#332b5f / `--brand-ink`): Use for brand contrast, important headings, and stable product structure. This is the trust anchor.

### Secondary
- **Fresh Mint** (#60cdb8 / `--brand-mint`): Use for safety, freshness, language exchange, and successful or reassuring moments.
- **Soft Lilac** (#f1edff / `--brand-lilac`): Use for gentle grouping, selected secondary surfaces, and Seoul-modern softness.

### Tertiary
- **Warm Honey** (#e7b846 / `--brand-honey`): Use sparingly for playful exchange cues or highlighted social details. It should never compete with coral as the action color.
- **Quiet Blush** (#fff1ef / `--brand-blush`): Use as a soft tint behind coral chips, not as a full-page romantic wash.

### Neutral
- **Clean Surface** (#fffaf2 / `--background`): The app background. Keep it clean and nearly neutral; warmth should be subtle.
- **Readable Ink** (#292237 / `--foreground`): Default text color.
- **Card White** (#ffffff / `--card`): Primary content surfaces.
- **Soft Divider** (#ecd9d5 / `--border`): Borders and separators.
- **Muted Text** (#7a7184 / `--muted-foreground`): Secondary text only; verify contrast before using on tinted surfaces.

### Named Rules
**The Controlled Rose Rule.** Coral/rose should guide action and affection, not become a sugary dating-app wash.

**The Clean Seoul Rule.** Prefer clean off-white, ink, and restrained accent placement over heavy gradients, candy pink surfaces, or generic romance palettes.

## 3. Typography

**Display Font:** Noto Sans Thai, Noto Sans KR, system-ui, sans-serif

**Body Font:** Noto Sans Thai, Noto Sans KR, system-ui, sans-serif

**Label/Mono Font:** Noto Sans Thai, Noto Sans KR, system-ui, sans-serif

**Character:** The type system is bilingual, practical, and modern. It should render Thai and Korean with equal care, avoiding cramped line-height or overly tight tracking.

### Hierarchy
- **Display** (900, 42px, 1.08): Use only for landing or major welcome moments.
- **Headline** (800-900, 28-32px, 1.15): Use for onboarding and major screen headings.
- **Title** (700-800, 22px, 1.2): Use for cards, sections, and prominent profile moments.
- **Body** (400-500, 15-17px, 1.55): Use for readable profile, topic, and chat content. Keep long prose at 65-75ch where applicable.
- **Label** (700-900, 10-12px, 1.1): Use for tabs, chips, badges, and metadata. Letter spacing stays at 0.

### Named Rules
**The Bilingual Care Rule.** Never sacrifice Thai or Korean readability for a compact Latin-only UI rhythm.

## 4. Elevation

SEOULMATE uses a hybrid of tonal layering, borders, and soft shadows. Surfaces should feel touchable and calm, not glassy or heavily floating.

### Shadow Vocabulary
- **Soft Card Lift** (`0 18px 48px oklch(0.68 0.19 23 / 12%)`): Use on primary cards that need gentle separation.
- **Raised Moment** (`0 24px 70px oklch(0.25 0.07 282 / 16%)`): Reserve for modals, important overlays, or elevated action panels.
- **Action Glow** (`0 14px 34px oklch(0.68 0.19 23 / 24%)`): Use only on primary action buttons or conversion moments.

### Named Rules
**The Calm Depth Rule.** Elevation should clarify hierarchy and touch targets; it should not make the app feel glassy, luxury-cosmetic, or decorative.

## 5. Components

### Buttons
- **Shape:** Rounded product controls, generally 10-12px, with pill shapes only when the control is explicitly chip-like.
- **Primary:** Controlled Coral background, white text, confident weight, and a soft action glow when emphasis is needed.
- **Hover / Focus:** Slightly deeper coral, visible focus ring from `--ring`, and 150-250ms transitions.
- **Secondary / Ghost:** Use ink, lilac, or clean white surfaces. Do not create a rainbow of inactive buttons.

### Chips
- **Style:** Small, high-signal, rounded pills with light tints and strong readable text.
- **Locale Chips:** Coral/blush for Thai-Korean identity switching.
- **Intent Chips:** Ink/lilac for dating, friendship, and exchange modes; intent should be legible at a glance.
- **Exchange Chips:** Honey can appear in moderation for language or cultural-exchange moments.

### Cards / Containers
- **Corner Style:** Generous but controlled, usually 16-24px depending on surface scale.
- **Background:** White cards on clean background, with subtle border and soft shadow.
- **Shadow Strategy:** Use soft lift for content cards and raised moment only for overlays.
- **Border:** Soft Divider, 1px. Avoid colored side stripes.
- **Internal Padding:** 16px for compact cards, 24px for larger onboarding or landing surfaces.

### Inputs / Fields
- **Style:** Clean filled or white fields with 10-12px radius and a visible border.
- **Focus:** Shift border/ring toward coral or ink; focus must be visible and accessible.
- **Error / Disabled:** Error uses destructive red with explanatory text; disabled states reduce contrast without becoming unreadable.

### Navigation
- **Style:** Mobile bottom bar and sticky top bar use clean translucent white, a thin border, and stable icon labels.
- **Active State:** Coral active icon/text and a small underline or state marker.
- **Inactive State:** Muted foreground only when contrast is sufficient; hover moves toward coral.

### App Shell
The mobile frame is capped around 448px for focus. Background treatments may use subtle lilac or blush atmosphere, but the dominant read should stay clean, trustworthy, and product-like.

## 6. Do's and Don'ts

### Do:
- **Do** keep the base surface clean and mostly neutral: `#fffaf2`, `#ffffff`, `#292237`.
- **Do** use coral/rose for primary actions, active states, and warm connection signals.
- **Do** use mint/lilac as light supporting accents for safety, exchange, and softness.
- **Do** preserve clear Thai and Korean readability with Noto Sans Thai/KR and generous line-height.
- **Do** make dating intent, friendship intent, and exchange intent visible through chips and labels.
- **Do** verify WCAG AA contrast, especially for muted text on tinted surfaces.

### Don't:
- **Don't** make the app feel like a shallow swipe-only dating app.
- **Don't** use sugary full-screen pink, candy romance gradients, or generic dating-app gradient text.
- **Don't** make the product look scammy, oversexualized, or manipulative.
- **Don't** turn the UI into a corporate SaaS dashboard; keep warmth and social energy present.
- **Don't** use heavy glassmorphism, decorative blur cards, or floating effects as the default surface.
- **Don't** use colored side-stripe borders as card accents.
