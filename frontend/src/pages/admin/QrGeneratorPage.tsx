import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

interface GeneratorForm {
  department: string;
  location: string;
  room: string;
  notes: string;
}

const DEFAULT_FORM: GeneratorForm = {
  department: "",
  location: "",
  room: "",
  notes: "",
};

export function QrGeneratorPage() {
  const [form, setForm] = useState<GeneratorForm>(DEFAULT_FORM);
  const [payload, setPayload] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<QRCodeCanvas | null>(null);

  const encoded = useMemo(() => {
    if (!payload) {
      return "";
    }
    return JSON.stringify({ type: "visitor-room", ...JSON.parse(payload) });
  }, [payload]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = {
      department: form.department.trim(),
      location: form.location.trim(),
      room: form.room.trim(),
      notes: form.notes.trim(),
    };
    setPayload(JSON.stringify(trimmed, null, 2));
    setCopied(false);
  }

  async function handleCopy() {
    if (!encoded) {
      return;
    }
    try {
      await navigator.clipboard.writeText(encoded);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
  }

  function handleDownload() {
    const dataUrl = qrRef.current?.toDataURL();
    if (!dataUrl) {
      return;
    }
    const link = document.createElement("a");
    link.download = `ii-vms-${form.department || "qr"}.png`;
    link.href = dataUrl;
    link.click();
  }

  return (
    <div className="qr-generator">
      <section className="generator-card">
        <div className="generator-copy">
          <h2>Create space-specific QR codes</h2>
          <p>
            Generate contextual QR codes for conference rooms, restricted labs, or classroom wings. Share
            codes with hosts or security to streamline access approvals.
          </p>
        </div>
        <form className="generator-form" onSubmit={handleSubmit}>
          <label>
            Department
            <input
              name="department"
              value={form.department}
              onChange={handleChange}
              placeholder="e.g. Engineering"
              required
            />
          </label>
          <label>
            Location
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Building or campus"
              required
            />
          </label>
          <label>
            Room No.
            <input
              name="room"
              value={form.room}
              onChange={handleChange}
              placeholder="Room or zone"
              required
            />
          </label>
          <label>
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Special instructions or host contact"
              rows={3}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Generate QR code
          </button>
        </form>
      </section>

      <section className="generator-preview">
        {encoded ? (
          <div className="preview-card">
            <div className="preview-qr">
              <QRCodeCanvas ref={qrRef} value={encoded} size={220} includeMargin bgColor="#0b1220" fgColor="#5eead4" />
            </div>
            <div className="preview-details">
              <h3>Payload</h3>
              <pre>{payload}</pre>
            </div>
            <div className="preview-actions">
              <button type="button" className="btn btn-primary" onClick={handleDownload}>
                Download QR
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleCopy}>
                {copied ? "Copied" : "Copy payload"}
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">Fill in the details to generate a QR code for this location.</div>
        )}
      </section>
    </div>
  );
}
