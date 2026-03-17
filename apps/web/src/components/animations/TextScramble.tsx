"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";

interface TextScrambleProps {
  text: string;
  className?: string;
  scrambleOnView?: boolean;
  delay?: number;
  duration?: number;
}

const chars = "!<>-_\\/[]{}—=+*^?#________";

export function TextScramble({
  text,
  className = "",
  scrambleOnView = true,
  delay = 0,
  duration = 1.5,
}: TextScrambleProps) {
  const [displayText, setDisplayText] = useState(text);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFallback(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!scrambleOnView || !(isInView || fallback) || hasAnimated) return;

    const timeout = setTimeout(() => {
      let iteration = 0;
      const totalIterations = text.length * 3;
      const intervalDuration = (duration * 1000) / totalIterations;

      const interval = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((char, index) => {
              if (char === " ") return " ";
              if (index < iteration / 3) {
                return text[index];
              }
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join("")
        );

        iteration += 1;

        if (iteration >= totalIterations) {
          clearInterval(interval);
          setDisplayText(text);
          setHasAnimated(true);
        }
      }, intervalDuration);

      return () => clearInterval(interval);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [isInView, fallback, text, scrambleOnView, delay, duration, hasAnimated]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={false}
      animate={(isInView || fallback) ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.3, delay: delay * 0.5 }}
    >
      {displayText}
    </motion.span>
  );
}
