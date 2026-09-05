import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrambleText } from './ScrambleText';
import { SquashHamburger } from './SquashHamburger';
import { SynapseXLogo } from './SynapseXLogo';

const spring = { type: 'spring', stiffness: 350, damping: 28 } as const;

interface NavbarProps {
  entranceComplete: boolean;
}

export function Navbar({ entranceComplete }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [downloadHover, setDownloadHover] = useState(false);
  const [aboutHover, setAboutHover] = useState(false);
  const [metricsHover, setMetricsHover] = useState(false);

  const scrollTo = (y: number) => {
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const navLinks = (
    <>
      <button
        className="text-[16px] sm:text-[13px] font-normal text-white/85 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        onMouseEnter={() => setAboutHover(true)}
        onMouseLeave={() => setAboutHover(false)}
        onClick={() => {
          scrollTo(window.innerHeight);
          setMenuOpen(false);
        }}
      >
        <ScrambleText text="About" isHovered={aboutHover} />
      </button>
      <button
        className="text-[16px] sm:text-[13px] font-normal text-white/85 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
        onMouseEnter={() => setMetricsHover(true)}
        onMouseLeave={() => setMetricsHover(false)}
        onClick={() => {
          scrollTo(window.innerHeight * 2);
          setMenuOpen(false);
        }}
      >
        <ScrambleText text="Metrics" isHovered={metricsHover} />
      </button>
    </>
  );

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 h-20 px-4 sm:px-6 md:px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: entranceComplete ? 1 : 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative h-full flex items-center justify-between max-w-[1600px] mx-auto">
        {/* Desktop: logo pill + expanding menu pill */}
        <div className="hidden sm:flex items-center gap-2">
          <motion.button
            className="flex items-center gap-2.5 h-12 px-5 bg-white/15 backdrop-blur-md rounded-[14px] cursor-pointer"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.22)' }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            onClick={() => scrollTo(0)}
          >
            <SynapseXLogo className="w-[18px] h-[18px] text-white" />
            <span className="text-[16px] font-medium tracking-tight text-white">
              <ScrambleText text="SynapseX" isHovered={logoHover} />
            </span>
          </motion.button>

          <motion.div
            className="flex items-center h-12 rounded-[14px] bg-white/15 backdrop-blur-md overflow-hidden"
            animate={{ width: menuOpen ? 290 : 48 }}
            transition={spring}
          >
            <motion.button
              className={`flex items-center justify-center cursor-pointer rounded-[14px] ${
                menuOpen ? 'w-9 h-9 rounded-[11px] bg-white/10 hover:bg-white/20 ml-1.5' : 'w-12 h-12'
              }`}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <SquashHamburger isOpen={menuOpen} />
            </motion.button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="flex items-center gap-7 pl-3 pr-5 whitespace-nowrap"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                >
                  {navLinks}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Mobile: logo pill (collapses when open) + expanding menu capsule */}
        <div className="flex sm:hidden items-center gap-2 flex-1 min-w-0">
          <motion.div
            className="flex items-center h-9 pl-3 pr-4 rounded-[10px] bg-white/15 backdrop-blur-md overflow-hidden whitespace-nowrap"
            animate={{ width: menuOpen ? 0 : 'auto', opacity: menuOpen ? 0 : 1 }}
            transition={spring}
          >
            <SynapseXLogo className="w-[15px] h-[15px] text-white mr-2" />
            <span className="text-[13px] font-medium tracking-tight text-white">SynapseX</span>
          </motion.div>

          <motion.div
            className="flex items-center h-9 rounded-[10px] bg-white/15 backdrop-blur-md overflow-hidden"
            animate={{ flexGrow: menuOpen ? 1 : 0 }}
            transition={spring}
          >
            <motion.button
              className={`flex items-center justify-center cursor-pointer rounded-[10px] ${
                menuOpen ? 'w-7 h-7 rounded-[8px] bg-white/10 ml-1' : 'w-9 h-9'
              }`}
              whileTap={{ scale: 0.95 }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <SquashHamburger isOpen={menuOpen} />
            </motion.button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  className="flex items-center gap-5 pl-2 pr-4"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 15 }}
                  transition={{ duration: 0.25 }}
                >
                  {navLinks}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Right: Download button */}
        <motion.a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="flex items-center gap-2 h-9 px-3.5 sm:h-12 sm:px-6 bg-white hover:bg-[#e2e2e6] rounded-full text-black text-[13px] sm:text-[16px] font-medium whitespace-nowrap shrink-0"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onMouseEnter={() => setDownloadHover(true)}
          onMouseLeave={() => setDownloadHover(false)}
        >
          <i className="bi bi-apple text-[14px] sm:text-[16px]" />
          <ScrambleText text="Download" isHovered={downloadHover} />
        </motion.a>
      </div>
    </motion.nav>
  );
}