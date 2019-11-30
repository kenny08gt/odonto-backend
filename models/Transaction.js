const Sequelize = require('sequelize');

module.exports = () => {
    return {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
        },
        user_id: Sequelize.INTEGER,
        transaction: Sequelize.STRING,
        state: Sequelize.INTEGER,
        seats: {
            type: Sequelize.STRING,
            get: function () {
                var seats = this.getDataValue('seats');
                return JSON.parse(seats);
            },
        }
    }
};
