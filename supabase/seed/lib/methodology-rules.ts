import {
  isTypeOnlyNote,
  mergeExerciseNotes,
} from "../../../src/lib/methodology/exercise-notes";
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
  ParsedCardioActivity,
  ParsedDaySpec,
  ParsedExerciseSpec,
  ParsedHistoricalPR,
  ParsedNutritionTargets,
  ParsedRecoveryActivity,
  ParsedRecoveryWorkout,
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
const cardioBlockName = "Cardio";
const recoveryBlockName = "Recovery";

const historicalPrExerciseNames = new Set([
  "Barbell Bench Press",
  "Seated Overhead BB Press",
  "Conventional Deadlift",
]);

const exerciseNameMap: Record<string, string> = {
  "3-Point DB Row": "3-Point Single Arm DB Row",
  "Barbell Shrug": "Barbell Shrug",
  "BB RDL": "BB Romanian Deadlift",
  "BB/DB Shrug": "BB/DB Shrug",
  "Bent Over BB Row": "Bent Over Barbell Row",
  "BW Pull Ups": "Bodyweight Pull Ups",
  "Cable Pushdown": "Cable Pushdown",
  "Cable Rope Face Pulls": "Cable Rope Face Pulls",
  "Cable Wood Chopper": "Cable Wood Chopper",
  "Cable/Machine Pullover": "Cable/Machine Pullover",
  "DB RDL": "DB Romanian Deadlift",
  "DB Shrug": "DB Shrug",
  "Heel Elevated BB Back Squat": "Heel Elevated BB Back Squat",
  "Military Press": "Military Press",
  "Seated DB Press": "Seated DB Shoulder Press",
  "Seated OHP BB": "Seated Overhead BB Press",
  "Single Arm Cable Lateral Raise": "Single Arm Cable Lateral Raise",
  "Single Arm Cable Pushdown": "Single Arm Cable Pushdown",
  "Single Arm Chest Supported Row": "Single Arm Chest Supported Row",
  "Single Leg ATG Split Squat": "ATG Split Squat",
  "Single Leg BB Squat": "Single Leg BB Squat",
};

function inferTiming(workoutLabel: string): Timing {
  const normalized = workoutLabel.toLowerCase();

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

      // A Notes cell holding nothing but "Compound" / "Isolation" is the plan's
      // TYPE column leaking into a free-text field (T2-E). That classification
      // belongs to `exercises.is_compound`, which the seed already writes — as a
      // note it is pure noise, and it is what the logger's exercise picker
      // prints under the exercise name. Dropped HERE, at the point of reading,
      // so no downstream merge can resurrect it.
      //
      // Only NOTHING-BUT-a-type-word is dropped: "Compound — PR" and
      // "Isolation (ATG day)" are real notes and survive untouched.
      notesByExercise.set(
        toCanonicalExerciseName(rawName),
        isTypeOnlyNote(rawNotes) ? "" : rawNotes,
      );
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

  return paragraphs.length > 0
    ? paragraphs.join(" ")
    : summarizeMarkdownLines(lines);
}

function describeBasketballSession() {
  return "Pickup game or league play at game pace.";
}

