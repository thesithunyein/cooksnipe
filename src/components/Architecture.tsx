import { motion } from 'framer-motion';

const layers = [
  { number: 'Layer 1', name: 'Capture' },
  { number: 'Layer 2', name: 'Process' },
  { number: 'Layer 3', name: 'Interface' },
];

export function Architecture() {
  return (
    <section className="relative min-h-screen bg-black overflow-hidden flex items-center justify-center">
      {/* Content */}
      <div className="w-full max-w-3xl mx-auto px-6 sm:px-8 py-32">
        {/* Heading block — centered */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.0 }}
        >
          <p className="text-white/40 text-[13px] sm:text-[14px] tracking-[0.2em] uppercase mb-8">Architecture</p>
          <h2 className="text-white font-light text-[clamp(28px,6vw,56px)] leading-[1.15] tracking-[-0.02em] mb-10">
            Three layers. Zero friction.
          </h2>
          <p className="text-white/45 text-[15px] sm:text-[17px] leading-relaxed max-w-xl mx-auto">
            Sensor layer captures raw bioelectric signals. Processing layer isolates intent. Interface layer delivers
            structured output to any connected system.
          </p>
        </motion.div>

        {/* Layer cards — centered */}
        <motion.div
          className="mt-20 flex flex-col items-center gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 1.2, delay: 0.4 }}
        >
          {layers.map((layer, i) => (
            <motion.div
              key={layer.number}
              className="max-w-md w-full h-[72px] border border-white/10 rounded-lg flex items-center justify-between px-6 hover:border-white/20 hover:bg-white/[0.02] transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.5 + i * 0.1 }}
            >
              <span className="text-white/30 text-[12px] tracking-[0.15em] uppercase">{layer.number}</span>
              <span className="text-white text-[16px] sm:text-[18px] font-light">{layer.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}