"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, PieChart, Pie } from "recharts";

const AXIS = { stroke: "#3a4655", fontSize: 10, fontFamily: "var(--font-mono)", tickLine: false, axisLine: false };
const TIP = {
  contentStyle: { background: "#05070a", border: "1px solid #f5a623", fontFamily: "var(--font-mono)", fontSize: 11, color: "#e2e8f0" },
  labelStyle: { color: "#f5a623" },
  cursor: { stroke: "#f5a623", strokeDasharray: "3 3" },
};
const short = (d: string) => d.slice(5);

export function MrrChart({ data }: { data: { day: string; value: number }[] }) {
  const up = data.length < 2 || data[data.length - 1].value >= data[0].value;
  const color = up ? "#16c784" : "#ea3943";
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1c2530" vertical={false} />
        <XAxis dataKey="day" tickFormatter={short} {...AXIS} minTickGap={30} />
        <YAxis {...AXIS} tickFormatter={(v) => `$${v}`} width={56} orientation="right" />
        <Tooltip {...TIP} formatter={(v) => [`$${Number(v).toFixed(2)}`, "MRR"]} />
        <Area type="stepAfter" dataKey="value" stroke={color} strokeWidth={2} fill="url(#mrrFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function VolumeChart({ data }: { data: { day: string; signups: number; subscribers: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#1c2530" vertical={false} />
        <XAxis dataKey="day" tickFormatter={short} {...AXIS} minTickGap={20} />
        <YAxis {...AXIS} allowDecimals={false} orientation="right" width={30} />
        <Tooltip {...TIP} cursor={{ fill: "rgba(245,166,35,0.08)" }} />
        <Bar dataKey="signups" name="Signups" stackId="a" fill="#16c784" isAnimationActive={false} />
        <Bar dataKey="subscribers" name="Newsletter" stackId="a" fill="#3b82f6" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ViewsChart({ data }: { data: { day: string; views: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke="#1c2530" vertical={false} />
        <XAxis dataKey="day" tickFormatter={short} {...AXIS} minTickGap={20} />
        <YAxis {...AXIS} allowDecimals={false} orientation="right" width={30} />
        <Tooltip {...TIP} />
        <Line type="monotone" dataKey="views" name="Views" stroke="#f5a623" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const MIX = ["#f5a623", "#16c784", "#3b82f6", "#a855f7"];
export function PlanMix({ data }: { data: { name: string; count: number; mrr: number }[] }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <div className="flex items-center gap-4">
      <div className="h-[120px] w-[120px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: "none", count: 1 }]} dataKey="count" innerRadius={38} outerRadius={56} stroke="none" isAnimationActive={false}>
              {(total ? data : [0]).map((_, i) => <Cell key={i} fill={total ? MIX[i % MIX.length] : "#1c2530"} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-2 font-mono text-xs">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2"><span className="h-2 w-2" style={{ background: MIX[i % MIX.length] }} />{d.name}</span>
            <span className="tabular-nums text-slate-400">{d.count} · ${d.mrr}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ data, color = "#f5a623" }: { data: number[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data.map((v, i) => ({ i, v }))}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
