'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Installations', 'clientKey', {
      type: DataTypes.STRING,
      allowNull: false
    })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn('Installations', 'clientKey')
  }
};
