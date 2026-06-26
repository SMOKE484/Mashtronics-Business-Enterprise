import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import ScrollHero from '../components/ScrollHero';
import heroClip from '../assets/images/heroClip.mp4';
import svcCctv from '../assets/images/services/cctv.png';
import svcAccess from '../assets/images/services/access-control.png';
import svcFence from '../assets/images/services/electric-fence.png';
import svcCabling from '../assets/images/services/network-cabling.png';
import svcFibre from '../assets/images/services/fibre.png';
import svcFire from '../assets/images/services/fire-detection.png';
import svcAlarms from '../assets/images/services/alarms.png';
import svcControl from '../assets/images/services/control-rooms.png';
import svcIntercom from '../assets/images/services/intercom.png';
import aboutUsImg from '../assets/images/aboutUs.png';
import whyImg from '../assets/images/newWhyUs.png';
import nttLogo from '../assets/images/NTTDATA.jpg';
import transnetLogo from '../assets/images/transnet.jpg';
import samacorLogo from '../assets/images/Samacor.jpg';
import randwaterLogo from '../assets/images/RandWater.jpg';
import stlmLogo from '../assets/images/STLM.jpg';
import './Home.css';

gsap.registerPlugin(ScrollTrigger);

const SERVICES = [
  { name: 'CCTV Installation', desc: 'HD cameras with remote viewing on your phone via Hik-Connect and DMSS.', img: svcCctv },
  { name: 'Access Control', desc: 'Biometric and card systems for offices, gates and restricted areas.', img: svcAccess },
  { name: 'Electric Fencing', desc: 'Perimeter security installed to SABS standards.', img: svcFence },
  { name: 'Network Cabling', desc: 'Structured cabling and patching for a solid IT setup.', img: svcCabling },
  { name: 'Fibre Installation', desc: 'High-speed fibre for campuses and multi-building sites.', img: svcFibre },
  { name: 'Fire Detection', desc: 'Early warning systems that protect people and property.', img: svcFire },
  { name: 'Intrusion Alarms', desc: 'Alarm systems that link up with your armed response.', img: svcAlarms },
  { name: 'Control Rooms', desc: 'Monitoring rooms built to run 24/7.', img: svcControl },
  { name: 'Intercom Systems', desc: 'Audio and video intercoms for complexes and business parks.', img: svcIntercom },
];

const CLIENTS = [
  { src: nttLogo, alt: 'NTT Data' },
  { src: transnetLogo, alt: 'Transnet' },
  { src: samacorLogo, alt: 'Samacor' },
  { src: randwaterLogo, alt: 'Rand Water' },
  { src: stlmLogo, alt: 'STLM' },
];

