require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI is missing in .env file');
    process.exit(1);
}

const createAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Mongo Connected');

        const adminUsername = 'admin';
        const adminPassword = 'Conectividad.1';

        const existingAdmin = await User.findOne({ username: adminUsername });
        if (existingAdmin) {
            console.log(`Admin user '${adminUsername}' already exists. Updating role to admin just in case.`);
            existingAdmin.role = 'admin';
            existingAdmin.passwordHash = bcrypt.hashSync(adminPassword, 10);
            await existingAdmin.save();
            console.log('Admin user updated successfully.');
            process.exit(0);
        }

        const passwordHash = bcrypt.hashSync(adminPassword, 10);

        const adminUser = new User({
            username: adminUsername,
            passwordHash,
            role: 'admin'
        });

        await adminUser.save();
        console.log(`✅ Admin user '${adminUsername}' created successfully.`);

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdmin();
