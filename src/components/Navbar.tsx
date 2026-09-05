import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrambleText } from './ScrambleText';
import { SquashHamburger } from './SquashHamburger';

const spring = { type: 'spring', stiffness: 350, damping: 28 } as const;

interface NavbarProps {
  entranceComplete: boolean;
}

export function Navbar({ entranceComplete }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const [launchHover, setLaunchHover] = useState(false);
  const [aboutHover, setAboutHover] = useState(false);
  const [metricsHover, setMetricsHover] = useState(false);

  const scrollTo = (y: number) => {
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  const navLinks = (
    <>
      <button
        className="text-[16px] text-white/60 hover:text-white transition-colors cursor-pointer"
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
        className="text-[16px] text-white/60 hover:text-white transition-colors cursor-pointer"
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
        {/* Left: logo pill + expanding menu pill (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <motion.button
            className="flex items-center gap-2.5 h-12 px-5 bg-white/15 backdrop-blur-md rounded-[14px] cursor-pointer"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.22)' }}
            whileTap={{ scale: 0.98 }}
            onMouseEnter={() => setLogoHover(true)}
            onMouseLeave={() => setLogoHover(false)}
            onClick={() => scrollTo(0)}
          >
            <img src="/logo.png" alt="CookSnipe" className="w-[18px] h-[18px] rounded-full object-cover" />
            <span className="text-[16px] font-medium tracking-tight text-white">
              <ScrambleText text="CookSnipe" isHovered={logoHover} />
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

        {/* Left (mobile): logo pill */}
        <motion.button
          className="md:hidden flex items-center gap-2.5 h-11 px-4 bg-white/15 backdrop-blur-md rounded-[14px] cursor-pointer"
          whileTap={{ scale: 0.97 }}
          onClick={() => scrollTo(0)}
        >
          <img src="/logo.png" alt="CookSnipe" className="w-[18px] h-[18px] rounded-full object-cover" />
          <span className="text-[15px] font-medium tracking-tight text-white">CookSnipe</span>
        </motion.button>

        {/* Right: Launch App + hamburger */}
        <div className="flex items-center gap-2.5">
          <motion.a
            href="https://github.com/thesithunyein/cooksnipe"
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-4 bg-white hover:bg-white/90 rounded-full flex items-center gap-1.5 text-black text-[12px] font-semibold whitespace-nowrap"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={() => setLaunchHover(true)}
            onMouseLeave={() => setLaunchHover(false)}
          >
            <ScrambleText text="Launch App" isHovered={launchHover} />
          </motion.a>

          <motion.button
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/15 backdrop-blur-md cursor-pointer"
            whileTap={{ scale: 0.95 }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <SquashHamburger isOpen={menuOpen} />
          </motion.button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="md:hidden absolute top-20 left-4 right-4 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}