async function protectPhotosPage() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.replace("/login.html");
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
      window.location.replace("/login.html");
      return false;
    }

    return true;
  } catch (error) {
    localStorage.removeItem("token");
    window.location.replace("/login.html");
    return false;
  }
}
const uploadForm = document.getElementById("uploadForm");
const uploadMessage = document.getElementById("uploadMessage");
const gallery = document.getElementById("gallery");
const refreshButton = document.getElementById("refreshButton");
const gpsButton = document.getElementById("gpsButton");
const gpsStatus = document.getElementById("gpsStatus");
const gpsLat = document.getElementById("gpsLat");
const gpsLng = document.getElementById("gpsLng");
const cameraInput = document.getElementById("cameraInput");
const photosInput = document.getElementById("photos");

function getToken() {
  return localStorage.getItem("token");
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

function formatDate(dateString) {
  const date = new Date(dateString);

  return date.toLocaleString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  if (!response.ok) {
    throw new Error("Could not load image.");
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function loadImageIntoElement(photoId, imgElement) {
  try {
    const imageUrl = await getProtectedImageUrl(photoId);
    imgElement.src = imageUrl;
  } catch (error) {
    console.error("Image load error:", error);
    imgElement.alt = "Image could not be loaded";
  }
}

async function loadMyPhotos() {
  gallery.innerHTML = "<p>Loading images...</p>";

  const token = getToken();

  if (!token) {
    gallery.innerHTML = `
      <p>You must login first.</p>
      <a class="button" href="/login.html">Go to Login</a>
    `;
    return;
  }

  try {
    const response = await fetch("/api/photos/my", {
      headers: {
        ...getAuthHeaders(),
      },
    });

    const data = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login.html";
      return;
    }

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
          <div class="photo-card">
            <img 
              id="photo-img-${photo._id}" 
              alt="${escapeHtml(photo.originalName)}"
            />

            <div class="photo-info">
              <h3>${escapeHtml(photo.originalName)}</h3>
              <p><strong>Date:</strong> ${formatDate(photo.createdAt)}</p>
              <p><strong>Category:</strong> ${escapeHtml(photo.category || "N/A")}</p>
              <p><strong>Asset:</strong> ${escapeHtml(photo.asset || "N/A")}</p>
              <p><strong>Work Order:</strong> ${escapeHtml(photo.workOrder || "N/A")}</p>
              <p><strong>Location:</strong> ${escapeHtml(photo.location || "N/A")}</p>
              <p>${escapeHtml(photo.description || "")}</p>
            </div>

            <div class="photo-actions">
              <button class="danger" onclick="deletePhoto('${photo._id}')">
                Delete
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    for (const photo of photos) {
      const imgElement = document.getElementById(`photo-img-${photo._id}`);

      if (imgElement) {
        await loadImageIntoElement(photo._id, imgElement);
      }
    }
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function deletePhoto(photoId) {
  const confirmed = confirm("Are you sure you want to delete this photo?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/photos/${photoId}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders(),
      },
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Could not delete photo.");
    }

    await loadMyPhotos();
  } catch (error) {
    alert(error.message);
  }
}

gpsButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    gpsStatus.value = "GPS not available";
    return;
  }

  gpsStatus.value = "Requesting GPS...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      gpsLat.value = position.coords.latitude;
      gpsLng.value = position.coords.longitude;
      gpsStatus.value = "GPS added";
    },
    () => {
      gpsStatus.value = "GPS permission denied";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
});

cameraInput.addEventListener("change", () => {
  if (cameraInput.files.length > 0) {
    const dataTransfer = new DataTransfer();

    for (const file of photosInput.files) {
      dataTransfer.items.add(file);
    }

    dataTransfer.items.add(cameraInput.files[0]);

    photosInput.files = dataTransfer.files;

    uploadMessage.textContent = "Camera photo added. Press Upload Images to save.";
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const token = getToken();

  if (!token) {
    uploadMessage.textContent = "You must login first.";
    return;
  }

  const formData = new FormData(uploadForm);

  uploadMessage.textContent = "Uploading images...";

  try {
    const response = await fetch("/api/photos/upload", {
      method: "POST",
      body: formData,
      headers: {
        ...getAuthHeaders(),
      },
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Upload failed.");
    }

    uploadMessage.textContent = `${result.count} image(s) uploaded successfully.`;

    uploadForm.reset();
    cameraInput.value = "";
    gpsStatus.value = "Not requested yet";

    await loadMyPhotos();
  } catch (error) {
    uploadMessage.textContent = error.message;
  }
});

refreshButton.addEventListener("click", loadMyPhotos);

protectPhotosPage().then((isAllowed) => {
  if (isAllowed) {
    loadMyPhotos();
  }
});