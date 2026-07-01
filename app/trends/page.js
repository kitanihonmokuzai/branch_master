"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../../lib/supabaseClient";
import Nav from "../../components/Nav";

export const dynamic = "force-dynamic";

const LINE_COLORS = [
  "#7a5c3e",
  "#4c7a4f",
  "#b8433b",
  "#3a6ea5",
  "#a5763a",
  "#7a3a6e",
  "#3aa5a0",
  "#a5a53a",
];

export default function TrendsPage() {
  const [markets, setMarkets] = useState([]);
  const [entries, setEntries] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: marketRows, error: mErr }, { data: entryRows, error: eErr }, { data: branchRows, error: bErr }] =
        await Promise.all([
          supabase.from("markets").select("*").order("market_date", { ascending: true }),
          supabase.from("entries").select("market_id, branch_no, volume"),
          supabase.from("branch_master").select("*").order("branch_no"),
        ]);

      if (mErr || eErr || bErr) {
        setErrorMsg(
          "データの取得に失敗しました: " +
            [mErr, eErr, bErr].filter(Boolean).map((e) => e.message).join(" / ")
        );
      }

      setMarkets(marketRows || []);
      setEntries(entryRows || []);
      setBranches(branchRows || []);

      // デフォルトは、全期間の合計材積が多い上位3枝番を選択しておく
      const totals = {};
      (entryRows || []).forEach((e) => {
        totals[e.branch_no] = (totals[e.branch_no] || 0) + Number(e.volume || 0);
      });
      const top = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([no]) => Number(no));
      setSelected(top);

      setLoading(false);
    }
    load();
  }, []);

  const branchMap = useMemo(() => {
    const m = {};
    branches.forEach((b) => (m[b.branch_no] = b.name));
    return m;
  }, [branches]);

  const chartData = useMemo(() => {
    return markets.map((m) => {
      const row = {
        label: `${m.market_date}${m.name ? " " + m.name : ""}`,
      };
      selected.forEach((no) => {
        const matched = entries.filter(
          (e) => e.market_id === m.id && e.branch_no === no
        );
        row[String(no)] = Number(
          matched.reduce((s, e) => s + Number(e.volume || 0), 0).toFixed(3)
        );
      });
      return row;
    });
  }, [markets, entries, selected]);

  function toggleBranch(no) {
    setSelected((prev) =>
      prev.includes(no) ? prev.filter((n) => n !== no) : [...prev, no]
    );
  }

  return (
    <div className="container">
      <Nav title="枝番別 推移グラフ（回をまたいだ比較）" />

      {errorMsg && (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <p className="error-text" style={{ margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <div className="panel">
        <h2>比較する枝番号を選択</h2>
        {loading ? (
          <p className="muted">読み込み中...</p>
        ) : (
          <div className="checkbox-list">
            {branches.map((b) => (
              <label key={b.branch_no}>
                <input
                  type="checkbox"
                  checked={selected.includes(b.branch_no)}
                  onChange={() => toggleBranch(b.branch_no)}
                />
                {String(b.branch_no).padStart(2, "0")} {b.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>材積の推移</h2>
        {markets.length === 0 ? (
          <p className="muted">まだ回が作成されていません。</p>
        ) : selected.length === 0 ? (
          <p className="muted">上のリストから比較したい枝番号を選択してください。</p>
        ) : (
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd3" />
                <XAxis dataKey="label" fontSize={11} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                {selected.map((no, i) => (
                  <Line
                    key={no}
                    type="monotone"
                    dataKey={String(no)}
                    name={`${String(no).padStart(2, "0")} ${branchMap[no] || ""}`}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
