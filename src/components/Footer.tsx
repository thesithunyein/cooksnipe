import { motion } from 'framer-motion';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_080203_fd7f4f85-3a86-4837-8192-85e7bfe68e75.mp4';

export function Footer() {
  return (
    <footer className="bg-black overflow-hidden">
      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Left: Video */}
        <div className="w-full md:w-1/2 h-[300px] md:h-auto overflow-hidden">
          <video
            className="w-full h-full object-cover"
            src={VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
          />
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
              <img src="/logo.png" alt="CookSnipe" className="w-8 h-8 rounded-full object-cover" />
              <span className="text-white/70 text-[15px] font-medium tracking-tight">CookSnipe</span>
            </motion.div>

            <motion.p
              className="text-white/40 text-[14px] sm:text-[15px] leading-relaxed max-w-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              Real-time MomoSwap launch sniper for Cookie Chain. Detect, analyze, and snipe new token launches before
              anyone else. Built for degens who move fast.
            </motion.p>

            <motion.div
              className="flex gap-4 mt-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <a
                href="https://github.com/thesithunyein/cooksnipe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white text-[13px] tracking-wide transition-colors"
              >
                GitHub
              </a>
              <a
                href="https://superteam.fun/earn/listing/create-an-app-on-cookie-chain-app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white text-[13px] tracking-wide transition-colors"
              >
                Bounty
              </a>
              <a
                href="https://cookiechain.wtf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/50 hover:text-white text-[13px] tracking-wide transition-colors"
              >
                Cookie Chain
              </a>
            </motion.div>
          </div>

          <motion.p
            className="text-white/25 text-[12px] mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            &copy; 2026 CookSnipe. Built by Sithu Nyein.
          </motion.p>
        </div>
      </div>
    </footer>
  );
}