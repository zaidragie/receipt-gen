import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Orgs() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    address: "",
    reg_no: "",
    tax_no: "",
    receipt_prefix: "REC-",
    thank_you_note: "Thank you for your support.",
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) return alert(error.message);
    setOrgs(data || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addOrg() {
    if (!form.name.trim()) return alert("NGO name is required.");
    setSaving(true);

    const { error } = await supabase.from("organizations").insert({
      name: form.name.trim(),
      address: form.address.trim() || null,
      reg_no: form.reg_no.trim() || null,
      tax_no: form.tax_no.trim() || null,
      receipt_prefix: (form.receipt_prefix || "REC-").trim(),
      thank_you_note: form.thank_you_note.trim() || null,
    });

    setSaving(false);
    if (error) return alert(error.message);

    setForm({
      name: "",
      address: "",
      reg_no: "",
      tax_no: "",
      receipt_prefix: "REC-",
      thank_you_note: "Thank you for your support.",
    });

    await load();
  }

  async function uploadLogo(orgId, file) {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${orgId}/logo.${ext}`;

    // upload to bucket "logos"
    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/png",
      });

    if (upErr) return alert(upErr.message);

    // save logo_path on org
    const { error: dbErr } = await supabase
      .from("organizations")
      .update({ logo_path: path })
      .eq("id", orgId);

    if (dbErr) return alert(dbErr.message);

    await load();
    alert("Logo updated ✅");
  }

  async function getLogoUrl(logo_path) {
    if (!logo_path) return null;
    const { data } = await supabase.storage.from("logos").createSignedUrl(logo_path, 60 * 30);
    return data?.signedUrl || null;
  }

  return (
    <div className="grid" style={{ maxWidth: 920 }}>
      <div className="card">
        <div className="h1">NGOs</div>

        {/* Add NGO form */}
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="h2">Add NGO</div>

          <div className="grid">
            <div>
              <label className="small">NGO name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Helping Hands Foundation"
              />
            </div>

            <div>
              <label className="small">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="optional"
              />
            </div>

            <div className="row">
              <div>
                <label className="small">Registration No</label>
                <input
                  value={form.reg_no}
                  onChange={(e) => setForm({ ...form, reg_no: e.target.value })}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className="small">Tax/PBO No</label>
                <input
                  value={form.tax_no}
                  onChange={(e) => setForm({ ...form, tax_no: e.target.value })}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="row">
              <div>
                <label className="small">Receipt prefix</label>
                <input
                  value={form.receipt_prefix}
                  onChange={(e) => setForm({ ...form, receipt_prefix: e.target.value })}
                  placeholder="REC-"
                />
              </div>
              <div>
                <label className="small">Thank you note</label>
                <input
                  value={form.thank_you_note}
                  onChange={(e) => setForm({ ...form, thank_you_note: e.target.value })}
                  placeholder="Thank you for your support."
                />
              </div>
            </div>

            <button className="btn primary" onClick={addOrg} disabled={saving}>
              {saving ? "Saving…" : "Add NGO"}
            </button>
          </div>
        </div>

        {/* NGO list */}
        {loading ? (
          <div className="muted">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="muted">No NGOs yet. Add one above.</div>
        ) : (
          <div className="grid" style={{ gap: 12 }}>
            {orgs.map((o) => (
              <OrgCard key={o.id} org={o} getLogoUrl={getLogoUrl} uploadLogo={uploadLogo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgCard({ org, getLogoUrl, uploadLogo }) {
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    (async () => {
      const url = await getLogoUrl(org.logo_path);
      setLogo(url);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.logo_path]);

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="logoBox" style={{ width: 64, height: 64 }}>
          {logo ? (
            <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="muted">Logo</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{org.name}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Prefix: <b>{org.receipt_prefix || "REC-"}</b>
          </div>

          <div className="muted" style={{ marginTop: 6 }}>
            {org.reg_no ? `Reg: ${org.reg_no}` : "Reg: -"}
            {" • "}
            {org.tax_no ? `Tax/PBO: ${org.tax_no}` : "Tax/PBO: -"}
          </div>

          {org.address && <div className="muted" style={{ marginTop: 6 }}>{org.address}</div>}

          {org.thank_you_note && (
            <div className="muted" style={{ marginTop: 8 }}>
              “{org.thank_you_note}”
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <label className="small">Update logo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => uploadLogo(org.id, e.target.files?.[0])}
            />
            <div className="muted" style={{ marginTop: 6 }}>
              Tip: Square logos work best.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
