import { motion } from 'framer-motion';

interface SquashHamburgerProps {
  isOpen: boolean;
}

export function SquashHamburger({ isOpen }: SquashHamburgerProps) {
  return (
    <div className="relative w-[15px] h-[10px] md:w-[18px] md:h-[12px]">
      <motion.span
        className="absolute left-0 top-0 w-full h-[1.2px] md:h-[1.5px] bg-white origin-center"
        animate={{ rotate: isOpen ? 45 : 0, y: isOpen ? 4.25 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.span
        className="absolute left-0 top-1/2 w-full h-[1.2px] md:h-[1.5px] bg-white -mt-[0.6px] md:-mt-[0.75px]"
        animate={{ opacity: isOpen ? 0 : 1, scaleX: isOpen ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
      <motion.span
        className="absolute left-0 bottom-0 w-full h-[1.2px] md:h-[1.5px] bg-white origin-center"
        animate={{ rotate: isOpen ? -45 : 0, y: isOpen ? -4.25 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      />
    </div>
  );
}