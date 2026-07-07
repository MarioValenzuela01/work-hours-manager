const express = require("express");
const fs = require("fs");
const path = require("path");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const router = express.Router();

const RIDING_ONLY_ITEMS = [
  "Seat Condition",
  "Brake",
  "Accelerator / Throttle",
  "Shifter / Transmission",
  "Safety Switch / Seat Switch",
  "Lights",
  "Drive Forward / Reverse"
];

const PUSH_ONLY_ITEMS = [
  "Pull Cord / Starter Rope",
  "Handle Condition",
  "Safety Bar / Stop Lever",
  "Choke Cable",
  "Throttle Cable",
  "Grass Discharge / Bag Area",
  "Safety Bar Operation"
];

function getValueOrNA(data, itemName) {
  const equipmentType = data.equipmentType;

  const isRidingOnly = RIDING_ONLY_ITEMS.includes(itemName);
  const isPushOnly = PUSH_ONLY_ITEMS.includes(itemName);

  if (equipmentType === "Push Mower" && isRidingOnly) {
    return "N/A";
  }

  if (equipmentType === "Riding Mower" && isPushOnly) {
    return "N/A";
  }

  return data.checklist?.[itemName] || "";
}

function normalizeStatus(value) {
  if (!value) return "";

  if (value === "✓") return "OK";
  if (value === "✕") return "X";

  return value;
}

function drawText(page, text, x, y, font, size = 8) {
  page.drawText(String(text || ""), {
    x,
    y,
    size,
    font,
    color: rgb(0, 0, 0)
  });
}

function drawMultilineText(page, text, x, y, font, size = 8, lineHeight = 10) {
  const value = String(text || "");
  const lines = value.match(/.{1,85}(\s|$)/g) || [];

  lines.slice(0, 4).forEach((line, index) => {
    page.drawText(line.trim(), {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color: rgb(0, 0, 0)
    });
  });
}

router.get("/test", (req, res) => {
  res.send("Lawn inspection route is working");
});

router.post("/pdf", async (req, res) => {
  try {
    const data = req.body;

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "LawnInspection.pdf"
    );

    if (!fs.existsSync(templatePath)) {
      return res
        .status(404)
        .send("Template PDF not found. Save it as public/templates/LawnInspection.pdf");
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    const page = pdfDoc.getPages()[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    /*
      PDF coordinates start from bottom-left.
      If something is slightly moved, adjust x/y numbers here.
    */

    // =========================
    // HEADER FIELDS
    // =========================

    drawText(page, data.operator, 92, 704, font, 8);
    drawText(page, data.date, 365, 704, font, 8);

    drawText(page, data.equipmentType, 122, 678, font, 8);
    drawText(page, data.brand, 345, 678, font, 8);

    drawText(page, data.model, 78, 654, font, 8);
    drawText(page, data.hoursStart, 275, 654, font, 8);
    drawText(page, data.hoursEnd, 460, 654, font, 8);

    // =========================
    // FLUIDS / FILTERS
    // =========================

    const fluids = data.fluids || {};

    drawText(page, fluids["Engine Oil Level"]?.level, 250, 500, font, 7);
    drawText(page, fluids["Engine Oil Level"]?.addedReplaced, 355, 500, font, 7);
    drawText(page, fluids["Engine Oil Level"]?.amount, 475, 500, font, 7);

    drawText(page, fluids["Fuel Level"]?.level, 250, 482, font, 7);
    drawText(page, fluids["Fuel Level"]?.addedReplaced, 355, 482, font, 7);
    drawText(page, fluids["Fuel Level"]?.amount, 475, 482, font, 7);

    drawText(page, fluids["Air Filter"]?.level, 250, 464, font, 7);
    drawText(page, fluids["Air Filter"]?.addedReplaced, 355, 464, font, 7);
    drawText(page, fluids["Air Filter"]?.amount, 475, 464, font, 7);

    // =========================
    // COMMENTS
    // =========================

    drawMultilineText(page, data.generalComments, 72, 420, font, 8, 10);

    // =========================
    // CHECKLIST POSITIONS
    // =========================
    // Estos x/y son para escribir OK, X o N/A al lado de cada item.

    const itemPositions = {
      // Left column
      "Overall Appearance": { x: 250, y: 336 },
      "Seat Condition": { x: 250, y: 318 },
      "Motor Appearance": { x: 250, y: 300 },
      "Frame / Body Condition": { x: 250, y: 282 },
      "Tires / Wheels": { x: 250, y: 264 },
      "Mower Blade": { x: 250, y: 246 },
      "Cutting Deck": { x: 250, y: 228 },
      "Undercarriage": { x: 250, y: 210 },
      "Bearings / Seals / Tie Rods": { x: 250, y: 192 },

      // Right column
      "Brake": { x: 520, y: 336 },
      "Accelerator / Throttle": { x: 520, y: 318 },
      "Shifter / Transmission": { x: 520, y: 300 },
      "Safety Switch / Seat Switch": { x: 520, y: 282 },
      "Lights": { x: 520, y: 264 },
      "Starts Properly": { x: 520, y: 246 },
      "Engine Sound": { x: 520, y: 228 },
      "Drive Forward / Reverse": { x: 520, y: 210 },
      "Blade Engagement": { x: 520, y: 192 },
      "Stops Properly": { x: 520, y: 174 },

      // Push mower items.
      // Ojo: estos solo se verán bien cuando estén agregados visualmente a tu matriz PDF.
      "Pull Cord / Starter Rope": { x: 250, y: 156 },
      "Handle Condition": { x: 250, y: 138 },
      "Safety Bar / Stop Lever": { x: 250, y: 120 },
      "Choke Cable": { x: 520, y: 156 },
      "Throttle Cable": { x: 520, y: 138 },
      "Grass Discharge / Bag Area": { x: 520, y: 120 },
      "Safety Bar Operation": { x: 520, y: 102 }
    };

    Object.entries(itemPositions).forEach(([itemName, position]) => {
      const rawValue = getValueOrNA(data, itemName);
      const value = normalizeStatus(rawValue);

      drawText(page, value, position.x, position.y, boldFont, 7);
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=lawn-mower-inspection-filled.pdf"
    );

    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("Error filling Lawn Inspection PDF:", error);
    res.status(500).send(error.message);
  }
});

module.exports = router;