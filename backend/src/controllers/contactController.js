import ContactMessage from '../models/ContactMessage.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function getContactErrors(input = {}) {
  const errors = {}
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 80) {
    errors.name = 'Enter your name (2–80 characters).'
  }
  if (typeof input.email !== 'string' || input.email.trim().length > 254 || !emailPattern.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (typeof input.message !== 'string' || input.message.trim().length < 10 || input.message.trim().length > 4000) {
    errors.message = 'Enter a message between 10 and 4,000 characters.'
  }
  if (input.company !== undefined && (typeof input.company !== 'string' || input.company.length > 200)) {
    errors.company = 'Invalid form submission.'
  }
  if (Object.keys(input).some((key) => !['name', 'email', 'message', 'company'].includes(key))) {
    errors.request = 'Only name, email, and message can be submitted.'
  }
  return errors
}

export async function createContactMessage(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const errors = getContactErrors(body)
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Please correct the contact form.', errors })

    if (body.company?.trim()) {
      return res.status(201).json({ message: 'Your message has been received. Our team will be in touch.' })
    }

    const contactMessage = await ContactMessage.create({
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      message: body.message.trim(),
    })
    return res.status(201).json({
      message: 'Your message has been received. Our team will be in touch.',
      contactId: contactMessage.id,
    })
  } catch (error) {
    return next(error)
  }
}
