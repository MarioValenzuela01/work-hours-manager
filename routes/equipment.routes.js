
"use strict";

const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

const Equipment = require("../models/equipment.model");
const EquipmentUsage = require("../models/equipmentUsage.model");
const User = require("../models/user.model");

const {
    requireAuth
} = require("../middleware/auth.middleware");

const {
    createInspectionPdf
} = require("../inspection/inspection.controller");

// ==========================================
// AUTHENTICATION
// ==========================================

router.use(requireAuth);

// ==========================================
// CONFIGURATION
// ==========================================

const STORAGE_DIR = path.join(
    __dirname,
    "..",
    "storage",
    "equipment-inspections"
);

const ACTIVE_STATUSES = [
    "IN_PROGRESS",
    "PENDING_INSPECTION"
];

// ==========================================
// VALIDATION HELPERS
// ==========================================

function isValidMeter(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function isValidInspection(fields, comments) {

    if (
        !fields ||
        typeof fields !== "object" ||
        Array.isArray(fields)
    ) {
        return false;
    }

    if (
        typeof comments !== "string" ||
        comments.length > 220
    ) {
        return false;
    }

    // Validate the 53 fields of the official form
    for (let i = 1; i <= 53; i++) {

        const key = `field${i}`;

        if (
            !Object.prototype.hasOwnProperty.call(
                fields,
                key
            )
        ) {
            return false;
        }

        if (
            typeof fields[key] !== "string" ||
            fields[key].length > 500
        ) {
            return false;
        }
    }

    return true;
}

function isValidObjectIdString(value) {
    return /^[a-fA-F0-9]{24}$/.test(value);
}

// ==========================================
// DATABASE HELPERS
// ==========================================

async function findActiveEquipment(nfcCode) {

    return Equipment.findOne({
        nfcCode,
        active: true
    });
}

async function findOpenUsage(equipmentId) {

    return EquipmentUsage.findOne({
        equipmentId,
        status: {
            $in: ACTIVE_STATUSES
        }
    });
}

// ==========================================
// DATE HELPER - MONCTON TIMEZONE
// ==========================================

function formatInspectionDate(dateValue) {

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid inspection date");
    }

    const formatter = new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "America/Moncton",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    );

    const parts = formatter.formatToParts(date);

    const value = (type) =>
        parts.find(part => part.type === type)?.value;

    return (
        `${value("year")}-` +
        `${value("month")}-` +
        `${value("day")}`
    );
}

// ==========================================
// GET - IDENTIFY EQUIPMENT
// ==========================================

router.get("/:nfcCode", async (req, res) => {

    try {

        const equipment = await findActiveEquipment(
            req.params.nfcCode
        );

        if (!equipment) {
            return res.status(404).json({
                message: "Equipment not found"
            });
        }

        return res.json(equipment);

    } catch (error) {

        console.error(
            "Equipment lookup error:",
            error
        );

        return res.status(500).json({
            message: "Failed to load equipment"
        });
    }
});

// ==========================================
// GET - CURRENT EQUIPMENT USAGE
// ==========================================

router.get("/:nfcCode/current", async (req, res) => {

    try {

        const equipment = await findActiveEquipment(
            req.params.nfcCode
        );

        if (!equipment) {
            return res.status(404).json({
                message: "Equipment not found"
            });
        }

        const usage = await findOpenUsage(
            equipment._id
        );

        return res.json({
            equipment,
            usage
        });

    } catch (error) {

        console.error(
            "Current usage error:",
            error
        );

        return res.status(500).json({
            message: "Failed to load current usage"
        });
    }
});

// ==========================================
// POST - START EQUIPMENT USAGE
// ==========================================

router.post("/:nfcCode/start", async (req, res) => {

    try {

        const { hoursStart } = req.body || {};

        // Validate initial hour meter
        if (!isValidMeter(hoursStart)) {
            return res.status(400).json({
                message:
                    "Valid initial hour meter required"
            });
        }

        // Identify equipment
        const equipment = await findActiveEquipment(
            req.params.nfcCode
        );

        if (!equipment) {
            return res.status(404).json({
                message: "Equipment not found"
            });
        }

        // Identify authenticated operator
        const user = await User.findById(
            req.userId
        );

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        // Create independent usage record
        const usage = await EquipmentUsage.create({

            equipmentId: equipment._id,

            operatorId: user._id,

            operatorName: user.username,

            startTime: new Date(),

            hoursStart,

            status: "IN_PROGRESS"

        });

        return res.status(201).json({
            message: "Equipment usage started",
            usage
        });

    } catch (error) {

        // Partial unique index prevents overlapping uses
        if (error.code === 11000) {

            return res.status(409).json({
                message:
                    "Equipment already has an open record"
            });
        }

        console.error(
            "Start usage error:",
            error
        );

        return res.status(500).json({
            message: "Failed to start equipment usage"
        });
    }
});

