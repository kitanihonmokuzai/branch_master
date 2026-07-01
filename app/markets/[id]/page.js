"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "../../../lib/supabaseClient";
import Nav from "../../../components/Nav";

function branchLabel(no, branchMap) {
  const n = branchMap[no];
  return n ? `${String(no).padStart(2, "0")} ${n}` : String(no).padStart(2, "0");
}

export default function MarketDetailPage({ params }) {
  const marketId = params.id;

  const [market, setMarket] = useState(null);
  const [branches, setBranches] = useState([]); // [{branch_no, name}]
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [branchNo, setBranchNo] = useState("");
  const [volume, setVolume] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const volumeRef = useRef(null);

  const branchMap = useMemo(() => {
    const m = {};
    branches.forEach((b) => (m[b.branch_no] = b.name));
    return m;
  }, [branches]);

  async function load() {
    setLoading(true);
    setErrorMsg("");

    const [{ data: marketRow, error: marketErr }, { data: branchRows, error: branchErr }] =
      await Promise.all([
        supabase.from("markets").select("*").eq("id", marketId).single(),
        supabase.from("branch_master").select("*").order("branch_no"),
      ]);

    if (marketErr) {
      setErrorMsg("回の情報取得に失敗しました: " + marketErr.message);
      setLoading(false);
      return;
    }
    if (branchErr) {
      setErrorMsg("枝番表の取得に失敗しました: " + branchErr.message);
    }

    const { data: entryRows, error: entryErr } = await supabase
      .from("entries")
      .select("*")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true });

    if (entryErr) {
      setErrorMsg("入力データの取得に失敗しました: " + entryErr.message);
    }

    setMarket(marketRow);
    setBranches(branchRows || []);
    setEntries(entryRows || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  const branchMissing = touched && branchNo === "";
  const volumeMissing = touched && (volume === "" || Number.isNaN(Number(volume)));

  async function handleAdd(e) {
    e.preventDefault();
    setTouched(true);

    if (branchNo === "" || volume === "" || Number.isNaN(Number(volume))) {
      setErrorMsg("枝番号と材積の両方を入力してください。片方だけの入力は登録できません。");
      return;
    }
    if (Number(volume) < 0) {
      setErrorMsg("材積は0以上の数値で入力してください。");
      return;
    }

    setErrorMsg("");
    setSaving(true);
    const { error } = await supabase.from("entries").insert({
      market_id: marketId,
      branch_no: Number(branchNo),
      volume: Number(volume),
    });
    setSaving(false);

    if (error) {
      setErrorMsg("登録に失敗しました: " + error.message);
      return;
    }

    // 枝番号はそのまま残して連続入力しやすくし、材積だけクリアする
    setVolume("");
    setTouched(false);
    volumeRef.current && volumeRef.current.focus();
    load();
  }

  async function handleDelete(id) {
    if (!confirm("この明細を削除しますか？")) return;
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) {
      setErrorMsg("削除に失敗しました: " + error.message);
      return;
    }
    load();
  }

  const summary = useMemo(() => {
    const rows = [];
    for (let no = 0; no <= 49; no++) {
      const matched = entries.filter((e) => e.branch_no === no);
      const count = matched.length;
      const total = matched.reduce((sum, e) => sum + Number(e.volume || 0), 0);
      rows.push({ branch_no: no, name: branchMap[no] || "", count, total });
    }
    return rows;
  }, [entries, branchMap]);

  const grandTotal = summary.reduce((s, r) => s + r.total, 0);
  const grandCount = summary.reduce((s, r) => s + r.count, 0);

  const chartData = summary
    .filter((r) => r.total > 0)
    .map((r) => ({
      label: `${String(r.branch_no).padStart(2, "0")}`,
      材積: Number(r.total.toFixed(3)),
    }));

  if (loading) {
    return (
      <div className="container">
        <Nav title="銘木市 枝番号別集計" />
        <p className="muted">読み込み中...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="container">
        <Nav title="銘木市 枝番号別集計" />
        <p className="error-text">回が見つかりませんでした。</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Nav
        title={`${market.market_date}${market.name ? "｜" + market.name : ""}`}
      />

      {errorMsg && (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <p className="error-text" style={{ margin: 0 }}>{errorMsg}</p>
        </div>
      )}

      <div className="panel">
        <h2>物件入力</h2>
        <form className="row" onSubmit={handleAdd}>
          <div className="field">
            <label>枝番号</label>
            <select
              className={branchMissing ? "invalid" : ""}
              value={branchNo}
              onChange={(e) => setBranchNo(e.target.value)}
            >
              <option value="">選択してください</option>
              {branches.map((b) => (
                <option key={b.branch_no} value={b.branch_no}>
                  {String(b.branch_no).padStart(2, "0")} {b.name}
                </option>
              ))}
            </select>
            {branchMissing && <span className="error-text">枝番号が未選択です</span>}
          </div>
          <div className="field">
            <label>材積 (m3)</label>
            <input
              ref={volumeRef}
              className={volumeMissing ? "invalid" : ""}
              type="number"
              step="0.001"
              min="0"
              placeholder="例: 1.234"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
            />
            {volumeMissing && <span className="error-text">材積が未入力です</span>}
          </div>
          <button type="submit" disabled={saving}>
            {saving ? "登録中..." : "追加"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 10 }}>
          枝番号・材積の両方を入力しないと登録できません（片方だけの入力ミスを防止します）。登録後は枝番号を保持したまま材積欄がクリアされるので、同じ枝番が続く場合はそのまま連続入力できます。
        </p>
      </div>

      <div className="panel">
        <h2>入力明細（{entries.length}件）</h2>
        {entries.length === 0 ? (
          <p className="muted">まだ入力がありません。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>枝番号</th>
                <th>名称</th>
                <th>材積</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{String(e.branch_no).padStart(2, "0")}</td>
                  <td>{branchMap[e.branch_no] || ""}</td>
                  <td>{Number(e.volume).toFixed(3)}</td>
                  <td>
                    <button className="secondary" onClick={() => handleDelete(e.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>枝番号別 集計（この回）</h2>
        <table>
          <thead>
            <tr>
              <th>枝番号</th>
              <th>名称</th>
              <th>椪数</th>
              <th>合計材積</th>
            </tr>
          </thead>
          <tbody>
            {summary
              .filter((r) => r.count > 0)
              .map((r) => (
                <tr key={r.branch_no}>
                  <td>{String(r.branch_no).padStart(2, "0")}</td>
                  <td>{r.name}</td>
                  <td>{r.count}</td>
                  <td>{r.total.toFixed(3)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="summary-total">
          総椪数 {grandCount} 件 ／ 総材積 {grandTotal.toFixed(3)} m3
        </p>
      </div>

      <div className="panel">
        <h2>枝番別材積（この回）</h2>
        {chartData.length === 0 ? (
          <p className="muted">グラフ表示するデータがありません。</p>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd3" />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="材積" fill="#7a5c3e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
