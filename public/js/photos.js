const uploadMessage = document.getElementById("uploadMessage");
const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");

const cameraInput = document.getElementById("cameraInput");
const photosInput = document.getElementById("photosInput");

const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeModalButton = document.getElementById("closeModalButton");

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

  uploadMessage.textContent = "Uploading image...";

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
      uploadMessage.textContent = "You must login first.";
      redirectToLogin();
      return;
    }

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Upload failed.");
    }

    uploadMessage.textContent = `${result.count} image(s) uploaded successfully.`;

    cameraInput.value = "";
    photosInput.value = "";

    await loadMyPhotos();
  } catch (error) {
    console.error("Upload error:", error);
    uploadMessage.textContent = error.message;
  }
}

async function loadMyPhotos() {
  if (!requireLogin()) {
    return;
  }

  gallery.innerHTML = "<p>Loading images...</p>";

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
          <img
            id="photo-img-${photo._id}"
            class="photo-thumb"
            alt="${escapeHtml(photo.originalName)}"
            data-photo-id="${photo._id}"
          />
        `;
      })
      .join("");

    for (const photo of photos) {
      const imgElement = document.getElementById(`photo-img-${photo._id}`);

      if (imgElement) {
        const imageUrl = await getProtectedImageUrl(photo._id);
        imgElement.src = imageUrl;

        imgElement.addEventListener("click", () => {
          openImageModal(imageUrl);
        });
      }
    }
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function openImageModal(imageUrl) {
  modalImage.src = imageUrl;
  imageModal.classList.add("open");
}

function closeImageModal() {
  imageModal.classList.remove("open");
  modalImage.src = "";
}

cameraInput.addEventListener("change", () => {
  uploadFiles(cameraInput.files);
});

photosInput.addEventListener("change", () => {
  uploadFiles(photosInput.files);
});

refreshButton.addEventListener("click", loadMyPhotos);

closeModalButton.addEventListener("click", closeImageModal);

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
    loadMyPhotos();
  }
});