import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform, useMotionTemplate } from 'framer-motion';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_092455_089c54f8-3b03-4966-9df1-e9746063d0ef.mp4';

export function CinematicText() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 15,
    damping: 32,
    mass: 1.8,
  });

  const yValue = useTransform(smoothProgress, [0, 1], [60, -120]);
  const rotateX = useTransform(smoothProgress, [0, 1], [24, 0]);
  const opacity = useTransform(smoothProgress, [0.3, 0.5], [0, 1]);

  const transform3d = useMotionTemplate`rotateX(${rotateX}deg) translateY(${yValue}px) translateZ(15px)`;

  return (
    <section ref={containerRef} className="relative w-full h-screen h-[100dvh] overflow-hidden">
      {/* Background video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Top gradient overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-[180px] z-10"
        style={{
          background: 'linear-gradient(to bottom, #010103, transparent)',
        }}
      />

      {/* Content */}
      <div className="relative z-20 flex items-center justify-center h-full">
        <div className="max-w-5xl" style={{ perspective: '400px' }}>
          <motion.p
            className="font-sans font-normal text-[22px] sm:text-[30px] md:text-[36px] lg:text-[42px] text-white leading-[1.35] tracking-[-0.02em] select-none px-6 sm:px-12 text-center"
            style={{
              transform: transform3d,
              opacity,
              transformOrigin: 'center center',
            }}
          >
            A neural-AI interface built on the architecture of the human nervous system. SynapseX translates synaptic
            activity into computational intelligence. Every signal becomes measurable, structured, and visible. It
            continuously reconstructs internal state as a dynamic neural map. Biological noise is filtered into
            actionable cognitive patterns.
          </motion.p>
        </div>
      </div>
    </section>
  );
}