function dedupeTags(values: string[]) {
  return [...new Set(values)];
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
  workoutName: string,
  blockName: string,
  displayOrder: number,
): BlockType {
  if (workoutName === "Lower ATG" && displayOrder <= 8) {
    return "mobility";
  }

  // The v3.0 Saturday "Prehab" day is a recovery/mobility session — its blocks
  // are restorative, so keep them out of the push/pull + 48h strength gates.
  if (/prehab/i.test(workoutName)) {
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

function findSectionByWorkoutName(
  sections: Map<string, string>,
  workoutName: string,
) {
  const normalizedWorkoutName = workoutName.toLowerCase();

  for (const [title, section] of sections) {
    if (title.toLowerCase().includes(normalizedWorkoutName)) {
      return section;
    }
  }

  throw new Error(`Could not find a section for workout "${workoutName}".`);
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
    const pullSubBank = inferPullSubBank(blockName, exerciseName);

    return {
      name: exerciseName,
      notes: notesByExercise.get(exerciseName) ?? "",
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

// Parse the adjustable per-block set-scheme (D4/D9/D15) from the plan's own
// notation in the optional "Sets" column, e.g. "2 × 6–8", "2 × failure",
// "1 WU + 2 × failure". Defaults reproduce the legacy 1 warm-up + 2 working
// (3-set) behaviour when the cell is absent or unparseable. Rep ranges are NOT
// read here — they stay on the exercises (prescribed_min/max).
function parseSetScheme(rawSets: string): {
  warmupSets: number;
  workingSets: number;
  toFailure: boolean;
} {
  const text = normalizeWhitespace(rawSets).toLowerCase();
  let warmupSets = 1;
  let workingSets = 2;
  let toFailure = false;

  if (!text) {
    return { warmupSets, workingSets, toFailure };
  }

  // Optional warm-up prefix: "no wu", "1 wu +", "2 warm-up +".
  if (/\bno\s+(?:wu|warm)/.test(text)) {
    warmupSets = 0;
  } else {
    const warmupMatch = text.match(/(\d+)\s*(?:x\s*)?(?:wu|warm-?ups?)/);

    if (warmupMatch) {
      warmupSets = Number.parseInt(warmupMatch[1], 10);
    }
  }

  // Working sets = the count before "×"/"x". When a warm-up prefix uses "+",
  // read the working segment after it so the warm-up count isn't picked up.
  const workingSegment = text.includes("+")
    ? (text.split("+").pop() ?? text)
    : text;
  const workingMatch = workingSegment.match(/(\d+)\s*(?:x|×)/);

  if (workingMatch) {
    workingSets = Number.parseInt(workingMatch[1], 10);
  }

  toFailure = /failure/.test(text);

  return { warmupSets, workingSets, toFailure };
}

function ensureSectionTable(sectionContent: string, workoutName: string) {
  const [table] = extractTables(sectionContent);

  if (!table) {
    throw new Error(`Missing exercise table for workout "${workoutName}".`);
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
        workoutEntries: [],
        recoveryLabels: addOnsValue ? [addOnsValue] : [],
      };
    }

    const workoutEntries = sessionValue
      .split("→")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const workoutName = normalizeWhitespace(
          entry.replace(/\((AM|PM)\)/gi, ""),
        );
        const lowerWorkoutName = workoutName.toLowerCase();

        return {
          workoutName,
          workoutType:
            lowerWorkoutName.includes("run") ||
            lowerWorkoutName.includes("basketball") ||
            lowerWorkoutName.includes("hyrox")
              ? "cardio"
              : "lifting",
          timing: inferTiming(entry),
        } as const;
      });

    return {
      dayOfWeek,
      dayLabel,
      isRestDay: false,
      gym: gymValue,
      workoutEntries,
      recoveryLabels: addOnsValue ? [addOnsValue] : [],
    };
  });

  return { days };
}

