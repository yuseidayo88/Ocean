import type { ja } from './ja'

/** 骨だけ。文言は Phase 11 までに詰める */
export const en: typeof ja = {
  brand: 'OneFound',
  nav: {
    home: 'Home', inbox: 'Inbox', work: 'Work', task: 'Tasks',
    deliverable: 'Deliverables', member: 'Members', decision: 'Decisions',
    chat: 'Chat', search: 'Search',
  },
  state: {
    wait: 'Your call', check: 'Review', running: 'Running',
    idle: 'Idle', done: 'Done', approved: 'Approved',
  },
  composer: { placeholder: 'Tell the Executive', executive: 'Executive', auto: 'Auto' },
  auth: {
    title: 'OneFound', lead: 'An AI company for solo founders.',
    email: 'Email', send: 'Send me a link',
    sent: 'Check your email and open the link.', signOut: 'Sign out',
  },
  home: {
    greeting: 'What are we starting?',
    emptyLead: 'Just write what you want to do.',
    views: { office: 'Office', desk: 'Desk', progress: 'Progress', flow: 'Workflow' },
  },
  error: {
    title: 'That did not work', retry: 'Try again', back: 'Back to home',
    notFound: 'No such screen', unauthorized: 'Sign in first',
    rateLimited: 'Stopped at the limit',
  },
}
