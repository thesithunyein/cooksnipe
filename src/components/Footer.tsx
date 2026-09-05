import { motion } from 'framer-motion';
import { SynapseXLogo } from './SynapseXLogo';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_080203_fd7f4f85-3a86-4837-8192-85e7bfe68e75.mp4';

export function Footer() {
  return (
    <footer className="bg-black overflow-hidden">
      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Left: Video */}
        <div className="w-full md:w-1/2 h-[300px] md:h-auto overflow-hidden">
          <video className="w-full h-full object-cover" src={VIDEO_URL} autoPlay muted loop playsInline />
        </div>

        {/* Right: Content */}
        <div className="w-full md:w-1/2 flex flex-col justify-between p-10 sm:p-16">
          <div>
            <motion.div
              className="flex items-center gap-2.5 mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <SynapseXLogo className="w-[18px] h-[18px] text-white/70" />
              <span className="text-white/70 text-[15px] font-medium tracking-tight">SynapseX</span>
            </motion.div>

            <motion.p
              className="text-white/40 text-[14px] sm:text-[15px] leading-relaxed max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              The next evolution of human-machine interaction. Built for those who refuse to be limited by biology
              alone.
            </motion.p>
          </div>

          <motion.p
            className="text-white/25 text-[12px] mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            (c) 2026 SynapseX Labs. All rights reserved.
          </motion.p>
        </div>
      </div>
    </footer>
  );
}