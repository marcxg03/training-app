import matter from "gray-matter";

import type { MarkdownTable } from "./types";

function getMarkdownContent(markdown: string) {
  return matter(markdown).content.replace(/\r\n/g, "\n");
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function stripMarkdown(raw: string) {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .trim();
}

export function extractTables(markdown: string): MarkdownTable[] {
  const lines = getMarkdownContent(markdown).split("\n");
  const tables: MarkdownTable[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!/^\s*\|.*\|\s*$/.test(lines[index])) {
      index += 1;
      continue;
    }

    const tableLines: string[] = [];

    while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
      tableLines.push(lines[index]);
      index += 1;
    }

    if (tableLines.length < 2) {
      continue;
    }

    const headers = splitTableRow(tableLines[0]).map(stripMarkdown);
    const potentialSeparator = splitTableRow(tableLines[1]);

    if (!isSeparatorRow(potentialSeparator)) {
      continue;
    }

    const rows = tableLines
      .slice(2)
      .map((line) => splitTableRow(line).map(stripMarkdown))
      .filter((cells) => cells.some((cell) => cell.length > 0));

    tables.push({ headers, rows });
  }

  return tables;
}

export function extractSections(markdown: string, level: 2 | 3) {
  const content = getMarkdownContent(markdown);
  const lines = content.split("\n");
  const sections = new Map<string, string>();
  const headingPrefix = "#".repeat(level);
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const headingLevel = headingMatch[1].length;

      if (currentHeading && headingLevel <= level) {
        sections.set(currentHeading, currentLines.join("\n").trim());
        currentHeading = null;
        currentLines = [];
      }

      if (headingLevel === level) {
        currentHeading = stripMarkdown(headingMatch[2]).trim();
        currentLines = [];
      }

      continue;
    }

    if (currentHeading) {
      currentLines.push(line);
    }
  }

  if (currentHeading) {
    sections.set(currentHeading, currentLines.join("\n").trim());
  }

  return sections;
}

export function parseKeyValue(line: string) {
  const match = stripMarkdown(line).match(/^([^:]+):\s*(.+)$/);

  if (!match) {
    return null;
  }

  return {
    key: match[1].trim(),
    value: match[2].trim(),
  };
}

export function normalizeExerciseName(raw: string) {
  return stripMarkdown(raw).replace(/\s+/g, " ").replace(/[–—]/g, "-").trim();
}
