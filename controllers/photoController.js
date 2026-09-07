const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const Photo = require('../models/photo.model');
const User = require('../models/user.model');

const { convertToJpeg } = require('../services/imageProcessingService');

const {
  canViewPhoto,
  canDeletePhoto,
} = require('../services/photoPermissionService');

function buildRelativePath(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

async function getUserName(userId) {
  const user = await User.findById(userId).select('username').lean();
  return user?.username || 'Unknown User';
}

async function uploadPhotos(req, res) {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: 'Missing user from token.',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'No images uploaded.',
      });
    }

    const username = await getUserName(userId);

    const {
      description = '',
      category = '',
      asset = '',
      workOrder = '',
      location = '',
      gpsLat,
      gpsLng,
    } = req.body;

    const savedPhotos = [];

    for (const file of req.files) {
      const processedImage = await convertToJpeg(file);

      const photo = await Photo.create({
        originalName: file.originalname,

        storedName: processedImage.storedName,
        physicalPath: processedImage.physicalPath,
        relativePath: processedImage.relativePath,

        uploadedBy: userId,
        uploadedByName: username,

        description,
        category,
        asset,
        workOrder,
        location,

        gps: {
          lat: gpsLat ? Number(gpsLat) : null,
          lng: gpsLng ? Number(gpsLng) : null,
        },

        size: processedImage.size,
        mimeType: processedImage.mimeType,
      });

      savedPhotos.push(photo);
    }

    return res.status(201).json({
      ok: true,
      message: 'Images uploaded successfully.',
      count: savedPhotos.length,
      photos: savedPhotos,
    });
  } catch (error) {
    console.error('Upload photos error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error uploading photos.',
      error: error.message,
    });
  }
}

async function getMyPhotos(req, res) {
  try {
    const page = Math.max(
      parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 24, 1),
      50
    );

    const skip = (page - 1) * limit;

    const filter = {
      uploadedBy: req.userId,
      deletedAt: null,
    };

    const [photos, total] = await Promise.all([
      Photo.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Photo.countDocuments(filter),
    ]);

    const hasMore = skip + photos.length < total;

    return res.json({
      ok: true,
      photos,
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Get my photos error:", error);

    return res.status(500).json({
      ok: false,
      message: "Error loading photos.",
    });
  }
}

async function getAllPhotos(req, res) {
  try {
    const {
      user,
      category,
      asset,
      workOrder,
      search,
      from,
      to,
    } = req.query;

    const filter = {
      deletedAt: null,
    };

    if (user) {
      filter.uploadedByName = new RegExp(user, 'i');
    }

    if (category) {
      filter.category = new RegExp(category, 'i');
    }

    if (asset) {
      filter.asset = new RegExp(asset, 'i');
    }

    if (workOrder) {
      filter.workOrder = new RegExp(workOrder, 'i');
    }

    if (search) {
      filter.$or = [
        { originalName: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') },
        { asset: new RegExp(search, 'i') },
        { workOrder: new RegExp(search, 'i') },
        { location: new RegExp(search, 'i') },
        { uploadedByName: new RegExp(search, 'i') },
      ];
    }

    if (from || to) {
      filter.createdAt = {};

      if (from) {
        filter.createdAt.$gte = new Date(from);
      }

      if (to) {
        filter.createdAt.$lte = new Date(to);
      }
    }

    const photos = await Photo.find(filter).sort({
      createdAt: -1,
    });

    return res.json({
      ok: true,
      photos,
    });
  } catch (error) {
    console.error('Get all photos error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error loading all photos.',
    });
  }
}

async function getPhotoFile(req, res) {
  try {
    const photo = await Photo.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!photo) {
      return res.status(404).json({
        ok: false,
        message: 'Photo not found.',
      });
    }

    if (!canViewPhoto(req, photo)) {
      return res.status(403).json({
        ok: false,
        message: 'You do not have permission to view this photo.',
      });
    }

    if (!fs.existsSync(photo.physicalPath)) {
      return res.status(404).json({
        ok: false,
        message: 'Image file not found on server.',
      });
    }

    res.setHeader('Content-Type', photo.mimeType);

    res.setHeader(
      'Cache-Control',
      'private, max-age=604800'
    );

    return res.sendFile(
      path.resolve(photo.physicalPath)
    );
  } catch (error) {
    console.error('Get photo file error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error loading image file.',
    });
  }
}

async function getPhotoThumbnail(req, res) {
  try {
    const photo = await Photo.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!photo) {
      return res.status(404).json({
        ok: false,
        message: 'Photo not found.',
      });
    }

    if (!canViewPhoto(req, photo)) {
      return res.status(403).json({
        ok: false,
        message: 'You do not have permission to view this photo.',
      });
    }

    if (!fs.existsSync(photo.physicalPath)) {
      return res.status(404).json({
        ok: false,
        message: 'Image file not found on server.',
      });
    }

    const thumbnailFolder = path.join(
      path.dirname(photo.physicalPath),
      'thumbnails'
    );

    const thumbnailPath = path.join(
      thumbnailFolder,
      path.basename(photo.physicalPath)
    );

    /*
     * Create the thumbnail only if it does not exist.
     * Existing photos get one the first time
     * the gallery requests it.
     */
    if (!fs.existsSync(thumbnailPath)) {
      fs.mkdirSync(thumbnailFolder, {
        recursive: true,
      });

      await sharp(photo.physicalPath)
        .resize({
          width: 360,
          height: 360,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 75,
        })
        .toFile(thumbnailPath);
    }

    res.setHeader('Content-Type', 'image/jpeg');

    res.setHeader(
      'Cache-Control',
      'private, max-age=604800'
    );

    return res.sendFile(
      path.resolve(thumbnailPath)
    );
  } catch (error) {
    console.error('Get photo thumbnail error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error loading photo thumbnail.',
    });
  }
}

async function deletePhoto(req, res) {
  try {
    const photo = await Photo.findOne({
      _id: req.params.id,
      deletedAt: null,
    });

    if (!photo) {
      return res.status(404).json({
        ok: false,
        message: 'Photo not found.',
      });
    }

    if (!canDeletePhoto(req, photo)) {
      return res.status(403).json({
        ok: false,
        message: 'You do not have permission to delete this photo.',
      });
    }

    if (fs.existsSync(photo.physicalPath)) {
      fs.unlinkSync(photo.physicalPath);
    }

    photo.deletedAt = new Date();
    await photo.save();

    return res.json({
      ok: true,
      message: 'Photo deleted successfully.',
    });
  } catch (error) {
    console.error('Delete photo error:', error);

    return res.status(500).json({
      ok: false,
      message: 'Error deleting photo.',
    });
  }
}

module.exports = {
  uploadPhotos,
  getMyPhotos,
  getAllPhotos,
  getPhotoFile,
  getPhotoThumbnail,
  deletePhoto,
};