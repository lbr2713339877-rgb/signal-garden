import React, { type ReactElement } from "react";
import { ImageResponse } from "next/og";
import { ogFont } from "./font";
import { projectOgStat, todayOgForkCell } from "./metric";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const BG = "#030303";
const INK = "#f2f0ea";
const MUTED = "rgba(242,240,234,0.58)";
const LINE = "rgba(242,240,234,0.16)";

function clip(value: string, max: number): string {
  const chars = Array.from(value.replace(/\s+/g, " ").trim());
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

function frame(children: ReactElement, footer: string) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        color: INK,
        padding: "64px 72px",
        fontFamily: "Noto Sans SC",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 22,
          letterSpacing: "0.22em",
        }}
      >
        SIGNAL GARDEN
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>signalgarden.site</div>
        <div style={{ display: "flex" }}>{footer}</div>
      </div>
    </div>
  );
}

function respond(node: ReactElement) {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: [
      {
        name: "Noto Sans SC",
        data: ogFont(),
        weight: 400,
        style: "normal",
      },
    ],
  });
}

export function renderProjectOg(input: {
  name: string;
  owner: string | null;
  forks7d: number | null;
  stars24h?: number | null;
  missing?: boolean;
}) {
  const name = clip(input.name || "Signal Garden", 42) || "Signal Garden";
  const owner = input.owner ? clip(input.owner, 48) : "";
  const stat = projectOgStat(input);
  const titleSize = Array.from(name).length > 22 ? 52 : 68;
  return respond(
    frame(
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 92, height: 1, background: LINE }} />
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: titleSize,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
          }}
        >
          {name}
        </div>
        {owner ? (
          <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: MUTED }}>{owner}</div>
        ) : null}
        {input.missing ? (
          <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: MUTED }}>未收录</div>
        ) : stat ? (
          <div style={{ display: "flex", marginTop: 32, alignItems: "baseline" }}>
            <div style={{ display: "flex", fontSize: 54 }}>{stat.value}</div>
            <div style={{ display: "flex", marginLeft: 18, fontSize: 26, color: MUTED }}>{stat.label}</div>
          </div>
        ) : null}
      </div>,
      input.missing ? "project" : stat?.label ?? "Signal Garden",
    ),
  );
}

export function renderTodayOg(input: {
  date: string;
  projects: { name: string; forks7d: number | null }[];
}) {
  const date = /^\d{4}-\d{2}-\d{2}/.test(input.date) ? input.date.slice(0, 10) : "Today";
  const rows = input.projects.slice(0, 5);
  return respond(
    frame(
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 44, letterSpacing: "-0.03em" }}>{date}</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          {rows.length === 0 ? (
            <div style={{ display: "flex", fontSize: 28, color: MUTED }}>今日榜单</div>
          ) : (
            rows.map((row, index) => (
              <div
                key={`${row.name}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: index === 0 ? 0 : 14,
                  fontSize: 30,
                }}
              >
                <div style={{ display: "flex" }}>{clip(row.name, 32)}</div>
                <div style={{ display: "flex", marginLeft: 24, color: MUTED }}>{todayOgForkCell(row.forks7d)}</div>
              </div>
            ))
          )}
        </div>
      </div>,
      "7-day new forks",
    ),
  );
}
