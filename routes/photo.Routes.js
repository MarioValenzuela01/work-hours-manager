const express = require('express');
const router = express.Router();

const uploadPhotosMiddleware = require('../middleware/photoUploadMiddleware');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');

const photoController = require('../controllers/photoController');

router.post(
  '/upload',
  requireAuth,
  uploadPhotosMiddleware.array('photos', 20),
  photoController.uploadPhotos
);

router.get('/my', requireAuth, photoController.getMyPhotos);

router.get('/all', requireAuth, requireAdmin, photoController.getAllPhotos);

router.get('/:id/file', requireAuth, photoController.getPhotoFile);

router.delete('/:id', requireAuth, photoController.deletePhoto);

module.exports = router;