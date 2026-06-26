import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import logo from '../assets/images/Logo.jpg (1) (1).png';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [transparent, setTransparent] = useState(false);
  const location = useLocation();

  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 100);
      // Transparent only on the home page while inside the hero pin area
      if (isHome) {
        setTransparent(y < window.innerHeight * 0.1);
      }
    };
    // Set initial state
    setTransparent(isHome && window.scrollY < window.innerHeight * 0.1);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  useEffect(() => {
    setMenuOpen(false);
    document.body.style.overflow = 'auto';
    // Re-evaluate transparent on route change
    setTransparent(location.pathname === '/' && window.scrollY < window.innerHeight * 0.1);
  }, [location]);

  const toggleMenu = () => {
    setMenuOpen(prev => {
      document.body.style.overflow = prev ? 'auto' : 'hidden';
      return !prev;
    });
  };

  const scrollTo = (id) => {
    if (location.pathname !== '/') {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      if (window.lenis) {
        window.lenis.scrollTo(top, { duration: 1.2 });
      } else {
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }
    setMenuOpen(false);
    document.body.style.overflow = 'auto';
  };

  const headerClass = [
    'header',
    scrolled ? 'scrolled' : '',
    transparent && !menuOpen ? 'header--transparent' : '',
  ].filter(Boolean).join(' ');

  return (
    <header className={headerClass}>
      <div className="container">
        <div className="header__inner">
          <Link to="/" className="logo">
            <img src={logo} alt="Mashtronics Business Enterprise" width={220} height={60} />
          </Link>

          <button
            className="nav-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={toggleMenu}
          >
            <span className={`hamburger${menuOpen ? ' open' : ''}`}></span>
          </button>

          <nav className="nav" data-visible={menuOpen}>
            <ul className="nav__list">
              <li className="nav__item">
                <NavLink to="/" end className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>Home</NavLink>
              </li>
              <li className="nav__item">
                <button className="nav__link nav__link--btn" onClick={() => scrollTo('about')}>About</button>
              </li>
              <li className="nav__item">
                <NavLink to="/why-choose-us" className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>Why Us</NavLink>
              </li>
              <li className="nav__item">
                <button className="nav__link nav__link--btn" onClick={() => scrollTo('services')}>Services</button>
              </li>
              <li className="nav__item">
                <button className="nav__link nav__link--btn" onClick={() => scrollTo('clients')}>Clients</button>
              </li>
              <li className="nav__item">
                <NavLink to="/gallery" className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>Gallery</NavLink>
              </li>
              <li className="nav__item">
                <NavLink to="/careers" className={({ isActive }) => `nav__link${isActive ? ' active' : ''}`}>Careers</NavLink>
              </li>
              <li className="nav__item nav__item--cta">
                <button className="nav__cta" onClick={() => scrollTo('cta')}>Get a Quote</button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
