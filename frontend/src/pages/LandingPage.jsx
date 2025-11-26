import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="container mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Intelligent, Integrated Visitor Management
            </h1>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Transform your organization's visitor experience with contactless check-ins, 
              identity verification, and real-time analytics
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:shadow-2xl transform hover:scale-105 transition-all"
              >
                Register as Visitor
              </Link>
              <Link
                to="/admin/login"
                className="px-8 py-4 rounded-lg bg-white text-gray-800 font-semibold border-2 border-gray-300 hover:border-blue-600 hover:shadow-lg transition-all"
              >
                Admin Access
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl font-bold text-center mb-16"
          >
            Key Features
          </motion.h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🔐",
                title: "Enhanced Security",
                description: "Identity verification and tamper-proof blockchain-based audit trails"
              },
              {
                icon: "📱",
                title: "Contactless Check-in",
                description: "QR code based seamless entry for visitors with instant notifications"
              },
              {
                icon: "📊",
                title: "Real-time Analytics",
                description: "AI-powered insights and visitor pattern analysis for better decision making"
              },
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Instant registration and check-in process saves time and improves flow"
              },
              {
                icon: "🔔",
                title: "Smart Notifications",
                description: "Automated alerts for hosts when their visitors arrive at the premises"
              },
              {
                icon: "💼",
                title: "Professional",
                description: "Modern interface designed for offices, institutions, and research facilities"
              }
            ].map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 bg-white rounded-xl shadow-lg hover:shadow-2xl transition-shadow"
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="max-w-3xl mx-auto space-y-8">
            {[
              { step: "1", title: "Visitor Registers", desc: "Fill out a simple online form with contact details and purpose" },
              { step: "2", title: "Receive QR Code", desc: "Get a unique QR code via email instantly after registration" },
              { step: "3", title: "Quick Check-in", desc: "Scan QR at entry for contactless, instant check-in" },
              { step: "4", title: "Track & Monitor", desc: "Admins receive real-time notifications and analytics" }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="flex items-start gap-6"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join modern organizations using II-VMS for secure visitor management
          </p>
          <Link
            to="/register"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-2xl transform hover:scale-105 transition-all"
          >
            Register Now
          </Link>
        </div>
      </section>
    </div>
  );
}
