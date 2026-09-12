# GitHub hook

The `github` hook turns GitHub alert markers into GitHub-compatible alert HTML.

## Hook contract

- ID: `github`.
- Label: `GitHub`.
- `install(markdownIt)` registers the namespaced renderer rule for alert tokens.
- `transform(markdownIt, tokens, env)` recognizes the syntax below, returns
  the original token array when there is no alert, and clones changed tokens
  when there is one.

## Supported syntax

The first line of a blockquote may begin with one of these case-insensitive
markers:

```markdown
> [!NOTE]
> Useful context for the reader.
```

Supported markers are `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and
`[!CAUTION]`. A marker must be the first content in the blockquote. Spaces or
tabs after the marker are accepted; an ordinary blockquote is unchanged when
the marker is absent.

## Emitted markup contract

An alert is emitted as a `div` with these classes and attributes:

```html
<div class="markdown-alert markdown-alert-note" dir="auto">
  <p class="markdown-alert-title" dir="auto">
    <svg class="octicon octicon-info mr-2" ...></svg>Note
  </p>
  <!-- rendered alert content -->
</div>
```

The stable selectors are:

- `.markdown-alert`
- `.markdown-alert-note`, `.markdown-alert-tip`,
  `.markdown-alert-important`, `.markdown-alert-warning`, and
  `.markdown-alert-caution`
- `.markdown-alert-title`
- `.octicon` and `.mr-2`
- `.octicon-info`, `.octicon-light-bulb`, `.octicon-report`,
  `.octicon-alert`, and `.octicon-stop`

The `dir="auto"` attributes and inline SVG icons are part of the emitted
markup contract.

## CSS contract

`base.css` contains alert, title, and emitted-icon styles only. Every selector
is scoped by:

```css
:where(body:has(#markdown-preview-themes[data-hook="github"]) .markdown-alert)
```

The stylesheet does not set `body` or `html` colors, fonts, backgrounds,
spacing, layout, or other page-wide properties. Hook selectors deliberately
use zero specificity so later theme CSS can override them with ordinary class
selectors.

## Stable hook variables

Define these custom properties on the preview body or another ancestor of the
alert. Each property is optional and inherits normally. The fallback shown is
used when neither the hook variable nor the corresponding GitHub semantic
variable exists.

| Variable | Fallback | Used for |
| --- | --- | --- |
| `--markdown-preview-themes-github-alert-padding` | `var(--base-size-8, 0.5rem) var(--base-size-16, 1rem)` | Alert padding |
| `--markdown-preview-themes-github-alert-margin-bottom` | `var(--base-size-16, 1rem)` | Space below an alert |
| `--markdown-preview-themes-github-alert-border-width` | `0.25em` | Left border width |
| `--markdown-preview-themes-github-alert-border-color` | `var(--borderColor-default, currentColor)` | Default left border color |
| `--markdown-preview-themes-github-alert-title-weight` | `var(--base-text-weight-medium, 500)` | Alert title weight |
| `--markdown-preview-themes-github-alert-title-line-height` | `1` | Alert title line height |
| `--markdown-preview-themes-github-alert-icon-gap` | `var(--base-size-8, 0.5rem)` | Space after the icon |
| `--markdown-preview-themes-github-alert-note-border-color` / `-color` | `var(--borderColor-accent-emphasis, #0969da)` / `var(--fgColor-accent, #0969da)` | Note border/title |
| `--markdown-preview-themes-github-alert-important-border-color` / `-color` | `var(--borderColor-done-emphasis, #8250df)` / `var(--fgColor-done, #8250df)` | Important border/title |
| `--markdown-preview-themes-github-alert-warning-border-color` / `-color` | `var(--borderColor-attention-emphasis, #9a6700)` / `var(--fgColor-attention, #9a6700)` | Warning border/title |
| `--markdown-preview-themes-github-alert-tip-border-color` / `-color` | `var(--borderColor-success-emphasis, #1a7f37)` / `var(--fgColor-success, #1a7f37)` | Tip border/title |
| `--markdown-preview-themes-github-alert-caution-border-color` / `-color` | `var(--borderColor-danger-emphasis, #cf222e)` / `var(--fgColor-danger, #cf222e)` | Caution border/title |

The `-border-color` and `-color` suffixes in the five type rows are literal:
for example, the complete note variables are
`--markdown-preview-themes-github-alert-note-border-color` and
`--markdown-preview-themes-github-alert-note-color`.

In a dark preferred color scheme, the local type fallbacks switch to `#4493f8`
(note), `#ab7df8` (important), `#d29922` (warning), `#3fb950` (tip), and
`#f85149` (caution). The private `*-default` properties used for that switch
are implementation details; set the documented variables above instead.

The built-in GitHub theme defines the optional `--base-*`, `--borderColor-*`,
and `--fgColor-*` inputs, preserving its original colors and spacing. Other
themes can use the hook defaults or override only the variables they need:

```css
body:has(#markdown-preview-themes[data-theme="my-docs"][data-hook="github"]) {
  --markdown-preview-themes-github-alert-note-color: #7c3aed;
  --markdown-preview-themes-github-alert-note-border-color: #7c3aed;
}
```
