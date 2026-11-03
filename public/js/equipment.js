
"use strict";

// ==========================================
// NFC EQUIPMENT - CONFIGURATION
// ==========================================

const pathParts = window.location.pathname.split("/");
const nfcCode = pathParts[2];

const API = `/api/equipment/${encodeURIComponent(nfcCode || "")}`;

// ==========================================
// DOM ELEMENTS
// ==========================================

const startForm = document.getElementById("startForm");
const finishForm = document.getElementById("finishForm");
const inspectionSection = document.getElementById("inspectionSection");
const busySection = document.getElementById("busySection");

const message = document.getElementById("message");
const statusLabel = document.getElementById("equipmentStatus");

const equipmentName = document.getElementById("equipmentName");
const equipmentCode = document.getElementById("equipmentCode");

const operatorName = document.getElementById("operatorName");
const currentOperator = document.getElementById("currentOperator");

const hoursStartInput = document.getElementById("hoursStart");
const hoursEndInput = document.getElementById("hoursEnd");

const startTimeInput = document.getElementById("startTime");
const initialMeterInput = document.getElementById("initialMeter");

const inspectionDetails = document.getElementById("inspectionDetails");
const busyMessage = document.getElementById("busyMessage");

const refreshButton = document.getElementById("refreshButton");

// ==========================================
// AUTHENTICATION
// ==========================================

function getToken() {
    return localStorage.getItem("token");
}

function getHeaders() {
    return {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json"
    };
}

function redirectToLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");

    const next = encodeURIComponent(window.location.pathname);

    window.location.replace(`/login.html?next=${next}`);
}

// Read JWT payload for UI purposes only.
// The backend remains responsible for authorization.

function getCurrentUserId() {
    const token = getToken();

    if (!token) {
        return null;
    }

    try {
        const payloadPart = token.split(".")[1];

        if (!payloadPart) {
            return null;
        }

        const base64 = payloadPart
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const padded = base64.padEnd(
            Math.ceil(base64.length / 4) * 4,
            "="
        );

        const payload = JSON.parse(atob(padded));

        return payload.userId || null;

    } catch (error) {
        console.error("Invalid token payload");
        return null;
    }
}

// ==========================================
// UI HELPERS
// ==========================================

function hideSections() {
    startForm.classList.add("hidden");
    finishForm.classList.add("hidden");
    inspectionSection.classList.add("hidden");
    busySection.classList.add("hidden");
}

function setMessage(text) {
    message.textContent = text;
}

function setStatus(text) {
    statusLabel.textContent = text;
}

function setButtonLoading(button, loading) {
    button.disabled = loading;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = "Please wait...";
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;
    }
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString("en-CA", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Moncton"
    });
}

function isValidMeter(value) {
    return (
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

// ==========================================
// API REQUEST
// ==========================================

async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                ...getHeaders(),
                ...(options.headers || {})
            }
        });
    } catch (error) {
        throw new Error(
            "Connection error. Please check your internet connection."
        );
    }

    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Authentication required");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("Invalid server response");
    }

    if (!response.ok) {
        throw new Error(
            data.message || `Request failed (${response.status})`
        );
    }

    return data;
}

// ==========================================
// LOAD EQUIPMENT
// ==========================================

