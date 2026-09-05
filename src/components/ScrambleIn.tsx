import { useEffect, useRef, useState } from 'react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+~|}{[]:;?><';

interface ScrambleInProps {
  text: string;
  /** ms before the scramble starts (after `triggered` becomes true) */
  delay: number;
  triggered: boolean;
}

export function ScrambleIn({ text, delay, triggered }: ScrambleInProps) {
  const [display, setDisplay] = useState('\u00A0');
  const intervalRef = useRef<number | undefined>(undefined);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!triggered) {
      setDisplay('\u00A0');
      return;
    }

    let cursor = 0;
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        cursor += 0.5; // half a char per frame
        const revealed = Math.floor(cursor);
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (ch === ' ') {
            out += ' ';
          } else if (i < revealed) {
            out += ch;
          } else if (i < revealed + 3) {
            out += CHARS[Math.floor(Math.random() * CHARS.length)];
          } else {
            out += ' ';
          }
        }
        setDisplay(out);
        if (revealed >= text.length && intervalRef.current !== undefined) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }, 25);
    }, delay);

    return () => {
      if (timeoutRef.current !== undefined) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
      timeoutRef.current = undefined;
      intervalRef.current = undefined;
    };
  }, [text, delay, triggered]);

  return <span>{display}</span>;
}