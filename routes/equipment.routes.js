
const express = require('express');
const router = express.Router();

const Equipment = require('../models/equipment.model');
const EquipmentUsage = require('../models/equipmentUsage.model');
const User = require('../models/user.model');

const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);

const isValidMeter = (value) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0;

// GET - Identify equipment
router.get('/:nfcCode', async (req, res) => {
    try {
        const equipment = await Equipment.findOne({
            nfcCode: req.params.nfcCode,
            active: true
        });

        if (!equipment) {
            return res.status(404).json({
                message: 'Equipment not found'
            });
        }

        res.json(equipment);

    } catch (error) {
        res.status(500).json({
            message: 'Failed to load equipment'
        });
    }
});

// GET - Current usage
router.get('/:nfcCode/current', async (req, res) => {
    try {
        const equipment = await Equipment.findOne({
            nfcCode: req.params.nfcCode,
            active: true
        });

        if (!equipment) {
            return res.status(404).json({
                message: 'Equipment not found'
            });
        }

        const usage = await EquipmentUsage.findOne({
            equipmentId: equipment._id,
            status: {
                $in: ['IN_PROGRESS', 'PENDING_INSPECTION']
            }
        });

        res.json({ equipment, usage });

    } catch (error) {
        res.status(500).json({
            message: 'Failed to load current usage'
        });
    }
});

// POST - Start equipment usage
router.post('/:nfcCode/start', async (req, res) => {
    try {
        const { hoursStart } = req.body;

        if (!isValidMeter(hoursStart)) {
            return res.status(400).json({
                message: 'Valid initial hour meter required'
            });
        }

        const equipment = await Equipment.findOne({
            nfcCode: req.params.nfcCode,
            active: true
        });

        if (!equipment) {
            return res.status(404).json({
                message: 'Equipment not found'
            });
        }

        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(401).json({
                message: 'User not found'
            });
        }

        const usage = await EquipmentUsage.create({
            equipmentId: equipment._id,
            operatorId: user._id,
            operatorName: user.username,
            startTime: new Date(),
            hoursStart,
            status: 'IN_PROGRESS'
        });

        res.status(201).json({
            message: 'Equipment usage started',
            usage
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Equipment already has an open record'
            });
        }

        res.status(500).json({
            message: 'Failed to start equipment usage'
        });
    }
});

// PATCH - Finish equipment usage
router.patch('/:nfcCode/finish', async (req, res) => {
    try {
        const { hoursEnd } = req.body;

        if (!isValidMeter(hoursEnd)) {
            return res.status(400).json({
                message: 'Valid final hour meter required'
            });
        }

        const equipment = await Equipment.findOne({
            nfcCode: req.params.nfcCode,
            active: true
        });

        if (!equipment) {
            return res.status(404).json({
                message: 'Equipment not found'
            });
        }

        const usage = await EquipmentUsage.findOne({
            equipmentId: equipment._id,
            status: 'IN_PROGRESS'
        });

        if (!usage) {
            return res.status(404).json({
                message: 'No active usage found'
            });
        }

        if (String(usage.operatorId) !== String(req.userId)) {
            return res.status(403).json({
                message: 'Only the operator can finish this usage'
            });
        }

        if (hoursEnd < usage.hoursStart) {
            return res.status(400).json({
                message: 'Final meter cannot be lower than initial meter'
            });
        }

        const updated = await EquipmentUsage.findOneAndUpdate(
            {
                _id: usage._id,
                status: 'IN_PROGRESS'
            },
            {
                $set: {
                    endTime: new Date(),
                    hoursEnd,
                    status: 'PENDING_INSPECTION'
                }
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(409).json({
                message: 'Usage was already updated'
            });
        }

        res.json({
            message: 'Usage finished. Inspection required.',
            usage: updated,
            totalEngineHours: updated.hoursEnd - updated.hoursStart
        });

    } catch (error) {
        res.status(500).json({
            message: 'Failed to finish equipment usage'
        });
    }
});

module.exports = router;
