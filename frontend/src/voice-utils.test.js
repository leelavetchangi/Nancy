import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  microphoneErrorMessage,
  normalizeVoiceCommand,
  resolveVoiceCommand,
  speechRecognitionErrorMessage,
} from './voice-utils.js'

test('normalizes speech transcripts before intent matching', () => {
  assert.equal(normalizeVoiceCommand('  Open, Ticket #1048!  '), 'open ticket #1048')
})

test('routes dashboard, customer tickets, ticket creation and high priority filters', () => {
  assert.deepEqual(resolveVoiceCommand('Open dashboard', 'customer'), {
    action: 'navigate', path: '/customer/dashboard', label: 'Open dashboard',
  })
  assert.deepEqual(resolveVoiceCommand('Go to my tickets', 'customer'), {
    action: 'navigate', path: '/customer/tickets', label: 'Open my tickets',
  })
  assert.deepEqual(resolveVoiceCommand('Create a new ticket', 'customer'), {
    action: 'navigate', path: '/customer/tickets/new', label: 'Create a new ticket',
  })
  assert.deepEqual(resolveVoiceCommand('Show high priority tickets', 'customer'), {
    action: 'navigate', path: '/customer/tickets?priority=high', label: 'Show high-priority tickets',
  })
})

test('recognizes wake words and greets without treating them as unknown commands', () => {
  for (const greeting of ['hello', 'Hello Stella', 'HEY', 'Hey Stella', 'Hi Stella']) {
    assert.deepEqual(resolveVoiceCommand(greeting, null), {
      action: 'welcome',
      label: 'Welcome to NEXA. How can I help you?',
    })
  }
})

test('wake words may prefix a command, and destination matching is case-insensitive and flexible', () => {
  assert.equal(resolveVoiceCommand('Hello Stella, open CHAT please', 'customer').path, '/customer/chat')
  assert.equal(resolveVoiceCommand('please show the DASHBOARD', 'agent').path, '/agent/dashboard')
  assert.equal(resolveVoiceCommand('can you take me to chat', 'supervisor').path, '/supervisor/chat')
  assert.equal(resolveVoiceCommand('GO TO HOME', 'customer').path, '/')
  assert.equal(resolveVoiceCommand('please open contact', null).path, '/contact')
  assert.equal(resolveVoiceCommand('go to about', null).path, '/about')
  assert.equal(resolveVoiceCommand('show me features', null).path, '/features')
})

test('routes a spoken ticket reference for the authenticated role', () => {
  assert.equal(resolveVoiceCommand('Open ticket 1048', 'customer').path, '/customer/tickets?ticket=1048')
  assert.equal(resolveVoiceCommand('Open ticket one zero four eight', 'agent').path, '/agent/chat?ticket=1048')
  assert.equal(resolveVoiceCommand('Open ticket #ABC123', 'supervisor').path, '/supervisor/chat?ticket=ABC123')
})

test('routes only implemented chat and staff tools', () => {
  assert.equal(resolveVoiceCommand('Go to live chat', 'customer').path, '/customer/chat')
  assert.equal(resolveVoiceCommand('Open AI triage', 'agent').path, '/agent/triage')
  assert.equal(resolveVoiceCommand('Open analytics', 'supervisor').path, '/supervisor/analytics')
  assert.equal(resolveVoiceCommand('Open knowledge base', 'customer').path, '/customer/knowledge')
  assert.equal(resolveVoiceCommand('Open feedback survey', 'customer').path, '/customer/csat')
  assert.equal(resolveVoiceCommand('Open knowledge base', 'admin').path, '/admin/knowledge')
})

test('recognizes logout and public website destinations', () => {
  assert.equal(resolveVoiceCommand('sign out', 'customer').action, 'logout')
  assert.deepEqual(resolveVoiceCommand('go to contact', null), {
    action: 'navigate', path: '/contact', label: 'Go to contact',
  })
  assert.equal(resolveVoiceCommand('show features', null).path, '/features')
  assert.equal(resolveVoiceCommand('tell me about NEXA', null).path, '/about')
})

test('microphone permission and device failures have actionable messages', () => {
  assert.match(microphoneErrorMessage({ name: 'NotAllowedError' }), /Allow microphone access/)
  assert.match(microphoneErrorMessage({ name: 'NotFoundError' }), /No microphone was found/)
  assert.match(microphoneErrorMessage({ name: 'NotReadableError' }), /being used by another app/)
})

test('speech recognition reports denied permission, silence, and network errors distinctly', () => {
  assert.match(speechRecognitionErrorMessage('not-allowed'), /access was denied/)
  assert.match(speechRecognitionErrorMessage('no-speech'), /No speech was detected/)
  assert.match(speechRecognitionErrorMessage('network'), /internet connection/)
})

test('routes notifications for every authenticated workspace role', () => {
  for (const role of ['customer', 'agent', 'supervisor', 'admin']) {
    assert.deepEqual(resolveVoiceCommand('Open notifications', role), {
      action: 'navigate',
      path: `/${role}/notifications`,
      label: 'Open notifications',
    })
  }
  assert.deepEqual(resolveVoiceCommand('Open notifications', null), {
    action: 'navigate',
    path: '/login',
    label: 'Sign in to view notifications',
  })
})
