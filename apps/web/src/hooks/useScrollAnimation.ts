"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollAnimationOptions {
  trigger?: string | Element;
  start?: string;
  end?: string;
  scrub?: boolean | number;
  markers?: boolean;
  toggleActions?: string;
  pin?: boolean;
  anticipatePin?: number;
}

export function useScrollAnimation<T extends HTMLElement>(
  animation: (element: T, gsapInstance: typeof gsap) => gsap.core.Timeline | gsap.core.Tween | void,
  options: ScrollAnimationOptions = {}
) {
  const elementRef = useRef<T>(null);
  const animationRef = useRef<gsap.core.Timeline | gsap.core.Tween | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const ctx = gsap.context(() => {
      const result = animation(element, gsap);
      if (result) {
        animationRef.current = result;
      }
    }, element);

    return () => {
      ctx.revert();
    };
  }, [animation, options]);

  return elementRef;
}

export function useParallax(speed: number = 0.5) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof window === "undefined") return;

    const ctx = gsap.context(() => {
      gsap.to(element, {
        y: () => window.innerHeight * speed,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    });

    return () => ctx.revert();
  }, [speed]);

  return elementRef;
}

export function useRevealAnimation<T extends HTMLElement>(
  delay: number = 0,
  direction: "up" | "down" | "left" | "right" = "up"
) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof window === "undefined") return;

    const distance = 40;
    const translateMap = {
      up: { y: distance, x: 0 },
      down: { y: -distance, x: 0 },
      left: { y: 0, x: distance },
      right: { y: 0, x: -distance },
    };

    const initial = translateMap[direction];

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        {
          opacity: 0,
          y: initial.y,
          x: initial.x,
        },
        {
          opacity: 1,
          y: 0,
          x: 0,
          duration: 0.8,
          delay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, [delay, direction]);

  return elementRef;
}

export function useStaggerReveal<T extends HTMLElement>(
  childSelector: string,
  staggerDelay: number = 0.1
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;

    const children = container.querySelectorAll(childSelector);
    if (!children.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        children,
        {
          opacity: 0,
          y: 30,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: staggerDelay,
          ease: "power3.out",
          scrollTrigger: {
            trigger: container,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, [childSelector, staggerDelay]);

  return containerRef;
}

export function useCountUp(
  endValue: number,
  duration: number = 2,
  suffix: string = ""
) {
  const elementRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof window === "undefined" || hasAnimated.current) return;

    const ctx = gsap.context(() => {
      const obj = { value: 0 };
      
      ScrollTrigger.create({
        trigger: element,
        start: "top 85%",
        onEnter: () => {
          if (hasAnimated.current) return;
          hasAnimated.current = true;
          
          gsap.to(obj, {
            value: endValue,
            duration,
            ease: "power2.out",
            onUpdate: () => {
              element.textContent = Math.round(obj.value).toLocaleString() + suffix;
            },
          });
        },
      });
    });

    return () => ctx.revert();
  }, [endValue, duration, suffix]);

  return elementRef;
}

export function useTextReveal<T extends HTMLElement>() {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof window === "undefined") return;

    const text = element.textContent || "";
    element.innerHTML = text
      .split("")
      .map((char) => `<span class="inline-block">${char === " " ? "&nbsp;" : char}</span>`)
      .join("");

    const chars = element.querySelectorAll("span");

    const ctx = gsap.context(() => {
      gsap.fromTo(
        chars,
        {
          opacity: 0,
          y: 20,
          rotateX: -90,
        },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.5,
          stagger: 0.02,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: element,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return elementRef;
}

export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]');
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const element = document.querySelector(href);
      if (!element) return;

      e.preventDefault();

      gsap.to(window, {
        duration: 1,
        scrollTo: { y: element, offsetY: 80 },
        ease: "power3.inOut",
      });
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, []);
}
