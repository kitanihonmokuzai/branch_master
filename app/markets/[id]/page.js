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

export const dynamic = "force-dynamic";

function makeEmptyRow(idRef) {
  idRef.current += 1;
  return { key: idRef.current, branch_no: "", volume: "" };
}

function isBranchValid(v) {
  if (v === "") return false;
  if (!/^\d{1,2}$/.test(v)) return false;
  const n = Number(v);
  return n >= 0 && n <= 49;
}

function isVolumeValid(v) {
  if (v === "") return false;
  if (!/^\d*\.?\d*$/.test(v)) return false; // ".333" のような入力も許可
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

function toVerticalFriendly(text) {
  return String(text || "").replace(/\(/g, "（").replace(/\)/g, "）");
}

function BranchAxisTick({ x, y, payload, nameMap }) {
  const no = payload.value;
  const name = toVerticalFriendly(nameMap[no] || "");
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#2b2620">
        {no}
      </text>
      <text
        x={0}
        y={18}
        textAnchor="start"
        fontSize={10}
        fill="#7a7264"
        style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
      >
        {name}
      </text>
    </g>
  );
}

export default function MarketDetailPage({ params }) {
  const marketId = params.id;

  const [market, setMarket] = useState(null);
  const [branches, setBranches] = useState([]); // [{branch_no, name}]
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const idRef = useRef(0);
  const [draftRows, setDraftRows] = useState(() => [makeEmptyRow(idRef)]);
  const [savingBatch, setSavingBatch] = useState(false);
  const branchRefs = useRef({});
  const volumeRefs = useRef({});
  const [entryFilter, setEntryFilter] = useState("");
  const [showEntries, setShowEntries] = useState(false);

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

  function updateDraftRow(key, field, value) {
    setDraftRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  }

  function removeDraftRow(key) {
    setDraftRows((rows) => {
      const next = rows.filter((r) => r.key !== key);
      return next.length === 0 ? [makeEmptyRow(idRef)] : next;
    });
  }

  function focusRow(key, target) {
    setTimeout(() => {
      const el = target === "branch" ? branchRefs.current[key] : volumeRefs.current[key];
      if (el) el.focus();
    }, 0);
  }

  function padBranch(rowKey) {
    setDraftRows((rows) =>
      rows.map((r) => {
        if (r.key !== rowKey) return r;
        if (!isBranchValid(r.branch_no)) return r;
        return { ...r, branch_no: String(Number(r.branch_no)).padStart(2, "0") };
      })
    );
  }

  function handleBranchKeyDown(rowKey, e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    padBranch(rowKey);
    focusRow(rowKey, "volume");
  }

  function handleVolumeKeyDown(rowKey, e) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const row = draftRows.find((r) => r.key === rowKey);
    if (!row) return;

    if (!isBranchValid(row.branch_no) || !isVolumeValid(row.volume)) {
      setErrorMsg("枝番号（0〜49）と材積の両方を正しく入力してから次に進んでください。");
      return;
    }
    setErrorMsg("");

    const idx = draftRows.findIndex((r) => r.key === rowKey);
    if (idx === draftRows.length - 1) {
      const newRow = makeEmptyRow(idRef);
      setDraftRows((rows) => [...rows, newRow]);
      focusRow(newRow.key, "branch");
    } else {
      focusRow(draftRows[idx + 1].key, "branch");
    }
  }

  const rowsToSave = draftRows.filter(
    (r) => isBranchValid(r.branch_no) && isVolumeValid(r.volume)
  );
  const incompleteRows = draftRows.filter((r) => {
    const hasInput = r.branch_no !== "" || r.volume !== "";
    const complete = isBranchValid(r.branch_no) && isVolumeValid(r.volume);
    return hasInput && !complete;
  });

  async function handleSaveBatch() {
    setErrorMsg("");

    if (incompleteRows.length > 0) {
      setErrorMsg(
        `枝番号・材積が正しく揃っていない行が${incompleteRows.length}件あります。赤くハイライトされた行を修正するか削除してから保存してください。`
      );
      return;
    }
    if (rowsToSave.length === 0) {
      setErrorMsg("保存する行がありません。枝番号と材積を入力してください。");
      return;
    }

    setSavingBatch(true);
    const payload = rowsToSave.map((r) => ({
      market_id: marketId,
      branch_no: Number(r.branch_no),
      volume: Number(r.volume),
      branch_name_snapshot: branchMap[Number(r.branch_no)] || null,
    }));
    const { error } = await supabase.from("entries").insert(payload);
    setSavingBatch(false);

    if (error) {
      setErrorMsg("保存に失敗しました: " + error.message);
      return;
    }

    const freshRow = makeEmptyRow(idRef);
    setDraftRows([freshRow]);
    focusRow(freshRow.key, "branch");
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

  const filteredEntries =
    entryFilter === ""
      ? entries
      : entries.filter((e) => e.branch_no === Number(entryFilter));

  const summary = useMemo(() => {
    const rows = [];
    for (let no = 0; no <= 49; no++) {
      const matched = entries.filter((e) => e.branch_no === no);
      const count = matched.length;
      const total = matched.reduce((sum, e) => sum + Number(e.volume || 0), 0);
      const name =
        (matched[0] && (matched[0].branch_name_snapshot || branchMap[no])) ||
        branchMap[no] ||
        "";
      rows.push({ branch_no: no, name, count, total });
    }
    return rows;
  }, [entries, branchMap]);

  const grandTotal = summary.reduce((s, r) => s + r.total, 0);
  const grandCount = summary.reduce((s, r) => s + r.count, 0);

  const chartData = summary
    .filter((r) => r.total > 0)
    .map((r) => ({
      no: String(r.branch_no).padStart(2, "0"),
      name: r.name,
      材積: Number(r.total.toFixed(3)),
    }));
  const chartNameMap = {};
  chartData.forEach((d) => {
    chartNameMap[d.no] = d.name;
  });

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
        <table>
          <thead>
            <tr>
              <th style={{ width: "15%" }}>枝番号</th>
              <th style={{ width: "35%" }}>名称</th>
              <th style={{ width: "30%" }}>材積 (m3)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draftRows.map((r) => {
              const branchOk = r.branch_no === "" || isBranchValid(r.branch_no);
              const volumeOk = r.volume === "" || isVolumeValid(r.volume);
              const hasInput = r.branch_no !== "" || r.volume !== "";
              const complete = isBranchValid(r.branch_no) && isVolumeValid(r.volume);
              const rowProblem = hasInput && !complete;
              const nameForRow = isBranchValid(r.branch_no)
                ? branchMap[Number(r.branch_no)] || ""
                : "";

              return (
                <tr key={r.key} className={rowProblem ? "missing-row" : ""}>
                  <td>
                    <input
                      ref={(el) => {
                        branchRefs.current[r.key] = el;
                      }}
                      className={!branchOk ? "invalid" : ""}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="0-49"
                      value={r.branch_no}
                      onChange={(e) =>
                        updateDraftRow(r.key, "branch_no", e.target.value.trim())
                      }
                      onKeyDown={(e) => handleBranchKeyDown(r.key, e)}
                      onBlur={() => padBranch(r.key)}
                    />
                  </td>
                  <td className="muted">{nameForRow}</td>
                  <td>
                    <input
                      ref={(el) => {
                        volumeRefs.current[r.key] = el;
                      }}
                      className={!volumeOk ? "invalid" : ""}
                      type="text"
                      inputMode="decimal"
                      placeholder="例: .333 → 0.333"
                      value={r.volume}
                      onChange={(e) =>
                        updateDraftRow(r.key, "volume", e.target.value.trim())
                      }
                      onKeyDown={(e) => handleVolumeKeyDown(r.key, e)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeDraftRow(r.key)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="row" style={{ marginTop: 14 }}>
          <button type="button" onClick={handleSaveBatch} disabled={savingBatch}>
            {savingBatch ? "保存中..." : `まとめて保存（${rowsToSave.length}件）`}
          </button>
          {incompleteRows.length > 0 && (
            <span className="error-text">
              入力が揃っていない行が{incompleteRows.length}件あります
            </span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          枝番号(0〜49)を入力してEnterで材積欄へ、材積を入力してEnterで次の行へ移動します。材積は「.333」のように入力しても0.333として認識されます。片方だけ入力された行は赤くハイライトされ、保存できません。
        </p>
      </div>

      <details className="panel">
        <summary>入力明細を表示（{entries.length}件）</summary>
        {entries.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>まだ入力がありません。</p>
        ) : (
          <>
            <div className="row" style={{ marginTop: 12 }}>
              <div className="field">
                <label>枝番号で絞り込み</label>
                <select
                  value={entryFilter}
                  onChange={(e) => setEntryFilter(e.target.value)}
                >
                  <option value="">すべて表示</option>
                  {branches.map((b) => (
                    <option key={b.branch_no} value={b.branch_no}>
                      {String(b.branch_no).padStart(2, "0")} {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {filteredEntries.length === 0 ? (
              <p className="muted" style={{ marginTop: 12 }}>
                該当する明細がありません。
              </p>
            ) : (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>枝番号</th>
                    <th>名称</th>
                    <th>材積</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((e) => (
                    <tr key={e.id}>
                      <td>{String(e.branch_no).padStart(2, "0")}</td>
                      <td>{e.branch_name_snapshot || branchMap[e.branch_no] || ""}</td>
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
          </>
        )}
      </details>

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
          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2ddd3" />
                <XAxis
                  dataKey="no"
                  height={100}
                  interval={0}
                  tick={(props) => <BranchAxisTick {...props} nameMap={chartNameMap} />}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value) => [`${value} m3`, "材積"]}
                  labelFormatter={(no) => `${no} ${chartNameMap[no] || ""}`}
                />
                <Bar dataKey="材積" fill="#7a5c3e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
