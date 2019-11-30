const Sequelize = require('sequelize');

module.exports = () => {
    return {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
        },
        email: {
            type: Sequelize.STRING,
            validate: {
                isEmail: true,
            }
        },
        name: Sequelize.STRING,
        tel: Sequelize.STRING,
    }
};
