
"use strict";

const express = require("express");
const fs = require("fs/promises");
const path = require("path");

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

    let pdfPath = null;
    let pdfCreated = false;

    try {

        const {
            fields,
            comments
        } = req.body || {};

        // ----------------------------------
        // 1. Validate inspection data
        // ----------------------------------

        if (!isValidInspection(fields, comments)) {

            return res.status(400).json({
                message:
                    "Invalid inspection data. " +
                    "All 53 fields must be included."
            });
        }

        // ----------------------------------
        // 2. Identify equipment
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
        // 3. Find pending inspection
        // ----------------------------------

        const usage = await EquipmentUsage.findOne({

            equipmentId: equipment._id,

            status: "PENDING_INSPECTION"

        });

        if (!usage) {

            return res.status(404).json({
                message:
                    "No pending inspection found"
            });
        }

        // ----------------------------------
        // 4. Verify operator
        // ----------------------------------

        if (
            String(usage.operatorId) !==
            String(req.userId)
        ) {

            return res.status(403).json({
                message:
                    "Only the original operator can " +
                    "complete this inspection"
            });
        }

        // ----------------------------------
        // 5. Prepare checklist
        // ----------------------------------

        const checklist = {};

        for (let i = 1; i <= 53; i++) {

            const key = `field${i}`;

            checklist[key] = fields[key];
        }

        // ----------------------------------
        // 6. Prepare PDF information
        // ----------------------------------

        const inspectionDate = formatInspectionDate(
            usage.endTime
        );

        const pdfData = {

            operator: usage.operatorName,

            date: inspectionDate,

            size: equipment.name,

            serialNumber:
                equipment.serialNumber || "",

            hourStart: String(
                usage.hoursStart
            ),

            hourEnd: String(
                usage.hoursEnd
            ),

            comments,

            ...checklist
        };

        // ----------------------------------
        // 7. Generate official PDF
        // ----------------------------------

        const pdfBuffer = await createInspectionPdf(
            pdfData
        );

        // ----------------------------------
        // 8. Create private storage directory
        // ----------------------------------

        await fs.mkdir(
            STORAGE_DIR,
            {
                recursive: true
            }
        );

        // ----------------------------------
        // 9. Save individual PDF
        // ----------------------------------

        const fileName = `${usage._id}.pdf`;

        pdfPath = path.join(
            STORAGE_DIR,
            fileName
        );

        // Prevent accidentally overwriting a PDF
        await fs.writeFile(
            pdfPath,
            pdfBuffer,
            {
                flag: "wx"
            }
        );

        pdfCreated = true;

        // ----------------------------------
        // 10. Save checklist in MongoDB
        // ----------------------------------

        const updated = await EquipmentUsage.findOneAndUpdate(

            {
                _id: usage._id,
                equipmentId: equipment._id,
                operatorId: req.userId,
                status: "PENDING_INSPECTION"
            },

            {
                $set: {

                    "inspection.checklist":
                        checklist,

                    "inspection.generalComments":
                        comments,

                    "inspection.completedAt":
                        new Date(),

                    status: "COMPLETED"
                }
            },

            {
                new: true,
                runValidators: true
            }
        );

        // ----------------------------------
        // 11. Handle concurrent update
        // ----------------------------------

        if (!updated) {

            // This request did not complete the record.
            // Remove the file created by this attempt.
            if (pdfCreated && pdfPath) {
                try {
                    await fs.unlink(pdfPath);
                } catch (cleanupError) {
                    console.error(
                        "PDF cleanup failed:",
                        cleanupError
                    );
                }
            }

            return res.status(409).json({
                message:
                    "Inspection was already completed or updated"
            });
        }

        // ----------------------------------
        // 12. Successful completion
        // ----------------------------------

        const pdfUrl =
            `/api/equipment/` +
            `${encodeURIComponent(equipment.nfcCode)}` +
            `/inspections/${updated._id}/pdf`;

        return res.json({

            message:
                "Inspection and PDF saved successfully",

            equipmentStatus: "AVAILABLE",

            usageStatus: updated.status,

            usageId: String(updated._id),

            totalEngineHours:
                updated.hoursEnd -
                updated.hoursStart,

            completedAt:
                updated.inspection.completedAt,

            pdfUrl
        });

    } catch (error) {

        console.error(
            "Inspection completion error:",
            error
        );

        if (error.code === "EEXIST") {

            return res.status(409).json({
                message:
                    "An inspection PDF already exists " +
                    "for this usage. Review the stored " +
                    "record before retrying."
            });
        }

        // Do not delete a PDF automatically when
        // the MongoDB commit outcome is uncertain.
        if (pdfCreated && pdfPath) {

            console.error(
                "PDF may require manual reconciliation:",
                pdfPath
            );
        }

        return res.status(500).json({
            message:
                "Inspection could not be completed. " +
                "The record may require review before retrying."
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
