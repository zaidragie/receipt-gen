import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Settings() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sigUrl, setSigUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email || "";
    setEmail(userEmail);

    const { data, error } = await supabase
      .from("admins")
      .select("display_name, signature_path")
      .eq("email", userEmail)
      .single();

    if (!error && data) {
      setDisplayName(data.display_name || "");

      if (data.signature_path) {
        const { data: s } = await supabase.storage
          .from("signatures")
          .createSignedUrl(data.signature_path, 60 * 30);

        setSigUrl(s?.signedUrl || null);
      } else {
        setSigUrl(null);
      }
    }
  }

  useEffect(() => { load(); }, []);

  async function saveName() {
    if (!email) return;
    setSaving(true);

    const { error } = await supabase
      .from("admins")
      .update({ display_name: displayName.trim() || null })
      .eq("email", email);

    setSaving(false);
    if (error) return alert(error.message);
    alert("Saved ✅");
  }

  async function uploadSignature(file) {
    if (!email || !file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${email.replaceAll("@", "_").replaceAll(".", "_")}/signature.${ext}`;

    setSaving(true);

    const { error: upErr } = await supabase.storage
      .from("signatures")
      .upload(path, file, { upsert: true, contentType: file.type || "image/png" });

    if (upErr) {
      setSaving(false);
      return alert(upErr.message);
    }

    const { error: dbErr } = await supabase
      .from("admins")
      .update({ signature_path: path })
      .eq("email", email);

    setSaving(false);
    if (dbErr) return alert(dbErr.message);

    await load();
    alert("Signature uploaded ✅");
  }

  return (
    <div className="grid" style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="h1">Settings</div>

        <div className="grid">
          <div>
            <label className="small">Signed-in email</label>
            <input value={email} disabled />
          </div>

          <div>
            <label className="small">Issued by (name shown on receipts)</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Zaid Ragie"
            />
            <button className="btn primary" onClick={saveName} disabled={saving} style={{ marginTop: 10 }}>
              {saving ? "Saving…" : "Save name"}
            </button>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div className="h2">Signature</div>

            {sigUrl ? (
              <img
                src={sigUrl}
                alt="signature"
                style={{
                  maxWidth: 360,
                  width: "100%",
                  background: "white",
                  borderRadius: 12,
                  padding: 10,
                  border: "1px solid #e5e7eb"
                }}
              />
            ) : (
              <div className="muted">No signature uploaded yet.</div>
            )}

            <div style={{ marginTop: 10 }}>
              <label className="small">Upload signature image (PNG/JPG)</label>
              <input type="file" accept="image/*" onChange={(e) => uploadSignature(e.target.files?.[0])} />
              <div className="muted" style={{ marginTop: 6 }}>
                Tip: sign on white paper, take a photo, crop it tight, upload.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
