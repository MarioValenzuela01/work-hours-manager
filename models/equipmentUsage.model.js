
const mongoose = require('mongoose');

const equipmentUsageSchema = new mongoose.Schema({
    equipmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipment',
        required: true
    },

    operatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    operatorName: {
        type: String,
        required: true
    },

    startTime: {
        type: Date,
        required: true
    },

    endTime: {
        type: Date,
        default: null
    },

    hoursStart: {
        type: Number,
        required: true,
        min: 0
    },

    hoursEnd: {
        type: Number,
        default: null,
        min: 0
    },

    status: {
        type: String,
        enum: [
            'IN_PROGRESS',
            'PENDING_INSPECTION',
            'COMPLETED'
        ],
        default: 'IN_PROGRESS'
    },

    inspection: {
        checklist: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        fluids: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        commentsByItem: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        generalComments: {
            type: String,
            default: ''
        },
        completedAt: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Solo una sesión activa o pendiente por tractor.
// COMPLETED no bloquea nuevos usos.
equipmentUsageSchema.index(
    { equipmentId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: {
                $in: ['IN_PROGRESS', 'PENDING_INSPECTION']
            }
        }
    }
);

module.exports = mongoose.model(
    'EquipmentUsage',
    equipmentUsageSchema
);
