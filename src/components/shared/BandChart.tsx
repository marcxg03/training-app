import {
  CHART_PADDING_TOP,
  CHART_PADDING_X,
  CHART_USABLE_HEIGHT,
  CHART_USABLE_WIDTH,
  CHART_VIEWBOX_WIDTH,
  ChartFrame,
} from "@/components/shared/ChartFrame";

type BandChartPoint = {
  label: string;
  min: number;
  max: number;
};

type BandChartProps = {
  points: BandChartPoint[];
  // Optional reference zone (e.g. the nutrition target range) drawn behind
  // the series band.
  targetZone?: { min: number; max: number } | null;
  unitLabel: string;
  ariaLabel?: string;
};

// Band grammar: each day is a [min, max] range (estimator uncertainty), drawn
// as a filled band with a midpoint line. Y domain spans data AND target zone
// so the zone is always visible for context.
export function BandChart({
  points,
  targetZone = null,
  unitLabel,
  ariaLabel = "Range trend chart",
}: BandChartProps) {
  const allValues = points.flatMap((point) => [point.min, point.max]);

  if (targetZone) {
    allValues.push(targetZone.min, targetZone.max);
  }

  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const span = rawMax - rawMin;
  const domainMin = span === 0 ? rawMin - 1 : rawMin - span * 0.05;
  const domainMax = span === 0 ? rawMax + 1 : rawMax + span * 0.05;

  function yFor(value: number): number {
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return CHART_PADDING_TOP + CHART_USABLE_HEIGHT * (1 - ratio);
  }

  const xs =
    points.length <= 1
      ? [CHART_VIEWBOX_WIDTH / 2]
      : points.map(
          (_, index) =>
            CHART_PADDING_X + (CHART_USABLE_WIDTH * index) / (points.length - 1),
        );

  const upperPath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xs[index].toFixed(2)} ${yFor(point.max).toFixed(2)}`,
    )
    .join(" ");
  const lowerPathReversed = [...points]
    .map((point, index) => ({ x: xs[index], y: yFor(point.min) }))
    .reverse()
    .map((c) => `L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(" ");
  const bandPath =
    points.length > 1 ? `${upperPath} ${lowerPathReversed} Z` : "";

  const midPath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xs[index].toFixed(2)} ${yFor((point.min + point.max) / 2).toFixed(2)}`,
    )
    .join(" ");

  return (
    <ChartFrame
      isEmpty={points.length === 0}
      ariaLabel={ariaLabel}
      unitLabel={unitLabel}
      startLabel={points[0]?.label}
      endLabel={points[points.length - 1]?.label}
    >
      {targetZone ? (
        <rect
          x={CHART_PADDING_X}
          y={yFor(targetZone.max)}
          width={CHART_USABLE_WIDTH}
          height={Math.max(yFor(targetZone.min) - yFor(targetZone.max), 1)}
          fill="rgb(var(--accent) / 0.08)"
          stroke="rgb(var(--accent) / 0.35)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}

      {bandPath ? (
        <path d={bandPath} fill="rgb(var(--accent) / 0.22)" stroke="none" />
      ) : null}

      {points.length > 1 ? (
        <path
          d={midPath}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {/* Children render eagerly even when ChartFrame shows its empty state,
          so the single-point mark must be explicitly length-guarded. */}
      {points.length === 1 ? (
        <circle
          cx={xs[0]}
          cy={yFor((points[0].min + points[0].max) / 2)}
          r={3}
          fill="rgb(var(--accent))"
        />
      ) : null}
    </ChartFrame>
  );
}
