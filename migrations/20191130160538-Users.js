'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {

    return queryInterface.createTable(
      'users',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        email: {
          type: Sequelize.STRING,
          unique: true,
        },
        name: Sequelize.STRING,
        tel: {
          type: Sequelize.STRING,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE
        },
        updatedAt: {
          type: Sequelize.DATE
        },
      },
      {
        engine: 'InnoDB',                     // default: 'InnoDB'
        charset: 'latin1',                    // default: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('users')
  }
};
