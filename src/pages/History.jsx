import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";

export default function History() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("receipts")
      .select(
        "id, receipt_number, date_issued, donor_name, donor_email, donor_phone, amount, payment_method, reference, notes, pdf_path, created_at, organizations(id, name)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    setLoading(false);
    if (error) return alert(error.message);
    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function shareSignedUrl(url, filename) {
    try {
      if (!navigator.share) return false;
      await navigator.share({ title: filename, url });
      return true;
    } catch {
      return false;
    }
  }

  async function openOrSharePdf(path, receiptNo) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 10);
    if (error) return alert(error.message);

    const url = data.signedUrl;
    const shared = await shareSignedUrl(url, `${receiptNo}.pdf`);
    if (!shared) window.open(url, "_blank");
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => {
      const hay = `${r.receipt_number} ${r.donor_name} ${r.organizations?.name || ""} ${r.reference || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  function money(n) {
    const v = Number(n || 0);
    return `R ${v.toFixed(2)}`;
  }

  return (
    <div className="grid" style={{ maxWidth: 920 }}>
      <div className="card">
        <div
          className="h1"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
        >
          <span>History</span>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="grid" style={{ marginBottom: 12 }}>
          <div>
            <label className="small">Search</label>
            <input
              placeholder="Receipt #, donor, NGO, reference…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="muted">Loading receipts…</div>
        ) : filtered.length === 0 ? (
          <div className="muted">No receipts found.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {filtered.map((r) => (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14 }}>{r.receipt_number}</div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {r.organizations?.name || "Unknown NGO"} • {r.date_issued}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900, fontSize: 14 }}>{money(r.amount)}</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>{r.donor_name}</div>
                  <div className="muted">
                    {r.payment_method ? `Method: ${r.payment_method}` : "Method: -"}
                    {r.reference ? ` • Ref: ${r.reference}` : ""}
                  </div>

                  {(r.donor_email || r.donor_phone) && (
                    <div className="muted" style={{ marginTop: 4 }}>
                      {r.donor_email ? r.donor_email : ""}
                      {r.donor_email && r.donor_phone ? " • " : ""}
                      {r.donor_phone ? r.donor_phone : ""}
                    </div>
                  )}

                  {r.notes && (
                    <div className="muted" style={{ marginTop: 6 }}>
                      Notes: {r.notes}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button
                    className="btn primary"
                    onClick={() => openOrSharePdf(r.pdf_path, r.receipt_number)}
                    disabled={!r.pdf_path}
                  >
                    Download / Share
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="muted" style={{ marginTop: 14 }}>
          Tip: On Android, this opens the share sheet when possible; otherwise it opens in a new tab.
        </div>
      </div>
    </div>
  );
}
