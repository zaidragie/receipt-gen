import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "../supabase";
import { makeReceiptNumber } from "../utils";

export default function NewReceipt() {
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [issuerEmail, setIssuerEmail] = useState("");

  const [form, setForm] = useState({
    organization_id: "",
    date_issued: new Date().toISOString().slice(0, 10),
    donor_name: "",
    donor_email: "",
    donor_phone: "",
    amount: "",
    payment_method: "EFT",
    reference: "",
    notes: "",
  });

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === form.organization_id) || null,
    [orgs, form.organization_id]
  );

  // Load current user email (for "Issued by" in PDF)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setIssuerEmail(data?.user?.email || "");
    })();
  }, []);

  // Load NGOs
  useEffect(() => {
    (async () => {
      setLoadingOrgs(true);
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      setLoadingOrgs(false);
      if (error) return alert(error.message);

      setOrgs(data || []);
      if (data?.length && !form.organization_id) {
        setForm((f) => ({ ...f, organization_id: data[0].id }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed logo URL (UI preview + used to embed in PDF)
  useEffect(() => {
    (async () => {
      if (!selectedOrg?.logo_path) return setLogoUrl(null);
      const { data, error } = await supabase.storage
        .from("logos")
        .createSignedUrl(selectedOrg.logo_path, 60 * 30);

      if (error) return setLogoUrl(null);
      setLogoUrl(data?.signedUrl || null);
    })();
  }, [selectedOrg?.logo_path]);

  function money(n) {
    const v = Number(n || 0);
    return `R ${v.toFixed(2)}`;
  }

  // Convert image url -> data URL for jsPDF.addImage
  async function imageUrlToDataUrl(url) {
    if (!url) return null;
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // Brand colors (match your app feel)
  const BRAND = { r: 79, g: 140, b: 255 }; // #4f8cff

  async function generatePdfBlob({ receiptNumber, logoDataUrl }) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageW = 595;
    const pageH = 842;

    const innerW = pageW - margin * 2;

    // Helpers
    const line = (y) => {
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
    };

    // ===== Header Brand Bar =====
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 0, pageW, 110, "F");

    // Logo (on brand bar)
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", margin, 26, 58, 58);
      } catch {
        try {
          doc.addImage(logoDataUrl, "JPEG", margin, 26, 58, 58);
        } catch {}
      }
    } else {
      // subtle placeholder box
      doc.setDrawColor(255);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, 26, 58, 58, 10, 10, "S");
    }

    // Org name + official title
    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(selectedOrg?.name || "NGO", margin + 74, 54);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("OFFICIAL DONATION RECEIPT", margin + 74, 76);

    // Receipt meta (right side on header)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Receipt No:", pageW - margin - 170, 48);
    doc.setFont("helvetica", "normal");
    doc.text(receiptNumber, pageW - margin - 98, 48);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", pageW - margin - 170, 68);
    doc.setFont("helvetica", "normal");
    doc.text(form.date_issued, pageW - margin - 98, 68);

    doc.setTextColor(0);

    // ===== Body starts =====
    let y = 130;

    // Org info line(s)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);

    const orgLines = [];
    if (selectedOrg?.address) orgLines.push(selectedOrg.address);
    const regs = [];
    if (selectedOrg?.reg_no) regs.push(`Reg: ${selectedOrg.reg_no}`);
    if (selectedOrg?.tax_no) regs.push(`Tax/PBO: ${selectedOrg.tax_no}`);
    if (regs.length) orgLines.push(regs.join(" • "));

    const orgText = orgLines.join("   |   ");
    if (orgText) {
      const wrappedOrg = doc.splitTextToSize(orgText, innerW);
      doc.text(wrappedOrg, margin, y);
      y += wrappedOrg.length * 14 + 6;
    } else {
      y += 6;
    }

    doc.setTextColor(0);
    line(y);
    y += 18;

    // Statement line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    const statement =
      "This receipt acknowledges that the organization listed above has received the donation described below.";
    doc.text(doc.splitTextToSize(statement, innerW), margin, y);
    y += 30;
    doc.setTextColor(0);

    // ===== Donor Card =====
    doc.setDrawColor(220);
    doc.setFillColor(247, 249, 255);
    doc.roundedRect(margin, y, innerW, 105, 12, 12, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Donor details", margin + 14, y + 22);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const donorLeftX = margin + 14;

    doc.setTextColor(80);
    doc.text("Name", donorLeftX, y + 44);
    doc.text("Email", donorLeftX, y + 68);
    doc.text("Phone", donorLeftX, y + 92);

    doc.setTextColor(0);
    doc.text(form.donor_name || "-", donorLeftX + 58, y + 44);
    doc.text(form.donor_email || "-", donorLeftX + 58, y + 68);
    doc.text(form.donor_phone || "-", donorLeftX + 58, y + 92);

    y += 125;

    // ===== Donation Card =====
    doc.setDrawColor(220);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, y, innerW, 140, 12, 12, "S");

    // Amount banner
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(margin, y, innerW, 44, 12, 12, "F");

    doc.setTextColor(255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Amount: ${money(form.amount)}`, margin + 14, y + 28);

    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Donation details", margin + 14, y + 68);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text("Payment method", margin + 14, y + 92);
    doc.text("Reference", margin + 14, y + 112);

    doc.setTextColor(0);
    doc.text(form.payment_method || "-", margin + 130, y + 92);
    doc.text(form.reference || "-", margin + 130, y + 112);

    // Notes (wrapped)
    if (form.notes) {
      doc.setTextColor(70);
      doc.text("Notes", margin + 14, y + 132);
      doc.setTextColor(0);
      const wrappedNotes = doc.splitTextToSize(form.notes, innerW - 160);
      doc.text(wrappedNotes, margin + 130, y + 132);
    }

    doc.setTextColor(0);
    y += 170;

    // Thank you note
    const thankYou = selectedOrg?.thank_you_note || "Thank you for your support.";
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(70);
    doc.text(doc.splitTextToSize(thankYou, innerW), margin, y);
    doc.setTextColor(0);
    y += 28;

    // ===== Signature / Issued by =====
    doc.setDrawColor(220);
    doc.roundedRect(margin, y, innerW, 90, 12, 12, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Issued by", margin + 14, y + 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(issuerEmail ? issuerEmail : "-", margin + 14, y + 40);
    doc.setTextColor(0);

    // signature lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90);
    doc.text("Signature:", margin + innerW / 2 + 10, y + 24);
    doc.text("_____________________________", margin + innerW / 2 + 10, y + 44);

    doc.text("Date:", margin + innerW / 2 + 10, y + 64);
    doc.setTextColor(0);
    doc.text(form.date_issued, margin + innerW / 2 + 45, y + 64);

    y += 110;

    // Footer
doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(120);

doc.text(
  "Generated by NGO Receipt Generator",
  margin,
  pageH - 28
);

doc.text(
  "Built by Zaid Ragie",
  pageW - margin,
  pageH - 28,
  { align: "right" }
);

doc.setTextColor(0);

    return doc.output("blob");
  }

  async function sharePdf(blob, filename) {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: filename,
          text: "Donation receipt",
          files: [file],
        });
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  async function createReceipt() {
    if (!selectedOrg) return alert("Please create/select an NGO first.");
    if (!form.donor_name.trim()) return alert("Donor name is required.");
    if (!form.amount || Number(form.amount) <= 0)
      return alert("Amount must be greater than 0.");

    setSaving(true);
    try {
      const receiptNumber = makeReceiptNumber(selectedOrg.receipt_prefix || "REC-");
      const logoDataUrl = logoUrl ? await imageUrlToDataUrl(logoUrl) : null;

      const pdfBlob = await generatePdfBlob({ receiptNumber, logoDataUrl });
      const pdfPath = `${selectedOrg.id}/${receiptNumber}.pdf`;

      // Upload PDF
      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });

      if (upErr) throw upErr;

      // Insert DB row
      const { error: dbErr } = await supabase.from("receipts").insert({
        organization_id: selectedOrg.id,
        receipt_number: receiptNumber,
        date_issued: form.date_issued,
        donor_name: form.donor_name,
        donor_email: form.donor_email || null,
        donor_phone: form.donor_phone || null,
        amount: Number(form.amount),
        payment_method: form.payment_method || null,
        reference: form.reference || null,
        notes: form.notes || null,
        pdf_path: pdfPath,
      });

      if (dbErr) throw dbErr;

      // Best UX on Android: share sheet
      const shared = await sharePdf(pdfBlob, `${receiptNumber}.pdf`);
      alert(shared ? "Receipt saved ✅ (shared)" : "Receipt saved ✅");

      // Reset
      setForm((f) => ({
        ...f,
        donor_name: "",
        donor_email: "",
        donor_phone: "",
        amount: "",
        payment_method: "EFT",
        reference: "",
        notes: "",
      }));
    } catch (e) {
      alert(e.message || "Failed to create receipt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid" style={{ maxWidth: 720 }}>
      <div className="card">
        <div className="h1">New Receipt</div>

        {loadingOrgs ? (
          <div className="muted">Loading NGOs…</div>
        ) : orgs.length === 0 ? (
          <div className="muted">
            No NGOs yet. Go to <b>NGOs</b> and add one first.
          </div>
        ) : (
          <>
            {/* NGO selector */}
            <div className="kpi" style={{ marginBottom: 12 }}>
              <div className="logoBox">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="logo"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span className="muted">Logo</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <label className="small">NGO</label>
                <select
                  value={form.organization_id}
                  onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>

                <div className="muted" style={{ marginTop: 6 }}>
                  Prefix: <b>{selectedOrg?.receipt_prefix || "REC-"}</b>
                </div>
              </div>

              <div style={{ width: 160 }}>
                <label className="small">Date</label>
                <input
                  type="date"
                  value={form.date_issued}
                  onChange={(e) => setForm({ ...form, date_issued: e.target.value })}
                />
              </div>
            </div>

            {/* Form */}
            <div className="grid">
              <div>
                <label className="small">Donor full name *</label>
                <input
                  placeholder="e.g. John Smith"
                  value={form.donor_name}
                  onChange={(e) => setForm({ ...form, donor_name: e.target.value })}
                />
              </div>

              <div className="row">
                <div>
                  <label className="small">Email</label>
                  <input
                    placeholder="optional"
                    value={form.donor_email}
                    onChange={(e) => setForm({ ...form, donor_email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="small">Phone</label>
                  <input
                    placeholder="optional"
                    value={form.donor_phone}
                    onChange={(e) => setForm({ ...form, donor_phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <label className="small">Amount (ZAR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 250.00"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="small">Payment method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  >
                    <option value="EFT">EFT</option>
                    <option value="Cash">Cash</option>
                    <option value="SnapScan">SnapScan</option>
                    <option value="Zapper">Zapper</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="small">Payment reference</label>
                <input
                  placeholder="optional"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>

              <div>
                <label className="small">Notes</label>
                <textarea
                  placeholder="optional"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <button className="btn primary" onClick={createReceipt} disabled={saving}>
                {saving ? "Creating…" : "Generate PDF + Save (Share on Android)"}
              </button>

              <div className="muted">
                If sharing doesn’t appear, use <b>History → Download / Share</b>.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
