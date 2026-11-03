
const mongoose = require('mongoose');
const Equipment = require('../models/equipment.model');

async function seedEquipment() {
    try {
        if (
            process.env.NODE_ENV !== 'development' ||
            process.env.MONGO_DB_NAME !== 'workhours_nfc_dev'
        ) {
            throw new Error('Development environment required');
        }

        await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'workhours_nfc_dev'
        });

        if (mongoose.connection.name !== 'workhours_nfc_dev') {
            throw new Error('Incorrect database');
        }

        const equipment = await Equipment.findOneAndUpdate(
            { code: 'TRACTOR-001' },
            {
                $setOnInsert: {
                    code: 'TRACTOR-001',
                    name: 'John Deere 4052R',
                    brand: 'John Deere',
                    model: '4052R',
                    nfcCode: 'tractor-001',
                    active: true
                }
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        console.log('Equipment ready:');
        console.log({
            code: equipment.code,
            name: equipment.name,
            nfcCode: equipment.nfcCode
        });

    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedEquipment();
