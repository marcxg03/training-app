import {
  getHighLevelMuscleGroups,
  getPrimaryMuscleGroupLabel,
} from "../../../src/lib/methodology/muscle-groups";
import {
  extractSections,
  extractTables,
  normalizeExerciseName,
  stripMarkdown,
} from "./parser";
import type {
  BlockType,
  DayOfWeek,
  ParsedBlock,
  ParsedCardioSession,
  ParsedDaySpec,
  ParsedExerciseSpec,
  ParsedHistoricalPR,
  ParsedNutritionTargets,
  ParsedRecoverySession,
  ParsedSessionSpec,
  ParsedWeeklyDay,
  ParsedWeeklySchedule,
  PullSubBank,
  Timing,
  TrainingPlanSpec,
  ValidationResult,
  WikiFiles,
} from "./types";

const dayNameToEnum: Record<string, DayOfWeek> = {
  Monday: "mon",
  Tuesday: "tue",
  Wednesday: "wed",
  Thursday: "thu",
  Friday: "fri",
  Saturday: "sat",
  Sunday: "sun",
};

const dayEnumToLabel: Record<DayOfWeek, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const dayOrder: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const historicalPrExerciseNames = new Set([
  "Barbell Bench Press",
  "Seated Overhead BB Press",
  "Conventional Deadlift",
]);

const exerciseNameMap: Record<string, string> = {
  "BB RDL": "BB Romanian Deadlift",
  "BW Pull Ups": "Bodyweight Pull Ups",
  "Barbell Shrug": "Barbell Shrug",
  "Cable/Machine Pullover": "Cable/Machine Pullover",
  "DB RDL": "DB Romanian Deadlift",
  "DB Shrug": "DB Shrug",
  "Military Press": "Military Press",
  "Seated DB Press": "Seated DB Shoulder Press",
  "Seated OHP BB": "Seated Overhead BB Press",
  "3-Point DB Row": "3-Point Single Arm DB Row",
  "Bent Over BB Row": "Bent Over Barbell Row",
  "Cable Rope Face Pulls": "Cable Rope Face Pulls",
  "Cable Pushdown": "Cable Pushdown",
  "Cable Wood Chopper": "Cable Wood Chopper",
  "Heel Elevated BB Back Squat": "Heel Elevated BB Back Squat",
  "Single Leg ATG Split Squat": "ATG Split Squat",
  "Single Leg BB Squat": "Single Leg BB Squat",
  "Single Arm Chest Supported Row": "Single Arm Chest Supported Row",
  "Single Arm Cable Pushdown": "Single Arm Cable Pushdown",
  "Single Arm Cable Lateral Raise": "Single Arm Cable Lateral Raise",
};

function inferTiming(sessionLabel: string): Timing {
  const normalized = sessionLabel.toLowerCase();

  if (normalized.includes("(am)")) {
    return "am";
  }

  if (normalized.includes("(pm)")) {
    return "pm";
  }

  return "anytime";
}

