const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sanitize = require('sanitize-filename');

const allowedMimeTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/octet-stream',
];

function createUploadFolder(userId) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const folder = path.join(
    process.cwd(),
    'uploads',
    'photos',
    'users',
    String(userId),
    year,
    month
  );

  fs.mkdirSync(folder, { recursive: true });

  return folder;
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      const userId = req.userId;

      if (!userId) {
        return cb(new Error('User ID not found from token.'));
      }

      const folder = createUploadFolder(userId);
      cb(null, folder);
    } catch (error) {
      cb(error);
    }
  },

  filename: function (req, file, cb) {
    const safeOriginalName = sanitize(file.originalname || 'image');
    const ext = path.extname(safeOriginalName).toLowerCase() || '.upload';
    const baseName = path.basename(safeOriginalName, ext);
    const uniquePart = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    const finalName = `${baseName}-${uniquePart}${ext}`;
    cb(null, finalName);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.heic',
    '.heif',
  ];

  const validMime = allowedMimeTypes.includes(file.mimetype);
  const validExtension = allowedExtensions.includes(ext);

  if (!validMime && !validExtension) {
    return cb(new Error('Only image files are allowed.'), false);
  }

  cb(null, true);
}

const uploadPhotos = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 20,
  },
});

module.exports = uploadPhotos;