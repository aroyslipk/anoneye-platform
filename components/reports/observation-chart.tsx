"use client";

import { useMemo } from "react";
import { useDateFormat, useI18n, useNumberFormat } from "@/lib/i18n/context";

export interface ChartPoint {
  observedAt: string;
  value?: number;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 14, bottom: 26, left: 44 };
const GAP_MS = 36 * 60 * 60 * 1000;

function niceTicks(min: number, max: number, count: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const spread = Math.max(Math.abs(min) * 0.1, 1);
    min -= spread;
    max += spread;
  }
  const step = (max - min) / Math.max(count - 1, 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

export function ObservationChart({
  points,
  label,
  emptyMessage,
  height = HEIGHT,
  showTable = false,
}: {
  points: ChartPoint[];
  label: string;
  emptyMessage: string;
  height?: number;
  showTable?: boolean;
}) {
  const { t } = useI18n();
  const number = useNumberFormat();
  const dateTime = useDateFormat();
  const dateOnly = useDateFormat({ dateStyle: "medium" });

  const model = useMemo(() => {
    const usable = points
      .map((point) => ({ ...point, time: Date.parse(point.observedAt) }))
      .filter((point) => Number.isFinite(point.time) && typeof point.value === "number")
      .sort((a, b) => a.time - b.time) as { observedAt: string; value: number; time: number }[];

    if (usable.length === 0) return null;
    const values = usable.map((point) => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max((rawMax - rawMin) * 0.18, Math.abs(rawMax) * 0.02, 1);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const start = usable[0].time;
    const end = usable[usable.length - 1].time;
    const span = Math.max(end - start, 60 * 60 * 1000);
    const ticks = niceTicks(min, max, 4);

    const x = (time: number) => PAD.left + ((time - start) / span) * (WIDTH - PAD.left - PAD.right);
    const y = (value: number) => PAD.top + ((max - value) / (max - min)) * (height - PAD.top - PAD.bottom);

    const segments: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    usable.forEach((point, index) => {
      const previous = usable[index - 1];
      if (previous && point.time - previous.time > GAP_MS) {
        segments.push(current);
        current = [];
      }
      current.push({ x: x(point.time), y: y(point.value) });
    });
    if (current.length > 0) segments.push(current);

    return { usable, min, max, ticks, x, y, segments, start, end };
  }, [points, height]);

  const description = useMemo(() => {
    if (!model) return emptyMessage;
    return `${label}: ${model.usable.length} ${t.reports.observations.toLowerCase()} · ${dateOnly.format(new Date(model.start))} – ${dateOnly.format(new Date(model.end))}`;
  }, [model, emptyMessage, label, dateOnly, t.reports.observations]);

  if (!model) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-line-2 bg-paper/60 px-6 text-center text-sm text-ink-3">
        {emptyMessage}
      </div>
    );
  }

  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label={description}>
        {model.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={model.y(tick)}
              y2={model.y(tick)}
              stroke="var(--chart-grid)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
            <text x={PAD.left - 8} y={model.y(tick) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)">
              {number.format(Math.round(tick))}
            </text>
          </g>
        ))}

        {model.segments.map((segment, index) => (
          <g key={index}>
            {segment.length > 1 ? (
              <polyline
                points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {segment.map((point, pointIndex) => (
              <circle key={pointIndex} cx={point.x} cy={point.y} r={segment.length === 1 ? 3.4 : 2.6} fill="var(--paper-2)" stroke="var(--chart-1)" strokeWidth="2" />
            ))}
          </g>
        ))}

        {/* Gaps are explicit: a gap is a missing observation, not a zero. */}
        {model.segments.slice(1).map((segment, index) => {
          const previous = model.segments[index];
          const from = previous[previous.length - 1];
          const to = segment[0];
          if (!from || !to) return null;
          return (
            <line key={`gap-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--line-2)" strokeWidth="1.5" strokeDasharray="2 6" />
          );
        })}

        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="var(--line)" strokeWidth="1" />
        <text x={PAD.left} y={height - 8} fontSize="10" fill="var(--ink-3)">
          {dateOnly.format(new Date(model.start))}
        </text>
        <text x={WIDTH - PAD.right} y={height - 8} textAnchor="end" fontSize="10" fill="var(--ink-3)">
          {dateOnly.format(new Date(model.end))}
        </text>
      </svg>
      <figcaption className="mt-1 text-[0.6875rem] leading-relaxed text-ink-3">{t.reports.chartNote}</figcaption>

      {showTable ? (
        <details className="mt-2 text-xs text-ink-2">
          <summary className="cursor-pointer rounded text-ink-3 focus-ring">{t.reports.observations}</summary>
          <div className="scroll-x mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-start">
              <thead className="bg-paper-3 text-[0.625rem] uppercase tracking-wide text-ink-3">
                <tr>
                  <th scope="col" className="px-2.5 py-1.5 text-start font-medium">{t.tracked.observedAt}</th>
                  <th scope="col" className="px-2.5 py-1.5 text-end font-medium">{t.reports.followers}</th>
                </tr>
              </thead>
              <tbody>
                {model.usable.slice(-40).reverse().map((point) => (
                  <tr key={`${point.observedAt}-${point.value}`} className="border-t border-line/60">
                    <td className="px-2.5 py-1.5">{dateTime.format(new Date(point.time))}</td>
                    <td className="px-2.5 py-1.5 text-end tabular-nums">{number.format(point.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </figure>
  );
}
