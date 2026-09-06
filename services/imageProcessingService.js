const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

function isHeicFile(file) {
  const ext = path.extname(file.originalname || file.path).toLowerCase();

  return (
    ext === '.heic' ||
    ext === '.heif' ||
    file.mimetype === 'image/heic' ||
    file.mimetype === 'image/heif'
  );
}

function buildJpegFileName(originalName) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);

  return `${baseName}.jpg`;
}

/*
 * Creates a small thumbnail beside the photo storage.
 *
 * Example:
 *
 * uploads/photos/users/USER/2026/08/photo.jpg
 *
 * becomes:
 *
 * uploads/photos/users/USER/2026/08/thumbnails/photo.jpg
 */
async function createThumbnail(imagePath) {
  const imageFolder = path.dirname(imagePath);

  const thumbnailFolder = path.join(
    imageFolder,
    'thumbnails'
  );

  await fs.mkdir(thumbnailFolder, {
    recursive: true,
  });

  const thumbnailPath = path.join(
    thumbnailFolder,
    path.basename(imagePath)
  );

  // If thumbnail already exists, don't recreate it
  try {
    await fs.access(thumbnailPath);
    return thumbnailPath;
  } catch (error) {
    // Thumbnail doesn't exist yet
  }

  await sharp(imagePath, {
    failOn: 'none',
  })
    .resize({
      width: 360,
      height: 360,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 72,
      progressive: true,
    })
    .toFile(thumbnailPath);

  return thumbnailPath;
}

async function convertToJpeg(file) {
  const uploadFolder = path.dirname(file.path);
  const jpegFileName = buildJpegFileName(file.filename);
  const finalPath = path.join(uploadFolder, jpegFileName);

  let inputBuffer;

  if (isHeicFile(file)) {
    const heicBuffer = await fs.readFile(file.path);

    inputBuffer = await heicConvert({
      buffer: heicBuffer,
      format: 'JPEG',
      quality: 0.88,
    });
  } else {
    inputBuffer = await fs.readFile(file.path);
  }

  await sharp(inputBuffer, {
    failOn: 'none',
  })
    .rotate()
    .resize({
      width: 1920,
      height: 1920,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
      progressive: true,
    })
    .toFile(finalPath);

  const finalStats = await fs.stat(finalPath);

  /*
   * Generate thumbnail immediately for new photos.
   */
  await createThumbnail(finalPath);

  try {
    if (file.path !== finalPath) {
      await fs.unlink(file.path);
    }
  } catch (error) {
    console.warn(
      'Could not delete original upload:',
      error.message
    );
  }

  return {
    storedName: jpegFileName,
    physicalPath: finalPath,
    relativePath: path
      .relative(process.cwd(), finalPath)
      .replace(/\\/g, '/'),
    mimeType: 'image/jpeg',
    size: finalStats.size,
  };
}

module.exports = {
  convertToJpeg,
  createThumbnail,
};