// ==========================================
// PATCH - FINISH EQUIPMENT USAGE
// ==========================================

router.patch("/:nfcCode/finish", async (req, res) => {

    try {

        const { hoursEnd } = req.body || {};

        // Validate final hour meter
        if (!isValidMeter(hoursEnd)) {

            return res.status(400).json({
                message:
                    "Valid final hour meter required"
            });
        }

        // Identify equipment
        const equipment = await findActiveEquipment(
            req.params.nfcCode
        );

        if (!equipment) {

            return res.status(404).json({
                message: "Equipment not found"
            });
        }

        // Find current usage
        const usage = await EquipmentUsage.findOne({
            equipmentId: equipment._id,
            status: "IN_PROGRESS"
        });

        if (!usage) {

            return res.status(404).json({
                message: "No active usage found"
            });
        }

        // Only the original operator can finish
        if (
            String(usage.operatorId) !==
            String(req.userId)
        ) {

            return res.status(403).json({
                message:
                    "Only the operator can finish this usage"
            });
        }

        // Final meter cannot be lower
        if (hoursEnd < usage.hoursStart) {

            return res.status(400).json({
                message:
                    "Final meter cannot be lower than initial meter"
            });
        }

        // Atomic update
        const updated = await EquipmentUsage.findOneAndUpdate(

            {
                _id: usage._id,
                equipmentId: equipment._id,
                operatorId: req.userId,
                status: "IN_PROGRESS"
            },

            {
                $set: {
                    endTime: new Date(),
                    hoursEnd,
                    status: "PENDING_INSPECTION"
                }
            },

            {
                new: true,
                runValidators: true
            }
        );

        if (!updated) {

            return res.status(409).json({
                message:
                    "Usage was already updated"
            });
        }

        return res.json({

            message:
                "Usage finished. Inspection required.",

            usage: updated,

            totalEngineHours:
                updated.hoursEnd -
                updated.hoursStart
        });

    } catch (error) {

        console.error(
            "Finish usage error:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to finish equipment usage"
        });
    }
});

// ==========================================
// PATCH - SAVE INSPECTION AND GENERATE PDF
// ==========================================

