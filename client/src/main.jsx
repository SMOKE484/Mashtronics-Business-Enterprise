import { StrictMode } from 'react';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
}
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './index.css';
import App from './App.jsx';

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();
window.lenis = lenis;

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