function parseRange(value: string) {
  const match = value.match(/(\d[\d,]*)\s*[–-]\s*(\d[\d,]*)/);

  if (!match) {
    throw new Error(`Could not parse nutrition range from "${value}".`);
  }

  return {
    min: Number.parseInt(match[1].replace(/,/g, ""), 10),
    max: Number.parseInt(match[2].replace(/,/g, ""), 10),
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function expandCompoundExerciseName(name: string) {
  switch (name) {
    case "Cable/Machine Pullover":
      return ["Cable Pullover", "Machine Pullover"];
    case "BB/DB Shrug":
      return ["Barbell Shrug", "DB Shrug"];
    case "Cable Pushdown (various grips)":
      return ["Cable Pushdown"];
    default:
      return [name];
  }
}

function cleanExerciseToken(token: string) {
  return normalizeExerciseName(token)
    .replace(/^(Lats|Upper Back|Teres Major|Rear Delts):\s*/i, "")
    .replace(/^from rear delt bank$/i, "")
    .replace(/^\d+\s+sets?\s*[-—].*$/i, "")
    .replace(/^skill\/power opener$/i, "")
    .replace(/\(current focus - fixed\)/gi, "")
    .replace(/\(current focus — fixed\)/gi, "")
    .replace(/\(\+ burnout set\)/gi, "")
    .replace(/\(various grips\)/gi, "")
    .replace(/\(at least one preacher\)/gi, "")
    .replace(/\(min 1x\/week\)/gi, "")
    .replace(/\(foot elevated\)/gi, "")
    .replace(/\(single arm\)/gi, "")
    .replace(/\(both arms\)/gi, "")
    .replace(/\(double arm\)/gi, "")
    .replace(/\(chest setting\)/gi, "")
    .replace(/\(EZ Bar\)/gi, "")
    .replace(/\(DB\)/gi, "")
    .replace(/\(atg day\)/gi, "")
    .replace(/\(Lower Compound day only\)/gi, "")
    .replace(/\(ATG day only\)/gi, "")
    .replace(/\(AM\)/gi, "")
    .replace(/\(PM\)/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function toCanonicalExerciseName(raw: string) {
  const cleaned = cleanExerciseToken(raw);
  return exerciseNameMap[cleaned] ?? cleaned;
}

function extractExerciseNotesMap(trainingLogMd: string) {
  const sections = extractSections(trainingLogMd, 2);
  const notesByExercise = new Map<string, string>();

  for (const [, sectionContent] of sections) {
    const [table] = extractTables(sectionContent);

    if (!table) {
      continue;
    }

    const exerciseIndex = table.headers.findIndex(
      (header) => header === "Exercise",
    );
    const notesIndex = table.headers.findIndex((header) => header === "Notes");

    if (exerciseIndex < 0 || notesIndex < 0) {
      continue;
    }

    for (const row of table.rows) {
      const rawName = row[exerciseIndex];
      const rawNotes = normalizeWhitespace(row[notesIndex] ?? "");

      if (!rawName) {
        continue;
      }

      const canonicalName = toCanonicalExerciseName(rawName);
      notesByExercise.set(canonicalName, rawNotes);
    }
  }

  notesByExercise.set(
    "Cable Wood Chopper",
    "Minimum once per week across abs rounds.",
  );
  notesByExercise.set("Barbell Bench Press", "Current primary focus.");
  notesByExercise.set(
    "Muscle Ups",
    "Two sets for skill and power before the main pull work.",
  );

  return notesByExercise;
}

function extractDocumentTitle(markdown: string) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1]) : null;
}

function summarizeMarkdownLines(lines: string[]) {
  return lines
    .map((line) => stripMarkdown(line.replace(/^- /, "")))
    .filter(Boolean)
    .join(" ");
}

function buildRunningDescription(sectionContent: string) {
  const lines = sectionContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^\*\*.+\*\*$/.test(line)) {
      if (currentHeading && currentLines.length > 0) {
        paragraphs.push(
          `${stripMarkdown(currentHeading)}: ${summarizeMarkdownLines(currentLines)}`,
        );
      }

      currentHeading = line;
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  if (currentHeading && currentLines.length > 0) {
    paragraphs.push(
      `${stripMarkdown(currentHeading)}: ${summarizeMarkdownLines(currentLines)}`,
    );
  }

  if (paragraphs.length === 0) {
    return summarizeMarkdownLines(lines);
  }

  return paragraphs.join(" ");
}

function describeBasketballSession() {
  return "Pickup game or league play at game pace.";
}

function dedupeTags(tags: string[]) {
  return [...new Set(tags)];
}

function inferChestRule(blockContext: string) {
  return /chest/i.test(blockContext);
}

function inferBlockRepRange(blockContext: string, typeValue: string) {
  if (inferChestRule(blockContext)) {
    return {
      isCompound: true,
      prescribedMin: 6,
      prescribedMax: 8,
    };
  }

  if (/compound/i.test(typeValue)) {
    return {
      isCompound: true,
      prescribedMin: 6,
      prescribedMax: 8,
    };
  }

  return {
    isCompound: false,
    prescribedMin: 8,
    prescribedMax: 10,
  };
}

function inferBlockType(
  sessionName: string,
  blockName: string,
  displayOrder: number,
): BlockType {
  if (sessionName === "Lower ATG" && displayOrder <= 8) {
    return "mobility";
  }

  if (/corrective/i.test(blockName)) {
    return "corrective";
  }

  return "failure";
}

function inferFocusMuscleGroups(blocks: ParsedBlock[]) {
  const focusGroups = new Set<string>();

  for (const block of blocks) {
    for (const exercise of block.exercises) {
      for (const group of getHighLevelMuscleGroups(exercise.muscleGroups)) {
        focusGroups.add(group);
      }
    }
  }

  return [...focusGroups];
}

function findSectionBySessionName(
  sections: Map<string, string>,
  sessionName: string,
) {
  const normalizedSessionName = sessionName.toLowerCase();

  for (const [title, section] of sections) {
    if (title.toLowerCase().includes(normalizedSessionName)) {
      return section;
    }
  }

  throw new Error(`Could not find a section for session "${sessionName}".`);
}

function parseDelimitedExercises(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function inferPullSubBank(
  blockContext: string,
  exerciseName: string,
): PullSubBank | undefined {
  if (!/area of focus/i.test(blockContext)) {
    return undefined;
  }

  if (
    [
      "Cable Pullover",
      "Machine Pullover",
      "Kneeling Single Arm Cable Lat Row",
      "Single Arm Chest Supported Row",
    ].includes(exerciseName)
  ) {
    return "lats";
  }

  if (exerciseName === "Straight Arm Cable Pulldown") {
    return "teres_major";
  }

  if (["Meadows Row", "Barbell Shrug", "DB Shrug"].includes(exerciseName)) {
    return "upper_back";
  }

  if (
    [
      "Reverse Pec Deck",
      "Single Arm Cable Rear Delt Fly",
      "Cable Rope Face Pulls",
    ].includes(exerciseName)
  ) {
    return "rear_delts";
  }

  return undefined;
}

function parseExerciseBank(
  blockName: string,
  typeValue: string,
  rawPrimary: string,
  rawSecondary: string,
  notesByExercise: Map<string, string>,
) {
  const combined = [rawPrimary, rawSecondary]
    .filter(Boolean)
    .flatMap((cell) => parseDelimitedExercises(cell))
    .flatMap(expandCompoundExerciseName)
    .map(toCanonicalExerciseName)
    .filter(
      (exerciseName) =>
        exerciseName.length > 0 &&
        exerciseName !== "—" &&
        exerciseName !== "-" &&
        exerciseName.toLowerCase() !== "skill/power opener" &&
        exerciseName.toLowerCase() !== "optional" &&
        !/^fatigue dependent$/i.test(exerciseName),
    );

  const uniqueExerciseNames = dedupeTags(combined);

  if (uniqueExerciseNames.length === 0) {
    uniqueExerciseNames.push(toCanonicalExerciseName(blockName));
  }

  const repRange = inferBlockRepRange(blockName, typeValue);

  return uniqueExerciseNames.map<ParsedExerciseSpec>((exerciseName, index) => {
    const notes = notesByExercise.get(exerciseName) ?? "";
    const pullSubBank = inferPullSubBank(blockName, exerciseName);

    return {
      name: exerciseName,
      notes,
      prescribedMin: repRange.prescribedMin,
      prescribedMax: repRange.prescribedMax,
      muscleGroups: inferMuscleGroupsForExercise(
        exerciseName,
        blockName,
        pullSubBank,
      ),
      isCompound: repRange.isCompound,
      displayOrder: index,
      pullSubBank,
    };
  });
}

function ensureSectionTable(sectionContent: string, sessionName: string) {
  const [table] = extractTables(sectionContent);

  if (!table) {
    throw new Error(`Missing exercise table for session "${sessionName}".`);
  }

  return table;
}

export function parseWeeklySchedule(
  currentPlanMd: string,
): ParsedWeeklySchedule {
  const weeklyScheduleSection = extractSections(currentPlanMd, 2).get(
    "Weekly Schedule",
  );

  if (!weeklyScheduleSection) {
    throw new Error('Missing "Weekly Schedule" section in current-plan.md.');
  }

  const [table] = extractTables(weeklyScheduleSection);

  if (!table) {
    throw new Error("Missing Weekly Schedule table in current-plan.md.");
  }

  const dayIndex = table.headers.findIndex((header) => header === "Day");
  const sessionIndex = table.headers.findIndex(
    (header) => header === "Session",
  );
  const gymIndex = table.headers.findIndex((header) => header === "Gym");
  const addOnsIndex = table.headers.findIndex((header) => header === "Add-ons");

  if (
    [dayIndex, sessionIndex, gymIndex, addOnsIndex].some((index) => index < 0)
  ) {
    throw new Error("Weekly Schedule table is missing required columns.");
  }

  const days = table.rows.map<ParsedWeeklyDay>((row) => {
    const dayLabel = row[dayIndex];
    const dayOfWeek = dayNameToEnum[dayLabel];

    if (!dayOfWeek) {
      throw new Error(`Unsupported day "${dayLabel}" in Weekly Schedule.`);
    }

    const sessionValue = row[sessionIndex];
    const gymValue = row[gymIndex] === "—" ? null : row[gymIndex];
    const addOnsValue = row[addOnsIndex] === "—" ? "" : row[addOnsIndex];

    if (/complete rest/i.test(sessionValue)) {
      return {
        dayOfWeek,
        dayLabel,
        isRestDay: true,
        gym: null,
        sessionEntries: [],
        recoveryLabels: addOnsValue ? [addOnsValue] : [],
      };
    }

    const sessionEntries = sessionValue
      .split("→")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const sessionName = normalizeWhitespace(
          entry.replace(/\((AM|PM)\)/gi, ""),
        );
        const lowerSessionName = sessionName.toLowerCase();
        const sessionType =
          lowerSessionName.includes("run") ||
          lowerSessionName.includes("basketball")
            ? "cardio"
            : "lifting";

        return {
          sessionName,
          sessionType,
          timing: inferTiming(entry),
        } as const;
      });

    return {
      dayOfWeek,
      dayLabel,
      isRestDay: false,
      gym: gymValue,
      sessionEntries,
      recoveryLabels: addOnsValue ? [addOnsValue] : [],
    };
  });

  return { days };
}

