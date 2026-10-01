# pi-skill-inline-autocomplete

Inline `/skill:` autocomplete for [Pi coding agent](https://pi.dev) — type `/` followed by letters **anywhere in the prompt** (not just at the start of line 0) to fuzzy-find and complete skills.

## What it does

Pi's built-in slash menu only opens at the start of line 0. This extension stacks an autocomplete provider on top so you can trigger skill suggestions mid-sentence, on any line:

| Input | Result |
| --- | --- |
| `fix this /zer` | Fuzzy-matches skills like `zereight-mode` |
| `fix this /skill:zer` | Same, using the explicit `/skill:` trigger |
| `/reload` on line 0 | Left alone — the core slash menu keeps handling it |

Accepting a suggestion inserts Pi's explicit skill command `/skill:<name>`, which stays recognized regardless of your `enableSkillCommands` setting.

## Install

```bash
pi install npm:pi-skill-inline-autocomplete
```

Or try it for one session without installing:

```bash
pi -e npm:pi-skill-inline-autocomplete
```

## Usage

1. Type `/` preceded by whitespace (or at the start of any line other than the slash-menu context) and a few letters of a skill name — e.g. `review this /zere`.
2. Press **Tab** to open the suggestion list (once the list is open, typing keeps filtering it).
3. Use **↑/↓** to pick, **Enter** to insert.

The first completion character run becomes `/skill:`; the rest of the query fuzzy-filters against skill names and descriptions (top 20 shown). Skill discovery follows the same `skills` config Pi itself uses — your `~/.pi/agent/settings.json` and project `.pi/settings.json` entries (including `!` exclusions) are honored.

## Requirements

- Pi coding agent with a TUI session (`ctx.hasUI`)
- Host-provided `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` (declared as peers; Pi supplies them)

## License

MIT