router.patch("/:nfcCode/inspection", async (req, res) => {
    try {
        const { fields, comments } = req.body || {};

        if (!isValidInspection(fields, comments)) {
            return res.status(400).json({
                message: "Invalid inspection data. All 53 fields must be included."
            });
        }

        const equipment = await findActiveEquipment(req.params.nfcCode);

        if (!equipment) {
            return res.status(404).json({
                message: "Equipment not found"
            });
        }

        const usage = await EquipmentUsage.findOne({
            equipmentId: equipment._id,
            status: "PENDING_INSPECTION"
        });

        if (!usage) {
            return res.status(409).json({
                message: "No pending inspection. Refresh equipment status."
            });
        }

        if (String(usage.operatorId) !== String(req.userId)) {
            return res.status(403).json({
                message: "Only the original operator can complete this inspection"
            });
        }

        const checklist = {};

        for (let i = 1; i <= 53; i++) {
            checklist[`field${i}`] = fields[`field${i}`];
        }

        // Identifies the exact contents of this inspection.
        const submissionHash = crypto
            .createHash("sha256")
            .update(JSON.stringify({ checklist, comments }))
            .digest("hex");

        // Persist the inspection BEFORE generating its PDF.
        // A retry can use the same hash, but cannot replace
        // a different inspection already submitted.
        const saved = await EquipmentUsage.findOneAndUpdate(
            {
                _id: usage._id,
                equipmentId: equipment._id,
                operatorId: req.userId,
                status: "PENDING_INSPECTION",
                $or: [
                    { "inspection.submissionHash": null },
                    { "inspection.submissionHash": submissionHash }
                ]
            },
            {
                $set: {
                    "inspection.checklist": checklist,
                    "inspection.generalComments": comments,
                    "inspection.submissionHash": submissionHash
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!saved) {
            return res.status(409).json({
                message: "Inspection changed or was already completed. Refresh status."
            });
        }

        // Generate PDF from persisted inspection data.
        const pdfData = {
            operator: saved.operatorName,
            date: formatInspectionDate(saved.endTime),
            size: equipment.name,
            serialNumber: equipment.serialNumber || "",
            hourStart: String(saved.hoursStart),
            hourEnd: String(saved.hoursEnd),
            comments: saved.inspection.generalComments,
            ...saved.inspection.checklist
        };

        const pdfBuffer = await createInspectionPdf(pdfData);

        await fs.mkdir(STORAGE_DIR, { recursive: true });

        const pdfPath = path.join(STORAGE_DIR, `${saved._id}.pdf`);

        // Write a complete temporary PDF first.
        // Linking it to the final filename is atomic on
        // the same filesystem and never overwrites an existing PDF.
        const tempPath = path.join(
            STORAGE_DIR,
            `${saved._id}.${crypto.randomUUID()}.tmp`
        );

        try {
            await fs.writeFile(tempPath, pdfBuffer, { flag: "wx" });

            try {
                await fs.link(tempPath, pdfPath);
            } catch (error) {
                if (error.code !== "EEXIST") {
                    throw error;
                }

                // A previous attempt may already have saved the PDF.
                // Confirm it is a complete-looking PDF before recovery.
                const existingPdf = await fs.readFile(pdfPath);

                const headerValid =
                    existingPdf.subarray(0, 5).toString() === "%PDF-";

                const footerValid =
                    existingPdf
                        .subarray(Math.max(0, existingPdf.length - 2048))
                        .toString("latin1")
                        .includes("%%EOF");

                if (!headerValid || !footerValid) {
                    throw new Error(
                        "Stored PDF requires manual review"
                    );
                }
            }
        } finally {
            await fs.rm(tempPath, { force: true }).catch(error => {
                console.error("Temporary PDF cleanup failed:", error);
            });
        }

        // Mark completed only after the PDF is available.


        const updated = await EquipmentUsage.findOneAndUpdate(
            {
                _id: saved._id,
                equipmentId: equipment._id,
                operatorId: req.userId,
                status: "PENDING_INSPECTION",
                "inspection.submissionHash": submissionHash
            },
            {
                $set: {
                    status: "COMPLETED",
                    "inspection.completedAt": new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updated) {
            return res.status(409).json({
                message: "Inspection status changed. Refresh equipment status."
            });
        }

        const pdfUrl =
            `/api/equipment/${encodeURIComponent(equipment.nfcCode)}` +
            `/inspections/${updated._id}/pdf`;

        return res.json({
            message: "Inspection and PDF saved successfully",
            equipmentStatus: "AVAILABLE",
            usageStatus: updated.status,
            usageId: String(updated._id),
            totalEngineHours: updated.hoursEnd - updated.hoursStart,
            completedAt: updated.inspection.completedAt,
            pdfUrl
        });

    } catch (error) {
        console.error("Inspection completion error:", error);

        return res.status(500).json({
            message:
                "Inspection could not be completed. " +
                "Retry with the same inspection data or contact an administrator."
        });
    }
});

// ==========================================
// GET - DOWNLOAD SAVED INSPECTION PDF
// ==========================================

router.get(
    "/:nfcCode/inspections/:usageId/pdf",
    async (req, res) => {

        try {

            // ----------------------------------
            // 1. Identify equipment
            // ----------------------------------

            const equipment = await findActiveEquipment(
                req.params.nfcCode
            );

            if (!equipment) {

                return res.status(404).json({
                    message: "Equipment not found"
                });
            }

            // ----------------------------------
            // 2. Validate usage ID
            // ----------------------------------

            const usageId = req.params.usageId;

            if (!isValidObjectIdString(usageId)) {

                return res.status(400).json({
                    message:
                        "Invalid inspection ID"
                });
            }

            // ----------------------------------
            // 3. Find completed usage
            // ----------------------------------

            const usage = await EquipmentUsage.findOne({

                _id: usageId,

                equipmentId: equipment._id,

                status: "COMPLETED"

            });

            if (!usage) {

                return res.status(404).json({
                    message:
                        "Inspection not found"
                });
            }

            // ----------------------------------
            // 4. Authorization
            // ----------------------------------

            const isOwner =
                String(usage.operatorId) ===
                String(req.userId);

            const isAdmin =
                req.role === "admin";

            if (!isOwner && !isAdmin) {

                return res.status(403).json({
                    message: "Access denied"
                });
            }

            // ----------------------------------
            // 5. Locate private PDF
            // ----------------------------------

            const pdfPath = path.join(

                STORAGE_DIR,

                `${usage._id}.pdf`

            );

            await fs.access(pdfPath);

            // ----------------------------------
            // 6. Send PDF
            // ----------------------------------

            const downloadName =
                `inspection-${equipment.code}-${usage._id}.pdf`;

            return res.download(
                pdfPath,
                downloadName
            );

        } catch (error) {

            console.error(
                "PDF download error:",
                error
            );

            if (error.code === "ENOENT") {

                return res.status(404).json({
                    message:
                        "PDF file not found"
                });
            }

            return res.status(500).json({
                message:
                    "Failed to download inspection PDF"
            });
        }
    }
);

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