export default function Home() {
  const pageRef = useRef(null);
  const marqueeRef = useRef(null);
  const clientTrackRef = useRef(null);

  const scrollToCta = () => {
    const el = document.getElementById('cta');
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    if (window.lenis) {
      window.lenis.scrollTo(top, { duration: 1.2 });
    } else {
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  useGSAP(() => {
    // ── 001 Hero: word-split stagger ──────────────────────────────────────
    const heading = pageRef.current.querySelector('.hero-heading');
    const words = heading.textContent.trim().split(' ');
    heading.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');

    gsap.fromTo('.hero-label', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.1 });
    gsap.fromTo('.word',
      { opacity: 0, y: 60, rotation: 3 },
      { opacity: 1, y: 0, rotation: 0, stagger: 0.09, duration: 0.75, ease: 'power3.out', delay: 0.25 }
    );
    gsap.fromTo('.hero-tagline',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 1.1 }
    );
    gsap.to('.scroll-line', { scaleY: 0, yoyo: true, repeat: -1, duration: 0.9, ease: 'power2.inOut', transformOrigin: 'top' });

    // ── Canvas: circle-wipe reveal ────────────────────────────────────────
    gsap.set('.scroll-hero', { clipPath: 'circle(0% at 50% 50%)' });
    gsap.to('.scroll-hero', {
      clipPath: 'circle(100% at 50% 50%)',
      ease: 'none',
      scrollTrigger: {
        trigger: '.scroll-hero',
        start: 'top 85%',
        end: 'top 20%',
        scrub: 1,
      },
    });

    // ── Background colour shifts ──────────────────────────────────────────
    const bgMap = [
      ['hero',     '#FAFBFC'],
      ['about',    '#EFF3F7'],
      ['stats',    '#FAFBFC'],
      ['services', '#F4F7FA'],
      ['marquee',  '#FAFBFC'],
      ['clients',  '#EFF3F7'],
      ['why',      '#F4F7FA'],
      ['cta',      '#1E2D3C'],
    ];
    bgMap.forEach(([id, color]) => {
      ScrollTrigger.create({
        trigger: `#${id}`,
        start: 'top 50%',
        onEnter:     () => gsap.to(document.body, { backgroundColor: color, duration: 0.6 }),
        onEnterBack: () => gsap.to(document.body, { backgroundColor: color, duration: 0.6 }),
      });
    });

    // ── 002 About: slide-left ─────────────────────────────────────────────
    gsap.fromTo('#about .section-label',
      { x: -30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: '#about', start: 'top 80%' } }
    );
    gsap.fromTo('#about .section-heading',
      { x: -80, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.08, scrollTrigger: { trigger: '#about', start: 'top 80%' } }
    );
    gsap.fromTo('#about .section-body',
      { x: -40, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.65, ease: 'power2.out', delay: 0.16, scrollTrigger: { trigger: '#about', start: 'top 80%' } }
    );

    // ── 003 Stats: scale-up + GSAP counters ──────────────────────────────
    pageRef.current.querySelectorAll('.stat').forEach((el, i) => {
      gsap.fromTo(el,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.5)', delay: i * 0.15,
          scrollTrigger: { trigger: '#stats', start: 'top 80%' } }
      );
      const target = +el.dataset.target;
      const suffix = el.dataset.suffix ?? '';
      const numEl = el.querySelector('.stat-number');
      ScrollTrigger.create({
        trigger: el, start: 'top 75%', once: true,
        onEnter: () => {
          const obj = { val: 0 };
          gsap.to(obj, {
            val: target, duration: 2, ease: 'power2.out', snap: { val: 1 },
            onUpdate: () => { numEl.textContent = Math.round(obj.val) + suffix; },
          });
        },
      });
    });

    // ── 004 Services: fade-up grid ────────────────────────────────────────
    gsap.fromTo('#services .section-label',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: '#services', start: 'top 80%' } }
    );
    gsap.fromTo('#services .section-heading',
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.08, scrollTrigger: { trigger: '#services', start: 'top 80%' } }
    );
    pageRef.current.querySelectorAll('.svc-card').forEach((card, i) => {
      gsap.fromTo(card,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 0.85, ease: 'power3.out',
          delay: (i % 3) * 0.12,
          scrollTrigger: { trigger: card, start: 'top 88%' } }
      );
    });
    pageRef.current.querySelectorAll('.svc-img').forEach(img => {
      gsap.to(img, {
        y: -30,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.svc-card'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    // ── 005 Marquee: scroll-driven translate ──────────────────────────────
    const marqueeEl = marqueeRef.current;
    if (marqueeEl) {
      gsap.to(marqueeEl, {
        x: () => -(marqueeEl.scrollWidth / 2),
        ease: 'none',
        scrollTrigger: { trigger: '#marquee', start: 'top bottom', end: 'bottom top', scrub: 1, invalidateOnRefresh: true },
      });
    }

    // ── 006 Clients: heading reveal ───────────────────────────────────────
    gsap.fromTo('#clients .section-label',
      { x: -30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: '#clients', start: 'top 80%' } }
    );
    gsap.fromTo('#clients .section-heading',
      { x: -60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.08, scrollTrigger: { trigger: '#clients', start: 'top 80%' } }
    );

    // ── 006 Clients: marquee handled by CSS animation ────────────────────

    // ── 007 Why Us: stagger-up ────────────────────────────────────────────
    gsap.fromTo('#why .section-label',
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: '#why', start: 'top 80%' } }
    );
    gsap.fromTo('#why .section-heading',
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.7, ease: 'power2.out', delay: 0.08, scrollTrigger: { trigger: '#why', start: 'top 80%' } }
    );
    pageRef.current.querySelectorAll('.why-list li').forEach((li, i) => {
      gsap.fromTo(li,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out', delay: i * 0.1,
          scrollTrigger: { trigger: '#why', start: 'top 75%' } }
      );
    });

    // ── 008 CTA: fade-up + data-persist ──────────────────────────────────
    gsap.fromTo('#cta .cta-inner',
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: '#cta', start: 'top 80%' } }
    );

  }, { scope: pageRef });

  return (
    <div id="home-page" ref={pageRef}>

      {/* 001 — Hero */}
      <section id="hero">
        <video
          className="hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/images/hero-poster.jpg"
        >
          <source src={heroClip} type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <span className="hero-label section-label">001 / Mashtronics</span>
        <h1 className="hero-heading">Professional Security Solutions</h1>
        <p className="hero-tagline">
          CCTV, access control and IT infrastructure for South African businesses. Trusted since 2015.
        </p>
        <div className="scroll-indicator">
          <span className="scroll-label">Scroll</span>
          <div className="scroll-line" />
        </div>
      </section>

      {/* Canvas: circle-wipe → frame sequence */}
      <ScrollHero />

      {/* 002 — About */}
      <section id="about" className="align-left">
        <div className="content-wrap">
          <span className="section-label">002 / About</span>
          <h2 className="section-heading">Built by people who know the job.<br />Trusted by the country's biggest names.</h2>
          <p className="section-body">
            Mashtronics was started by people who've been in the industry for over 13 years. We've grown into a trusted security company across South Africa — we install and look after systems that protect what matters.
          </p>
        </div>
        <div className="about__image-panel">
          <img src={aboutUsImg} alt="Mashtronics security professional" />
        </div>
      </section>

      {/* 003 — Stats */}
      <section id="stats">
        <span className="section-label" style={{ textAlign: 'center', display: 'block', marginBottom: '2rem' }}>003 / By the numbers</span>
        <div className="stats-grid">
          <div className="stat" data-target="400" data-suffix="+">
            <span className="stat-number">0+</span>
            <span className="stat-label">Projects Delivered</span>
          </div>
          <div className="stat" data-target="10" data-suffix="+">
            <span className="stat-number">0+</span>
            <span className="stat-label">Years in the Field</span>
          </div>
          <div className="stat" data-target="9" data-suffix="">
            <span className="stat-number">0</span>
            <span className="stat-label">Provinces Serviced</span>
          </div>
        </div>
      </section>

      {/* 004 — CCTV Packages */}
      <section id="packages">
        <div className="pkg-header">
          <span className="section-label">004 / Packages</span>
          <h2 className="section-heading">Residential CCTV Packages</h2>
          <p className="pkg-subhead">Everything included — NVR, HDD, cameras, cabling and accessories. Fully installed.</p>
        </div>
        <div className="pkg-grid">
          <div className="pkg-card">
            <div className="pkg-tier">Starter</div>
            <div className="pkg-cameras">4 Cameras</div>
            <div className="pkg-price"><span className="pkg-currency">R</span>12,000</div>
            <ul className="pkg-features">
              <li>NVR Recorder</li>
              <li>1TB Hard Drive</li>
              <li>4 HD Cameras</li>
              <li>Full Cabling</li>
              <li>All Accessories</li>
              <li>Professional Installation</li>
            </ul>
            <a href="tel:0117654148" className="btn btn--outline pkg-btn">Call to Book</a>
          </div>
          <div className="pkg-card pkg-card--featured">
            <div className="pkg-badge">Most Popular</div>
            <div className="pkg-tier">Standard</div>
            <div className="pkg-cameras">6 Cameras</div>
            <div className="pkg-price"><span className="pkg-currency">R</span>14,000</div>
            <ul className="pkg-features">
              <li>NVR Recorder</li>
              <li>1TB Hard Drive</li>
              <li>6 HD Cameras</li>
              <li>Full Cabling</li>
              <li>All Accessories</li>
              <li>Professional Installation</li>
            </ul>
            <a href="tel:0117654148" className="btn btn--primary pkg-btn">Call to Book</a>
          </div>
          <div className="pkg-card">
            <div className="pkg-tier">Premium</div>
            <div className="pkg-cameras">8 Cameras</div>
            <div className="pkg-price"><span className="pkg-currency">R</span>16,000</div>
            <ul className="pkg-features">
              <li>NVR Recorder</li>
              <li>1TB Hard Drive</li>
              <li>8 HD Cameras</li>
              <li>Full Cabling</li>
              <li>All Accessories</li>
              <li>Professional Installation</li>
            </ul>
            <a href="tel:0117654148" className="btn btn--outline pkg-btn">Call to Book</a>
          </div>
        </div>
        <p className="pkg-disclaimer">All prices include 15% VAT · VAT No. 4320284435 · These are estimates — call 011 765 4148 for a quote on your specific site.</p>
      </section>

      {/* 004 — Services */}
      <section id="services">
        <div className="services-header">
          <span className="section-label">003 / What we do</span>
          <h2 className="section-heading">Security and IT, sorted from one place.</h2>
        </div>
        <div className="services-grid">
          {SERVICES.map((s, i) => (
            <div className="svc-card" key={s.name}>
              <div className="svc-img-wrap">
                <img src={s.img} alt={s.name} className="svc-img" loading="lazy" />
              </div>
              <div className="svc-info">
                <span className="svc-num">0{i + 1}</span>
                <span className="svc-name">{s.name}</span>
                <span className="svc-desc">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 005 — Marquee */}
      <section id="marquee">
        <div className="marquee-inner">
          <span className="marquee-track" ref={marqueeRef}>
            CCTV <span className="sep">/</span> ACCESS CONTROL <span className="sep">/</span> PERIMETER <span className="sep">/</span> FIBRE <span className="sep">/</span> ALARMS <span className="sep">/</span> 24/7 MONITORING&nbsp;&nbsp;&nbsp;&nbsp;
            CCTV <span className="sep">/</span> ACCESS CONTROL <span className="sep">/</span> PERIMETER <span className="sep">/</span> FIBRE <span className="sep">/</span> ALARMS <span className="sep">/</span> 24/7 MONITORING&nbsp;&nbsp;&nbsp;&nbsp;
          </span>
        </div>
      </section>

      {/* 006 — Clients */}
      <section id="clients" className="align-left">
        <div className="content-wrap">
          <span className="section-label">004 / Trusted by</span>
          <h2 className="section-heading">Names you'll recognise.</h2>
        </div>
        <div className="client-marquee">
          <div className="client-track" ref={clientTrackRef}>
            {[...CLIENTS, ...CLIENTS].map((c, i) => (
              <div className="client-logo-wrap" key={i}>
                <img src={c.src} alt={c.alt} className="client-logo" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 007 — Why Us */}
      <section id="why" className="align-right">
        <div className="why__image-panel">
          <img src={whyImg} alt="Mashtronics technician installing CCTV" />
        </div>
        <div className="content-wrap">
          <span className="section-label">005 / Why us</span>
          <h2 className="section-heading">We do the work properly the first time.</h2>
          <ol className="why-list">
            <li>Certified technicians, not subcontracted labour.</li>
            <li>Hikvision and Dahua specialists with full warranty cover.</li>
            <li>24/7 support and rapid call-out across Gauteng.</li>
            <li>One point of contact from quote to handover.</li>
          </ol>
        </div>
      </section>

      {/* 008 — CTA */}
      <section id="cta" data-persist="true">
        <div className="cta-inner">
          <h2 className="cta-heading">Ready to secure your site?</h2>
          <p className="cta-body">We'll come assess your site, give you a quote and install. No middlemen.</p>
          <div className="cta-buttons">
            <button className="btn-primary" onClick={scrollToCta}>Get a quote</button>
            <a className="btn-secondary" href="tel:+27117654148">Call 011 765 4148</a>
          </div>
          <address className="cta-address">
            Meadgate Unit 18B, Kingfisher Street, Helderkruin, Roodepoort, 1724<br />
            <a href="mailto:walter@mashtronicsbe.co.za">walter@mashtronicsbe.co.za</a>
          </address>
        </div>
      </section>

    </div>
  );
}
