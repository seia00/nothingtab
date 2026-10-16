# Prompt: liquid-glass buttons

Paste everything below the line into a coding agent. Set `--accent` to your app's
colour and it's done.

---

Build me buttons/tiles in a "liquid glass" style: translucent panels that look
like polished glass sitting on top of the page, with a lit edge, a soft inner
glow, and a specular highlight that sweeps across on hover.

## Read this first — the effect has a prerequisite

Glass is only visible because of **what's behind it**. `backdrop-filter` blurs
and brightens the backdrop; if the backdrop is a flat colour, blurring it returns
the same flat colour and the buttons collapse into dull grey rectangles. No
amount of tuning fixes this.

So before writing any button CSS, check what's actually behind these buttons:

- **A photo, gradient, mesh, or anything with texture** → perfect, use the recipe
  as written.
- **A flat solid colour** → either put something behind it first (a large soft
  multi-stop gradient or a subtle noise layer will do), or skip `backdrop-filter`
  entirely and use the "flat backdrop" variant at the bottom. Don't ship the
  translucent version over a flat background and assume it looks like the
  reference — it won't.
- **Light-coloured backdrop** → this recipe is tuned for dark UI. On light
  backgrounds, invert it: dark hairline instead of white, drop the inner glow,
  and reduce `brightness()` below 1. Tell me if that's the case and I'll retune.

Also: glass reads best when it's the *exception*. A grid of 8 glass tiles against
a photo looks expensive; an entire UI of glass looks like frosted soup.

## The recipe — five layers, in this order

1. **Body fill** — a *gradient*, never a flat `rgba()`. Bright at the top-left,
   nearly nothing through the middle, slight lift at the bottom. This is what
   makes it read as a curved surface rather than a flat sheet.
2. **Backdrop filter** — blur + saturate + a touch of brightness. Saturation
   boost is what stops the blurred backdrop looking washed out and dead.
3. **Hairline border** — a *gradient* border, bright where light would hit
   (top-left) and fading to nothing at the bottom-right. A uniform 1px border is
   the single biggest tell of fake glass. Drawn with the mask-composite trick
   below, because `border-image` can't do rounded corners.
4. **Inset light** — a 1px white top highlight, a fainter bottom one, and an
   accent-coloured bloom pushed inward from the bottom edge.
5. **Specular sweep** — a diagonal light band that travels across the surface on
   hover, clipped by the button's own bounds.

## Motion

Lift `-3px` on hover with the icon scaling to ~1.07, and press to
`translateY(-1px) scale(0.965)`. Ease everything with
`cubic-bezier(.22,.61,.36,1)` over ~0.4s — it decelerates hard at the end, which
reads as weight. Never use `linear` or `ease-in-out` here; it looks cheap.

Wrap all of it in `@media (prefers-reduced-motion: reduce)` and disable.

## Reference implementation

