import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { SkeletonBlock, SkeletonText } from "./ErpSkeleton";

export function MetricBlock({
  label,
  value,
  comparison,
  positive = true,
  icon: Icon,
  spark,
  /*
   * A trend arrow only makes sense when `comparison` is an actual movement
   * ("+4.2% this term"). Most call sites pass a static descriptor ("0 on
   * roster", "Grades 6–10"), where a green/red arrow pointed the wrong way and
   * made a neutral fact look like good or bad news. Off unless asked for.
   */
  trend = false,
  loading = false,
  className = "",
}: {
  label: string;
  value: string;
  comparison: string;
  positive?: boolean;
  icon: React.ElementType;
  spark?: number[];
  trend?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const hasSpark = Boolean(spark && spark.length > 1);
  const coords = useMemo(() => {
    if (!hasSpark || !spark) return [];
    const minVal = Math.min(...spark);
    const maxVal = Math.max(...spark);
    const range = Math.max(maxVal - minVal, 1);
    return spark.map((point, index) => {
      const x = (index / (spark.length - 1)) * 100;
      const y = 38 - ((point - minVal) / range) * 26;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });
  }, [hasSpark, spark]);

  const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPoints = coords.length > 0 ? `0,44 ${points} 100,44` : "";
  const lastPoint = coords.length > 0 ? coords[coords.length - 1] : null;
  const strokeColor = positive ? "var(--brand)" : "var(--danger)";
  const gradId = `spark-grad-${label.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  return (
    <div className={`metric-block ${className}`}>
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={15} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="metric-value tabular-nums">
            {loading ? <SkeletonText width={58} height={24} /> : value}
          </div>
          <div
            className={`metric-change tabular-nums ${
              trend
                ? positive
                  ? "text-[var(--brand)]"
                  : "text-[var(--danger)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {loading ? (
              <SkeletonText width={44} />
            ) : (
              <>
                {trend &&
                  (positive ? (
                    <ArrowUpRight size={13} />
                  ) : (
                    <ArrowDownRight size={13} />
                  ))}
                {comparison}
              </>
            )}
          </div>
        </div>
        {loading && hasSpark ? (
          <SkeletonBlock style={{ height: 44, width: 84 }} />
        ) : hasSpark ? (
          <svg
            viewBox="0 0 100 44"
            className="h-11 w-[84px] overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#${gradId})`} />
            <polyline
              points={points}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {lastPoint && (
              <>
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="4"
                  fill={strokeColor}
                  opacity={0.22}
                />
                <circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r="2"
                  fill={strokeColor}
                />
              </>
            )}
          </svg>
        ) : null}
      </div>
    </div>
  );
}
