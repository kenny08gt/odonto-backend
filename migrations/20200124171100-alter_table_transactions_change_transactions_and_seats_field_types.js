'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */

    return Promise.all([
      queryInterface.changeColumn(
        'transactions',
        'seats',
        {
          type: Sequelize.TEXT('long')
        }
      ),
      queryInterface.changeColumn(
        'transactions',
        'transaction_raw',
        {
          type: Sequelize.TEXT('long'),
          allowNull: true
        }
      )]);
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return Promise.all([
      queryInterface.changeColumn(
        'transactions',
        'seats',
        {
          type: Sequelize.STRING
        }
      ),
      queryInterface.changeColumn(
        'transactions',
        'transaction_raw',
        {
          type: Sequelize.STRING,
          allowNull: true
        }

      )
    ]);
  }
};
