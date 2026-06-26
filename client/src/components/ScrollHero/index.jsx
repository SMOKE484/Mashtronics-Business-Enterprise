import { useRef, useState, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import './ScrollHero.css';

gsap.registerPlugin(ScrollTrigger);

const isMobile = () => window.innerWidth < 768;

const DESKTOP_COUNT = 150;
const MOBILE_COUNT = 75;
const DESKTOP_REVEAL = 8;
const MOBILE_REVEAL = 5;

function pad(n) {
  return String(n).padStart(4, '0');
}

export default function ScrollHero() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const text1Ref = useRef(null);
  const text2Ref = useRef(null);
  const text3Ref = useRef(null);
  const progressBarRef = useRef(null);

  const frames = useRef([]);
  const lastIndex = useRef(-1);
  const loadedCount = useRef(0);
  const stReady = useRef(false);

  const [revealed, setRevealed] = useState(false);
  const [mobile, setMobile] = useState(isMobile());

  const FRAME_COUNT = mobile ? MOBILE_COUNT : DESKTOP_COUNT;
  const REVEAL_THRESHOLD = mobile ? MOBILE_REVEAL : DESKTOP_REVEAL;
  const BASE_PATH = mobile ? '/frames-mobile/frame_' : '/frames/frame_';

  // ── draw a frame onto the canvas (cover-fit) ──────────────────────────
  const render = (index) => {
    if (index === lastIndex.current) return;
    lastIndex.current = index;
    const img = frames.current[index];
    if (!img?.complete || !img.naturalWidth) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };

  // ── resize canvas to fill viewport ────────────────────────────────────
  useEffect(() => {
    if (prefersReduced) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      render(lastIndex.current < 0 ? 0 : lastIndex.current);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    return () => window.removeEventListener('resize', resize);
  }, [prefersReduced]);

  // ── preload frames (lazy — only starts when section is near viewport) ──
  useEffect(() => {
    if (prefersReduced) return;

    const startLoading = () => {
      frames.current = [];
      loadedCount.current = 0;
      stReady.current = false;

      for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = new Image();
        img.src = `${BASE_PATH}${pad(i)}.jpg`;
        img.onload = () => {
          loadedCount.current += 1;

          if (progressBarRef.current) {
            const pct = (loadedCount.current / FRAME_COUNT) * 100;
            progressBarRef.current.style.width = `${pct}%`;
          }

          if (loadedCount.current === REVEAL_THRESHOLD) {
            requestAnimationFrame(() => render(0));
            setRevealed(true);
          }
        };
        frames.current.push(img);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        startLoading();
      },
      { rootMargin: '500px' }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [mobile, FRAME_COUNT, BASE_PATH, REVEAL_THRESHOLD, prefersReduced]);

  // ── GSAP ScrollTrigger wiring ─────────────────────────────────────────
  useGSAP(() => {
    if (prefersReduced || !revealed) return;

    // Ensure all texts start invisible
    gsap.set([text1Ref.current, text2Ref.current, text3Ref.current], { opacity: 0, y: 30 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=300%',
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          render(Math.round(self.progress * (FRAME_COUNT - 1)));
        },
      },
    });

    // text1: visible ~0-30% of scroll (0.5→2.5s), clear gap before text2
    tl.to(text1Ref.current, { opacity: 1, y: 0, duration: 1 }, 0.5);
    tl.to(text1Ref.current, { opacity: 0, y: -20, duration: 0.5 }, 2.5);

    // text2: visible ~38-65% of scroll (3.5→5.5s), clear gap before text3
    tl.to(text2Ref.current, { opacity: 1, y: 0, duration: 1 }, 3.5);
    tl.to(text2Ref.current, { opacity: 0, y: -20, duration: 0.5 }, 5.5);

    // text3: visible from ~72% to end (6.5s+), stays visible
    tl.to(text3Ref.current, { opacity: 1, y: 0, duration: 1 }, 6.5);

  }, { scope: sectionRef, dependencies: [revealed, FRAME_COUNT, prefersReduced] });

  // ── reduced-motion fallback ────────────────────────────────────────────
  if (prefersReduced) {
    return (
      <div className="scroll-hero scroll-hero--static">
        <img src="/frames/poster.jpg" alt="Security professional at work" className="scroll-hero__poster" />
        <div className="scroll-hero__overlay" />
        <div className="scroll-hero__texts scroll-hero__texts--static">
          <p className="hero-text hero-text--1">Protect what matters.</p>
          <p className="hero-text hero-text--2">CCTV Installation Packages from R12,000 Including Materials.</p>
          <p className="hero-text hero-text--3">Trusted since 2015.</p>
        </div>
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="scroll-hero">
      <canvas ref={canvasRef} className={`scroll-hero__canvas${revealed ? ' is-visible' : ''}`} />
      <div className="scroll-hero__overlay" />

      {/* Loading bar */}
      {!revealed && (
        <div className="scroll-hero__loader">
          <div ref={progressBarRef} className="scroll-hero__progress" />
        </div>
      )}

      {/* Overlay texts */}
      <div className="scroll-hero__texts">
        <p ref={text1Ref} className="hero-text hero-text--1">Protect what matters.</p>
        <p ref={text2Ref} className="hero-text hero-text--2">CCTV Installation Packages from R12,000 Including Materials.</p>
        <p ref={text3Ref} className="hero-text hero-text--3">Trusted since 2015.</p>
      </div>

      {/* Scroll cue — visible before pinned scroll starts */}
      {revealed && (
        <div className="scroll-hero__cue">
          <span>Scroll</span>
          <i className="fas fa-chevron-down" />
        </div>
      )}
    </section>
  );
}
