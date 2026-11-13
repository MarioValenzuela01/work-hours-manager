
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Cornerstone Work Hours Manager API",
            version: "1.0.0",
            description: "API for equipment usage, NFC tracking and inspections."
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local development"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        },
        security: [
            { bearerAuth: [] }
        ]
    },
    apis: [
        "./docs/*.yaml"
    ]
};

module.exports = swaggerJsdoc(options);
