import { motion } from 'framer-motion';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_095750_32a52ce0-2005-45c9-9093-41f03fde9530.mp4';

const features = [
  {
    title: 'Launch Detection',
    description: 'Real-time detection of new MomoSwap token launches the instant they appear.',
  },
  {
    title: 'Bonding Curve',
    description: 'Live bonding curve visualization for every launch, from mint to graduation.',
  },
  {
    title: 'One-Click Snipe',
    description: 'Pre-signed transactions with configurable slippage for instant execution.',
  },
  {
    title: 'Safety Badges',
    description: 'Automated checks for mint authority and liquidity locks before you buy.',
  },
];

export function Technology() {
  return (
    <section className="relative w-full min-h-screen overflow-hidden">
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen px-8 sm:px-12 md:px-16 lg:px-24 py-32 sm:py-40">
        {/* Top area */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-auto">
          <motion.h2
            className="text-white font-light text-[clamp(36px,8vw,72px)] leading-[0.95] tracking-[-0.03em]"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0 }}
          >
            Launch /<br />Detection
          </motion.h2>

          <motion.p
            className="text-white/50 text-[13px] sm:text-[15px] leading-relaxed max-w-xs md:text-right md:pt-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.0, delay: 0.2 }}
          >
            Detect new MomoSwap launches the instant they appear. Sub-300ms detection. Be first, be fast.
          </motion.p>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.0, delay: 0.3 }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="p-4 rounded-lg hover:bg-white/5 transition-colors duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.3 + i * 0.1 }}
            >
              <h3 className="text-white text-[14px] sm:text-[16px] font-normal mb-2">{feature.title}</h3>
              <p className="text-white/40 text-[12px] sm:text-[14px] leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}