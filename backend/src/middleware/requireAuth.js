import jwt from 'jsonwebtoken'
import User from '../models/User.js'

function clearSessionCookie(req, res) {
  res.clearCookie('nexa_session', {
    httpOnly: true,
    secure: req.app.locals.config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api',
  })
}

function verifySessionToken(token, secret) {
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'nexa-api',
    audience: 'nexa-web',
  })
  if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
    throw new jwt.JsonWebTokenError('Invalid session payload')
  }
  return payload
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.nexa_session
  if (!token) {
    return res.status(401).json({ message: 'Please sign in to continue.' })
  }

  try {
    const payload = verifySessionToken(token, req.app.locals.config.jwtSecret)
    const user = await User.findById(payload.sub)
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Your session is no longer active. Please sign in again.' })
    }
    req.user = user
    return next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
    }
    if (['JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' })
    }
    return next(error)
  }
}

export async function optionalAuth(req, res, next) {
  const token = req.cookies?.nexa_session
  if (!token) {
    req.user = null
    return next()
  }

  try {
    const payload = verifySessionToken(token, req.app.locals.config.jwtSecret)
    const user = await User.findById(payload.sub)
    if (!user || !user.isActive) {
      clearSessionCookie(req, res)
      req.user = null
      return next()
    }
    req.user = user
    return next()
  } catch (error) {
    if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      clearSessionCookie(req, res)
      req.user = null
      return next()
    }
    return next(error)
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' })
    }
    return next()
  }
}
