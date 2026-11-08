---
name: design-pass
description: "Gives a page of this service a designed look of its own inside the service's fixed frame: an audit for the defaults that mark a generated page, a five-line direction taken from the product, ordered passes with set values, and a template check. Use it on the first page of the service, on any page that looks generated or could belong to any other service, and when GongJae asks to polish or redesign a page, e.g. \"디자인 다듬어줘\", \"AI티 나\", \"너무 밋밋해\"."
---

# Design pass

Adapted from unslop by Damir Sokolovsky (https://github.com/heydamir/unslop, commit a6f121e), licensed under
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). This version is condensed and changed: it works inside
the frame below, leaves out generated images, landing heroes, and the story video, and adds Korean type. Keep this
credit in copies.

A generated page fails in two ways. Its first look is the set of defaults a model reaches for: hue gradients,
glows, emoji labels, uppercase tracked labels, sizes typed at random. Remove those and it fails the second way: a
clean page that could belong to any service, because nobody decided anything. GongJae wants both fixed, about half
and half: the page stays simple and quiet, as the frame sets, and a few decided choices taken from what this service
shows make it this service's page. The pass makes those choices quick to get right, so that design does not eat
the time that keeping it simple was meant to save.

## The frame

These hold for every page and are not the direction's to change; `.claude/rules/engineering.md` and `CLAUDE.md`
give the reasons and any later decision.
- Components from the project's kit and one set of design tokens; quiet chrome, meaning navigation, buttons,
  borders, and labels in neutrals.
- The light page, unless GongJae asks for a dark theme.
- Data laid out as data: a table with the fields as columns and other views a tab away. No hero, banner, or tagline
  ahead of the content.
- Filters with a few choices shown as chips on the page; a setting that changes the whole page opens a menu.
- No decoration that adds no information, and nothing a visitor does not need.

## Steps

1. Look. Render the page in a browser at a desktop and a phone width and take screenshots, so that the judgment
   is about what renders, not what the code intends.
2. Audit. Go through the signs at the end of this file and list each one found, with where it lives.
3. Decide how much to change.
   - Many signs across color, type, icons, and copy: run every pass.
   - A designed page with a few signs: fix only what the audit found, keep its tokens, and put larger ideas in the
     report as suggestions.
   - No signs, and the template check passes: say so, suggest at most three refinements with exact values, and
     change nothing else. Never change a good page just to make it different.
4. Direction. On the service's first page, and whenever a page fails the template check, write five lines into
   `docs/decisions.md`, derived from what the service does and for whom, never from what is in fashion:
   - Product: what it does, for whom, in one plain sentence.
   - Character: two or three concrete words, such as "exact, calm, a little warm". Not clean, modern, sleek,
     minimal, simple, or premium, which describe every template.
   - World: the place or material the service belongs to, such as timetables and calendars for deadlines, or
     paper and ink for an archive. It sets the slight tint of the neutrals and the accent.
   - Moment: the one or two places where the page carries color and care, chosen from its own content, such as
     the main table, the figure that matters, a deadline, or a chart whose colors each mean a series. Never an
     added picture.
   - Signature: one small detail only this service would have, used the same way everywhere, such as a countdown
     in tabular figures beside each deadline. One detail, not five.
   Show the five lines to GongJae beside the rendered page and go on. GongJae's reaction to the page decides; a
   changed direction is applied as the next pass, and an accepted one holds for later pages. A real brand, such as
   a logo, a color, or a typeface someone chose, is kept and the direction is built around it.
5. Passes, in the order below, each finished across the page before the next starts. Spacing comes first because
   everything reads differently once the rhythm holds; copy comes before type and layout because a heading's
   length decides its size and place; motion comes last because it has to fit a page that already works without it.
6. Check. Render again, go through the checklist, and compare with the audit list. Then ui-reviewer reviews the
   page before GongJae sees it, as engineering.md sets.

## Passes and values

Keep the project's own token values where they are good and fix how they are used. The values below are starting
points that the direction may move.

