import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { askCoach, checkBackend, loadHousehold, loadReadiness, startRemoteDrill, type BackendState } from './api'
import { getDemoReply, scoreForChecked } from './demoEngine'
import {
  ArrowIcon,
  BellIcon,
  BoxIcon,
  CheckIcon,
  CloseIcon,
  CloudIcon,
  DrillIcon,
  HomeIcon,
  MessageIcon,
  MicIcon,
  MoreIcon,
  PauseIcon,
  PetIcon,
  PlayIcon,
  SendIcon,
  ShieldIcon,
  SparkIcon,
  UserIcon,
} from './icons'
import type { Activity, Message, Supply, View } from './types'

const starterMessages: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: "Good morning. Your home is in good shape today—there are no urgent alerts nearby. You’re one small step away from a stronger 72-hour plan.",
    time: 'Now',
    actions: ['What should I do today?', 'Check my supplies', 'Run a family drill'],
    source: 'RescueReady coach',
  },
]

const initialSupplies: Supply[] = [
  { id: 'water', name: 'Drinking water', detail: '7 of 9 gallons', category: 'Water & food', checked: false, priority: true },
  { id: 'food', name: 'Shelf-stable food', detail: '3-day supply', category: 'Water & food', checked: true },
  { id: 'radio', name: 'Battery radio', detail: 'Not yet packed', category: 'Tools', checked: false, priority: true },
  { id: 'light', name: 'Flashlights', detail: '2 packed · batteries checked', category: 'Tools', checked: true },
  { id: 'aid', name: 'First-aid kit', detail: 'Checked 12 days ago', category: 'Health', checked: true },
  { id: 'meds', name: 'Prescription copies', detail: 'Add to document pouch', category: 'Health', checked: false, priority: true },
  { id: 'charger', name: 'Power bank', detail: '84% charged', category: 'Tools', checked: true },
  { id: 'pet', name: 'Pet food & spare leash', detail: '3-day supply for Pepper', category: 'Water & food', checked: true },
  { id: 'cash', name: 'Small cash reserve', detail: 'Packed in document pouch', category: 'Tools', checked: true },
  { id: 'blanket', name: 'Emergency blankets', detail: '3 packed', category: 'Tools', checked: true },
]

const baseActivity: Activity[] = [
  { id: 'readiness', service: 'Demo · Readiness', label: 'Checked the demo preparedness profile', state: 'complete', time: 'Just now' },
  { id: 'inventory', service: 'Local · Household store', label: 'Read fictional household inventory', state: 'complete', time: 'Just now' },
  { id: 'coach', service: 'Simulator · Coach', label: 'Prepared today’s next step', state: 'complete', time: 'Just now' },
]

const drillSteps = [
  { title: 'Find two safe exits', text: 'Point to the safest way out of every occupied room. Keep pathways clear.' },
  { title: 'Meet at the mailbox', text: 'Everyone moves calmly to the household meeting point. Bring Pepper if safe.' },
  { title: 'Account for everyone', text: 'Say each household member’s name, then pretend to text your out-of-area contact.' },
]

const nowLabel = () => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date())

function extractString(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return null
  const nested = typeof payload.data === 'object' && payload.data ? payload.data as Record<string, unknown> : payload
  for (const key of keys) {
    if (typeof nested[key] === 'string') return nested[key] as string
  }
  return null
}

function extractNumber(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return null
  const nested = typeof payload.data === 'object' && payload.data ? payload.data as Record<string, unknown> : payload
  for (const key of keys) {
    if (typeof nested[key] === 'number') return nested[key] as number
  }
  return null
}

function Brand() {
  return (
    <a href="#main" className="brand" aria-label="RescueReady home">
      <span className="brand-mark"><ShieldIcon size={23} /></span>
      <span className="brand-name">Rescue<span>Ready</span></span>
    </a>
  )
}

