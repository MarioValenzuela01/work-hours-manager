const mongoose = require('mongoose');

async function checkPermissions() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: 'workhours_nfc_dev'
        });

        const result = await mongoose.connection.db.command({
            connectionStatus: 1,
            showPrivileges: true
        });

        console.log('Connected database:', mongoose.connection.name);
        console.log('Authenticated roles:');
        console.log(JSON.stringify(
            result.authInfo.authenticatedUserRoles,
            null,
            2
        ));

        console.log('Privileges:');
        console.log(JSON.stringify(
            result.authInfo.authenticatedUserPrivileges,
            null,
            2
        ));
    } catch (error) {
        console.error('Permission check:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkPermissions();
