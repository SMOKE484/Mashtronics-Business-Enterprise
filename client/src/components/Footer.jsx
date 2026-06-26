import { Link } from 'react-router-dom';
import logo from '../assets/images/Logo.jpg (1) (1).png';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__col">
            <img src={logo} alt="Mashtronics" className="footer__logo" />
            <p>Digital security and IT solutions across South Africa since 2015.</p>
          </div>

          <div className="footer__col">
            <h3>Quick Links</h3>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/#about">About Us</Link></li>
              <li><Link to="/#services">Services</Link></li>
              <li><Link to="/why-choose-us">Why Choose Us</Link></li>
              <li><Link to="/gallery">Gallery</Link></li>
              <li><Link to="/careers">Careers</Link></li>
            </ul>
          </div>

          <div className="footer__col">
            <h3>Services</h3>
            <ul>
              <li><Link to="/#services">CCTV Installation</Link></li>
              <li><Link to="/#services">Access Control</Link></li>
              <li><Link to="/#services">Electric Fencing</Link></li>
              <li><Link to="/#services">Network Cabling</Link></li>
              <li><Link to="/#services">Fire Detection</Link></li>
              <li><Link to="/#services">Intrusion Alarms</Link></li>
            </ul>
          </div>

          <div className="footer__col">
            <h3>Contact</h3>
            <address>
              <p><i className="fas fa-map-marker-alt"></i> Meadgate Unit 18 B, Roodepoort</p>
              <p><i className="fas fa-phone-alt"></i> <a href="tel:+27117654148">011 765 4148</a></p>
              <p><i className="fas fa-envelope"></i> <a href="mailto:walter@mashtronicsbe.co.za">walter@mashtronicsbe.co.za</a></p>
            </address>
          </div>
        </div>

        <div className="footer__bottom">
          <div className="footer__legal">
            <p>&copy; {new Date().getFullYear()} Mashtronics Business Enterprise. All Rights Reserved.</p>
            <p><a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></p>
          </div>
          <div className="footer__credits">
            <p>Website by <a href="#" target="_blank" rel="noreferrer">Nalokie Holdings</a></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
