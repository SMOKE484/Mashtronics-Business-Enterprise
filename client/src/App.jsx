import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WhatsAppFAB from './components/WhatsAppFAB';
import ChatBot from './components/ChatBot';
import Home from './pages/Home';
import WhyChooseUs from './pages/WhyChooseUs';
import Gallery from './pages/Gallery';
import Careers from './pages/Careers';
import './App.css';

function LenisScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.lenis) {
      window.lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
  return null;
}

function BackToTop() {
  const btnRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      if (btnRef.current) {
        btnRef.current.classList.toggle('visible', window.scrollY > 400);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const handleClick = (e) => {
    e.preventDefault();
    if (window.lenis) {
      window.lenis.scrollTo(0, { duration: 1.2 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return (
    <button ref={btnRef} className="back-to-top" aria-label="Back to top" onClick={handleClick}>
      <i className="fas fa-arrow-up" aria-hidden="true" />
    </button>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <LenisScrollReset />
      <main id="main-content" style={isHome ? {} : { paddingTop: '80px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/why-choose-us" element={<WhyChooseUs />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/careers" element={<Careers />} />
        </Routes>
      </main>
      <Footer />
      <WhatsAppFAB />
      <BackToTop />
      <ChatBot />
    </>
  );
}
