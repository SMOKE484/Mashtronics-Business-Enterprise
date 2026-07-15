import { useState, useRef } from 'react';
import Seo from '../components/Seo';
import './Careers.css';

const JOBS = [
  {
    id: 1,
    title: 'Senior Technician',
    description: 'Senior Tech will be responsible for installation, configuration, commissioning and maintenance of CCTV, Access Control systems including Biometrics and networks systems',
    location: 'Gauteng',
    requirements: 'Matric, Driver\'s license, Any networking certificate, Molex Certificate (networking) or any other network related qualifications, Certificate in any CCTV and Access control, At least 5 years experience',
  },
];

export default function Careers() {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef(null);

  const openForm = (job) => {
    setActiveJob(job);
    setModalOpen(true);
    setSubmitted(false);
  };

  const closeForm = () => {
    setModalOpen(false);
    setActiveJob(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    formRef.current.reset();
    setTimeout(closeForm, 2500);
  };

  return (
    <>
      <Seo
        title="Careers at Mashtronics | Join Our Security & IT Team"
        description="Explore current job openings at Mashtronics Business Enterprise and join a team delivering CCTV, access control, and IT security solutions since 2015."
        path="/careers"
      />
      {/* Hero */}
      <section className="careers-hero">
        <div className="container">
          <h1>Careers at Mashtronics Business <span>Enterprise</span></h1>
          <p>Join a team that's been delivering solid security and tech solutions since 2015.</p>
        </div>
      </section>

      {/* Jobs */}
      <section className="careers-jobs section">
        <div className="container">
          <div className="section__header">
            <span className="section__subtitle">Join Our Team</span>
            <h2 className="section__title">Current Job Openings</h2>
            <div className="section__divider"></div>
            <p className="section__description">Check out our open positions and join a team that takes the work seriously.</p>
          </div>

          <ul className="job-list">
            {JOBS.map(job => (
              <li key={job.id} className="job-card">
                <div className="job-card__header">
                  <h3>{job.title}</h3>
                  <span className="job-badge"><i className="fas fa-map-marker-alt"></i> {job.location}</span>
                </div>
                <p>{job.description}</p>
                <div className="job-requirements">
                  <strong>Requirements:</strong>
                  <p>{job.requirements}</p>
                </div>
                <button className="btn btn--primary" onClick={() => openForm(job)}>Apply Now</button>
              </li>
            ))}
          </ul>

          {JOBS.length === 0 && (
            <div className="no-jobs">
              <i className="fas fa-briefcase"></i>
              <h3>No Open Positions</h3>
              <p>No open positions right now, but we're always keen to hear from good people. Drop your CV to <a href="mailto:walter@mashtronicsbe.co.za">walter@mashtronicsbe.co.za</a></p>
            </div>
          )}
        </div>
      </section>

      {/* Why work with us */}
      <section className="careers-perks section">
        <div className="container">
          <div className="section__header">
            <span className="section__subtitle">Benefits</span>
            <h2 className="section__title">Why Work With Us</h2>
            <div className="section__divider"></div>
          </div>
          <div className="perks-grid">
            <div className="perk-card">
              <i className="fas fa-graduation-cap"></i>
              <h4>Training and Growth</h4>
              <p>We invest in your skills and help you get certified.</p>
            </div>
            <div className="perk-card">
              <i className="fas fa-users"></i>
              <h4>Solid Team</h4>
              <p>Work with experienced people who've got your back.</p>
            </div>
            <div className="perk-card">
              <i className="fas fa-chart-line"></i>
              <h4>Room to Grow</h4>
              <p>There's space to move up here if you put in the work.</p>
            </div>
            <div className="perk-card">
              <i className="fas fa-tools"></i>
              <h4>Latest Equipment</h4>
              <p>You'll work with the latest security technology on every job.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Application Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeForm} aria-label="Close">&times;</button>
            <h3>Apply for {activeJob?.title}</h3>

            {submitted ? (
              <div className="modal-success">
                <i className="fas fa-check-circle"></i>
                <p>Application submitted! We'll be in touch soon.</p>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} encType="multipart/form-data">
                <div className="modal-field">
                  <label htmlFor="app-name">Full Names</label>
                  <input type="text" id="app-name" name="Name" placeholder="Your Name" required />
                </div>
                <div className="modal-field">
                  <label htmlFor="app-email">Email</label>
                  <input type="email" id="app-email" name="Email" placeholder="Your Email" required />
                </div>
                <div className="modal-field">
                  <label htmlFor="app-cv">Upload CV</label>
                  <input type="file" id="app-cv" name="cv" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" required />
                </div>
                <button type="submit" className="btn btn--primary">Submit Application</button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
