function getUserId(reqOrUser) {
  if (!reqOrUser) return null;

  return String(
    reqOrUser.userId ||
    reqOrUser._id ||
    reqOrUser.id
  );
}

function isAdmin(reqOrUser) {
  return reqOrUser?.role === 'admin';
}

function isPhotoOwner(reqOrUser, photo) {
  return String(photo.uploadedBy) === getUserId(reqOrUser);
}

function canViewPhoto(reqOrUser, photo) {
  return isAdmin(reqOrUser) || isPhotoOwner(reqOrUser, photo);
}

function canDeletePhoto(reqOrUser, photo) {
  if (isAdmin(reqOrUser)) return true;

  const ownsPhoto = isPhotoOwner(reqOrUser, photo);

  // Por ahora dejamos que cualquier usuario borre sus propias fotos.
  // Después podemos agregar canDeleteOwnPhotos al modelo User.
  return ownsPhoto;
}

module.exports = {
  getUserId,
  isAdmin,
  isPhotoOwner,
  canViewPhoto,
  canDeletePhoto,
};