function ReadinessRing({ score, size = 'large' }: { score: number; size?: 'large' | 'small' }) {
  return (
    <div className={`readiness-ring ${size}`} style={{ '--score': `${score * 3.6}deg` } as React.CSSProperties} aria-label={`${score}% ready`}>
      <div className="ring-inner">
        <strong>{score}<sup>%</sup></strong>
        {size === 'large' && <span>ready</span>}
      </div>
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [mobileNav, setMobileNav] = useState(false)
  const [messages, setMessages] = useState<Message[]>(starterMessages)
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [backend, setBackend] = useState<BackendState>('checking')
  const [activity, setActivity] = useState<Activity[]>(baseActivity)
  const [supplies, setSupplies] = useState<Supply[]>(() => {
    try {
      const saved = window.localStorage.getItem('rescueready-supplies')
      return saved ? JSON.parse(saved) as Supply[] : initialSupplies
    } catch {
      return initialSupplies
    }
  })
  const [householdName, setHouseholdName] = useState('The Rivera household')
  const [remoteScore, setRemoteScore] = useState<number | null>(null)
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillRunning, setDrillRunning] = useState(false)
  const [drillComplete, setDrillComplete] = useState(false)
  const [drillStep, setDrillStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const chatEnd = useRef<HTMLDivElement>(null)

  const checkedCount = supplies.filter((item) => item.checked).length
  const localScore = scoreForChecked(checkedCount, supplies.length)
  const score = remoteScore ?? localScore

  const addActivity = useCallback((item: Omit<Activity, 'id' | 'time'>) => {
    setActivity((current) => [{ ...item, id: crypto.randomUUID(), time: 'Just now' }, ...current].slice(0, 5))
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const connected = await checkBackend()
      if (!active) return
      setBackend(connected ? 'connected' : 'demo')
      if (connected) {
        const [household, readiness] = await Promise.all([loadHousehold(), loadReadiness()])
        if (!active) return
        const name = extractString(household, ['displayName', 'name', 'householdName'])
        const backendScore = extractNumber(readiness, ['score', 'readinessScore', 'overall'])
        if (name) setHouseholdName(name)
        if (backendScore !== null) setRemoteScore(Math.round(backendScore))
        addActivity({ service: 'API · RescueReady', label: 'Synced household plan', state: 'complete' })
      } else {
        addActivity({ service: 'Demo · Offline ready', label: 'Switched to secure local demo', state: 'local' })
      }
    })()
    return () => { active = false }
  }, [addActivity])

  useEffect(() => {
    window.localStorage.setItem('rescueready-supplies', JSON.stringify(supplies))
  }, [supplies])

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, thinking])

  useEffect(() => {
    if (!drillRunning) return
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [drillRunning])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrillOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const submitMessage = async (message = input) => {
    const trimmed = message.trim()
    if (!trimmed || thinking) return
    setInput('')
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: trimmed, time: nowLabel() }])
    setThinking(true)
    addActivity({ service: 'Simulator · Text input', label: 'Understood household question', state: 'active' })

    const remote = backend === 'connected' ? await askCoach(trimmed) : null
    const answer = extractString(remote, ['answer', 'message', 'response', 'text'])
    const remoteSource = extractString(remote, ['source'])
    const usedBedrock = remoteSource?.toLowerCase().includes('bedrock') ?? false
    const demo = getDemoReply(trimmed)
    await new Promise((resolve) => window.setTimeout(resolve, remote ? 250 : 650))

    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: answer ?? demo.answer,
      time: nowLabel(),
      actions: demo.actions,
      source: answer ? (usedBedrock ? 'Amazon Bedrock' : 'RescueReady deterministic engine') : demo.source,
    }])
    setThinking(false)
    addActivity({
      service: answer ? (usedBedrock ? 'AWS · Bedrock' : 'API · RescueReady') : 'Demo · Coach',
      label: 'Created a personalized next step',
      state: answer ? 'complete' : 'local',
    })
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void submitMessage()
  }

  const toggleSupply = (id: string) => {
    setSupplies((current) => current.map((item) => item.id === id ? { ...item, checked: !item.checked } : item))
    setRemoteScore(null)
    const item = supplies.find((supply) => supply.id === id)
    if (item) addActivity({ service: 'Inventory · Local', label: `${item.checked ? 'Reopened' : 'Packed'} ${item.name.toLowerCase()}`, state: 'local' })
  }

  const beginDrill = async () => {
    setDrillOpen(true)
    setDrillRunning(true)
    setDrillComplete(false)
    setDrillStep(0)
    setElapsed(0)
    if (backend === 'connected') await startRemoteDrill()
    addActivity({ service: 'Simulator · Guided drill', label: 'Started calm evacuation practice', state: 'active' })
  }

  const nextDrillStep = () => {
    if (drillStep === drillSteps.length - 1) {
      setDrillRunning(false)
      setDrillComplete(true)
      addActivity({ service: 'Simulator · Guided drill', label: 'Completed family evacuation practice', state: 'complete' })
    } else {
      setDrillStep((step) => step + 1)
    }
  }

  const navigate = (next: View) => {
    setView(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <header className="topbar">
        <Brand />
        <nav className={`nav-links ${mobileNav ? 'open' : ''}`} aria-label="Primary navigation">
          <button className={view === 'home' ? 'active' : ''} onClick={() => navigate('home')}><HomeIcon />Overview</button>
          <button className={view === 'supplies' ? 'active' : ''} onClick={() => navigate('supplies')}><BoxIcon />Supplies</button>
          <button className={view === 'drill' ? 'active' : ''} onClick={() => navigate('drill')}><DrillIcon />Practice</button>
        </nav>
        <div className="header-actions">
          <div className={`connection-pill ${backend}`} title={backend === 'connected' ? 'Connected to RescueReady API' : 'Local demo mode'}>
            <span />{backend === 'checking' ? 'Connecting' : backend === 'connected' ? 'API connected' : 'Demo ready'}
          </div>
          <button className="icon-button" aria-label="Notifications"><BellIcon /></button>
          <button className="profile-button" aria-label="Open household profile"><span><UserIcon size={17} /></span><small>Household</small></button>
          <button className="menu-button" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={() => setMobileNav((open) => !open)}><MoreIcon /></button>
        </div>
      </header>

      {view === 'home' && (
        <main id="main" className="page dashboard-page">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="status-dot" /> Demo household · Home is calm</div>
              <h1>Good morning. <span>Let’s keep your people ready.</span></h1>
              <p>One thoughtful step today makes an emergency feel less overwhelming tomorrow.</p>
            </div>
            <div className="weather-brief" aria-label="Local conditions">
              <CloudIcon size={25} />
              <div><strong>Demo</strong><span>No simulated alerts</span></div>
            </div>
          </section>

          <section className="dashboard-grid" aria-label="Preparedness overview">
            <div className="main-column">
              <section className="card household-card">
                <div className="card-heading">
                  <div><span className="section-kicker">YOUR HOUSEHOLD</span><h2>{householdName}</h2></div>
                  <button className="text-button">View plan <ArrowIcon size={16} /></button>
                </div>
                <div className="household-content">
                  <ReadinessRing score={score} />
                  <div className="readiness-copy">
                    <div className="score-label"><span className="good-dot" /> Solid foundation</div>
                    <h3>You’re ready for the most likely disruptions.</h3>
                    <p>Complete 3 priority items to reach <strong>85% readiness</strong>.</p>
                    <div className="people-row">
                      <span><UserIcon size={16} /> 2 adults</span>
                      <span><SparkIcon size={16} /> 1 child</span>
                      <span><PetIcon size={16} /> Pepper</span>
                    </div>
                  </div>
                  <div className="next-step-box">
                    <span className="mini-icon water-icon">H₂O</span>
                    <div><small>BEST NEXT STEP · 5 MIN</small><strong>Add 2 gallons of water</strong><span>Finish your 3-day supply</span></div>
                    <button aria-label="Open water supply task" onClick={() => navigate('supplies')}><ArrowIcon /></button>
                  </div>
                </div>
              </section>

              <section className="card coach-card">
                <div className="coach-header">
                  <div className="coach-avatar"><SparkIcon /></div>
                  <div><h2>Ask RescueReady</h2><p>Your calm, personalized preparedness coach</p></div>
                  <span className="voice-badge"><MicIcon size={15} /> Alexa+-style simulator</span>
                </div>
                <div className="chat-feed" aria-live="polite">
                  {messages.map((message) => (
                    <div className={`message-wrap ${message.role}`} key={message.id}>
                      {message.role === 'assistant' && <div className="message-mark"><SparkIcon size={15} /></div>}
                      <div>
                        <div className="message-bubble">
                          <p>{message.text}</p>
                          {message.source && <span className="answer-source"><CheckIcon size={12} /> Grounded in {message.source}</span>}
                        </div>
                        {message.actions && message === messages[messages.length - 1] && (
                          <div className="suggestion-row">
                            {message.actions.map((action) => <button key={action} onClick={() => void submitMessage(action)}>{action}</button>)}
                          </div>
                        )}
                        <span className="message-time">{message.time}</span>
                      </div>
                    </div>
                  ))}
                  {thinking && (
                    <div className="message-wrap assistant" aria-label="RescueReady is thinking">
                      <div className="message-mark"><SparkIcon size={15} /></div>
                      <div className="message-bubble typing"><i /><i /><i /></div>
                    </div>
                  )}
                  <div ref={chatEnd} />
                </div>
                <form className="chat-input" onSubmit={onSubmit}>
                  <button type="button" className="mic-button" aria-label="Voice input preview, not connected" title="Voice input is not connected in this simulator" disabled><MicIcon /></button>
                  <label className="sr-only" htmlFor="coach-input">Ask RescueReady</label>
                  <input id="coach-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about supplies, storms, drills…" autoComplete="off" />
                  <button className="send-button" type="submit" disabled={!input.trim() || thinking} aria-label="Send message"><SendIcon /></button>
                </form>
              </section>
            </div>

            <aside className="side-column">
              <section className="card quick-check-card">
                <div className="card-heading compact"><div><span className="section-kicker">QUICK CHECK</span><h2>72-hour supplies</h2></div><span className="count-pill">{checkedCount}/{supplies.length}</span></div>
                <div className="mini-progress"><span style={{ width: `${checkedCount / supplies.length * 100}%` }} /></div>
                <ul className="quick-list">
                  {supplies.filter((item) => item.priority || item.id === 'food').slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <button className={`check-button ${item.checked ? 'checked' : ''}`} onClick={() => toggleSupply(item.id)} aria-label={`${item.checked ? 'Mark missing' : 'Mark packed'}: ${item.name}`}><CheckIcon size={14} /></button>
                      <div><strong>{item.name}</strong><span>{item.detail}</span></div>
                      {item.priority && !item.checked && <small>Priority</small>}
                    </li>
                  ))}
                </ul>
                <button className="full-width-button secondary" onClick={() => navigate('supplies')}>Open full checklist <ArrowIcon size={16} /></button>
              </section>

              <section className="drill-preview">
                <div className="drill-illustration" aria-hidden="true">
                  <div className="radar-ring ring-one" /><div className="radar-ring ring-two" /><div className="home-symbol"><HomeIcon size={28} /></div>
                </div>
                <div className="drill-copy"><span className="section-kicker light">GUIDED PRACTICE</span><h2>Ready in 3 minutes?</h2><p>Try a calm evacuation drill with the whole household.</p><button onClick={() => void beginDrill()}><PlayIcon size={16} /> Start practice</button></div>
              </section>

              <section className="card activity-card">
                <div className="card-heading compact"><div><span className="section-kicker">LIVE ACTIVITY</span><h2>Your plan at work</h2></div><span className="live-dot">Live</span></div>
                <div className="activity-list">
                  {activity.slice(0, 4).map((item) => (
                    <div className="activity-item" key={item.id}>
                      <span className={`activity-icon ${item.state}`}><CheckIcon size={13} /></span>
                      <div><strong>{item.service}</strong><p>{item.label}</p></div>
                      <time>{item.time}</time>
                    </div>
                  ))}
                </div>
                <div className="privacy-note"><ShieldIcon size={15} /><span>Only the minimum needed data is shared with each service.</span></div>
              </section>
            </aside>
          </section>
        </main>
      )}

      {view === 'supplies' && (
        <main id="main" className="page inner-page">
          <section className="inner-hero">
            <div><span className="section-kicker">HOUSEHOLD INVENTORY</span><h1>Your 72-hour supplies</h1><p>Small, manageable steps. Check off what’s ready and we’ll keep the plan current.</p></div>
            <ReadinessRing score={score} size="small" />
          </section>
          <div className="supplies-layout">
            <section className="card supplies-card">
              <div className="supply-summary"><div><strong>{checkedCount} of {supplies.length}</strong><span>essentials packed</span></div><div className="mini-progress wide"><span style={{ width: `${checkedCount / supplies.length * 100}%` }} /></div><span>{Math.round(checkedCount / supplies.length * 100)}%</span></div>
              {(['Water & food', 'Health', 'Tools'] as const).map((category) => (
                <div className="supply-group" key={category}>
                  <h2>{category}<span>{supplies.filter((item) => item.category === category && item.checked).length}/{supplies.filter((item) => item.category === category).length}</span></h2>
                  {supplies.filter((item) => item.category === category).map((item) => (
                    <button className={`supply-row ${item.checked ? 'complete' : ''}`} key={item.id} onClick={() => toggleSupply(item.id)}>
                      <span className="large-check"><CheckIcon size={17} /></span>
                      <span className="supply-name"><strong>{item.name}</strong><small>{item.detail}</small></span>
                      {item.priority && !item.checked && <em>Best next step</em>}
                    </button>
                  ))}
                </div>
              ))}
            </section>
            <aside className="card impact-card"><SparkIcon /><span className="section-kicker">SMART PRIORITY</span><h2>Water makes the biggest difference.</h2><p>Add two gallons to cover everyone for three full days. That one action moves your readiness to <strong>{Math.min(100, score + 6)}%</strong>.</p><button onClick={() => toggleSupply('water')} disabled={supplies.find((item) => item.id === 'water')?.checked}>Mark water complete <CheckIcon size={16} /></button><div className="impact-foot"><ShieldIcon size={16} /> Stored privately in your household plan</div></aside>
          </div>
        </main>
      )}

      {view === 'drill' && (
        <main id="main" className="page inner-page">
          <section className="inner-hero"><div><span className="section-kicker">PRACTICE, NOT PANIC</span><h1>Build calm muscle memory.</h1><p>Short, voice-friendly drills help every person know what to do—without alarms or surprises.</p></div><button className="primary-action" onClick={() => void beginDrill()}><PlayIcon size={17} /> Start 3-minute drill</button></section>
          <div className="practice-grid">
            <section className="practice-feature">
              <div className="feature-visual"><div className="route route-a"/><div className="route route-b"/><span className="room room-a">Kitchen</span><span className="room room-b">Bedroom</span><span className="meeting-point"><CheckIcon /> Meet here</span><HomeIcon size={44}/></div>
              <div><span className="section-kicker light">RECOMMENDED FOR TODAY</span><h2>Home evacuation</h2><p>Practice two safe exits and your outdoor meeting point. RescueReady guides each step in a calm, Alexa+-style flow.</p><div className="practice-meta"><span><DrillIcon size={16}/> 3 minutes</span><span><UserIcon size={16}/> Whole household</span><span><PetIcon size={16}/> Pet included</span></div><button onClick={() => void beginDrill()}><PlayIcon size={16}/> Begin guided practice</button></div>
            </section>
            <aside className="card drill-history"><span className="section-kicker">PRACTICE HISTORY</span><h2>Consistency builds confidence</h2><div className="history-stat"><strong>2</strong><span>drills completed<br/>in the last 90 days</span></div><div className="history-row"><span className="history-check"><CheckIcon size={14}/></span><div><strong>Power outage</strong><small>September 18 · 4 min</small></div></div><div className="history-row"><span className="history-check"><CheckIcon size={14}/></span><div><strong>Family check-in</strong><small>August 02 · 3 min</small></div></div><div className="streak"><SparkIcon size={16}/><span><strong>Nice work.</strong> One more practice builds a 3-month streak.</span></div></aside>
          </div>
        </main>
      )}

      <footer><Brand /><p>Prepared, not scared. Built for the Amazon Developer Hackathon.</p><span>Privacy-first demo · 2026</span></footer>

      {drillOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDrillOpen(false) }}>
          <section className="drill-modal" role="dialog" aria-modal="true" aria-labelledby="drill-title">
            <div className="modal-top"><div><span className="step-label">GUIDED EVACUATION · STEP {Math.min(drillStep + 1, 3)} OF 3</span><h2 id="drill-title">{drillRunning ? drillSteps[drillStep].title : 'Practice complete'}</h2></div><button className="icon-button" onClick={() => setDrillOpen(false)} aria-label="Close drill" autoFocus><CloseIcon /></button></div>
            <div className="step-progress">{drillSteps.map((_, index) => <span key={index} className={index <= drillStep ? 'active' : ''} />)}</div>
            {!drillComplete ? (
              <div className="drill-stage">
                <div className="pulse-voice"><span><MicIcon size={34}/></span><i/><i/><i/></div>
                <p>{drillSteps[drillStep].text}</p>
                <div className="timer"><DrillIcon size={17}/><time>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</time><button onClick={() => setDrillRunning((running) => !running)}>{drillRunning ? <PauseIcon size={15}/> : <PlayIcon size={15}/>} {drillRunning ? 'Pause' : 'Resume'}</button></div>
                <button className="complete-step" onClick={nextDrillStep}>{drillStep === 2 ? 'We’re all accounted for' : 'Done — next step'} <ArrowIcon size={17}/></button>
              </div>
            ) : (
              <div className="drill-finished"><div className="finished-icon"><CheckIcon size={34}/></div><h3>Everyone made it safely.</h3><p>You practiced two exits, met at the mailbox, and accounted for every household member.</p><div><strong>{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</strong><span>practice time</span></div><button className="complete-step" onClick={() => setDrillOpen(false)}>Finish practice <CheckIcon size={17}/></button></div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default App
