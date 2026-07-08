import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTourStore } from '../stores/tourStore';

// Guided-tour overlay. Plays whatever deck is in the tour store: the cross-page
// essentials walkthrough, or a short per-page manual. A step optionally navigates
// to a page, highlights a target (by CSS selector), and shows an explanation.
const PAD = 6; // spotlight padding around the target

export default function ProductTour() {
  const { active, index, steps, setIndex, finish } = useTourStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState(null);
  const popRef = useRef(null);
  const [popH, setPopH] = useState(0);

  const STEPS = steps || [];
  const step = active ? STEPS[index] : null;
  const isLast = index >= STEPS.length - 1;

  // Navigate to the step's page (if we're not already there).
  useEffect(() => {
    if (!step?.path) return;
    if (location.pathname !== step.path) navigate(step.path);
  }, [active, index]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure the target — retry across a few frames so it works right after a
  // route change (the element may not be mounted on the first frame).
  useLayoutEffect(() => {
    if (!active || !step) return;
    let raf, tries = 0;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const b = el.getBoundingClientRect();
        // Off-screen (e.g. collapsed mobile sidebar) → no spotlight, centered popover.
        const onScreen = b.width > 0 && b.height > 0 && b.right > 0 && b.left < window.innerWidth && b.bottom > 0 && b.top < window.innerHeight;
        setRect(onScreen ? b : null);
      } else if (tries++ < 40) {
        raf = requestAnimationFrame(measure);
      } else {
        setRect(null); // target missing — popover falls back to center
      }
    };
    measure();
    const onReflow = () => {
      const el = document.querySelector(step.target);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onReflow); window.removeEventListener('scroll', onReflow, true); };
  }, [active, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => { if (isLast) finish(); else setIndex(index + 1); }, [isLast, index, setIndex, finish]);
  const prev = useCallback(() => setIndex(Math.max(0, index - 1)), [index, setIndex]);

  // Keyboard: → / Enter advance, ← back, Esc skip.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, prev, finish]);

  // Keep the measured popover height in sync so we can clamp it on screen.
  useLayoutEffect(() => {
    if (!active || !step) return;
    const h = popRef.current?.offsetHeight;
    if (h && h !== popH) setPopH(h);
  });

  if (!active || !step) return null;

  const POP_W = 320;
  const MARGIN = 12;
  // Clamp a candidate top so the whole popover (incl. Skip/Done) stays on screen.
  const clampTop = (t) => {
    const h = popH || 220; // fallback estimate before first measure
    const maxTop = Math.max(MARGIN, window.innerHeight - h - MARGIN);
    return Math.min(Math.max(MARGIN, t), maxTop);
  };
  let box = null, popStyle;
  if (rect) {
    box = { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 };
    const roomRight = box.left + box.width + 16 + POP_W < window.innerWidth;
    const roomBelow = box.top + box.height + 12 + (popH || 220) + MARGIN < window.innerHeight;
    if (roomRight) {
      popStyle = { top: clampTop(box.top), left: box.left + box.width + 16 };
    } else if (roomBelow) {
      popStyle = { top: clampTop(box.top + box.height + 12), left: Math.min(Math.max(MARGIN, box.left), window.innerWidth - POP_W - MARGIN) };
    } else {
      // Not enough room below — place above the target, clamped on screen.
      popStyle = { top: clampTop(box.top - (popH || 220) - 12), left: Math.min(Math.max(MARGIN, box.left), window.innerWidth - POP_W - MARGIN) };
    }
  } else {
    // No on-screen target — center the popover over a plain dim.
    popStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }} aria-live="polite">
      {box ? (
        /* Dim everything except the spotlight, via a huge box-shadow on the cutout. */
        <div
          style={{
            position: 'fixed',
            top: box.top, left: box.left, width: box.width, height: box.height,
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(2,6,23,0.78)',
            outline: '2px solid var(--accent, #4493f8)',
            outlineOffset: '2px',
            transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)' }} />
      )}
      {/* Click-catcher so a stray click anywhere keeps focus on the tour. */}
      <div style={{ position: 'fixed', inset: 0, cursor: 'default' }} onClick={(e) => { e.stopPropagation(); }} />

      {/* Popover */}
      <div
        ref={popRef}
        style={{
          position: 'fixed', ...popStyle, width: POP_W, maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
          background: 'var(--bg-raised, #0d1117)', border: '1px solid var(--line, #2a313c)',
          borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: '16px',
          color: 'var(--ink, #f0f6fc)', zIndex: 9001,
          transition: 'top .25s ease, left .25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '10.5px', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--ink-3, #6e7681)' }}>
            Step {index + 1} of {STEPS.length}
          </span>
          <button onClick={finish} style={{ background: 'none', border: 'none', color: 'var(--ink-3, #6e7681)', fontSize: '12px', cursor: 'pointer' }}>Skip</button>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600 }}>{step.title}</h3>
        <p style={{ margin: '0 0 14px', fontSize: '13.5px', lineHeight: 1.55, color: 'var(--ink-2, #9198a1)' }}>{step.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: '6px', height: '6px', borderRadius: '999px', background: i === index ? 'var(--accent, #4493f8)' : 'var(--line, #2a313c)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {index > 0 && (
              <button onClick={prev} style={{ padding: '7px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: 'transparent', border: '1px solid var(--line, #2a313c)', color: 'var(--ink-2, #9198a1)' }}>Back</button>
            )}
            <button onClick={next} style={{ padding: '7px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', background: 'var(--accent, #1f6feb)', border: '1px solid var(--accent, #1f6feb)', color: '#fff' }}>
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
