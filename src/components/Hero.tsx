import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ScrambleIn } from './ScrambleIn';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_083515_290e5a10-0b95-41af-a5e2-32b6389baa4d.mp4';

interface HeroProps {
  entranceComplete: boolean;
}

export function Hero({ entranceComplete }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastMouseX = useRef(0);
  const isSeeking = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!videoRef.current || isSeeking.current) return;

    const delta = (e.clientX - lastMouseX.current) * 0.8;
    lastMouseX.current = e.clientX;

    const video = videoRef.current;
    const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta * 0.001));

    if (Math.abs(video.currentTime - newTime) > 0.01) {
      isSeeking.current = true;
      video.currentTime = newTime;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeked = () => {
      isSeeking.current = false;
    };

    video.addEventListener('seeked', onSeeked);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      video.removeEventListener('seeked', onSeeked);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return (
    <section className="relative w-full h-screen h-[100dvh] overflow-hidden bg-black">
      {/* Background video — paused, mouse-scrubbed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        muted
        playsInline
        preload="auto"
        loop={false}
      />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.05,
        }}
      />

      {/* Watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[3]">
        <span
          className="select-none uppercase"
          style={{
            fontFamily: '"Anton SC", "Arial Narrow", sans-serif',
            fontSize: 'clamp(120px, 30vw, 521px)',
            letterSpacing: '-4px',
            opacity: 0.1,
            background: 'radial-gradient(circle, rgba(142,127,148,0) 0%, #8E7F94 70%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            transform: 'translateY(50px)',
          }}
        >
          TRANSCENDENCE
        </span>
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 flex flex-col h-full px-4 sm:px-6 md:px-8 pt-20 sm:pt-24 pb-8 sm:pb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: entranceComplete ? 1 : 0 }}
        transition={{ duration: 1 }}
      >
        <div className="flex-1" />

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            <h1 className="text-white font-light leading-[0.95] tracking-[-0.03em] text-[clamp(40px,10vw,100px)]">
              <ScrambleIn text="Brain" delay={200} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="And Body" delay={500} triggered={entranceComplete} />
            </h1>

            <motion.p
              className="max-w-sm text-[13px] sm:text-[15px] text-white/60 leading-relaxed"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: entranceComplete ? 1 : 0, y: entranceComplete ? 0 : 25 }}
              transition={{ duration: 0.9, delay: 0.2, ease: [0.215, 0.61, 0.355, 1] }}
            >
              Built at the intersection of neuroscience and artificial intelligence. SynapseX continuously maps neural
              pathways, cognitive load, and physiological states into a single adaptive intelligence layer.
            </motion.p>
          </div>

          {/* Right column */}
          <div className="text-left md:text-right">
            <h1 className="text-white font-light leading-[0.95] tracking-[-0.03em] text-[clamp(40px,10vw,100px)]">
              <ScrambleIn text="One" delay={700} triggered={entranceComplete} />
              <br />
              <ScrambleIn text="Network" delay={1000} triggered={entranceComplete} />
            </h1>
          </div>
        </div>
      </motion.div>
    </section>
  );
}