import { motion } from 'framer-motion';
import type { Role } from '../store/appStore';

interface CloudDissolveOverlayProps {
  role: Role;
}

const cloudPuffs = [
  { x: -118, y: -22, size: 76, color: '#DDF7F4', delay: 0.12 },
  { x: -82, y: 74, size: 62, color: '#D9F3FF', delay: 0.16 },
  { x: -12, y: -96, size: 70, color: '#E8FAF0', delay: 0.08 },
  { x: 88, y: -70, size: 66, color: '#DCEEFF', delay: 0.14 },
  { x: 118, y: 34, size: 78, color: '#EAFBF5', delay: 0.18 },
  { x: 34, y: 98, size: 68, color: '#DCEFFF', delay: 0.2 },
];

const breathLines = [
  { rotate: -64, x: -70, y: -96 },
  { rotate: -28, x: 50, y: -106 },
  { rotate: 8, x: 104, y: -30 },
  { rotate: 42, x: 78, y: 84 },
  { rotate: 76, x: -24, y: 106 },
  { rotate: 116, x: -110, y: 36 },
];

export const CloudDissolveOverlay = ({ role }: CloudDissolveOverlayProps) => {
  const roleTint = role.color;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="absolute left-1/2 top-1/2 h-52 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[48%] blur-2xl"
        style={{
          background: `radial-gradient(ellipse at center, ${roleTint}35 0%, rgba(214, 244, 250, 0.28) 42%, transparent 72%)`,
        }}
        initial={{ scale: 0.62, opacity: 0.68 }}
        animate={{ scale: [0.72, 1.1, 1.35], opacity: [0.62, 0.32, 0] }}
        transition={{ duration: 2.8, ease: 'easeOut' }}
      />

      {breathLines.map((line) => (
        <div
          key={`${line.rotate}-${line.x}`}
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(${line.x}px, ${line.y}px) rotate(${line.rotate}deg)`,
          }}
        >
          <motion.div
            className="h-[2px] w-20 origin-left rounded-full bg-sky-200/45"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 1.25], opacity: [0, 0.38, 0] }}
            transition={{ duration: 2.1, delay: 0.36, ease: 'easeOut' }}
          />
        </div>
      ))}

      <motion.div
        className="relative flex h-36 w-36 items-center justify-center shadow-lg"
        style={{
          background: role.gradient,
          borderRadius: '45% 55% 40% 60% / 55% 45% 60% 40%',
        }}
        initial={{ scale: 1, opacity: 1, filter: 'saturate(1)' }}
        animate={{ scale: [1, 1.09, 1.2], opacity: [1, 0.72, 0], filter: ['saturate(1)', 'saturate(0.7)', 'saturate(0.3)'] }}
        transition={{ duration: 1.85, ease: 'easeOut' }}
      >
        <div className="absolute left-5 top-3 h-8 w-12 -rotate-12 rounded-full bg-white/40 blur-[5px] mix-blend-overlay" />
        <motion.div
          className={role.id === 'role_white' ? 'text-2xl font-semibold text-zinc-600/75' : 'text-2xl font-semibold text-white/85'}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: [0.85, 0.7, 0] }}
          transition={{ duration: 1.65, ease: 'easeOut' }}
        >
          ( ◡‿◡ )
        </motion.div>
      </motion.div>

      {cloudPuffs.map((puff, index) => (
        <motion.div
          key={`${puff.x}-${puff.y}`}
          className="absolute left-1/2 top-1/2 rounded-full blur-[1px]"
          style={{
            width: puff.size,
            height: puff.size,
            marginLeft: -puff.size / 2,
            marginTop: -puff.size / 2,
            background: puff.color,
            boxShadow: '0 10px 30px rgba(125, 188, 211, 0.12)',
          }}
          initial={{ x: 0, y: 0, scale: 0.42, opacity: 0 }}
          animate={{
            x: puff.x,
            y: puff.y,
            scale: [0.42, 0.94, 1.08],
            opacity: [0, 0.72, 0],
          }}
          transition={{
            duration: 2.65,
            delay: puff.delay,
            ease: [0.22, 0.72, 0.18, 1],
          }}
        >
          <div
            className="absolute inset-[18%] rounded-full bg-white/45 blur-sm"
            style={{ transform: `translate(${index % 2 === 0 ? '-12%' : '10%'}, -8%)` }}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};
