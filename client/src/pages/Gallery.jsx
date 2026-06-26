import { useState } from 'react';
import { Link } from 'react-router-dom';
import kamoInstalling from '../assets/images/kamoInstalling.jpeg';
import povhiDrilling from '../assets/images/povhiDrilling.jpeg';
import mashambaPrimary from '../assets/images/mashambaPrimaryInstallation.jpeg';
import barmanWireless from '../assets/images/barmanWirelessLink.jpeg';
import mashtronicsTeam from '../assets/images/mashtronicsTeam.jpeg';
import image33 from '../assets/images/image33.JPG';
import image77 from '../assets/images/image77.JPG';
import image66 from '../assets/images/image66.JPG';
import './Gallery.css';

const ITEMS = [
  { src: kamoInstalling, alt: 'CCTV Installation at Mashamba Primary School', category: 'cctv', title: 'CCTV Installation', location: 'Mashamba Primary School' },
  { src: povhiDrilling, alt: 'CCTV installation', category: 'cctv', title: 'CCTV Installation', location: 'Mashamba Primary' },
  { src: mashambaPrimary, alt: 'Live CCTV Feed', category: 'fencing', title: 'Live CCTV Feed', location: 'Live CCTV Feed After Installation At Mashamba Primary' },
  { src: barmanWireless, alt: 'Wireless Link Installation', category: 'alarms', title: 'Wireless Link Installation', location: 'Installation of Wireless Link' },
  { src: mashtronicsTeam, alt: 'Mashtronics team', category: 'cctv', title: 'Mashtronics Team', location: 'Mashtronics Team after Installation Of CCTV at Mashamba Primary' },
  { src: image33, alt: 'Retail CCTV Installation', category: 'cctv', title: 'Live Feed', location: 'Live CCTV feed For Steve Tshwethe Local Municipality' },
  { src: image77, alt: 'PTZ Camera', category: 'cctv', title: 'PTZ Camera', location: 'PTZ Outdoor Camera Installation' },
  { src: image66, alt: 'City Surveillance', category: 'cctv', title: 'City Surveillance', location: 'City Surveillance For The Steve Tshwethe Local Municipality' },
];

const FILTERS = [
  { value: 'all', label: 'All Projects' },
  { value: 'cctv', label: 'CCTV Systems' },
  { value: 'access', label: 'Access Control' },
  { value: 'fencing', label: 'Electric Fencing' },
  { value: 'alarms', label: 'Alarm Systems' },
  { value: 'networking', label: 'Networking' },
];

const TESTIMONIALS = [
  { quote: 'The CCTV system Mashtronics installed at our warehouse has been flawless. Their attention to detail and clean installation work impressed us the most.', author: 'Michael Botha', role: 'Facilities Manager, Logistics Company' },
  { quote: "Our new access control system has significantly improved security at our offices. Mashtronics' team was professional and completed the work ahead of schedule.", author: 'Thandi Ngwenya', role: 'Office Administrator, Law Firm' },
];

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  const filtered = activeFilter === 'all' ? ITEMS : ITEMS.filter(i => i.category === activeFilter);

  const openLightbox = (item) => setLightbox(item);
  const closeLightbox = () => setLightbox(null);

  const navigate = (dir) => {
    const idx = filtered.findIndex(i => i === lightbox);
    const next = (idx + dir + filtered.length) % filtered.length;
    setLightbox(filtered[next]);
  };

  return (
    <>
      {/* Hero */}
      <section className="gallery-hero">
        <div className="container">
          <h1>Our <span>Security</span> Portfolio</h1>
          <p>Explore our completed projects showcasing professional installations across South Africa</p>
        </div>
      </section>

      {/* Filter */}
      <section className="gallery-filter">
        <div className="container">
          <div className="filter-controls">
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`filter-btn${activeFilter === f.value ? ' active' : ''}`}
                onClick={() => setActiveFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="gallery-grid">
        <div className="container">
          <div className="grid-container">
            {filtered.map((item, i) => (
              <div className="gallery-item" key={i}>
                <img src={item.src} alt={item.alt} loading="lazy" />
                <div className="gallery-overlay">
                  <div className="overlay-content">
                    <h3>{item.title}</h3>
                    <p>{item.location}</p>
                    <button className="gallery-expand" onClick={() => openLightbox(item)} aria-label="Expand image">
                      <i className="fas fa-expand"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="gallery-cta">
            <p>Want to see more of our work?</p>
            <Link to="/#contact" className="btn btn--primary">Request Portfolio</Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="gallery-testimonials">
        <div className="container">
          <div className="section-intro">
            <h2>Client <span>Feedback</span> On Our Work</h2>
            <p>Hear what our clients say about our installation quality and service</p>
          </div>
          <div className="testimonial-slider">
            {TESTIMONIALS.map((t) => (
              <div className="testimonial-slide" key={t.author}>
                <div className="testimonial-content">
                  <p>"{t.quote}"</p>
                  <div className="client-info">
                    <h4>{t.author}</h4>
                    <p>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">&times;</button>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={lightbox.src} alt={lightbox.alt} />
            <div className="lightbox-caption">
              <h3>{lightbox.title}</h3>
              <p>{lightbox.location}</p>
            </div>
          </div>
          <button className="lightbox-prev" onClick={(e) => { e.stopPropagation(); navigate(-1); }} aria-label="Previous">&#10094;</button>
          <button className="lightbox-next" onClick={(e) => { e.stopPropagation(); navigate(1); }} aria-label="Next">&#10095;</button>
        </div>
      )}
    </>
  );
}
