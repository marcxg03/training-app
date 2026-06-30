type ProgressionChartPoint = {
  label: string;
  value: number;
};

type ProgressionChartProps = {
  points: ProgressionChartPoint[];
  unitLabel: string;
};

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 130;
const PADDING_X = 8;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 8;
const GRID_LINES = 4;

function buildXPositions(count: number): number[] {
  if (count <= 1) {
    return [VIEWBOX_WIDTH / 2];
  }

  const usableWidth = VIEWBOX_WIDTH - PADDING_X * 2;

  return Array.from(
    { length: count },
    (_, index) => PADDING_X + (usableWidth * index) / (count - 1),
  );
}

function buildYPosition(value: number, min: number, max: number): number {
  const usableHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  if (max === min) {
    return PADDING_TOP + usableHeight / 2;
  }

  const ratio = (value - min) / (max - min);

  return PADDING_TOP + usableHeight * (1 - ratio);
}

export function ProgressionChart({ points, unitLabel }: ProgressionChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-[130px] items-center justify-center rounded-[var(--radius)] border border-border bg-card">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          No data yet
        </p>
      </div>
    );
  }

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
    label: point.label,
    value: point.value,
  }));

  const linePath = coordinates
    .map(
      (coordinate, index) =>
        `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`,
    )
    .join(" ");

  const areaPath =
    coordinates.length > 0
      ? `${linePath} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${(VIEWBOX_HEIGHT - PADDING_BOTTOM).toFixed(2)} L ${coordinates[0].x.toFixed(2)} ${(VIEWBOX_HEIGHT - PADDING_BOTTOM).toFixed(2)} Z`
      : "";

  const gridLines = Array.from({ length: GRID_LINES + 1 }, (_, index) => {
    const ratio = index / GRID_LINES;

    return (
      PADDING_TOP + (VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM) * ratio
    );
  });

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-4">
      <svg
        role="img"
        aria-label="Top-set weight progression"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        {gridLines.map((y, index) => (
          <line
            key={`grid-${index}`}
            x1={PADDING_X}
            x2={VIEWBOX_WIDTH - PADDING_X}
            y1={y}
            y2={y}
            stroke="rgb(var(--border))"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

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
      </svg>

      <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tabular-nums tracking-[0.06em] text-faint">
        <span>{coordinates[0]?.label}</span>
        <span>{unitLabel}</span>
        <span>{coordinates[coordinates.length - 1]?.label}</span>
      </div>
    </div>
  );
}
