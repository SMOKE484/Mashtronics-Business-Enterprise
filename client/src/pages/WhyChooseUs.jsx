import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Seo from '../components/Seo';
import comprehensiveImg from '../assets/images/COMPREHENSIVE.jpg';
import innovativeImg from '../assets/images/INNOVATIVE.jpg';
import tailorMadeImg from '../assets/images/TailorMade.jpg';
import './WhyChooseUs.css';

const FEATURES = [
  { icon: 'fa-shield-alt', title: '10+ Years Experience', desc: "We've been doing this for over 10 years. We know what works and what doesn't." },
  { icon: 'fa-cogs', title: 'Latest Technology', desc: 'We use up-to-date security tech to keep your business safe.' },
  { icon: 'fa-user-tie', title: 'Certified Team', desc: 'Our certified technicians install and maintain your systems properly.' },
  { icon: 'fa-headset', title: '24/7 Support', desc: "We're available around the clock so you don't have to worry." },
];

const SLIDES = [
  {
    title: 'We Cover Everything',
    desc: 'From CCTV to access control, we handle the whole job. We look at the full picture and make sure all your security systems work together properly.',
    stat: '400+', statLabel: 'Projects Completed',
    img: comprehensiveImg, imgAlt: 'Comprehensive Security Solutions',
  },
  {
    title: 'Up-to-Date Technology',
    desc: 'We keep up with the latest in digital security — high-res cameras, smart analytics and systems that all connect and talk to each other.',
    stat: '100%', statLabel: 'Client Satisfaction',
    img: innovativeImg, imgAlt: 'Up-to-Date Technology',
  },
  {
    title: 'Built Around Your Needs',
    desc: 'Every business is different. We assess your site properly and design a system that fits your specific setup — not a one-size-fits-all solution.',
    stat: '10+', statLabel: 'Years Experience',
    img: tailorMadeImg, imgAlt: 'Custom Security Solutions',
  },
];

const TESTIMONIALS = [
  { quote: 'Mashtronics installed our CCTV system and access control. The team knew their stuff and finished the job ahead of schedule.', author: 'NTT Data', role: 'Corporate Client' },
  { quote: "We've been with Mashtronics for 5 years now. Their maintenance is solid and they respond fast when you need them.", author: 'Transnet', role: 'Government Entity' },
];

export default function WhyChooseUs() {
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef(null);

  const goTo = (idx) => setCurrent((idx + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    intervalRef.current = setInterval(() => goTo(current + 1), 5000);
    return () => clearInterval(intervalRef.current);
  }, [current]);

  const scrollToContact = () => {
    window.location.href = '/#contact';
  };

  return (
    <>
      <Seo
        title="Why Choose Mashtronics | 10+ Years in Digital Security"
        description="10+ years of experience, certified technicians, and 400+ completed projects. See why businesses across Gauteng trust Mashtronics for CCTV and access control."
        path="/why-choose-us"
      />
      {/* Hero */}
      <section className="why-hero">
        <div className="container">
          <h1>Why <span>Choose</span> Mashtronics</h1>
          <p>Your Trusted Partner in Digital Security Solutions</p>
        </div>
      </section>

      {/* Features */}
      <section className="why-features section">
        <div className="container">
          <div className="section__header">
            <span className="section__subtitle">Our Advantages</span>
            <h2 className="section__title">What Sets Us Apart</h2>
            <div className="section__divider"></div>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon"><i className={`fas ${f.icon}`}></i></div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slider */}
      <section className="why-slider-section">
        <div className="container">
          <div className="why-slider">
            <div className="why-slide">
              <div className="why-content">
                <h2 className="why-title">{SLIDES[current].title}</h2>
                <p className="why-description">{SLIDES[current].desc}</p>
                <div className="why-stats">
                  <div className="stat">
                    <span className="stat-number">{SLIDES[current].stat}</span>
                    <span className="stat-label">{SLIDES[current].statLabel}</span>
                  </div>
                </div>
              </div>
              <div className="why-image">
                <img src={SLIDES[current].img} alt={SLIDES[current].imgAlt} loading="lazy" />
              </div>
            </div>

            <div className="why-nav-arrows">
              <button className="why-prev" onClick={() => goTo(current - 1)} aria-label="Previous">
                <i className="fas fa-chevron-left"></i>
              </button>
              <button className="why-next" onClick={() => goTo(current + 1)} aria-label="Next">
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            <div className="why-thumbnails">
              {SLIDES.map((s, i) => (
                <div
                  key={i}
                  className={`why-thumb-item${current === i ? ' active' : ''}`}
                  onClick={() => goTo(i)}
                >
                  <img src={s.img} alt={`Slide ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="why-testimonials section">
        <div className="container">
          <div className="section__header">
            <span className="section__subtitle">Client Feedback</span>
            <h2 className="section__title">What Our Clients Say</h2>
            <div className="section__divider"></div>
          </div>
          <div className="testimonial-grid">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-card" key={t.author}>
                <div className="testimonial-content">
                  <i className="fas fa-quote-left"></i>
                  <p>{t.quote}</p>
                </div>
                <div className="testimonial-author">
                  <h4>{t.author}</h4>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="why-cta">
        <div className="container">
          <h2>Want to secure your business?</h2>
          <p>Give us a call and we'll come assess your site. No obligations.</p>
          <button onClick={scrollToContact} className="btn btn--white">Contact Us Now</button>
        </div>
      </section>
    </>
  );
}
