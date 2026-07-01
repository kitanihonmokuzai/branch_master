"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import Nav from "../components/Nav";

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HomePage() {
  const [markets, setMarkets] = useState([]);
  const [stats, setStats] = useState({}); // market_id -> {count, total}
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState(todayStr());
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function load() {
    setLoading(true);
    const { data: marketRows, error: marketErr } = await supabase
      .from("markets")
      .select("*")
      .order("market_date", { ascending: false });

    if (marketErr) {
      setErrorMsg("回一覧の取得に失敗しました: " + marketErr.message);
      setLoading(false);
      return;
    }

    const { data: entryRows, error: entryErr } = await supabase
      .from("entries")
      .select("market_id, volume");

    if (entryErr) {
      setErrorMsg("集計の取得に失敗しました: " + entryErr.message);
    }

    const s = {};
    (entryRows || []).forEach((e) => {
      if (!s[e.market_id]) s[e.market_id] = { count: 0, total: 0 };
      s[e.market_id].count += 1;
      s[e.market_id].total += Number(e.volume || 0);
    });

    setMarkets(marketRows || []);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createMarket() {
    setErrorMsg("");
    if (!newDate) {
      setErrorMsg("開催日を入力してください。");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("markets").insert({
      market_date: newDate,
      name: newName || null,
    });
    setCreating(false);
    if (error) {
      setErrorMsg("回の作成に失敗しました: " + error.message);
      return;
    }
    setNewName("");
    load();
  }

  return (
    <div className="container">
      <Nav title="銘木市 枝番号別集計" />

      <div className="panel">
        <h2>新しい回を作成</h2>
        <div className="row">
          <div className="field">
            <label>開催日</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>回の名称（任意）</label>
            <input
              type="text"
              placeholder="例：7月度銘木市"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <button onClick={createMarket} disabled={creating}>
            {creating ? "作成中..." : "回を作成"}
          </button>
        </div>
        {errorMsg && <p className="error-text" style={{ marginTop: 10 }}>{errorMsg}</p>}
      </div>

      <div className="panel">
        <h2>回一覧</h2>
        {loading ? (
          <p className="muted">読み込み中...</p>
        ) : markets.length === 0 ? (
          <p className="muted">まだ回が作成されていません。上のフォームから作成してください。</p>
        ) : (
          markets.map((m) => {
            const s = stats[m.id] || { count: 0, total: 0 };
            return (
              <div className="market-list-item" key={m.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {m.market_date} {m.name ? `｜${m.name}` : ""}
                  </div>
                  <div className="muted">
                    入力件数 {s.count} 件 ／ 合計材積 {s.total.toFixed(3)} m3
                  </div>
                </div>
                <Link href={`/markets/${m.id}`}>
                  <button className="secondary">開く</button>
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
