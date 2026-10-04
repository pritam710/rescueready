export type View = 'home' | 'supplies' | 'drill'

export type Message = {
  id: string
  role: 'assistant' | 'user'
  text: string
  time: string
  actions?: string[]
  source?: string
}

export type Supply = {
  id: string
  name: string
  detail: string
  category: 'Water & food' | 'Health' | 'Tools'
  checked: boolean
  priority?: boolean
}

export type Activity = {
  id: string
  service: string
  label: string
  state: 'complete' | 'active' | 'local'
  time: string
}
