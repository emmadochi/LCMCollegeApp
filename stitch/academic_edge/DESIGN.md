# Design System Document: Academic Tech-Forward Mobile Experience

## 1. Overview & Creative North Star
**Creative North Star: The Intellectual Atelier**
This design system moves away from the "industrial" feel of standard Learning Management Systems (LMS) toward a high-end, editorial experience. It treats the student not as a user in a database, but as a scholar in a digital atelier. We achieve this through **Organic Asymmetry** and **Tonal Depth**. By breaking the rigid, boxed-in grid of traditional education platforms, we create a sense of breathing room—mimicking the quiet, focused atmosphere of a modern university library.

The "Academic" feel is conveyed through sophisticated Manrope typography (reminiscent of architectural lettering), while the "Tech-Forward" personality is injected through glassmorphism, depth-based layering, and vibrant accent transitions.

---

## 2. Colors & Surface Logic
The palette is rooted in deep, authoritative indigos, contrasted by energetic, "living" teals that represent progress and intellectual spark.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be established exclusively through background color shifts.
*   *Example:* A `surface-container-low` section sitting on a `surface` background provides enough contrast to signify a new area without the visual clutter of a line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of premium materials. Use the `surface-container` tiers to create "nested" depth:
*   **Base Level:** `surface` (#f7f9fc)
*   **Sectioning:** `surface-container-low` (#f2f4f7)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff) to provide the highest lift and focus.
*   **Tertiary Overlays:** `surface-container-high` (#e6e8eb) for secondary utility panels.

### The Glass & Gradient Rule
To ensure the UI feels custom and premium:
*   **Floating Elements:** Use `surface_variant` with a 60% opacity and a `20px` backdrop-blur for top navigation bars or floating action buttons.
*   **Signature Textures:** Use a subtle linear gradient (45°) from `primary` (#000666) to `primary_container` (#1a237e) for Hero backgrounds and major CTAs to add "soul" and dimension.

---

## 3. Typography
The system uses a dual-sans pairing to balance authority with modern readability.

*   **Display & Headlines (Manrope):** The "Architectural" voice. Used for course titles and major milestones. Its geometric nature feels tech-forward yet established.
    *   *Headline-LG (2rem):* For screen titles. Use tight letter-spacing (-0.02em) for a premium editorial look.
*   **Body & Labels (Inter):** The "Functional" voice. Highly legible at small scales for course descriptions and metadata.
*   **Hierarchy Note:** Always maintain a high contrast between `headline-sm` and `body-md`. This "jump" in scale signals importance and mimics the layout of high-end academic journals.

---

## 4. Elevation & Depth
We define hierarchy through **Tonal Layering** rather than traditional structural lines.

*   **The Layering Principle:** Place `surface-container-lowest` cards on `surface-container-low` backgrounds. This creates a soft, natural "lift" that feels integrated into the environment.
*   **Ambient Shadows:** When a card needs to "float" (e.g., a featured course card), use a shadow with a blur of `24px`, an offset of `y: 8px`, and an opacity of `4%`. The shadow color must be a tinted version of `on-surface` (#191c1e) to simulate natural light.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., input fields), use `outline-variant` (#c6c5d4) at **20% opacity**. Never use 100% opaque borders.
*   **Glassmorphism:** Use semi-transparent `primary_container` with a blur for "Locked" states, allowing the content below to be hinted at but not accessible, creating a sense of "depth-based gating."

---

## 5. Components

### Cards & Lists
*   **Rule:** Forbid divider lines. Use `spacing.8` (2rem) of vertical white space to separate course modules.
*   **Styling:** Use `roundedness.md` (0.75rem/12px) for standard cards. Large hero cards can use `roundedness.xl` (1.5rem) to feel more "organic."

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. White text. `roundedness.full` for a modern, friendly feel.
*   **Secondary (Progress):** Use `secondary` (#006b5c) for "Resume" actions.
*   **Tertiary:** No background. Use `primary` text with a `label-md` weight.

### Chips (Course Tags)
*   **Style:** `surface-container-high` background with `on-surface-variant` text.
*   **Shape:** `roundedness.sm` (0.25rem) to differentiate them from the "pill-shaped" buttons.

### Progress Indicators
*   **In Progress:** Energetic `secondary` (#006b5c) with a subtle glow effect (soft shadow of the same color).
*   **Completed:** A solid `primary_fixed` checkmark.
*   **Locked:** A `surface-dim` icon with a 40% opacity, utilizing the Glassmorphism rule for the container.

### Input Fields
*   **State:** Soft `surface-container-low` background. 
*   **Focus:** Transition the "Ghost Border" from 20% to 100% opacity of `outline_variant` and add a subtle `primary` tint to the background.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical padding (e.g., more top padding than bottom) in Hero sections to create an editorial feel.
*   **Do** use the `spacing.6` (1.5rem) as your standard "gutter" to ensure the UI feels expensive and airy.
*   **Do** use high-quality, desaturated educational imagery with a `primary` color overlay at 10% to unify photos with the brand.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on-surface` (#191c1e) to maintain the soft, academic tonal range.
*   **Don't** use standard "Material Design" drop shadows. If it looks like a default shadow, it is too heavy.
*   **Don't** cram content. If a screen feels full, increase the `surface` background color and move secondary information to a "View More" glass-morphic sheet.
*   **Don't** use 1px dividers. If you feel the need for a line, try using a `1px` tall block of `surface-container-high` instead.