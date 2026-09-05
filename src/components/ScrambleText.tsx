import { useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

interface ScrambleTextProps {
  text: string;
  isHovered: boolean;
  className?: string;
}

export function ScrambleText({ text, isHovered, className }: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const intervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isHovered) {
      setDisplay(text);
      return;
    }

    // Scramble all chars first, then reveal left-to-right at 4 frames/char.
    let ticks = 0;
    const scrambleTicks = 4;
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        ticks++;
        let out = '';
        if (ticks <= scrambleTicks) {
          for (const ch of text) out += ch === ' ' ? ' ' : CHARS[Math.floor(Math.random() * CHARS.length)];
        } else {
          const revealed = Math.floor((ticks - scrambleTicks) * 0.25);
          for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === ' ') out += ' ';
            else if (i < revealed) out += ch;
            else out += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
        setDisplay(out);
        if (ticks > scrambleTicks && (ticks - scrambleTicks) * 0.25 >= text.length && intervalRef.current !== undefined) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }, 25);
    }, 25);

    return () => {
      if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
      timeoutRef.current = undefined;
      intervalRef.current = undefined;
    };
  }, [text, isHovered]);

  return <span className={className}>{display}</span>;
}