export function parseSessionBlocks(
  currentPlanMd: string,
  sessionName: string,
): ParsedBlock[] {
  const sections = extractSections(currentPlanMd, 2);
  const sectionContent = findSectionBySessionName(sections, sessionName);
  const table = ensureSectionTable(sectionContent, sessionName);
  const blockIndex = table.headers.findIndex((header) => header === "Block");
  const primaryIndex = table.headers.findIndex(
    (header) => header === "Primary Exercises",
  );
  const secondaryIndex = table.headers.findIndex(
    (header) => header === "Secondary Exercises",
  );
  const typeIndex = table.headers.findIndex((header) => header === "Type");
  const notesByExercise = new Map<string, string>();

  if (
    [blockIndex, primaryIndex, secondaryIndex, typeIndex].some(
      (index) => index < 0,
    )
  ) {
    throw new Error(
      `Session "${sessionName}" table is missing required columns.`,
    );
  }

  const mergedRows: Array<{
    blockName: string;
    primaryExercises: string;
    secondaryExercises: string;
    typeValue: string;
  }> = [];

  for (const row of table.rows) {
    const blockName = normalizeWhitespace(row[blockIndex] ?? "");
    const primaryExercises = normalizeWhitespace(row[primaryIndex] ?? "");
    const secondaryExercises = normalizeWhitespace(row[secondaryIndex] ?? "");
    const typeValue = normalizeWhitespace(row[typeIndex] ?? "");

    if (!blockName && mergedRows.length > 0) {
      const currentRow = mergedRows[mergedRows.length - 1];

      currentRow.primaryExercises = [
        currentRow.primaryExercises,
        primaryExercises,
      ]
        .filter(Boolean)
        .join(", ");
      currentRow.secondaryExercises = [
        currentRow.secondaryExercises,
        secondaryExercises,
      ]
        .filter(Boolean)
        .join(", ");

      if (!currentRow.typeValue && typeValue) {
        currentRow.typeValue = typeValue;
      }

      continue;
    }

    mergedRows.push({
      blockName,
      primaryExercises,
      secondaryExercises,
      typeValue,
    });
  }

  return mergedRows.map((row, index) => {
    const normalizedBlockName =
      row.blockName === "Lateral Raise Burnout"
        ? "Lateral Raise"
        : row.blockName;

    const exercises =
      row.blockName === "Lateral Raise Burnout"
        ? parseExerciseBank(
            "Lateral Raise",
            row.typeValue,
            "Single Arm Cable Lateral Raise",
            "DB Lateral Raise, Seated DB Lateral Raise",
            notesByExercise,
          )
        : parseExerciseBank(
            normalizedBlockName,
            row.typeValue,
            row.primaryExercises,
            row.secondaryExercises,
            notesByExercise,
          );

    return {
      blockName: normalizedBlockName,
      blockType: inferBlockType(sessionName, normalizedBlockName, index + 1),
      displayOrder: index + 1,
      exercises,
    };
  });
}

