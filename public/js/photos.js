console.log("photos.js version 4 loaded");
const uploadMessage = document.getElementById("uploadMessage");
const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");

const cameraInput = document.getElementById("cameraInput");
const photosInput = document.getElementById("photosInput");

const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeModalButton = document.getElementById("closeModalButton");
const deleteModalButton = document.getElementById("deleteModalButton");

let selectedPhotoId = null;

function getToken() {
  return localStorage.getItem("token");
}

function redirectToLogin() {
  window.location.replace("/login.html");
}

function requireLogin() {
  const token = getToken();

  if (!token) {
    redirectToLogin();
    return false;
  }

  return true;
}

function getAuthHeaders() {
  const token = getToken();

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function protectPhotosPage() {
  const token = getToken();

  if (!token) {
    redirectToLogin();
    return false;
  }

  try {
    const response = await fetch("/api/photos/my", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      redirectToLogin();
      return false;
    }

    return true;
  } catch (error) {
    console.error("Auth check error:", error);
    localStorage.removeItem("token");
    redirectToLogin();
    return false;
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(message) {
  uploadMessage.textContent = message;
}

async function getProtectedImageUrl(photoId) {
  const response = await fetch(`/api/photos/${photoId}/file`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("token");
    redirectToLogin();
    throw new Error("You must login first.");
  }

  if (!response.ok) {
    throw new Error("Could not load image.");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function uploadFiles(fileList) {
  if (!requireLogin()) {
    return;
  }

  const files = Array.from(fileList || []);

  if (files.length === 0) {
    return;
  }

  const formData = new FormData();

  files.forEach((file) => {
    formData.append("photos", file);
  });

  setMessage("Uploading and converting image...");

  try {
    const response = await fetch("/api/photos/upload", {
      method: "POST",
      body: formData,
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      setMessage("You must login first.");
      redirectToLogin();
      return;
    }

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Upload failed.");
    }

    setMessage("Image uploaded. Updating gallery...");

    cameraInput.value = "";
    photosInput.value = "";

    await loadMyPhotos();

    setMessage(`${result.count} image(s) uploaded successfully.`);
  } catch (error) {
    console.error("Upload error:", error);
    setMessage(error.message);
  }
}

async function loadMyPhotos() {
  if (!requireLogin()) {
    return;
  }

  gallery.innerHTML = "<p>Updating gallery...</p>";

  try {
    const response = await fetch("/api/photos/my", {
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      redirectToLogin();
      return;
    }

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "Could not load photos.");
    }

    const photos = data.photos || [];

    if (photos.length === 0) {
      gallery.innerHTML = "<p>No images uploaded yet.</p>";
      return;
    }

    gallery.innerHTML = photos
      .map((photo) => {
        return `
          <div class="thumb-wrapper" id="thumb-wrapper-${photo._id}">
            <div class="thumb-loading">Loading...</div>
            <img
              id="photo-img-${photo._id}"
              class="photo-thumb"
              alt="${escapeHtml(photo.originalName)}"
              data-photo-id="${photo._id}"
              style="display: none;"
            />
          </div>
        `;
      })
      .join("");

    for (const photo of photos) {
      await loadSingleThumbnail(photo);
    }
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function loadSingleThumbnail(photo) {
  const imgElement = document.getElementById(`photo-img-${photo._id}`);
  const wrapper = document.getElementById(`thumb-wrapper-${photo._id}`);

  if (!imgElement || !wrapper) {
    return;
  }

  try {
    const imageUrl = await getProtectedImageUrl(photo._id);

    imgElement.src = imageUrl;
    imgElement.style.display = "block";

    const loadingElement = wrapper.querySelector(".thumb-loading");

    if (loadingElement) {
      loadingElement.remove();
    }

    imgElement.addEventListener("click", () => {
      openImageModal(imageUrl, photo._id);
    });
  } catch (error) {
    console.error("Thumbnail load error:", error);

    wrapper.innerHTML = `
      <div class="thumb-error">
        Image could not load
      </div>
    `;
  }
}

function openImageModal(imageUrl, photoId) {
  selectedPhotoId = photoId;
  modalImage.src = imageUrl;
  imageModal.classList.add("open");
}

function closeImageModal() {
  imageModal.classList.remove("open");
  modalImage.src = "";
  selectedPhotoId = null;
}

async function deleteSelectedPhoto() {
  if (!selectedPhotoId) {
    return;
  }

  const confirmed = confirm("Are you sure you want to delete this photo?");

  if (!confirmed) {
    return;
  }

  setMessage("Deleting photo...");

  try {
    const response = await fetch(`/api/photos/${selectedPhotoId}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      setMessage("You must login first.");
      redirectToLogin();
      return;
    }

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Could not delete photo.");
    }

    closeImageModal();

    setMessage("Photo deleted. Updating gallery...");

    await loadMyPhotos();

    setMessage("Photo deleted successfully.");
  } catch (error) {
    console.error("Delete error:", error);
    setMessage(error.message);
  }
}

cameraInput.addEventListener("change", () => {
  uploadFiles(cameraInput.files);
});

photosInput.addEventListener("change", () => {
  uploadFiles(photosInput.files);
});

refreshButton.addEventListener("click", () => {
  setMessage("Updating gallery...");
  loadMyPhotos();
});

closeModalButton.addEventListener("click", closeImageModal);

deleteModalButton.addEventListener("click", deleteSelectedPhoto);

imageModal.addEventListener("click", (event) => {
  if (event.target === imageModal) {
    closeImageModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageModal();
  }
});

protectPhotosPage().then((isAllowed) => {
  if (isAllowed) {
    setMessage("Updating gallery...");
    loadMyPhotos();
  }
});