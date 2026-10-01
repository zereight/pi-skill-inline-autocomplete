/**
 * Inline skill autocomplete anywhere in the editor (not only line 0).
 * Trigger: whitespace-or-start + `/` + optional skill name (no `skill:` required).
 * Completion inserts `/skill:name` (Pi’s explicit skill command).
 * Core slash menu stays first-line-only; this stacks on ctx.ui.addAutocompleteProvider.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir, loadSkills, type Skill } from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	type AutocompleteProvider,
	type AutocompleteSuggestions,
	fuzzyFilter,
} from "@earendil-works/pi-tui";

const MAX_SUGGESTIONS = 20;
const INLINE_SKILL_SLASH_RE = /(?:^|[\s])(\/(?:skill:)?[^\s/]*)$/;

type SkillEntry = Pick<Skill, "name" | "description">;

type InlineSkillContext = {
	query: string;
	prefix: string;
};

function isCoreSlashCommandLine(cursorLine: number, textBeforeCursor: string): boolean {
	return cursorLine === 0 && textBeforeCursor.trimStart().startsWith("/");
}

function extractInlineSkillContext(textBeforeCursor: string): InlineSkillContext | undefined {
	const match = textBeforeCursor.match(INLINE_SKILL_SLASH_RE);
	const prefix = match?.[1];
	if (!prefix) {
		return undefined;
	}
	const query = prefix.startsWith("/skill:") ? prefix.slice("/skill:".length) : prefix.slice(1);
	return { query, prefix };
}

function expandHome(path: string): string {
	if (path.startsWith("~/")) {
		return join(homedir(), path.slice(2));
	}
	return path;
}

function readSkillsConfig(agentDir: string, cwd: string): { skillPaths: string[]; includeDefaults: boolean } {
	const skillPaths: string[] = [];
	let includeDefaults = true;

	const settingsFiles = [join(agentDir, "settings.json"), join(cwd, ".pi", "settings.json")];

	for (const file of settingsFiles) {
		if (!existsSync(file)) {
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(readFileSync(file, "utf8"));
		} catch {
			continue;
		}
		if (!parsed || typeof parsed !== "object") {
			continue;
		}
		const skillsValue = Reflect.get(parsed, "skills");
		if (!Array.isArray(skillsValue)) {
			continue;
		}
		for (const entry of skillsValue) {
			if (typeof entry !== "string") {
				continue;
			}
			if (entry.startsWith("!")) {
				if (entry === "!skills/**" || entry.includes("/skills")) {
					includeDefaults = false;
				}
				continue;
			}
			skillPaths.push(expandHome(entry));
		}
	}

	return { skillPaths: [...new Set(skillPaths)], includeDefaults };
}

function loadSkillEntries(cwd: string): SkillEntry[] {
	const agentDir = getAgentDir();
	const { skillPaths, includeDefaults } = readSkillsConfig(agentDir, cwd);
	const result = loadSkills({
		cwd,
		agentDir,
		skillPaths,
		includeDefaults,
	});
	return result.skills.map((skill) => ({
		name: skill.name,
		description: skill.description,
	}));
}

function formatSkillItem(skill: SkillEntry): AutocompleteItem {
	return {
		value: `/skill:${skill.name}`,
		label: skill.name,
		description: skill.description,
	};
}

function filterSkills(skills: SkillEntry[], query: string): AutocompleteItem[] {
	if (!query.trim()) {
		return skills.slice(0, MAX_SUGGESTIONS).map(formatSkillItem);
	}
	return fuzzyFilter(skills, query, (skill) => `${skill.name} ${skill.description}`)
		.slice(0, MAX_SUGGESTIONS)
		.map(formatSkillItem);
}

function createSkillInlineProvider(
	current: AutocompleteProvider,
	getSkills: () => SkillEntry[],
): AutocompleteProvider {
	return {
		async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
			const currentLine = lines[cursorLine] ?? "";
			const textBeforeCursor = currentLine.slice(0, cursorCol);

			if (isCoreSlashCommandLine(cursorLine, textBeforeCursor)) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const inlineContext = extractInlineSkillContext(textBeforeCursor);
			if (inlineContext === undefined) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const skills = getSkills();
			if (options.signal.aborted || skills.length === 0) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			const suggestions = filterSkills(skills, inlineContext.query);
			if (suggestions.length === 0) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}

			return {
				items: suggestions,
				prefix: inlineContext.prefix,
			};
		},

		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
		},

		shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}

export default function skillInlineAutocompleteExtension(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) {
			return;
		}

		const getSkills = (): SkillEntry[] => loadSkillEntries(ctx.cwd);

		ctx.ui.addAutocompleteProvider((current) => createSkillInlineProvider(current, getSkills));
	});
}
