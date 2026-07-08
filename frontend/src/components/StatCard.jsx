import { motion } from 'framer-motion';

const bgs = {
  blue:   'bg-blue-50',
  green:  'bg-emerald-50',
  yellow: 'bg-amber-50',
  red:    'bg-rose-50',
  purple: 'bg-violet-50',
};

export default function StatCard({ icon, label, value, color = 'blue', subtitle }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`w-10 h-10 ${bgs[color] || bgs.blue} rounded-xl flex items-center justify-center`}>
          <span className="text-lg">{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-extrabold text-gray-900 stat-number">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </motion.div>
  );
}
