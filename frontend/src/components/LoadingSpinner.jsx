import { motion } from 'framer-motion';

const dotVariants = {
  initial: { opacity: 0.3, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
};

export default function LoadingSpinner({ fullScreen = false, message = 'Loading...' }) {
  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center"
    >
      <div className="relative w-14 h-14">
        <motion.div
          className="absolute inset-0 border-[3px] border-blue-100 rounded-full"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 border-[3px] border-transparent border-t-blue-600 border-r-blue-600 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <div className="flex items-center gap-1 mt-4">
        <p className="text-gray-500 text-sm font-medium">{message}</p>
        <span className="flex gap-0.5">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1 h-1 bg-gray-400 rounded-full"
              variants={dotVariants}
              initial="initial"
              animate="animate"
              transition={{ duration: 0.4, repeat: Infinity, repeatType: 'reverse', delay: i * 0.15 }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      {content}
    </div>
  );
}
