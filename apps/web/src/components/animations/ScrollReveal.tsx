/**
 * ScrollReveal - Content is ALWAYS visible by default.
 * Animation wrappers are pure pass-through divs to ensure
 * content displays even if React hydration fails.
 */

import { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  once?: boolean;
  scale?: number;
}

export function ScrollReveal({
  children,
  className = "",
}: ScrollRevealProps) {
  return <div className={className}>{children}</div>;
}

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
}

export function StaggerContainer({
  children,
  className = "",
}: StaggerContainerProps) {
  return <div className={className}>{children}</div>;
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
}

export function StaggerItem({
  children,
  className = "",
}: StaggerItemProps) {
  return <div className={className}>{children}</div>;
}

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  speed?: number;
  direction?: "up" | "down";
}

export function Parallax({
  children,
  className = "",
}: ParallaxProps) {
  return <div className={className}>{children}</div>;
}