**Spacing.** Every margin, padding, gap, and fixed height is a multiple of 4, with 2 allowed for nudges inside small
controls: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Equal things get equal sizes: one row height and one gap per list,
one padding per row of cards. Space inside a group is smaller than space between groups. Icons, labels, and numbers
each sit in one aligned column, numbers right-aligned. Rows are 32 compact, 36 default, and 40 to 44 for touch;
padding is about 16 in panels, 20 to 24 in cards, and 24 to 32 at the page edges. One-off values such as
`mt-[13px]` become steps of the scale.

**Color.**
- One neutral ramp for the background, surfaces, borders, and text, tinted so slightly toward the world that no
  surface reads as a color. Light starting points, as page, card, and raised surface, then primary, secondary, and
  muted text: graphite #fafafa, #ffffff, #f4f4f5, #171717, #525252, #737373; warm #f7f4ee, #fdfbf7, #efe9df,
  #1f1b16, #5e554a, #7b7266; ink #f5f7fa, #ffffff, #eceff4, #111827, #4b5565, #6b7487. An untinted grey ramp is
  the kit's default, so choose rather than inherit it.
- Three text roles, primary, secondary, and muted; muted is for meta and captions only and stays near 4.5:1.
- One accent, from the brand if there is a real one and otherwise from the world, covering a few percent of the
  page: the primary action, the selection, the one figure that matters. Text on the accent, or in it, reaches 4.5:1.
- Inside the moment, color can be richer, as long as each hue means something.
- Semantic colors carry meaning only and are toned to the palette: positive #16a34a and negative #dc2626 on light.
- Borders are hairlines, the primary text color at 6 to 10 % opacity. Shadows are neutral and small:
  `0 1px 2px rgba(0,0,0,.05)`, or `0 8px 24px rgba(0,0,0,.06)` for a floating menu.
- No hue-to-hue gradient, gradient text, colored glow or shadow, color wash or blob, or neon border. A gradient is
  at most a small tone shift inside one neutral.

**Icons.** One line set, the kit's or lucide, at one size (16 or 18) and one stroke (1.5), in the color of the text
role beside it, with one icon-box width and an 8 to 10 gap to the label. Emoji used as icons or decoration become
icons or go. An icon that adds nothing goes; a category that needs a color gets a small dot.

**Copy.** A heading names the context, such as the page or the period, in this service's own nouns, never a
greeting. No exclamation marks, and no period after a heading, label, button, or caption. Labels are short:
"검색" or "Search", not "Search anything...". A change says what it compares with, as in "지난달보다 12% 증가" or
"+12% vs last month". No hype words and no claim that cannot be checked. Sample data looks real. A badge such as
PRO, New, or Beta goes unless the service needs it, and then it is quiet text. GongJae's corrections to Korean
interface wording are recorded with the harness; the project's `docs/decisions.md` holds those that apply here.

**Type.**
- One family for the interface, the project's own if someone chose it, plus at most one partner, such as a mono
  for figures and meta. For Korean with Latin, Pretendard (SIL Open Font License 1.1) is a good default.
- A few sizes: 12 for meta, 13 to 14 secondary, 14 to 15 body, 28 to 36 for a page title. Two weights, 400 and
  500, with 600 at most for rare emphasis. Hierarchy comes from size and color, not weight. No italic for emphasis.
- Latin labels in sentence case, not uppercase with wide tracking, and no negative letter spacing under 16 px.
- Numbers in tabular figures (`tabular-nums`) and in one format across the page, so a date, a count, or a sum is
  written one way everywhere.
- Korean short strings, meaning headings, labels, buttons, and table cells, break only between words, with
  `word-break: keep-all` and `overflow-wrap: anywhere`. Paragraphs keep the default, since the sources disagree on
  keep-all for running text. Korean paragraphs need more line height than Latin ones; start near 1.6 and judge it
  rendered.

