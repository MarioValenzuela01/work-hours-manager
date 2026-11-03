
"use strict";

const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const Hour = require("../models/hours.model");

// ==========================================
// LOAD SELECT HOURS
// ==========================================

exports.loadSelectHours = (req, res) => {
    res.sendFile(
        path.join(__dirname, "../public/select-hours.html")
    );
};

// ==========================================
// HANDLE SELECT HOUR
// ==========================================

exports.handleSelectHour = async (req, res) => {
    const { hourId } = req.body;

    if (!hourId) {
        return res.status(400).json({
            error: "Missing hourId"
        });
    }

    try {
        const hour = await Hour.findOne({
            id: hourId,
            userId: req.userId
        });

        if (!hour) {
            return res.status(404).json({
                error: "Hour not found"
            });
        }

        const query =
            `?date=${encodeURIComponent(hour.date)}` +
            `&hourStart=${encodeURIComponent(hour.startTime)}` +
            `&hourEnd=${encodeURIComponent(hour.endTime)}` +
            `&description=${encodeURIComponent(hour.description || "")}`;

        return res.redirect(`/inspection${query}`);

    } catch (error) {
        console.error("Select hour error:", error);

        return res.status(500).json({
            error: "Server error"
        });
    }
};

// ==========================================
// LOAD INSPECTION FORM
// ==========================================

exports.loadForm = (req, res) => {
    res.sendFile(
        path.join(__dirname, "../public/inspection.html")
    );
};

// ==========================================
// REUSABLE PDF GENERATOR
// ==========================================

async function createInspectionPdf(data) {

    const templatePath = path.join(
        __dirname,
        "../templates/inspection-template.pdf"
    );

    const existingPdfBytes = fs.readFileSync(templatePath);

    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    const page = pdfDoc.getPages()[0];

    const font = await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
    );

    // ======================================
    // GENERAL INFORMATION
    // ======================================

    page.drawText(String(data.operator || ""), {
        x: 140, y: 627, size: 12, font
    });

    page.drawText(String(data.date || ""), {
        x: 443, y: 627, size: 12, font
    });

    page.drawText(String(data.size || ""), {
        x: 142, y: 607, size: 14, font
    });

    page.drawText(String(data.serialNumber || ""), {
        x: 303, y: 607, size: 12, font
    });

    page.drawText(String(data.hourStart ?? ""), {
        x: 452, y: 607, size: 12, font
    });

    page.drawText(String(data.hourEnd ?? ""), {
        x: 452, y: 587, size: 12, font
    });

    page.drawText("Hour End:", {
        x: 390, y: 587, size: 12, font
    });

    // ======================================
    // CHECKBOX HELPER
    // ======================================

    const drawX = (value, x, y) => {
        if (String(value ?? "").trim() !== "") {
            page.drawText("X", {
                x, y, size: 14, font
            });
        }
    };

    // ======================================
    // FROM THE GROUND
    // ======================================

    drawX(data.field1, 282, 566);
    drawX(data.field2, 282, 551);
    drawX(data.field3, 282, 536);
    drawX(data.field4, 282, 521);
    drawX(data.field5, 282, 506);

    drawX(data.field14, 517, 566);
    drawX(data.field15, 517, 551);
    drawX(data.field16, 517, 536);
    drawX(data.field17, 517, 521);

    // ======================================
    // OPERATOR STATION
    // ======================================

    drawX(data.field6, 282, 467);
    drawX(data.field7, 282, 452);
    drawX(data.field8, 282, 437);
    drawX(data.field9, 282, 422);
    drawX(data.field10, 282, 407);
    drawX(data.field11, 282, 392);
    drawX(data.field12, 282, 377);
    drawX(data.field13, 282, 362);

    drawX(data.field18, 517, 467);
    drawX(data.field19, 517, 452);
    drawX(data.field20, 517, 437);
    drawX(data.field21, 517, 422);
    drawX(data.field22, 517, 407);
    drawX(data.field23, 517, 392);
    drawX(data.field24, 517, 377);
    drawX(data.field25, 517, 362);

    // ======================================
    // FLUID CHECKBOXES
    // ======================================

    drawX(data.field26, 196, 328);
    drawX(data.field27, 196, 311);
    drawX(data.field28, 196, 296);
    drawX(data.field29, 196, 279);
    drawX(data.field30, 196, 264);
    drawX(data.field31, 196, 249);
    drawX(data.field32, 196, 234);

    // ======================================
    // TEXT FIELD HELPER
    // ======================================

    const drawTextField = (value, x, y, width) => {
        const text = String(value ?? "");

        if (text.trim() === "") {
            return;
        }

        const size = 10;

        const textWidth = font.widthOfTextAtSize(
            text,
            size
        );

        const offsetX = textWidth < width
            ? (width - textWidth) / 2
            : 0;

        page.drawText(text, {
            x: x + offsetX,
            y,
            size,
            font
        });
    };

    // ======================================
    // FLUID LEVELS
    // ======================================

    for (let i = 33; i <= 39; i++) {
        drawTextField(
            data[`field${i}`],
            219,
            328 - ((i - 33) * 16),
            99
        );
    }

    // ======================================
    // FLUIDS ADDED
    // ======================================

    for (let i = 40; i <= 46; i++) {
        drawTextField(
            data[`field${i}`],
            325,
            328 - ((i - 40) * 16),
            82
        );
    }

    // ======================================
    // FLUID COMMENTS
    // ======================================

    for (let i = 47; i <= 53; i++) {
        drawTextField(
            data[`field${i}`],
            414,
            328 - ((i - 47) * 16),
            116
        );
    }

    // ======================================
    // GENERAL COMMENTS
    // ======================================

    const comments = String(data.comments || "");

    if (comments.trim() !== "") {
        page.drawText(comments.trim(), {
            x: 87,
            y: 190,
            size: 11,
            maxWidth: 450,
            lineHeight: 10,
            font
        });
    }

    // ======================================
    // GENERATE PDF BUFFER
    // ======================================

    const pdfBytes = await pdfDoc.save();

    return Buffer.from(pdfBytes);
}

// ==========================================
// EXPORT REUSABLE PDF GENERATOR
// ==========================================

exports.createInspectionPdf = createInspectionPdf;

// ==========================================
// EXISTING PDF DOWNLOAD ENDPOINT
// ==========================================

exports.generatePDF = async (req, res) => {
    try {
        const data = req.body || {};

        const pdfBuffer = await createInspectionPdf(data);

        const safeDate =
            /^\d{4}-\d{2}-\d{2}$/.test(data.date || "")
                ? data.date
                : new Date().toISOString().slice(0, 10);

        res.setHeader(
            "Content-Type",
            "application/pdf"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename=inspection-${safeDate}.pdf`
        );

        return res.send(pdfBuffer);

    } catch (error) {
        console.error(
            "Error generating inspection PDF:",
            error
        );

        return res.status(500).send(
            "Error generating PDF"
        );
    }
};
