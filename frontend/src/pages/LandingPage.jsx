import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/* ─── Reusable SVG icon components ─── */
const icons = {
  shield: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  qrCode: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 13.875h3.375m3.375 0H21m-7.5 3.375h.008v.008H13.5v-.008zm3.375 0h.008v.008h-.008v-.008zm3.375 0H21v3.375h-3.375v-3.375z" />
    </svg>
  ),
  chart: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v10.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 019 19.875V9.75zm6-3.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v13.875c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0115 19.875V6z" />
    </svg>
  ),
  bolt: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  bell: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  building: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  ),
};

const featureIconColors = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

const features = [
  { icon: icons.shield,   title: "Enhanced Security",     description: "Identity verification and tamper-proof blockchain-based audit trails" },
  { icon: icons.qrCode,   title: "Contactless Check-in",  description: "QR code based seamless entry for visitors with instant notifications" },
  { icon: icons.chart,     title: "Real-time Analytics",   description: "AI-powered insights and visitor pattern analysis for better decisions" },
  { icon: icons.bolt,      title: "Lightning Fast",        description: "Instant registration and check-in process saves time and improves flow" },
  { icon: icons.bell,      title: "Smart Notifications",   description: "Automated alerts for hosts when their visitors arrive at premises" },
  { icon: icons.building,  title: "Enterprise Ready",      description: "Modern interface for offices, institutions, and research facilities" },
];

const stats = [
  { value: "99.9%", label: "Uptime" },
  { value: "<3s",   label: "Check-in Time" },
  { value: "256-bit", label: "Encryption" },
  { value: "24/7",  label: "Monitoring" },
];

const steps = [
  { step: "1", title: "Register Online",   desc: "Fill out a simple form with your contact details and purpose of visit" },
  { step: "2", title: "Receive QR Code",   desc: "Get a unique QR code via email instantly after registration" },
  { step: "3", title: "Scan & Check In",   desc: "Present your QR code at entry for contactless, instant verification" },
  { step: "4", title: "Track & Monitor",   desc: "Admins receive real-time notifications, analytics and audit trails" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 pb-24 px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 animated-gradient">
        {/* Decorative blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl float-delay" />

        <div className="container mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-blue-700 bg-blue-100 rounded-full">
              Secure &bull; Intelligent &bull; Contactless
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Intelligent Visitor Management
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-2xl mx-auto">
              Transform your organisation's visitor experience with contactless check-ins, 
              biometric verification, and AI-powered real-time analytics.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="group px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Register as Visitor
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                to="/admin/login"
                className="px-8 py-4 rounded-xl bg-white/80 backdrop-blur text-gray-800 font-semibold border border-gray-200 hover:border-blue-400 hover:bg-white shadow-sm hover:shadow-md transition-all duration-200"
              >
                Admin Access
              </Link>
            </div>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s, i) => (
                <div key={i} className="glass-card rounded-xl px-6 py-4 text-center">
                  <p className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent stat-number">{s.value}</p>
                  <p className="text-sm text-gray-500 font-medium mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section id="features" className="py-24 px-4 bg-white">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 rounded-full">
              Features
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-2xl mx-auto">
              A comprehensive platform built for modern visitor management with security at its core.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="group relative p-6 bg-white rounded-2xl border border-gray-100 hover:border-transparent hover:shadow-xl transition-all duration-300"
              >
                {/* Gradient hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${featureIconColors[idx]} flex items-center justify-center text-white mb-4 shadow-lg shadow-${featureIconColors[idx].split('-')[1]}-500/25`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-3 py-1 mb-4 text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 rounded-full">
              How It Works
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              Simple 4-Step Process
            </h2>
          </motion.div>

          <div className="max-w-3xl mx-auto relative">
            {/* Connecting line */}
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-400 via-purple-400 to-emerald-400 hidden sm:block" />

            <div className="space-y-8">
              {steps.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.15 }}
                  className="flex items-start gap-6 relative"
                >
                  <div className="relative z-10 w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-lg shadow-blue-500/25">
                    {item.step}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{item.title}</h3>
                    <p className="text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="relative py-24 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white animated-gradient overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-2xl float" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-2xl float-delay" />
        </div>
        <div className="container mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6">Ready to Get Started?</h2>
            <p className="text-xl mb-10 text-blue-100 max-w-2xl mx-auto">
              Join modern organisations using II-VMS for secure, intelligent visitor management.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-blue-700 rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              Register Now
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