**Layout.** Keep the sections and their order. Use real desktop proportions, content capped around 1440 to 1600 wide
rather than a narrow centered column, and let a phone width stack in reading order. Long headings align left. One
primary action, with at most one secondary action beside it.

**Details.**
- Radius by size: tags 4 to 6, inputs, rows, and buttons 8 to 10, cards 12 to 16. An inner radius is the outer
  radius minus the padding between them, never under 4. Not everything is a pill.
- Counts and meta are quiet text, often muted or mono, not glowing pills; keyboard shortcuts are small keycaps.
- A chart takes its type from the data: a trend is a line, a comparison bars, a share one stacked bar or a list
  with bars. It sits on a muted grid with muted labels, and the accent goes to the one series or bar that matters,
  the rest in neutral steps.
- A stat card holds a label, a figure, and its change, with no sparkline or icon added to fill it. Equal cards side
  by side with the same content read as a template, so vary the widths.
- Hover and focus states stay inside the palette, with a visible focus ring.
- The signature appears where it belongs and nowhere else.

**Motion.** Remove loops on things that are not live (`animate-pulse`, shimmer, floating), `transition-all`,
`hover:scale` on cards, and bounce. Keep motion that explains something: a hover changes color or surface, a menu
fades and rises a few pixels, a changed number tweens. One easing curve, `cubic-bezier(0.22, 1, 0.36, 1)`, with
120 to 180 ms for feedback, 160 to 220 for menus, and 300 to 500 for entrances; at most one entrance on load. Animate
color, opacity, and transform only.

## Signs of a generated page

- Surfaces and color: hue gradients on backgrounds, cards, buttons, or the active item; gradient text; colored glows
  and shadows; washes or blobs behind content; neon borders; several near-identical tints of text; everything
  highlighted so that nothing leads; glass cards.
- Type: headings at 700 to 900; uppercase tracked labels; too many sizes and weights; numbers in mixed formats,
  such as "07" beside "7" or "$48,210" beside "$124,860.40"; negative tracking on small text; italic for emphasis.
- Icons: emoji as icons, in labels, or in counts; a sparkle for anything AI; icons of several sizes or colors, or
  off their column.
- Spacing: one-off values; rows of one list with different heights or gaps; groups closer to their neighbours than
  to their own items; sibling cards with different padding.
- Copy: greeting headings; exclamation marks; a change with no reference; wordy placeholders; hype words; periods
  on labels; fake-looking data.
- Components: glowing pills for counts or status; badges everywhere; every element a full pill; rainbow, glowing,
  or pill-shaped bars in a chart; a sparkline in every stat card; identical cards side by side; a gradient or
  sparkle logo.
- Motion: pulses or glows on things that are not live; `transition-all` and hover scaling; bounce; everything flying
  in on load; parallax; animated width, height, or position.

The template look is what a cleaned page falls back to when nobody decided:
- an untinted grey ramp, the kit's default near-black primary, and a font nobody chose;
- a heading that would still fit if another service's name replaced this one's;
- the same layout, type, and palette as the last service built.

## Checklist

- The frame holds, and the direction is in `docs/decisions.md` and followed by every pass.
- Every spacing value is on the 4 px scale, equal things are equal, and icons, labels, and numbers align in columns.
- One tinted neutral ramp, three text roles, and one accent with enough contrast; no hue gradient, gradient text,
  glow, colored shadow, or blob.
- No emoji in the interface; one icon set at one size and stroke.
- Weights 400 to 600; no uppercase tracked labels, italic, or tight small text; Korean short strings break between
  words.
- No exclamation marks, periods on labels, greeting headings, or unchecked claims.
- Numbers in one format with tabular figures; nested radii add up.
- No looping or bouncy motion; one easing curve; only color, opacity, and transform animate.
- Template check: swap the service's name for another's. If the page would still fit, push the direction further in
  the copy, the moment, and the signature, without adding decoration.
- No removed decoration was replaced by new decoration or a new trend, such as glass, grain, noise, or bento grids.
