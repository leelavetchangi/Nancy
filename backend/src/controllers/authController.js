import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^\+?[0-9][0-9\s()-]{6,19}$/

export function getRegistrationErrors({ fullName, email, mobileNumber, password }) {
  const errors = {}
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 80) {
    errors.fullName = 'Enter your full name (2–80 characters).'
  }
  if (typeof email !== 'string' || email.trim().length > 254 || !emailPattern.test(email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (typeof mobileNumber !== 'string' || !phonePattern.test(mobileNumber.trim())) {
    errors.mobileNumber = 'Enter a valid mobile number.'
  }
  const passwordIsValid = typeof password === 'string'
    && password.length >= 8
    && Buffer.byteLength(password, 'utf8') <= 72
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  if (!passwordIsValid) {
    errors.password = 'Use 8–72 bytes with upper- and lowercase letters, a number, and a symbol.'
  }
  return errors
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    mobileNumber: user.mobileNumber,
    role: user.role,
  }
}

function sessionCookieOptions(rememberMe, nodeEnv) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000,
  }
}

function issueSession(req, res, user, rememberMe = false) {
  const expiresIn = rememberMe ? '7d' : '12h'
  const token = jwt.sign(
    { sub: user.id },
    req.app.locals.config.jwtSecret,
    { expiresIn, issuer: 'nexa-api', audience: 'nexa-web' },
  )
  res.cookie('nexa_session', token, sessionCookieOptions(rememberMe, req.app.locals.config.nodeEnv))
}

export async function register(req, res, next) {
  try {
    const { fullName, email, mobileNumber, password } = req.body ?? {}
    const errors = getRegistrationErrors({ fullName, email, mobileNumber, password })
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      mobileNumber: mobileNumber.trim(),
      passwordHash,
      role: 'customer',
    })
    issueSession(req, res, user)
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
        errors: { email: 'An account with this email already exists.' },
      })
    }
    return next(error)
  }
}

export async function login(req, res, next) {
  try {
    const { email, password, rememberMe = false } = req.body ?? {}
    if (typeof email !== 'string' || !emailPattern.test(email.trim()) || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Enter a valid email and password.' })
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect.' })
    }
    issueSession(req, res, user, rememberMe === true)
    return res.json({ user: publicUser(user) })
  } catch (error) {
    return next(error)
  }
}

export function me(req, res) {
  return res.json({ user: publicUser(req.user) })
}

export function session(req, res) {
  return res.json({ user: req.user ? publicUser(req.user) : null })
}

export function logout(req, res) {
  res.clearCookie('nexa_session', {
    httpOnly: true,
    secure: req.app.locals.config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api',
  })
  return res.json({ message: 'You have been signed out.' })
}
