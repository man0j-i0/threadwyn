"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Scroll-entry reveal. Uses `whileInView` (IntersectionObserver under the
 * hood) rather than a scroll listener, animates only transform + opacity, and
 * collapses to a plain opacity fade when the user prefers reduced motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  once = true,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once, margin: "-64px" }}
      transition={{ duration: reduced ? 0.2 : 0.7, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/** Parent for staggered lists — pair with <StaggerItem>. */
export function Stagger({
  children,
  className,
  delayChildren = 0,
  stagger = 0.05,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delayChildren?: number;
  stagger?: number;
  once?: boolean;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: {},
    show: {
      transition: {
        delayChildren,
        staggerChildren: reduced ? 0 : stagger,
      },
    },
  };
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-48px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 16,
}: {
  children: React.ReactNode;
  className?: string;
  y?: number;
}) {
  const reduced = useReducedMotion();
  const variants: Variants = {
    hidden: reduced ? { opacity: 0 } : { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.2 : 0.6, ease: EASE },
    },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

/**
 * Headline that resolves word by word from behind a mask. Used once per page,
 * on the single most important line — any more and it stops being a moment.
 */
export function MaskedHeading({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  if (reduced) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={cn("inline", className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden py-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "108%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.85, delay: delay + i * 0.055, ease: EASE }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