async function loadEquipment() {
    try {
        hideSections();
        setMessage("");
        setStatus("Loading...");

        if (!getToken()) {
            redirectToLogin();
            return;
        }

        const result = await apiRequest(`${API}/current`);

        const { equipment, usage } = result;

        if (!equipment) {
            throw new Error("Equipment not found");
        }

        equipmentName.textContent = equipment.name;
        equipmentCode.textContent = equipment.code;

        const currentUserId = getCurrentUserId();

        // ==================================
        // EQUIPMENT AVAILABLE
        // ==================================

        if (!usage) {
            setStatus("Available");

            operatorName.value =
                localStorage.getItem("username") || "";

            hoursStartInput.value = "";

            startForm.classList.remove("hidden");

            return;
        }

        const isOwner =
            currentUserId !== null &&
            String(currentUserId) === String(usage.operatorId);

        // ==================================
        // PENDING INSPECTION
        // ==================================

        if (usage.status === "PENDING_INSPECTION") {
            setStatus("Pending Inspection");

            if (!isOwner) {
                busyMessage.textContent =
                    `This tractor has an inspection pending ` +
                    `for ${usage.operatorName}.`;

                busySection.classList.remove("hidden");
                return;
            }

            inspectionDetails.textContent =
                `Operator: ${usage.operatorName} | ` +
                `Start: ${usage.hoursStart} h | ` +
                `End: ${usage.hoursEnd} h | ` +
                `Total: ${(
                    usage.hoursEnd - usage.hoursStart
                ).toFixed(1)} h`;

            inspectionSection.classList.remove("hidden");

            return;
        }

        // ==================================
        // EQUIPMENT IN PROGRESS
        // ==================================

        if (usage.status === "IN_PROGRESS") {
            setStatus("In Use");

            if (!isOwner) {
                busyMessage.textContent =
                    `This tractor is currently being used by ` +
                    `${usage.operatorName}.`;

                busySection.classList.remove("hidden");

                return;
            }

            currentOperator.value = usage.operatorName;

            startTimeInput.value =
                formatDate(usage.startTime);

            initialMeterInput.value =
                Number(usage.hoursStart).toFixed(1);

            hoursEndInput.min = usage.hoursStart;
            hoursEndInput.value = "";

            finishForm.classList.remove("hidden");

            return;
        }

        throw new Error("Unknown equipment status");

    } catch (error) {
        console.error("Load equipment error:", error);
        setMessage(error.message);
        setStatus("Error");
    }
}

// ==========================================
// START EQUIPMENT USAGE
// ==========================================

startForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawValue = hoursStartInput.value;

    if (!isValidMeter(rawValue)) {
        setMessage("Please enter a valid initial hour meter.");
        return;
    }

    const hoursStart = Number(rawValue);

    const button = startForm.querySelector("button");

    setButtonLoading(button, true);
    setMessage("");

    try {
        const result = await apiRequest(`${API}/start`, {
            method: "POST",
            body: JSON.stringify({
                hoursStart
            })
        });

        console.log("Equipment usage started:", result.message);

        await loadEquipment();

    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonLoading(button, false);
    }
});

// ==========================================
// FINISH EQUIPMENT USAGE
// ==========================================

finishForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const rawValue = hoursEndInput.value;

    if (!isValidMeter(rawValue)) {
        setMessage("Please enter a valid final hour meter.");
        return;
    }

    const hoursEnd = Number(rawValue);

    const hoursStart = Number(initialMeterInput.value);

    if (hoursEnd < hoursStart) {
        setMessage(
            "Final hour meter cannot be lower than initial hour meter."
        );
        return;
    }

    const button = finishForm.querySelector("button");

    setButtonLoading(button, true);
    setMessage("");

    try {
        const result = await apiRequest(`${API}/finish`, {
            method: "PATCH",
            body: JSON.stringify({
                hoursEnd
            })
        });

        console.log("Equipment usage finished:", result.message);

        await loadEquipment();

    } catch (error) {
        setMessage(error.message);
    } finally {
        setButtonLoading(button, false);
    }
});

// ==========================================
// OPEN EQUIPMENT INSPECTION
// ==========================================

const openInspectionButton =
    document.getElementById("openInspectionButton");

if (openInspectionButton) {
    openInspectionButton.addEventListener("click", () => {

        const inspectionUrl =
            `/inspection.html?equipment=${encodeURIComponent(nfcCode)}`;

        window.location.href = inspectionUrl;
    });
}

// ==========================================
// REFRESH STATUS
// ==========================================

refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;

    try {
        await loadEquipment();
    } finally {
        refreshButton.disabled = false;
    }
});

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

if (!nfcCode || !/^[a-zA-Z0-9_-]+$/.test(nfcCode)) {
    setMessage("Invalid equipment URL");
    setStatus("Error");
} else {
    loadEquipment();
}
