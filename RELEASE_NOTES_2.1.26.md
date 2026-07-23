# InvictaTill Browser 2.1.26

InvictaTill Browser 2.1.26 delivers a complete professional redesign of the background downloads popout panel, fixing visual inconsistencies and improving the overall UI quality.

## Downloads Popout — Professional Redesign

### Visual improvements
- **Darker, crisper background** (`#10141f`) with proper depth shadow — no more washed-out semi-transparent background
- **Smooth entrance animation** — panel slides up and scales in from the bottom right
- **Header redesigned** — smaller, cleaner "Downloads" title (14px 700 weight) with a green brand eyebrow label; removed the oversized 62px min-height
- **Summary bar** — tighter, muted text (9.5px) with a subtle divider, no distracting background fill
- **Item rows** — left-padded at 14px with proper color-coded left-edge gradient per state (active = cyan tint, completed = green tint, stopped = red tint)
- **Progress bar** — custom CSS gradient (cyan → green) replacing the raw browser `<progress>` element; thinner (3px) and more polished
- **Dismiss button** — smaller (22px), lighter opacity, smooth hover transition

### Button hierarchy fixed
- **"Open"** — solid green pill (`#00c46e`) with dark text and a brighter hover state
- **"Show in folder"** — ghost button (transparent + soft border), clearly secondary to "Open" — previously had no class and fell through to unstyled browser defaults
- **"Cancel download"** — red tint background with red text and hover intensification
- **Pause/Resume** — consistent with the secondary ghost style

### Footer
- Flexbox-centered with a `→` arrow indicator that slides right on hover
- Subtle cyan tint color transitioning to white on hover

### Width
- Reduced from 356px → 320px — less intrusive over page content
