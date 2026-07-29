import {
  CHART_PADDING_TOP,
  CHART_PADDING_X,
  CHART_USABLE_HEIGHT,
  CHART_USABLE_WIDTH,
  CHART_VIEWBOX_HEIGHT,
  CHART_PADDING_BOTTOM,
  CHART_VIEWBOX_WIDTH,
  ChartFrame,
} from "@/components/shared/ChartFrame";

type ProgressionChartPoint = {
  label: string;
  value: number;
};

type ProgressionChartProps = {
  points: ProgressionChartPoint[];
  unitLabel: string;
  ariaLabel?: string;
};

function buildXPositions(count: number): number[] {
  if (count <= 1) {
    return [CHART_VIEWBOX_WIDTH / 2];
  }

  return Array.from(
    { length: count },
    (_, index) => CHART_PADDING_X + (CHART_USABLE_WIDTH * index) / (count - 1),
  );
}

function buildYPosition(value: number, min: number, max: number): number {
  if (max === min) {
    return CHART_PADDING_TOP + CHART_USABLE_HEIGHT / 2;
  }

  const ratio = (value - min) / (max - min);

  return CHART_PADDING_TOP + CHART_USABLE_HEIGHT * (1 - ratio);
}

export function ProgressionChart({
  points,
  unitLabel,
  ariaLabel = "Progression chart",
}: ProgressionChartProps) {
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the domain so a flat or single-point series still renders inside the box.
  const span = rawMax - rawMin;
  const min = span === 0 ? rawMin - 1 : rawMin;
  const max = span === 0 ? rawMax + 1 : rawMax;

  const xs = buildXPositions(points.length);
  const coordinates = points.map((point, index) => ({
    x: xs[index],
    y: buildYPosition(point.value, min, max),
  }));

  const linePath = coordinates
    .map(
      (coordinate, index) =>
        `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`,
    )
    .join(" ");

  const baselineY = CHART_VIEWBOX_HEIGHT - CHART_PADDING_BOTTOM;
  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${coordinates[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`
      : "";

  return (
    <ChartFrame
      isEmpty={points.length === 0}
      ariaLabel={ariaLabel}
      unitLabel={unitLabel}
      startLabel={points[0]?.label}
      endLabel={points[points.length - 1]?.label}
    >
      {areaPath ? (
        <path d={areaPath} fill="rgb(var(--accent) / 0.16)" stroke="none" />
      ) : null}

      {coordinates.length > 1 ? (
        <path
          d={linePath}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}

      {coordinates.map((coordinate, index) => (
        <circle
          key={`point-${index}`}
          cx={coordinate.x}
          cy={coordinate.y}
          r={index === coordinates.length - 1 ? 3.5 : 2.5}
          fill="rgb(var(--accent))"
        />
      ))}
    </ChartFrame>
  );
}
