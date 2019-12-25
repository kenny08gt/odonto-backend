'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    /*
      Add altering commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.createTable('users', { id: Sequelize.INTEGER });
    */
    return queryInterface.createTable(
      'seats',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        column: Sequelize.INTEGER,
        row: Sequelize.STRING,
        section: Sequelize.STRING,
        course: Sequelize.STRING,
        state: Sequelize.INTEGER,
        precio: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        name: {
          type: Sequelize.STRING,
          allowNull: true
        },
        register_number: {
          type: Sequelize.STRING,
          allowNull: true
        },//colegiado o carnet,
        university: {
          type: Sequelize.STRING,
          allowNull: true
        },
        no_document: {
          type: Sequelize.STRING,
          allowNull: true
        },
        transaction: {
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
        uniqueKeys: {
          actions_unique: {
            fields: ['column', 'row', 'section', 'course']
          }
        }
      },
      {
        engine: 'InnoDB',                     // default: 'InnoDB'
        charset: 'latin1',                    // default: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    /*
      Add reverting commands here.
      Return a promise to correctly handle asynchronicity.

      Example:
      return queryInterface.dropTable('users');
    */
    return queryInterface.dropTable('seats')
  }
};
