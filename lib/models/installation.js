const Sequelize = require('sequelize')
const EncryptedField = require('sequelize-encrypted')

if (!process.env.STORAGE_SECRET) {
  throw new Error('STORAGE_SECRET is not defined.')
}

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET)

module.exports = class Installation extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init({
      jiraHost: DataTypes.STRING,
      secrets: encrypted.vault('secrets'),
      sharedSecret: encrypted.field('sharedSecret', {
        type: DataTypes.STRING,
        allowNull: false
      }),
      clientKey: encrypted.field('clientKey', {
        type: DataTypes.STRING,
        allowNull: false
      }),
      enabled: Sequelize.BOOLEAN
    }, { sequelize })
  }

  static async getForClientKey (clientKey) {
    return Installation.findOne({
      where: {
        clientKey: clientKey
      }
    })
  }

  static async getForHost (host) {
    return Installation.findOne({
      where: {
        jiraHost: host,
        enabled: true
      }
    })
  }

  async enable () {
    await this.update({
      enabled: true
    })
  }

  async disable () {
    await this.update({
      enabled: false
    })
  }

  static async install (payload) {
    const [installation, created] = await Installation.findOrCreate({
      where: {
        clientKey: payload.clientKey
      },
      defaults: {
        jiraHost: payload.host,
        sharedSecret: payload.sharedSecret
      }
    })

    if (!created) {
      await installation.update({
        sharedSecret: payload.sharedSecret,
        enabled: true
      })
    }

    return installation
  }

  static async uninstall (payload) {
    return Installation.destroy({
      where: {
        clientKey: payload.clientKey
      }
    })
  }
}
