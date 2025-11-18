import { QRCodeSVG } from "qrcode.react";
import { Visitor } from "../api";

interface QrPreviewProps {
  visitor: Visitor | null;
}

export function QrPreview({ visitor }: QrPreviewProps) {
  if (!visitor) {
    return (
      <div className="card">
        <h2>QR Code</h2>
        <p>Select a visitor or submit the form to see their QR token.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>QR Code</h2>
      <p>
        Present this code at the security checkpoint. Status: <strong>{visitor.status}</strong>
      </p>
      <div className="qr-wrapper">
        <QRCodeSVG value={visitor.qrToken} size={180} />
      </div>
      <dl className="details">
        <div>
          <dt>Name</dt>
          <dd>{visitor.name}</dd>
        </div>
        <div>
          <dt>Purpose</dt>
          <dd>{visitor.purpose}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{visitor.qrToken}</dd>
        </div>
      </dl>
    </div>
  );
}
