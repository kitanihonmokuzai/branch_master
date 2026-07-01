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

  // 最終行の両方が埋まったら自動で次の空行を追加する（スプレッドシート的な連続入力）
  useEffect(() => {
    const last = draftRows[draftRows.length - 1];
    if (last && last.branch_no !== "" && last.volume !== "") {
      const newRow = makeEmptyRow(idRef);
      setDraftRows((rows) => [...rows, newRow]);
      // 次の行の枝番号セレクトへフォーカスを移す
      setTimeout(() => {
        const el = branchRefs.current[newRow.key];
        if (el) el.focus();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRows]);

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

  const rowsToSave = draftRows.filter(
    (r) => r.branch_no !== "" && r.volume !== ""
  );
  const incompleteRows = draftRows.filter(
    (r) => (r.branch_no === "") !== (r.volume === "")
  );

  async function handleSaveBatch() {
    setErrorMsg("");

    if (incompleteRows.length > 0) {
      setErrorMsg(
        `枝番号・材積の片方だけ入力されている行が${incompleteRows.length}件あります。赤くハイライトされた行を修正するか削除してから保存してください。`
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
    }));
    const { error } = await supabase.from("entries").insert(payload);
    setSavingBatch(false);

    if (error) {
      setErrorMsg("保存に失敗しました: " + error.message);
      return;
    }

    const freshRow = makeEmptyRow(idRef);
    setDraftRows([freshRow]);
    setTimeout(() => {
      const el = branchRefs.current[freshRow.key];
      if (el) el.focus();
    }, 0);
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
        <table>
          <thead>
            <tr>
              <th style={{ width: "55%" }}>枝番号</th>
              <th>材積 (m3)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draftRows.map((r) => {
              const isIncomplete = (r.branch_no === "") !== (r.volume === "");
              return (
                <tr key={r.key} className={isIncomplete ? "missing-row" : ""}>
                  <td>
                    <select
                      ref={(el) => {
                        branchRefs.current[r.key] = el;
                      }}
                      className={isIncomplete && r.branch_no === "" ? "invalid" : ""}
                      value={r.branch_no}
                      onChange={(e) =>
                        updateDraftRow(r.key, "branch_no", e.target.value)
                      }
                    >
                      <option value="">選択してください</option>
                      {branches.map((b) => (
                        <option key={b.branch_no} value={b.branch_no}>
                          {String(b.branch_no).padStart(2, "0")} {b.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={isIncomplete && r.volume === "" ? "invalid" : ""}
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="例: 1.234"
                      value={r.volume}
                      onChange={(e) =>
                        updateDraftRow(r.key, "volume", e.target.value)
                      }
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
              片方だけ入力されている行が{incompleteRows.length}件あります
            </span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          枝番号と材積を入力すると自動で次の行が追加されるので、連続して入力を続けられます。片方だけ入力された行は赤くハイライトされ、そのままでは保存できません。入力が終わったら「まとめて保存」を押してください。
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
