import './WhatsAppFAB.css';

export default function WhatsAppFAB() {
  return (
    <a
      href="https://wa.me/27604284818"
      className="whatsapp-fab"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
    >
      <i className="fab fa-whatsapp" aria-hidden="true" />
    </a>
  );
}