```css
.glass {
  /* the only two things you should need to change */
  --accent: 100 189 255;          /* rgb triplet, no commas */
  --radius: 22px;

  position: relative;
  overflow: hidden;               /* clips the sweep to the button */
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;

  /* 1 — body fill */
  background: linear-gradient(155deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0.04) 46%,
    rgba(255, 255, 255, 0.075) 100%);

  /* 2 — backdrop. -webkit- prefix is still required for Safari. */
  -webkit-backdrop-filter: blur(18px) saturate(1.7) brightness(1.06);
          backdrop-filter: blur(18px) saturate(1.7) brightness(1.06);

  /* 4 — inset light */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.26),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    inset 0 0 30px -8px rgb(var(--accent) / 0.5),
    inset 0 -22px 40px -30px rgb(var(--accent) / 0.55),
    0 18px 40px -22px rgba(0, 0, 0, 0.95);

  transition:
    transform 0.4s cubic-bezier(.22, .61, .36, 1),
    box-shadow 0.4s cubic-bezier(.22, .61, .36, 1);
}

/* 3 — gradient hairline. Two masks, one inset by the padding, XOR'd together,
   leaves only a 1px band that follows the border radius. */
.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  background: linear-gradient(150deg,
    rgba(255, 255, 255, 0.80) 0%,
    rgb(var(--accent) / 0.38) 24%,
    rgba(255, 255, 255, 0.05) 48%,
    rgb(var(--accent) / 0.30) 76%,
    rgba(255, 255, 255, 0.45) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;      /* both spellings needed */
          mask-composite: exclude;
}

/* 5 — specular sweep */
.glass::after {
  content: "";
  position: absolute;
  inset: -1px;
  z-index: 1;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-130%);
  background: linear-gradient(105deg,
    transparent 32%,
    rgba(255, 255, 255, 0.14) 45%,
    rgba(190, 228, 255, 0.30) 50%,
    rgba(255, 255, 255, 0.10) 56%,
    transparent 70%);
}

.glass:hover::after {
  opacity: 1;
  animation: glass-sweep 0.9s cubic-bezier(.22, .61, .36, 1);
}

@keyframes glass-sweep {
  from { transform: translateX(-130%); }
  to   { transform: translateX(130%); }
}

/* content has to clear the two pseudo-elements */
.glass > * {
  position: relative;
  z-index: 3;
}

.glass .icon {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.55));
  transition: transform 0.4s cubic-bezier(.22, .61, .36, 1);
}

.glass:hover {
  transform: translateY(-3px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.30),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    inset 0 0 30px -8px rgb(var(--accent) / 0.6),
    0 26px 50px -20px rgba(0, 0, 0, 0.95),
    0 0 34px -14px rgb(var(--accent) / 0.5);
}
.glass:hover .icon { transform: scale(1.07); }
.glass:active { transform: translateY(-1px) scale(0.965); }

.glass:focus-visible {
  outline: 2px solid rgb(var(--accent) / 0.9);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .glass, .glass .icon { transition: none; }
  .glass:hover::after { animation: none; }
}
```

## Flat-backdrop variant

If there's genuinely nothing textured behind the buttons, drop
`backdrop-filter` and replace the body fill with a translucent dark base. Keep
layers 1, 3, 4 and 5 — the gradient hairline and the sweep are what carry the
look, and they work over anything.

```css
.glass {
  background:
    linear-gradient(155deg, rgba(255,255,255,.10), rgba(255,255,255,.02) 46%, rgba(255,255,255,.06)),
    rgba(16, 16, 22, 0.72);
}
```

## Performance — these cost real frame time

- **Never** use an SVG `feTurbulence` filter to add "organic" distortion. It's
  evaluated per-pixel per-element and on a grid of tiles it can cost more than
  every other thing on the page combined, for an effect nobody can see. If you
  want distortion, bake it into a static image.
- Blur cost scales with radius. 18px is a good ceiling; 26px+ is noticeably more
  expensive for a difference you can barely see.
- Each `backdrop-filter` element is its own offscreen pass. A dozen is fine, a
  hundred in a scrolling list is not — for long lists, put one glass panel behind
  the list rather than one per row.
- Animate only `transform` and `opacity` on hover. Animating `box-shadow` is
  acceptable at this count but is the first thing to drop if frames suffer.

## Accessibility

Don't put small or low-contrast text directly on glass over a busy backdrop —
contrast changes as the backdrop changes and can fail WCAG in patches. Either
keep glass to icon-only controls, or add a text shadow / darker local fill behind
the label. Verify a `:focus-visible` ring survives against the backdrop.

## Optional: true edge refraction

Only attempt this if the backdrop is a **fixed, known image whose on-screen
position you can compute** (a full-bleed non-scrolling background). It will not
work over scrolling or dynamic content — skip it in that case, the recipe above
already looks good.

Give each button a child element holding *its own copy of the backdrop image*,
aligned to the page behind it but magnified about the button's centre, then mask
it to the edge band. The imagery lines up with what's outside the button and then
bows outward across the bevel — actual refraction, not a painted gradient.

For a magnification `m`, a button rect `r`, and a background drawn at size
`bw × bh` offset `(ox, oy)` in the viewport, the child's background-position is:

```
px = r.width  / 2 − m × (r.left + r.width  / 2 − ox)
py = r.height / 2 − m × (r.top  + r.height / 2 − oy)
```

with `background-size: (bw × m) (bh × m)`. Recompute on resize. `m ≈ 1.45` and a
12px rim is a good starting point. Mask it with the same two-mask XOR trick as
the hairline, but with `padding: 12px` instead of `1px`.

Use a **downscaled copy** of the image for this — the band is magnified and
blurred, so quarter resolution is indistinguishable and avoids every button
resampling a full-size image.