export function parseWorkoutBlocks(
  currentPlanMd: string,
  workoutName: string,
  notesByExercise: Map<string, string>,
): ParsedBlock[] {
  const sections = extractSections(currentPlanMd, 2);
  const sectionContent = findSectionByWorkoutName(sections, workoutName);
  const table = ensureSectionTable(sectionContent, workoutName);
  const blockIndex = table.headers.findIndex((header) => header === "Block");
  const primaryIndex = table.headers.findIndex(
    (header) => header === "Primary Exercises",
  );
  const secondaryIndex = table.headers.findIndex(
    (header) => header === "Secondary Exercises",
  );
  const typeIndex = table.headers.findIndex((header) => header === "Type");
  // The set-scheme column is optional (D15). When absent (index < 0) the block
  // falls back to the legacy 1 warm-up + 2 working default via parseSetScheme.
  const setsIndex = table.headers.findIndex((header) => header === "Sets");

  if (
    [blockIndex, primaryIndex, secondaryIndex, typeIndex].some(
      (index) => index < 0,
    )
  ) {
    throw new Error(
      `Workout "${workoutName}" table is missing required columns.`,
    );
  }

  const mergedRows: Array<{
    blockName: string;
    primaryExercises: string;
    secondaryExercises: string;
    typeValue: string;
    setsValue: string;
  }> = [];

  for (const row of table.rows) {
    const blockName = normalizeWhitespace(row[blockIndex] ?? "");
    const primaryExercises = normalizeWhitespace(row[primaryIndex] ?? "");
    const secondaryExercises = normalizeWhitespace(row[secondaryIndex] ?? "");
    const typeValue = normalizeWhitespace(row[typeIndex] ?? "");
    const setsValue =
      setsIndex >= 0 ? normalizeWhitespace(row[setsIndex] ?? "") : "";

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

      // The block-level scheme lives on the block's first row; a continuation
      // row (empty Block) doesn't override it, but may fill it if unset.
      if (!currentRow.setsValue && setsValue) {
        currentRow.setsValue = setsValue;
      }

      continue;
    }

    mergedRows.push({
      blockName,
      primaryExercises,
      secondaryExercises,
      typeValue,
      setsValue,
    });
  }

  return mergedRows.map((row, index) => {
    const normalizedBlockName =
      row.blockName === "Lateral Raise Burnout"
        ? "Shoulder Burnout"
        : row.blockName;
    const exercises =
      normalizedBlockName === "Shoulder Burnout"
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

    const scheme = parseSetScheme(row.setsValue);

    return {
      blockName: normalizedBlockName,
      blockType: inferBlockType(workoutName, normalizedBlockName, index + 1),
      displayOrder: index + 1,
      warmupSets: scheme.warmupSets,
      workingSets: scheme.workingSets,
      toFailure: scheme.toFailure,
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

  if (
    /upper chest|mid chest|bench press focus|lower chest|chest/.test(
      normalizedBlock,
    )
  ) {
    tags = ["chest"];
  } else if (
    /shoulder press|lateral raise|shoulder burnout/.test(normalizedBlock)
  ) {
    tags = ["shoulders"];
  } else if (/shoulder prehab/.test(normalizedBlock)) {
    tags = ["shoulders", "back"];
  } else if (/vertical pull|horizontal pull/.test(normalizedBlock)) {
    tags = ["back"];
  } else if (/pull.?ups?/.test(normalizedBlock)) {
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
  } else if (/jefferson curl|good mornings/.test(normalizedBlock)) {
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

export function parseCardioActivities(
  currentPlanMd: string,
): ParsedCardioActivity[] {
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

  const activities: ParsedCardioActivity[] = [];

  // v3.0 hybrid plan runs: track (1km repeats), easy, long. Matched by the
  // "### <Day> — <Name> Run" subsection titles. Formats reuse existing enums
  // (speed_run / endurance_run) to avoid a schema migration — the activity name
  // and description carry the real detail.
  for (const { title, content } of sections) {
    if (/track/i.test(title)) {
      activities.push({
        name: "Track Run",
        timing: "am",
        cardioFormat: "speed_run",
        cardioDistance: "4–6 × 1 km repeats",
        cardioTargetZone: "anaerobic",
        description: buildRunningDescription(content),
      });
    } else if (/easy/i.test(title)) {
      activities.push({
        name: "Easy Run",
        timing: "pm",
        cardioFormat: "endurance_run",
        cardioDistance: "2–3 mi",
        cardioTargetZone: "zone_2",
        description: summarizeMarkdownLines(content.split("\n")),
      });
    } else if (/long/i.test(title)) {
      activities.push({
        name: "Long Run",
        timing: "am",
        cardioFormat: "endurance_run",
        cardioDistance: "6–8 mi",
        cardioTargetZone: "zone_2",
        description: summarizeMarkdownLines(content.split("\n")),
      });
    }
  }

  // HYROX is a compromised full-course circuit (Thursdays), not in Running
  // Sessions. Logged as a lightweight cardio entry; full station detail + race
  // weights live in the plan doc. Reuses endurance_run to avoid a migration.
  activities.push({
    name: "HYROX",
    timing: "anytime",
    cardioFormat: "endurance_run",
    cardioDistance: "Full course, scalable % (25→50→100)",
    cardioTargetZone: "anaerobic",
    description:
      "Full HYROX course as one continuous compromised circuit (run → station → run): 8 runs + 8 stations (SkiErg, sled push/pull, burpee broad jumps, row, farmers carry, sandbag lunges, wall balls), scaled ~25%→50%→100% across the block. Station distances and official Doubles Mixed race weights are in the plan doc.",
  });

  activities.push({
    name: "Basketball",
    timing: "anytime",
    cardioFormat: "basketball",
    cardioDistance: null,
    cardioTargetZone: "game_pace",
    description: describeBasketballSession(),
  });

  const seen = new Map<string, ParsedCardioActivity>();

  for (const activity of activities) {
    const existing = seen.get(activity.name);

    if (!existing) {
      seen.set(activity.name, activity);
      continue;
    }

    if (JSON.stringify(existing) !== JSON.stringify(activity)) {
      throw new Error(
        `Conflicting cardio activity definitions found for "${activity.name}".`,
      );
    }
  }

  return [...seen.values()];
}

export function parseRecoveryActivities(
  currentPlanMd: string,
  planDecisionsMd: string,
): ParsedRecoveryWorkout[] {
  const weeklySchedule = parseWeeklySchedule(currentPlanMd);

  if (
    !/Thursday after Push/i.test(planDecisionsMd) ||
    !/Weekend \(Sat or Sun\)/i.test(planDecisionsMd)
  ) {
    throw new Error(
      "plan-decisions.md is missing the expected recovery policy text.",
    );
  }

  return weeklySchedule.days.flatMap((day) =>
    day.recoveryLabels.map((label) => {
      if (/hot yoga or sauna/i.test(label)) {
        throw new Error(
          `Recovery label "${label}" on ${day.dayLabel} must be rewritten to a single explicit activity.`,
        );
      }

      if (/hot yoga/i.test(label)) {
        return {
          dayOfWeek: day.dayOfWeek,
          workoutName: "Hot Yoga",
          timing: "pm" as const,
          description: "Hot yoga recovery session.",
        };
      }

      if (/sauna$/i.test(label)) {
        return {
          dayOfWeek: day.dayOfWeek,
          workoutName: "Sauna",
          timing: "pm" as const,
          description: "Sauna recovery session.",
        };
      }

      throw new Error(`Unsupported recovery label "${label}".`);
    }),
  );
}

export function parseRecoveryActivitiesCatalog(
  recoveryWorkouts: ParsedRecoveryWorkout[],
): ParsedRecoveryActivity[] {
  const activitiesByName = new Map<string, ParsedRecoveryActivity>();

  for (const workout of recoveryWorkouts) {
    const nextActivity: ParsedRecoveryActivity = {
      name: workout.workoutName,
      description: workout.description,
    };
    const existing = activitiesByName.get(nextActivity.name);

    if (!existing) {
      activitiesByName.set(nextActivity.name, nextActivity);
      continue;
    }

    if (JSON.stringify(existing) !== JSON.stringify(nextActivity)) {
      throw new Error(
        `Conflicting recovery activity definitions found for "${nextActivity.name}".`,
      );
    }
  }

  return [...activitiesByName.values()];
}

function validateDuplicateDefinitions<T>(
  label: string,
  rows: Array<{ name: string; definition: T }>,
) {
  const definitionsByName = new Map<string, string>();
  const collisions = new Set<string>();

  for (const row of rows) {
    const serialized = JSON.stringify(row.definition);
    const existing = definitionsByName.get(row.name);

    if (!existing) {
      definitionsByName.set(row.name, serialized);
      continue;
    }

    if (existing !== serialized) {
      collisions.add(row.name);
    }
  }

  if (collisions.size > 0) {
    const names = [...collisions].sort().join(", ");
    throw new Error(
      `Duplicate ${label} collisions detected for: ${names}. Fix the wiki block/activity names and re-run the seed.`,
    );
  }
}

export function parseLiftingBlocksGlobal(days: ParsedDaySpec[]): ParsedBlock[] {
  const collisions = new Set<string>();
  const uniqueBlocks = new Map<string, ParsedBlock>();

  for (const day of days) {
    for (const workout of day.workouts.filter(
      (entry) => entry.workoutType === "lifting",
    )) {
      for (const block of workout.blocks) {
        const existing = uniqueBlocks.get(block.blockName);

        if (!existing) {
          uniqueBlocks.set(block.blockName, {
            ...block,
            exercises: block.exercises.map((exercise) => ({
              ...exercise,
              muscleGroups: [...exercise.muscleGroups],
            })),
          });
          continue;
        }

        if (existing.blockType !== block.blockType) {
          collisions.add(block.blockName);
          continue;
        }

        const exercisesByName = new Map(
          existing.exercises.map(
            (exercise) => [exercise.name, exercise] as const,
          ),
        );

        for (const exercise of block.exercises) {
          const existingExercise = exercisesByName.get(exercise.name);

          if (!existingExercise) {
            existing.exercises.push({
              ...exercise,
              displayOrder: existing.exercises.length,
              muscleGroups: [...exercise.muscleGroups],
            });
            continue;
          }

          // The same exercise appears in Round 1, Round 2 and Round 3 of a
          // session, and this join used to run whether or not the two notes were
          // identical — which is how a one-word note came out the far end as
          // "Compound\nCompound\nCompound" (T2-E). mergeExerciseNotes keeps
          // genuinely different lines and drops repeats.
          existingExercise.notes = mergeExerciseNotes(
            existingExercise.notes,
            exercise.notes,
          );
          existingExercise.prescribedMin = Math.min(
            existingExercise.prescribedMin,
            exercise.prescribedMin,
          );
          existingExercise.prescribedMax = Math.max(
            existingExercise.prescribedMax,
            exercise.prescribedMax,
          );
          existingExercise.muscleGroups = dedupeTags([
            ...existingExercise.muscleGroups,
            ...exercise.muscleGroups,
          ]);
          existingExercise.isCompound =
            existingExercise.isCompound || exercise.isCompound;
        }
      }
    }
  }

  if (collisions.size > 0) {
    throw new Error(
      `Duplicate lifting block name collisions detected for: ${[...collisions]
        .sort()
        .join(", ")}. Fix the wiki block/activity names and re-run the seed.`,
    );
  }

  return [...uniqueBlocks.values()]
    .map((block) => ({
      ...block,
      exercises: block.exercises.map((exercise, index) => ({
        ...exercise,
        displayOrder: index,
      })),
    }))
    .sort((left, right) => left.blockName.localeCompare(right.blockName));
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

export function validateTrainingPlan(days: ParsedDaySpec[]): ValidationResult {
  // Slice B2 (D5/D10): the rich methodology rules (48h recovery, compound
  // window, push/pull balance, min rest day, sauna cap, missing-muscle, hot
  // yoga + sauna) are now NON-BLOCKING advisory output — every check writes to
  // softWarnings. hardViolations is retained as an always-empty array (shape
  // preserved, ValidationResult unchanged) so a legitimate block with no full
  // rest day (Block II) seeds clean. Nothing writes to hardViolations by design.
  const hardViolations: string[] = [];
  const softWarnings: string[] = [];
  const lastSeenDayByMuscleGroup = new Map<string, number>();
  const hardRecoveryGroups = new Set(["chest", "back", "legs"]);
  let pushWorkouts = 0;
  let pullWorkouts = 0;
  let restDayCount = 0;
  let guaranteedSaunaCount = 0;

  for (const [index, day] of days.entries()) {
    if (day.isRestDay) {
      restDayCount += 1;
    }

    const recoveryNames = day.workouts
      .filter((workout) => workout.workoutType === "recovery")
      .map((workout) => workout.workoutName);

    if (recoveryNames.includes("Sauna")) {
      guaranteedSaunaCount += 1;
    }

    if (recoveryNames.includes("Hot Yoga") && recoveryNames.includes("Sauna")) {
      softWarnings.push(
        `${day.dayLabel}: hot yoga and sauna cannot be scheduled on the same day.`,
      );
    }

    const liftingWorkouts = day.workouts.filter(
      (workout) => workout.workoutType === "lifting",
    );
    const dayRecoveryGroups = new Set<string>();
    const dayCompoundGroups = new Set<string>();

    for (const workout of liftingWorkouts) {
      if (
        workout.focusMuscleGroups.some((group) =>
          ["chest", "shoulders", "arms"].includes(group),
        )
      ) {
        pushWorkouts += 1;
      }

      if (
        workout.focusMuscleGroups.some((group) =>
          ["back", "arms"].includes(group),
        )
      ) {
        pullWorkouts += 1;
      }

      for (const block of workout.blocks) {
        for (const exercise of block.exercises) {
          const highLevelGroups = getHighLevelMuscleGroups(
            exercise.muscleGroups,
          );

          for (const group of highLevelGroups) {
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

      if (workout.focusMuscleGroups.length === 0) {
        softWarnings.push(
          `${day.dayLabel}: lifting workout "${workout.workoutName}" is missing inferred muscle groups.`,
        );
      }
    }

    for (const group of dayRecoveryGroups) {
      const previousDayIndex = lastSeenDayByMuscleGroup.get(group);

      if (previousDayIndex !== undefined && index - previousDayIndex < 2) {
        softWarnings.push(
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

    const cardioIndices = day.workouts
      .filter((workout) => workout.workoutType === "cardio")
      .map((workout) => workout.displayOrder);
    const liftingIndices = day.workouts
      .filter((workout) => workout.workoutType === "lifting")
      .map((workout) => workout.displayOrder);

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
      day.workouts.filter((workout) => workout.workoutType !== "recovery")
        .length >= 2 &&
      day.workouts.some((workout) => workout.workoutType === "recovery")
    ) {
      softWarnings.push(
        `${day.dayLabel}: recovery activity is scheduled on a multi-session day.`,
      );
    }
  }

  if (restDayCount < 1) {
    softWarnings.push(
      "The weekly plan must include at least one full rest day.",
    );
  }

  if (guaranteedSaunaCount > 2) {
    softWarnings.push(
      "The weekly plan cannot guarantee more than two sauna sessions.",
    );
  }

  if (Math.abs(pushWorkouts - pullWorkouts) > 1) {
    softWarnings.push(
      "Push and pull workout counts are out of weekly balance.",
    );
  }

  return {
    hardViolations: dedupeTags(hardViolations),
    softWarnings: dedupeTags(softWarnings),
  };
}

export function parsePlanFromWiki(files: WikiFiles): TrainingPlanSpec {
  const weeklySchedule = parseWeeklySchedule(files.currentPlan);
  const cardioActivities = parseCardioActivities(files.currentPlan);
  const cardioByName = new Map(
    cardioActivities.map((activity) => [activity.name, activity] as const),
  );
  const recoveryWorkouts = parseRecoveryActivities(
    files.currentPlan,
    files.planDecisions,
  );
  const recoveryActivities = parseRecoveryActivitiesCatalog(recoveryWorkouts);
  const recoveryByDay = new Map<DayOfWeek, ParsedRecoveryWorkout[]>();

  for (const recoveryWorkout of recoveryWorkouts) {
    const existing = recoveryByDay.get(recoveryWorkout.dayOfWeek) ?? [];
    existing.push(recoveryWorkout);
    recoveryByDay.set(recoveryWorkout.dayOfWeek, existing);
  }

  const exerciseNotesByName = extractExerciseNotesMap(files.trainingLog);
  const days = weeklySchedule.days.map<ParsedDaySpec>((weeklyDay) => {
    const workouts: ParsedDaySpec["workouts"] = weeklyDay.workoutEntries.map(
      (entry, index) => {
        if (entry.workoutType === "lifting") {
          const blocks = parseWorkoutBlocks(
            files.currentPlan,
            entry.workoutName,
            exerciseNotesByName,
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
            workoutName: entry.workoutName,
            workoutType: "lifting" as const,
            timing: entry.timing,
            gym: weeklyDay.gym,
            description: null,
            displayOrder: index + 1,
            cardioFormat: null,
            cardioDistance: null,
            cardioTargetZone: null,
            blocks,
            blockRefs: blocks.map((block) => ({
              blockName: block.blockName,
              blockCategory: "lifting" as const,
              displayOrder: block.displayOrder,
              presetActivityName: null,
              presetActivityType: null,
            })),
            focusMuscleGroups: inferFocusMuscleGroups(blocks),
          };
        }

        const cardio = cardioByName.get(entry.workoutName);

        if (!cardio) {
          throw new Error(
            `Missing parsed cardio details for "${entry.workoutName}".`,
          );
        }

        return {
          workoutName: entry.workoutName,
          workoutType: "cardio" as const,
          timing: entry.timing,
          gym: entry.workoutName === "Basketball" ? null : weeklyDay.gym,
          description: cardio.description,
          displayOrder: index + 1,
          cardioFormat: cardio.cardioFormat,
          cardioDistance: cardio.cardioDistance,
          cardioTargetZone: cardio.cardioTargetZone,
          blocks: [],
          blockRefs: [
            {
              blockName: cardioBlockName,
              blockCategory: "cardio" as const,
              displayOrder: 1,
              presetActivityName: cardio.name,
              presetActivityType: "cardio" as const,
            },
          ],
          focusMuscleGroups: [],
        };
      },
    );

    const recoveryForDay = recoveryByDay.get(weeklyDay.dayOfWeek) ?? [];

    for (const recoveryWorkout of recoveryForDay) {
      workouts.push({
        workoutName: recoveryWorkout.workoutName,
        workoutType: "recovery",
        timing: recoveryWorkout.timing,
        gym: weeklyDay.gym,
        description: recoveryWorkout.description,
        displayOrder: workouts.length + 1,
        cardioFormat: null,
        cardioDistance: null,
        cardioTargetZone: null,
        blocks: [],
        blockRefs: [
          {
            blockName: recoveryBlockName,
            blockCategory: "recovery",
            displayOrder: 1,
            presetActivityName: recoveryWorkout.workoutName,
            presetActivityType: "recovery",
          },
        ],
        focusMuscleGroups: [],
      });
    }

    return {
      dayOfWeek: weeklyDay.dayOfWeek,
      dayLabel: weeklyDay.dayLabel,
      isRestDay: weeklyDay.isRestDay,
      workouts,
    };
  });

  const validation = validateTrainingPlan(days);

  if (validation.hardViolations.length > 0) {
    throw new Error(
      `Schedule validation failed:\n- ${validation.hardViolations.join("\n- ")}`,
    );
  }

  const orderedDays = dayOrder.map((dayOfWeek) => {
    const day = days.find((entry) => entry.dayOfWeek === dayOfWeek);

    if (!day) {
      throw new Error(
        `Weekly schedule is missing ${dayEnumToLabel[dayOfWeek]}.`,
      );
    }

    return day;
  });

  const liftingBlocks = parseLiftingBlocksGlobal(orderedDays);

  // Derive the plan name from the current-plan.md H1 (e.g. "Current Training
  // Plan — Block II" → "Block II") rather than hardcoding a stale block name;
  // fall back to the full title, then a default.
  const planTitle = extractDocumentTitle(files.currentPlan);
  const planName = planTitle?.includes("—")
    ? (planTitle.split("—").pop()?.trim() ?? planTitle)
    : (planTitle ?? "Block II");

  return {
    name: planName,
    overviewTitle: extractDocumentTitle(files.overview),
    masterPlanTitle: extractDocumentTitle(files.masterPlan),
    days: orderedDays,
    liftingBlocks,
    cardioActivities,
    recoveryActivities,
    cardioBlockName,
    recoveryBlockName,
    nutritionTargets: parseNutritionTargets(files.nutrition),
    historicalPrs: parseHistoricalPRs(files.trainingLog),
    validation,
  };
}
