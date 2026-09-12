import { useState } from 'react'

export interface TrendPoint {
  date: string
  displayDate: string
  minutes: number
}

interface Props {
  data: TrendPoint[]
  targetGoalMinutes?: number
  color?: string
  height?: number
  showLabels?: boolean
  minY?: number
  maxY?: number
  yAxisTicks?: number[]
}

/**
 * Renders a hand-drawn straight-line trend chart (Apple Health style): a
 * gradient-filled area, a dashed goal benchmark line when a goal is set,
 * and a hover tooltip per point. Pure/presentational — all inputs are
 * plain data, no knowledge of where they came from.
 * Parameters:
 *     data (TrendPoint[]): one point per day, already in display order
 *     targetGoalMinutes (number | undefined): if set, draws a dashed goal line
 *     color (string): the line/fill color as a hex string
 *     height (number): chart height in px
 *     showLabels (boolean): whether to render x-axis date labels
 *     minY (number): lower bound of the y-axis scale
 *     maxY (number): upper bound of the y-axis scale
 *     yAxisTicks (number[]): additional faint horizontal guide lines to draw
 * Returns:
 *     element (JSX.Element): the chart, or an empty state if there's no data
 */
export function TrendLineChart({
  data,
  targetGoalMinutes,
  color = '#FF2D55',
  height = 140,
  showLabels = true,
  minY = 0,
  maxY = 100,
  yAxisTicks = []
}: Props): JSX.Element {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div className="h-28 flex items-center justify-center text-zinc-400 text-sm">No data available</div>;
  }

  const width = 540;
  const paddingLeft = 32;
  const paddingRight = 44;
  const paddingTop = 18;
  const paddingBottom = 26;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = data.length === 1 ? paddingLeft : paddingLeft + (i / (data.length - 1)) * chartWidth;
    const clamped = Math.max(minY, Math.min(maxY, d.minutes));
    const y = paddingTop + chartHeight - ((clamped - minY) / (maxY - minY || 1)) * chartHeight;
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), '');
  const last = points[points.length - 1] as { x: number; y: number };
  const first = points[0] as { x: number; y: number };
  const areaD = `${pathD} L ${last.x} ${paddingTop + chartHeight} L ${first.x} ${paddingTop + chartHeight} Z`;

  const targetY =
    targetGoalMinutes !== undefined
      ? paddingTop + chartHeight - ((Math.max(minY, Math.min(maxY, targetGoalMinutes)) - minY) / (maxY - minY || 1)) * chartHeight
      : null;

  const gradientId = `gradient-${color.replace('#', '')}`;

  return (
    <div className="relative w-full select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible" style={{ maxHeight: height }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yAxisTicks
          .filter((tick) => tick !== targetGoalMinutes)
          .map((tick) => {
            const y = paddingTop + chartHeight - ((tick - minY) / (maxY - minY || 1)) * chartHeight;
            return (
              <g key={tick}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#E5E5EA" strokeWidth="0.8" />
                <text x={width - paddingRight + 6} y={y + 3.5} fill="#8E8E93" fontSize="10" fontFamily="system-ui, -apple-system, sans-serif">
                  {tick}
                </text>
              </g>
            );
          })}

        {targetY !== null && targetGoalMinutes !== undefined && (
          <g>
            <line
              x1={paddingLeft}
              y1={targetY}
              x2={width - paddingRight}
              y2={targetY}
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeOpacity="0.85"
            />
            <text x={width - paddingRight + 6} y={targetY + 3.5} fill={color} fontSize="11" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">
              {targetGoalMinutes}
            </text>
          </g>
        )}

        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <circle cx={p.x} cy={p.y} r="14" fill="transparent" />
              {isHovered && <circle cx={p.x} cy={p.y} r="8" fill={color} fillOpacity="0.2" />}
              <circle cx={p.x} cy={p.y} r={isHovered ? '4.5' : '3'} fill="#FFFFFF" stroke={color} strokeWidth="2" />
            </g>
          );
        })}

        {showLabels &&
          points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <text
                key={i}
                x={p.x}
                y={height - 8}
                textAnchor="middle"
                fill={isHovered ? color : '#71717A'}
                fontSize="10"
                fontWeight={isHovered ? '600' : '400'}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {p.displayDate.split(' ')[0]}
              </text>
            );
          })}
      </svg>

      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="absolute z-20 pointer-events-none bg-zinc-900 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-zinc-700/60 -translate-x-1/2 -translate-y-full mb-2.5"
          style={{
            left: `${((points[hoveredIndex] as { x: number }).x / width) * 100}%`,
            top: `${((points[hoveredIndex] as { y: number }).y / height) * 100}%`
          }}
        >
          <div className="font-semibold text-zinc-100 flex items-center justify-between gap-3">
            <span>{(points[hoveredIndex] as TrendPoint).displayDate}</span>
            <span className="text-rose-400 font-bold">{(points[hoveredIndex] as TrendPoint).minutes} min</span>
          </div>
          {targetGoalMinutes !== undefined && (
            <div className="text-[10px] text-zinc-400 mt-0.5 border-t border-zinc-700 pt-0.5 flex justify-between gap-3">
              <span>Goal: {targetGoalMinutes}</span>
              <span className={(points[hoveredIndex] as TrendPoint).minutes >= targetGoalMinutes ? 'text-emerald-400' : 'text-amber-400'}>
                {(points[hoveredIndex] as TrendPoint).minutes >= targetGoalMinutes
                  ? 'Target met'
                  : `${targetGoalMinutes - (points[hoveredIndex] as TrendPoint).minutes} below`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
