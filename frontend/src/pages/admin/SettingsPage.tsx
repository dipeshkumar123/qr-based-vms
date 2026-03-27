import { ChangeEvent, FormEvent, useState } from "react";

type StatusState = "idle" | "saving" | "saved";

interface SecuritySettings {
  enforceTwoFactor: boolean;
  sessionTimeout: string;
  ipAllowlist: string;
}

interface NotificationSettings {
  emailAlerts: boolean;
  smsAlerts: boolean;
  weeklyDigest: boolean;
  slackWebhook: string;
}

interface BrandingSettings {
  accentColor: string;
  logoUrl: string;
  footerNote: string;
}

export function SettingsPage() {
  const [status, setStatus] = useState<StatusState>("idle");
  const [security, setSecurity] = useState<SecuritySettings>({
    enforceTwoFactor: true,
    sessionTimeout: "30",
    ipAllowlist: "",
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailAlerts: true,
    smsAlerts: false,
    weeklyDigest: true,
    slackWebhook: "",
  });
  const [branding, setBranding] = useState<BrandingSettings>({
    accentColor: "#5eead4",
    logoUrl: "",
    footerNote: "Fostering secure, seamless visitor journeys.",
  });

  function handleSecurityChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type, checked } = event.target;
    setSecurity((previous) => ({ ...previous, [name]: type === "checkbox" ? checked : value }));
  }

  function handleNotificationsToggle(event: ChangeEvent<HTMLInputElement>) {
    const { name, checked } = event.target;
    setNotifications((previous) => ({ ...previous, [name]: checked }));
  }

  function handleNotificationsInput(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setNotifications((previous) => ({ ...previous, [name]: value }));
  }

  function handleBrandingChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setBranding((previous) => ({ ...previous, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    window.setTimeout(() => {
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2500);
    }, 800);
  }

  return (
    <form className="settings" onSubmit={handleSubmit}>
      <header className="settings-header">
        <div>
          <h2>Control center</h2>
          <p>Update access guardrails, adjust alerting, and fine-tune branding assets in one place.</p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
          {status === "saving" ? "Saving" : "Save changes"}
        </button>
      </header>

      <section className="settings-grid">
        <article className="settings-card">
          <header>
            <h3>Security & compliance</h3>
            <p>Harden entry policies and automate compliance guardrails across campuses.</p>
          </header>
          <label className="toggle">
            <input
              type="checkbox"
              name="enforceTwoFactor"
              checked={security.enforceTwoFactor}
              onChange={handleSecurityChange}
            />
            Enforce admin two-factor authentication
          </label>
          <label>
            Session timeout
            <select name="sessionTimeout" value={security.sessionTimeout} onChange={handleSecurityChange}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="120">2 hours</option>
            </select>
          </label>
          <label>
            IP allowlist
            <textarea
              name="ipAllowlist"
              value={security.ipAllowlist}
              onChange={handleSecurityChange}
              placeholder="Add IPv4/IPv6 ranges separated by commas"
              rows={4}
            />
          </label>
        </article>

        <article className="settings-card">
          <header>
            <h3>Notifications</h3>
            <p>Align real-time alerts with each facility’s escalation playbook.</p>
          </header>
          <label className="toggle">
            <input
              type="checkbox"
              name="emailAlerts"
              checked={notifications.emailAlerts}
              onChange={handleNotificationsToggle}
            />
            Email visitor arrival updates to hosts
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              name="smsAlerts"
              checked={notifications.smsAlerts}
              onChange={handleNotificationsToggle}
            />
            Deliver SMS alerts to on-call security
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              name="weeklyDigest"
              checked={notifications.weeklyDigest}
              onChange={handleNotificationsToggle}
            />
            Send weekly facility occupancy digest
          </label>
          <label>
            Slack webhook URL
            <input
              name="slackWebhook"
              value={notifications.slackWebhook}
              onChange={handleNotificationsInput}
              placeholder="https://hooks.slack.com/services/..."
            />
          </label>
        </article>

        <article className="settings-card">
          <header>
            <h3>Branding</h3>
            <p>Keep visitor touch points aligned with your corporate identity.</p>
          </header>
          <label>
            Accent color
            <input name="accentColor" type="color" value={branding.accentColor} onChange={handleBrandingChange} />
          </label>
          <label>
            Logo URL
            <input
              name="logoUrl"
              value={branding.logoUrl}
              onChange={handleBrandingChange}
              placeholder="https://cdn.example.com/logo.svg"
            />
          </label>
          <label>
            Footer note
            <textarea
              name="footerNote"
              value={branding.footerNote}
              onChange={handleBrandingChange}
              rows={3}
            />
          </label>
        </article>
      </section>

      {status === "saved" ? <div className="settings-toast">Preferences updated successfully.</div> : null}
    </form>
  );
}