export function inferMuscleGroupsForExercise(
  exerciseName: string,
  blockContext: string,
  pullSubBank?: PullSubBank,
) {
  const normalizedBlock = blockContext.toLowerCase();
  let tags: string[] = [];

  if (/upper chest|mid chest|lower chest/.test(normalizedBlock)) {
    tags = ["chest"];
  } else if (/shoulder press|lateral raise/.test(normalizedBlock)) {
    tags = ["shoulders"];
  } else if (/vertical pull|horizontal pull/.test(normalizedBlock)) {
    tags = ["back"];
  } else if (/rear delts/.test(normalizedBlock)) {
    tags = ["shoulders", "back"];
  } else if (/muscle ups/.test(normalizedBlock)) {
    tags = ["back"];
  } else if (/triceps/.test(normalizedBlock)) {
    tags = ["arms", "triceps"];
  } else if (/biceps/.test(normalizedBlock)) {
    tags = ["arms", "biceps"];
  } else if (
    /squat|hinge|hip thrust|quad accessory|hamstring accessory/.test(
      normalizedBlock,
    )
  ) {
    tags = ["legs"];
  } else if (/calves/.test(normalizedBlock)) {
    tags = ["calves"];
  } else if (/abs/.test(normalizedBlock)) {
    tags = ["core"];
  } else if (/atg split squat/.test(normalizedBlock)) {
    tags = ["legs"];
  } else if (/jefferson curl|seated good mornings/.test(normalizedBlock)) {
    tags = ["back", "core"];
  } else if (/tib raises/.test(normalizedBlock)) {
    tags = ["legs", "tibialis"];
  } else if (/low back extensions/.test(normalizedBlock)) {
    tags = ["core", "lower_back"];
  }

  if (/area of focus/.test(normalizedBlock)) {
    tags = ["back"];

    switch (pullSubBank) {
      case "lats":
        tags.push("lats");

        if (
          exerciseName === "Cable Pullover" ||
          exerciseName === "Machine Pullover"
        ) {
          tags.push("teres_major");
        }
        break;
      case "upper_back":
        tags.push("upper_back");
        break;
      case "teres_major":
        tags.push("teres_major");
        break;
      case "rear_delts":
        tags.push("shoulders", "rear_delts");
        break;
      default:
        break;
    }
  }

  return dedupeTags(tags);
}

