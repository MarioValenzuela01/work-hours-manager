const groundItems = [
  { name: "Overall Appearance", type: "common" },
  { name: "Motor Appearance", type: "common" },
  { name: "Frame / Body Condition", type: "common" },
  { name: "Tires / Wheels", type: "common" },
  { name: "Mower Blade", type: "common" },
  { name: "Cutting Deck", type: "common" },
  { name: "Undercarriage", type: "common" },
  { name: "Bearings / Seals / Tie Rods", type: "common" },
  { name: "Grass Discharge / Bag Area", type: "push" }
];

const controlItems = [
  { name: "Seat Condition", type: "riding" },
  { name: "Brake", type: "riding" },
  { name: "Accelerator / Throttle", type: "riding" },
  { name: "Shifter / Transmission", type: "riding" },
  { name: "Safety Switch / Seat Switch", type: "riding" },
  { name: "Lights", type: "riding" },
  { name: "Pull Cord / Starter Rope", type: "push" },
  { name: "Handle Condition", type: "push" },
  { name: "Safety Bar / Stop Lever", type: "push" },
  { name: "Choke Cable", type: "push" },
  { name: "Throttle Cable", type: "push" }
];

const operationItems = [
  { name: "Starts Properly", type: "common" },
  { name: "Engine Sound", type: "common" },
  { name: "Drive Forward / Reverse", type: "riding" },
  { name: "Blade Engagement", type: "common" },
  { name: "Stops Properly", type: "common" },
  { name: "Safety Bar Operation", type: "push" }
];

const fluidItems = [
  "Engine Oil Level",
  "Fuel Level",
  "Air Filter"
];

const equipmentTypeSelect = document.getElementById("equipmentType");

function shouldShowItem(itemType, equipmentType) {
  if (itemType === "common") return true;
  if (itemType === "riding" && equipmentType === "Riding Mower") return true;
  if (itemType === "push" && equipmentType === "Push Mower") return true;

  return false;
}

function createChecklistRow(item) {
  const row = document.createElement("div");

  row.className = "check-row";
  row.dataset.itemName = item.name;
  row.dataset.itemType = item.type;

  row.innerHTML = `
    <div class="item-name">${item.name}</div>

    <select class="status-input" data-item="${item.name}">
      <option value="">Select</option>
      <option value="✓">✓ OK</option>
      <option value="✕">✕ Needs Attention</option>
      <option value="N/A">N/A</option>
    </select>

    <input
      type="text"
      class="comment-input"
      data-comment="${item.name}"
      placeholder="Comments"
    />
  `;

  return row;
}

function renderChecklist(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  items.forEach((item) => {
    container.appendChild(createChecklistRow(item));
  });
}

function renderFluidsTable() {
  const tbody = document.getElementById("fluidsTable");
  tbody.innerHTML = "";

  fluidItems.forEach((item) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${item}</td>
      <td>
        <input type="text" data-fluid-level="${item}" placeholder="Level" />
      </td>
      <td>
        <input type="text" data-fluid-added="${item}" placeholder="Yes / No" />
      </td>
      <td>
        <input type="text" data-fluid-amount="${item}" placeholder="Amount" />
      </td>
    `;

    tbody.appendChild(row);
  });
}

function updateVisibleItems() {
  const equipmentType = equipmentTypeSelect.value;
  const rows = document.querySelectorAll(".check-row");

  rows.forEach((row) => {
    const itemType = row.dataset.itemType;
    const visible = shouldShowItem(itemType, equipmentType);

    const statusInput = row.querySelector(".status-input");
    const commentInput = row.querySelector(".comment-input");

    if (visible) {
      row.classList.remove("hidden");

      if (statusInput.value === "N/A") {
        statusInput.value = "";
      }
    } else {
      row.classList.add("hidden");
      statusInput.value = "N/A";
      commentInput.value = "";
    }
  });
}

function collectChecklistData() {
  const checklist = {};
  const commentsByItem = {};

  document.querySelectorAll(".check-row").forEach((row) => {
    const itemName = row.dataset.itemName;
    const statusInput = row.querySelector(".status-input");
    const commentInput = row.querySelector(".comment-input");

    checklist[itemName] = statusInput.value || "";
    commentsByItem[itemName] = commentInput.value || "";
  });

  return {
    checklist,
    commentsByItem
  };
}

function collectFluidsData() {
  const fluids = {};

  fluidItems.forEach((item) => {
    const levelInput = document.querySelector(`[data-fluid-level="${item}"]`);
    const addedInput = document.querySelector(`[data-fluid-added="${item}"]`);
    const amountInput = document.querySelector(`[data-fluid-amount="${item}"]`);

    fluids[item] = {
      level: levelInput.value,
      addedReplaced: addedInput.value,
      amount: amountInput.value
    };
  });

  return fluids;
}

async function generatePdf(event) {
  event.preventDefault();

  const { checklist, commentsByItem } = collectChecklistData();

  const payload = {
    operator: document.getElementById("operator").value,
    date: document.getElementById("date").value,
    equipmentType: document.getElementById("equipmentType").value,
    brand: document.getElementById("brand").value,
    model: document.getElementById("model").value,
    hoursStart: document.getElementById("hoursStart").value,
    hoursEnd: document.getElementById("hoursEnd").value,
    checklist,
    commentsByItem,
    fluids: collectFluidsData(),
    generalComments: document.getElementById("generalComments").value,
    operatorSignature: document.getElementById("operatorSignature").value,
    supervisorSignature: document.getElementById("supervisorSignature").value
  };

  const response = await fetch("/api/lawn-inspection/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    alert("Error generating PDF");
    return;
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "lawn-mower-inspection.pdf";
  link.click();

  window.URL.revokeObjectURL(url);
}

renderChecklist("groundItems", groundItems);
renderChecklist("controlItems", controlItems);
renderChecklist("operationItems", operationItems);
renderFluidsTable();
updateVisibleItems();

equipmentTypeSelect.addEventListener("change", updateVisibleItems);
document
  .getElementById("lawnInspectionForm")
  .addEventListener("submit", generatePdf);