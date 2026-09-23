/**
 * Shared design primitives extracted from /demo (Slice S0).
 *
 * These are the tokenized, prop-driven building blocks S1–S6 compose to build
 * the real mobile screens — the canonical replacements for the inline copies in
 * src/app/demo/page.tsx. Import from "@/components/shared".
 *
 * (Pre-existing chart/link components in this folder are imported directly by
 * path and are intentionally not re-exported here.)
 */
export { FocalCard, type FocalCardProps } from "./FocalCard";
export {
  MacroRangeBar,
  type MacroRangeBarProps,
  type MacroRangeState,
} from "./MacroRangeBar";
export { SetRow, type SetRowProps, type SetRole } from "./SetRow";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./SegmentedControl";
export { StatCard, type StatCardProps } from "./StatCard";
export {
  SessionRow,
  type SessionRowProps,
  type SessionRowIconVariant,
} from "./SessionRow";
export {
  SessionRowButton,
  type SessionRowButtonProps,
} from "./SessionRowButton";
