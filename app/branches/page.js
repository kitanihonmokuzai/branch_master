"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Nav from "../../components/Nav";

export const dynamic = "force-dynamic";

export default function BranchMasterPage() {
  const [branches, setBranches] = useState([]);
  const [originalNames, setOriginalNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");

  async function load() {
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("branch_master")
      .select("*")
      .order("branch_no");

    if (error) {
      setErrorMsg("枝番表の取得に失敗しました: " + error.message);
      setLoading(false);
      return;
    }

    setBranches(data || []);
    const orig = {};
    (data || []).forEach((b) => (orig[b.branch_no] = b.name));
    setOriginalNames(orig);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateName(branch_no, value) {
    setBranches((rows) =>
      rows.map((b) => (b.branch_no === branch_no ? { ...b, name: value } : b))
    );
  }

  const changedRows = branches.filter(
    (b) => b.name !== originalNames[b.branch_no]
  );

  async function handleSave() {
    if (changedRows.length === 0) return;
    setSaving(true);
    setErrorMsg("");
    setDoneMsg("");

    for (const b of changedRows) {
      const { error } = await supabase
        .from("branch_master")
        .update({ name: b.name })
        .eq("branch_no", b.branch_no);
      if (error) {
        setErrorMsg(`枝番号${String(b.branch_no).padStart(2, "0")}の更新に失敗しました: ` + error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setDoneMsg(`${changedRows.length}件の名称を更新しました。`);
    load();
  }

  return (
    <div className="container">
      <Nav title="枝番表の編集" />

      <div className="panel">
        <h2>枝番号 0〜49 の名称</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          枝番号は追加・削除できません。名称だけを書き換えられます。ここでの変更は今後の入力から反映され、既に入力済みの回のデータ（過去の明細に表示される名称）は変更されません。
        </p>

        {errorMsg && <p className="error-text">{errorMsg}</p>}
        {doneMsg && <p className="muted" style={{ color: "var(--ok)" }}>{doneMsg}</p>}

        {loading ? (
          <p className="muted">読み込み中...</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th style={{ width: "15%" }}>枝番号</th>
                  <th>名称</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => {
                  const changed = b.name !== originalNames[b.branch_no];
                  return (
                    <tr key={b.branch_no}>
                      <td>{String(b.branch_no).padStart(2, "0")}</td>
                      <td>
                        <input
                          type="text"
                          className={changed ? "invalid" : ""}
                          value={b.name}
                          onChange={(e) => updateName(b.branch_no, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="row" style={{ marginTop: 14 }}>
              <button onClick={handleSave} disabled={saving || changedRows.length === 0}>
                {saving ? "保存中..." : `変更を保存（${changedRows.length}件）`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
