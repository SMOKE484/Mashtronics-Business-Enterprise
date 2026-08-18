import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { LoadingState, LoadErrorState, EmptyState } from '../components/PageState'
import './Scheduling.css'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function mondayOf(date) {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function sameDay(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

export default function Scheduling() {
  const [technicians, setTechnicians] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const navigate = useNavigate()

  const monday = useMemo(() => mondayOf(new Date()), [])
  const weekDays = useMemo(() => DAY_LABELS.map((_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  }), [monday])
  const friday = weekDays[4]

  function load() {
    if (!technicians.length) setLoading(true)
    setLoadError('')
    Promise.all([
      api.get('/technicians'),
      api.get(`/jobs?from=${monday.toISOString()}&to=${friday.toISOString()}`),
    ]).then(([t, j]) => { setTechnicians(t.filter(x => x.active)); setJobs(j) })
      .catch(err => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const jobsFor = (techId, day) => jobs.filter(j =>
    (j.technicianRef?._id || j.technicianRef) === techId && sameDay(j.scheduledDate, day)
  )

  return (
    <div className="card">
      <div className="card-title">Technician Schedule — This Week</div>

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <LoadErrorState onRetry={load}>Couldn't load this week's schedule — {loadError}.</LoadErrorState>
      ) : technicians.length === 0 ? (
        <EmptyState actionLabel="Add Technicians" onAction={() => navigate('/technicians')}>
          Add technicians first, then assign jobs to see them here.
        </EmptyState>
      ) : (
        <div className="sched-grid" style={{ gridTemplateColumns: `150px repeat(${DAY_LABELS.length}, minmax(0,1fr))` }}>
          <div className="sched-header-cell" />
          {weekDays.map((d, i) => (
            <div key={i} className="sched-header-cell">{DAY_LABELS[i]} {d.getDate()}</div>
          ))}
          {technicians.map(t => (
            <Fragment key={t._id}>
              <div className="sched-tech-cell">{t.name}</div>
              {weekDays.map((d, i) => (
                <div key={t._id + i} className="sched-cell">
                  {jobsFor(t._id, d).map(j => (
                    <div key={j._id} className="sched-chip">
                      <div className="sched-chip-time">{j.scheduledTime || ''}</div>
                      <div className="sched-chip-label">{(j.clientRef?.name || 'Job')} — {j.jobType}</div>
                    </div>
                  ))}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
