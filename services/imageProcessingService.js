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
      quality: 0.92,
    });
  } else {
    inputBuffer = await fs.readFile(file.path);
  }

  await sharp(inputBuffer, {
    failOn: 'none',
  })
    .rotate()
    .resize({
      width: 2200,
      height: 2200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 84,
      mozjpeg: true,
      progressive: true,
    })
    .toFile(finalPath);

  const finalStats = await fs.stat(finalPath);

  try {
    if (file.path !== finalPath) {
      await fs.unlink(file.path);
    }
  } catch (error) {
    console.warn('Could not delete original upload:', error.message);
  }

  return {
    storedName: jpegFileName,
    physicalPath: finalPath,
    relativePath: path.relative(process.cwd(), finalPath).replace(/\\/g, '/'),
    mimeType: 'image/jpeg',
    size: finalStats.size,
  };
}

module.exports = {
  convertToJpeg,
};