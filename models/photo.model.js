const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },

    storedName: {
      type: String,
      required: true,
      trim: true,
    },

    physicalPath: {
      type: String,
      required: true,
    },

    relativePath: {
      type: String,
      required: true,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    uploadedByName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
      trim: true,
    },

    category: {
      type: String,
      default: '',
      trim: true,
    },

    asset: {
      type: String,
      default: '',
      trim: true,
    },

    workOrder: {
      type: String,
      default: '',
      trim: true,
    },

    location: {
      type: String,
      default: '',
      trim: true,
    },

    gps: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    size: {
      type: Number,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    tags: {
      type: [String],
      default: [],
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Photo', photoSchema);