export function parseRunningSessions(
  currentPlanMd: string,
): ParsedCardioSession[] {
  const runningSectionMatch = currentPlanMd.match(
    /## Running Sessions([\s\S]*?)## Warm-Up Protocols/,
  );
  const runningSection = runningSectionMatch?.[1]?.trim();

  if (!runningSection) {
    throw new Error('Missing "Running Sessions" section in current-plan.md.');
  }

  const sections = runningSection
    .split(/^###\s+/m)
    .map((section) => section.trim())
    .filter(Boolean)
    .map((section) => {
      const [titleLine, ...contentLines] = section.split("\n");

      return {
        title: stripMarkdown(titleLine),
        content: contentLines.join("\n").trim(),
      };
    });
  const sessions: ParsedCardioSession[] = [];

  for (const { title, content } of sections) {
    if (/Monday AM/i.test(title)) {
      sessions.push({
        sessionName: "Speed Run",
        timing: "am",
        cardioFormat: "speed_run",
        cardioDistance: "5×100m",
        cardioTargetZone: "sprint",
        description: buildRunningDescription(content),
      });
    }

    if (/Saturday AM/i.test(title)) {
      sessions.push({
        sessionName: "Endurance Run",
        timing: "am",
        cardioFormat: "endurance_run",
        cardioDistance: "3 miles",
        cardioTargetZone: "zone_2",
        description: summarizeMarkdownLines(content.split("\n")),
      });
    }
  }

  if (sessions.length !== 2) {
    throw new Error("Expected to parse exactly two running sessions.");
  }

  return sessions;
}

export function parseRecoveryActivities(
  currentPlanMd: string,
  planDecisionsMd: string,
): ParsedRecoverySession[] {
  const weeklySchedule = parseWeeklySchedule(currentPlanMd);

  if (
    !/Thursday after Push/i.test(planDecisionsMd) ||
    !/Weekend \(Sat or Sun\)/i.test(planDecisionsMd)
  ) {
    throw new Error(
      "plan-decisions.md is missing the expected recovery policy text.",
    );
  }

  return weeklySchedule.days.flatMap((day) => {
    return day.recoveryLabels.map((label) => {
      if (/hot yoga or sauna/i.test(label)) {
        return {
          dayOfWeek: day.dayOfWeek,
          sessionName: "Hot Yoga or Sauna",
          timing: "pm" as const,
          description: "Hot Yoga or Sauna (alternates with Sunday).",
        };
      }

      if (/sauna$/i.test(label)) {
        return {
          dayOfWeek: day.dayOfWeek,
          sessionName: "Sauna",
          timing: "pm" as const,
          description:
            "Sauna after lifting as the guaranteed weekly sauna slot.",
        };
      }

      throw new Error(`Unsupported recovery label "${label}".`);
    });
  });
}

export function parseNutritionTargets(
  nutritionMd: string,
): ParsedNutritionTargets {
  const targetsSection = extractSections(nutritionMd, 2).get(
    "Targets (Ranges, Not Fixed Numbers)",
  );

  if (!targetsSection) {
    throw new Error(
      'Missing "Targets (Ranges, Not Fixed Numbers)" section in nutrition.md.',
    );
  }

  const [table] = extractTables(targetsSection);

  if (!table) {
    throw new Error("Missing nutrition targets table.");
  }

  const metricIndex = table.headers.findIndex((header) => header === "Metric");
  const rangeIndex = table.headers.findIndex((header) => header === "Range");

  if (metricIndex < 0 || rangeIndex < 0) {
    throw new Error("Nutrition targets table is missing required columns.");
  }

  const targetMap = new Map<string, { min: number; max: number }>();

  for (const row of table.rows) {
    targetMap.set(row[metricIndex], parseRange(row[rangeIndex]));
  }

  const calories = targetMap.get("Calories");
  const protein = targetMap.get("Protein");
  const carbs = targetMap.get("Carbs");
  const fat = targetMap.get("Fat");

  if (!calories || !protein || !carbs || !fat) {
    throw new Error(
      "Nutrition targets table is missing one or more macro rows.",
    );
  }

  return {
    calMin: calories.min,
    calMax: calories.max,
    proteinMinG: protein.min,
    proteinMaxG: protein.max,
    carbsMinG: carbs.min,
    carbsMaxG: carbs.max,
    fatMinG: fat.min,
    fatMaxG: fat.max,
  };
}

export function parseHistoricalPRs(
  trainingLogMd: string,
): ParsedHistoricalPR[] {
  const sections = extractSections(trainingLogMd, 2);
  const prs: ParsedHistoricalPR[] = [];

  for (const [, sectionContent] of sections) {
    const [table] = extractTables(sectionContent);

    if (!table) {
      continue;
    }

    const exerciseIndex = table.headers.findIndex(
      (header) => header === "Exercise",
    );
    const prIndex = table.headers.findIndex(
      (header) => header === "PR (weight × reps)",
    );

    if (exerciseIndex < 0 || prIndex < 0) {
      continue;
    }

    for (const row of table.rows) {
      const exerciseName = toCanonicalExerciseName(row[exerciseIndex] ?? "");
      const rawPr = row[prIndex] ?? "";

      if (!historicalPrExerciseNames.has(exerciseName) || !rawPr) {
        continue;
      }

      const match = rawPr.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+)/);

      if (!match) {
        continue;
      }

      prs.push({
        exerciseName,
        prType: "weight",
        weightKg: Number.parseFloat(match[1]),
        reps: Number.parseInt(match[2], 10),
      });
    }
  }

  return prs;
}

