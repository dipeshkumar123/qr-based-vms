import { useState } from "react";
import { Link } from "react-router-dom";
import { VisitorForm } from "../components/VisitorForm";
import { QrPreview } from "../components/QrPreview";
import type { Visitor } from "../api";

const FEATURES = [
  {
    title: "Instant QR Check-in",
    description:
      "Generate secure QR badges in seconds and keep lobby traffic moving with touchless entry.",
  },
  {
    title: "Real-time Dashboard",
    description:
      "Monitor on-site activity, spot bottlenecks, and keep every visit compliant and accountable.",
  },
  {
    title: "Visitor Ledger",
    description:
      "Immutable event history ensures audit readiness across corporate offices and tech parks.",
  },
  {
    title: "Host Notifications",
    description:
      "Automatically alert hosts when their guests arrive to reduce wait times and no-shows.",
  },
  {
    title: "Security Controls",
    description:
      "Role-based access with admin keys and QR revocation keeps sensitive spaces protected.",
  },
  {
    title: "Compliance Ready",
    description:
      "Export visitor data instantly for regulatory checks, incident response, or stakeholder reports.",
  },
];

export function LandingPage() {
  const [preRegisteredVisitor, setPreRegisteredVisitor] = useState<Visitor | null>(null);

  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero__content">
          <span className="eyebrow">Visitor journeys, redefined</span>
          <h1>Smart QR-Based Visitor Management System</h1>
          <p>
            Create a frictionless check-in experience across corporate offices, coworking hubs, tech parks,
            and modern campuses. Capture every visitor interaction, keep security teams informed, and delight
            every guest with a seamless arrival.
          </p>
          <div className="cta-group">
            <Link to="/admin" className="btn btn-primary">
              Get Started
            </Link>
            <Link to="/check-in" className="btn btn-ghost">
              Scan QR
            </Link>
          </div>
          <div className="hero-highlights">
            <div>
              <strong>99.9%</strong>
              <span>Uptime across security checkpoints</span>
            </div>
            <div>
              <strong>15K+</strong>
              <span>Visitors processed every month</span>
            </div>
            <div>
              <strong>2x faster</strong>
              <span>Lobby throughput with QR automation</span>
            </div>
          </div>
        </div>
        <div className="landing-hero__visual">
          <div className="glass-card scanner-preview">
            <header>
              <span>Live scanner</span>
              <span className="status-dot" />
            </header>
            <div className="scanner-frame">
              <div className="scanner-lens" />
            </div>
            <footer>
              <div>
                <span className="label">Visitor</span>
                <strong>Ariana Sharma</strong>
              </div>
              <div>
                <span className="label">Purpose</span>
                <strong>Product demo</strong>
              </div>
            </footer>
          </div>
          <div className="glass-card activity-preview">
            <h3>Realtime arrivals</h3>
            <ul>
              <li>
                <span className="badge badge-positive">Checked-in</span>
                <div>
                  <strong>John Carter</strong>
                  <span>Meeting • HQ Lobby</span>
                </div>
                <time>09:42</time>
              </li>
              <li>
                <span className="badge badge-pending">Pending</span>
                <div>
                  <strong>Priya Verma</strong>
                  <span>Audit • Tower B</span>
                </div>
                <time>09:38</time>
              </li>
              <li>
                <span className="badge">Cleared</span>
                <div>
                  <strong>Elijah Brooks</strong>
                  <span>Interview • Innovation Lab</span>
                </div>
                <time>09:30</time>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="feature-section">
        <header>
          <h2>All the tools your lobby needs</h2>
          <p>
            From digital reception desks to enterprise-grade security controls, II-VMS adapts to your
            workflow and scales with every building you protect.
          </p>
        </header>
        <div className="feature-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-card__icon" />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="registration-section">
        <div className="registration-copy">
          <span className="eyebrow">Pre-register visitors</span>
          <h2>Create QR badges before guests arrive</h2>
          <p>
            Capture visitor details in advance, email QR passes instantly, and let guests breeze through
            your entrance with zero friction.
          </p>
          <ul>
            <li>Auto-generate secure QR tokens for each visitor.</li>
            <li>Share arrival instructions and parking details with one click.</li>
            <li>Keep compliance and security teams informed in real time.</li>
          </ul>
        </div>
        <div className="registration-form">
          <VisitorForm onSuccess={setPreRegisteredVisitor} />
          <QrPreview
            visitor={preRegisteredVisitor}
            emptyMessage="Submit the form to instantly issue a secure QR badge."
          />
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <h2>Build smarter, safer visitor journeys</h2>
          <p>
            Deploy II-VMS across every site and give teams a single, trusted platform for visitor
            engagement and compliance.
          </p>
          <div className="cta-group">
            <Link to="/admin" className="btn btn-primary">
              Launch Admin Dashboard
            </Link>
            <Link to="/check-in" className="btn btn-ghost">
              Open QR Scanner
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
