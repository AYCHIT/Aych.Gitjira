const { Installation } = require('../../models')

/*
 * This will need to be replaced with a call out to a database
 * of shared secrets for Jira. Pending infrastructure, we use a
 * simple associative array for testing.
 */
module.exports = async (config, repository) => {
  const installation = await Installation.getForHost(config.jira)

  return {
    secret: installation.sharedSecret,
    baseURL: installation.jiraHost
  }
}