function buildCardioSessionMap(currentPlanMd: string) {
  const runningSessions = parseRunningSessions(currentPlanMd);
  const cardioSessions = new Map<string, ParsedCardioSession>();

  for (const session of runningSessions) {
    cardioSessions.set(session.sessionName, session);
  }

  cardioSessions.set("Basketball", {
    sessionName: "Basketball",
    timing: "anytime",
    cardioFormat: "basketball",
    cardioDistance: null,
    cardioTargetZone: "game_pace",
    description: describeBasketballSession(),
  });

  return cardioSessions;
}

function validateTrainingPlan(days: ParsedDaySpec[]): ValidationResult {
  const hardViolations: string[] = [];
  const softWarnings: string[] = [];
  const lastSeenDayByMuscleGroup = new Map<string, number>();
  const hardRecoveryGroups = new Set(["chest", "back", "legs"]);
  let pushSessions = 0;
  let pullSessions = 0;
  let restDayCount = 0;
  let guaranteedSaunaCount = 0;

  for (const [index, day] of days.entries()) {
    if (day.isRestDay) {
      restDayCount += 1;
    }

    const recoveryNames = day.sessions
      .filter((session) => session.sessionType === "recovery")
      .map((session) => session.sessionName);

    if (recoveryNames.includes("Sauna")) {
      guaranteedSaunaCount += 1;
    }

    if (
      recoveryNames.some((name) => /^Hot Yoga$/i.test(name)) &&
      recoveryNames.includes("Sauna")
    ) {
      hardViolations.push(
        `${day.dayLabel}: hot yoga and sauna cannot be scheduled on the same day.`,
      );
    }

    const liftingSessions = day.sessions.filter(
      (session) => session.sessionType === "lifting",
    );
    const dayFocusGroups = new Set<string>();
    const dayRecoveryGroups = new Set<string>();
    const dayCompoundGroups = new Set<string>();

    for (const session of liftingSessions) {
      const focusGroups = session.focusMuscleGroups;

      if (
        focusGroups.some((group) =>
          ["chest", "shoulders", "arms"].includes(group),
        )
      ) {
        pushSessions += 1;
      }

      if (focusGroups.some((group) => ["back", "arms"].includes(group))) {
        pullSessions += 1;
      }

      for (const block of session.blocks) {
        for (const exercise of block.exercises) {
          const highLevelGroups = getHighLevelMuscleGroups(
            exercise.muscleGroups,
          );

          for (const group of highLevelGroups) {
            dayFocusGroups.add(group);

            if (
              block.blockType !== "mobility" &&
              hardRecoveryGroups.has(group)
            ) {
              dayRecoveryGroups.add(group);
            }

            if (
              block.blockType !== "mobility" &&
              exercise.isCompound &&
              hardRecoveryGroups.has(group)
            ) {
              dayCompoundGroups.add(group);
            }
          }
        }
      }

      if (session.focusMuscleGroups.length === 0) {
        hardViolations.push(
          `${day.dayLabel}: lifting session "${session.sessionName}" is missing inferred muscle groups.`,
        );
      }
    }

    for (const group of dayRecoveryGroups) {
      const previousDayIndex = lastSeenDayByMuscleGroup.get(group);

      if (previousDayIndex !== undefined && index - previousDayIndex < 2) {
        hardViolations.push(
          `${day.dayLabel}: ${group} repeats before 48 hours of recovery.`,
        );
      }

      if (dayCompoundGroups.has(group) && previousDayIndex === index - 1) {
        softWarnings.push(
          `${day.dayLabel}: compound ${group} work is inside the 24-hour recovery window.`,
        );
      }

      lastSeenDayByMuscleGroup.set(group, index);
    }

    const cardioIndices = day.sessions
      .filter((session) => session.sessionType === "cardio")
      .map((session) => session.displayOrder);
    const liftingIndices = day.sessions
      .filter((session) => session.sessionType === "lifting")
      .map((session) => session.displayOrder);

    if (
      cardioIndices.length > 0 &&
      liftingIndices.length > 0 &&
      Math.min(...cardioIndices) < Math.min(...liftingIndices)
    ) {
      softWarnings.push(
        `${day.dayLabel}: cardio is scheduled before lifting on the same day.`,
      );
    }

    if (
      day.sessions.filter((session) => session.sessionType !== "recovery")
        .length >= 2 &&
      day.sessions.some((session) => session.sessionType === "recovery")
    ) {
      softWarnings.push(
        `${day.dayLabel}: recovery activity is scheduled on a multi-session day.`,
      );
    }
  }

  if (restDayCount < 1) {
    hardViolations.push(
      "The weekly plan must include at least one full rest day.",
    );
  }

  if (guaranteedSaunaCount > 2) {
    hardViolations.push(
      "The weekly plan cannot guarantee more than two sauna sessions.",
    );
  }

  if (Math.abs(pushSessions - pullSessions) > 1) {
    hardViolations.push(
      "Push and pull session counts are out of weekly balance.",
    );
  }

  return {
    hardViolations: dedupeTags(hardViolations),
    softWarnings: dedupeTags(softWarnings),
  };
}

