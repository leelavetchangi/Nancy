export function notFound(req, res) {
  return res.status(404).json({ message: 'The requested API route was not found.' })
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  if (error.code === 11000) {
    return res.status(409).json({ message: 'A record with this information already exists.' })
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body must contain valid JSON.' })
  }
  if (error.code === 'UNSUPPORTED_TICKET_FILE') {
    return res.status(400).json({ message: error.message })
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body exceeds the 20 KB limit.' })
  }
  if (error.name === 'MulterError') {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Each attachment must be smaller than 2 MB.'
      : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Attach no more than 3 files.'
        : 'The attachment upload is invalid.'
    return res.status(400).json({ message })
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: 'Please check the submitted information.' })
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'The request contains an invalid identifier.' })
  }

  const databaseUnavailable = [
    'MongoServerSelectionError',
    'MongoNetworkError',
    'MongoNotConnectedError',
    'MongooseServerSelectionError',
    'MongoTopologyClosedError',
  ].includes(error.name) || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)
  if (databaseUnavailable) {
    console.error('Database unavailable while handling API request.')
    return res.status(503).json({ message: 'NEXA is temporarily unable to reach its data service. Please try again shortly.' })
  }

  console.error('API request failed:', {
    name: error.name || 'Error',
    code: error.code,
  })
  return res.status(500).json({ message: 'Something went wrong. Please try again.' })
}
