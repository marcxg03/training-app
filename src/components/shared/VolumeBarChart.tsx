import {
  CHART_PADDING_TOP,
  CHART_PADDING_X,
  CHART_USABLE_HEIGHT,
  CHART_USABLE_WIDTH,
  ChartFrame,
} from "@/components/shared/ChartFrame";

type VolumeBarChartPoint = {
  label: string;
  value: number;
};

type VolumeBarChartProps = {
  points: VolumeBarChartPoint[];
  unitLabel: string;
  ariaLabel?: string;
};

// Bar grammar differs from the line chart by design (D2): categorical x and
// a ZERO baseline — a min-anchored domain would make an 18-set week look
// one-tenth of a 20-set week.
const BAR_GAP_RATIO = 0.35;

export function VolumeBarChart({
  points,
  unitLabel,
  ariaLabel = "Weekly volume chart",
}: VolumeBarChartProps) {
  const max = Math.max(...points.map((point) => point.value), 1);
  const slotWidth = points.length > 0 ? CHART_USABLE_WIDTH / points.length : 0;
  const barWidth = slotWidth * (1 - BAR_GAP_RATIO);

  const bars = points.map((point, index) => {
    const height = (point.value / max) * CHART_USABLE_HEIGHT;
    return {
      x: CHART_PADDING_X + slotWidth * index + (slotWidth - barWidth) / 2,
      y: CHART_PADDING_TOP + CHART_USABLE_HEIGHT - height,
      height,
      isLast: index === points.length - 1,
    };
  });

  return (
    <ChartFrame
      isEmpty={points.length === 0}
      ariaLabel={ariaLabel}
      unitLabel={unitLabel}
      startLabel={points[0]?.label}
      endLabel={points[points.length - 1]?.label}
    >
      {bars.map((bar, index) => (
        <rect
          key={`bar-${index}`}
          x={bar.x}
          y={bar.y}
          width={barWidth}
          height={bar.height}
          rx={2}
          fill={bar.isLast ? "rgb(var(--accent))" : "rgb(var(--accent) / 0.45)"}
        />
      ))}
    </ChartFrame>
  );
}