export function parsePlanFromWiki(files: WikiFiles): TrainingPlanSpec {
  const weeklySchedule = parseWeeklySchedule(files.currentPlan);
  const cardioSessions = buildCardioSessionMap(files.currentPlan);
  const recoverySessions = parseRecoveryActivities(
    files.currentPlan,
    files.planDecisions,
  );
  const recoveryByDay = new Map<DayOfWeek, ParsedRecoverySession[]>();

  for (const recoverySession of recoverySessions) {
    const existing = recoveryByDay.get(recoverySession.dayOfWeek) ?? [];
    existing.push(recoverySession);
    recoveryByDay.set(recoverySession.dayOfWeek, existing);
  }

  const exerciseNotesByName = extractExerciseNotesMap(files.trainingLog);
  const days = weeklySchedule.days.map<ParsedDaySpec>((weeklyDay) => {
    const sessions: ParsedSessionSpec[] = weeklyDay.sessionEntries.map(
      (entry, index) => {
        if (entry.sessionType === "lifting") {
          const blocks = parseSessionBlocks(
            files.currentPlan,
            entry.sessionName,
          ).map((block) => ({
            ...block,
            exercises: block.exercises.map((exercise) => ({
              ...exercise,
              notes: exerciseNotesByName.get(exercise.name) ?? exercise.notes,
            })),
          }));

          for (const block of blocks) {
            for (const exercise of block.exercises) {
              if (!getPrimaryMuscleGroupLabel(exercise.muscleGroups)) {
                throw new Error(
                  `Exercise "${exercise.name}" in block "${block.blockName}" is missing a high-level muscle group tag.`,
                );
              }
            }
          }

          return {
            sessionName: entry.sessionName,
            sessionType: "lifting",
            timing: entry.timing,
            gym: weeklyDay.gym,
            description: null,
            displayOrder: index + 1,
            cardioFormat: null,
            cardioDistance: null,
            cardioTargetZone: null,
            blocks,
            focusMuscleGroups: inferFocusMuscleGroups(blocks),
          };
        }

        const cardio = cardioSessions.get(entry.sessionName);

        if (!cardio) {
          throw new Error(
            `Missing parsed cardio details for "${entry.sessionName}".`,
          );
        }

        return {
          sessionName: entry.sessionName,
          sessionType: "cardio",
          timing: entry.timing,
          gym: entry.sessionName === "Basketball" ? null : weeklyDay.gym,
          description: cardio.description,
          displayOrder: index + 1,
          cardioFormat: cardio.cardioFormat,
          cardioDistance: cardio.cardioDistance,
          cardioTargetZone: cardio.cardioTargetZone,
          blocks: [],
          focusMuscleGroups: [],
        };
      },
    );

    const recoveryForDay = recoveryByDay.get(weeklyDay.dayOfWeek) ?? [];

    for (const recovery of recoveryForDay) {
      sessions.push({
        sessionName: recovery.sessionName,
        sessionType: "recovery",
        timing: recovery.timing,
        gym:
          recovery.sessionName === "Hot Yoga or Sauna" ? null : weeklyDay.gym,
        description: recovery.description,
        displayOrder: sessions.length + 1,
        cardioFormat: null,
        cardioDistance: null,
        cardioTargetZone: null,
        blocks: [],
        focusMuscleGroups: [],
      });
    }

    return {
      dayOfWeek: weeklyDay.dayOfWeek,
      dayLabel: weeklyDay.dayLabel,
      isRestDay: weeklyDay.isRestDay,
      sessions,
    };
  });

  const validation = validateTrainingPlan(days);

  if (validation.hardViolations.length > 0) {
    throw new Error(
      `Schedule validation failed:\n- ${validation.hardViolations.join("\n- ")}`,
    );
  }

  return {
    name: "Marcus base plan v1",
    overviewTitle: extractDocumentTitle(files.overview),
    masterPlanTitle: extractDocumentTitle(files.masterPlan),
    days: dayOrder.map((dayOfWeek) => {
      const day = days.find((entry) => entry.dayOfWeek === dayOfWeek);

      if (!day) {
        throw new Error(
          `Weekly schedule is missing ${dayEnumToLabel[dayOfWeek]}.`,
        );
      }

      return day;
    }),
    nutritionTargets: parseNutritionTargets(files.nutrition),
    historicalPrs: parseHistoricalPRs(files.trainingLog),
    validation,
  };
}
