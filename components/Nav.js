"use client";

import Link from "next/link";

export default function Nav({ title }) {
  return (
    <div className="header">
      <h1>{title}</h1>
      <nav className="nav">
        <Link href="/">回一覧</Link>
        <Link href="/trends">推移グラフ</Link>
        <Link href="/branches">枝番表の編集</Link>
      </nav>
    </div>
  );
}
