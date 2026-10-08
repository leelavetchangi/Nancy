import multer from 'multer'

const ticketMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const chatMimeTypes = new Set([...ticketMimeTypes, 'audio/webm', 'audio/mp4'])

function createUpload(allowedMimeTypes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 3, fields: 4, parts: 7 },
    fileFilter(req, file, callback) {
      const contentType = file.mimetype.split(';', 1)[0].trim().toLowerCase()
      if (!allowedMimeTypes.has(contentType)) {
        const error = new Error('Attachments must be PDF, JPG, PNG, or WebP files.')
        error.code = 'UNSUPPORTED_TICKET_FILE'
        return callback(error)
      }
      return callback(null, true)
    },
  })
}

export const ticketUpload = createUpload(ticketMimeTypes)
export const chatUpload = createUpload(chatMimeTypes)
