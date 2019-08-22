const JWT = require('atlassian-jwt')
const { Installation } = require('../models')

module.exports = async (req, res, next) => {
  if (!req.session.githubToken || !req.session.jiraHost) {
    return next(new Error('GitHub token or jiraHost missing'))
  }

  const { github, client, isAdmin } = res.locals

  async function getInstallationsWithAdmin ({installations, login}) {
    const installationsWithAdmin = []
    for (const installation of installations) {
      // See if we can get the membership for this user
      const admin = await isAdmin({
        org: installation.account.login,
        username: login,
        type: installation.target_type
      })
      const hasMemberPermission = installation.permissions.members === 'read'
      installationsWithAdmin.push({...installation, admin, hasMemberPermission})
    }
    return installationsWithAdmin
  }

  if (req.query.jwt && req.query.xdm_e) {
    const { jwt: token, xdm_e: jiraHost } = req.query
    const { data: { login } } = await github.users.get()
    try {
      // we can get the jira client Key from the JWT's `iss` property
      // so we'll decode the JWT here and verify it's the right key before continuing
      const installation = await Installation.getForHost(jiraHost)
      const { iss: clientKey } = JWT.decode(token, installation.sharedSecret)

      const { data: { installations } } = (await github.users.getInstallations({}))
      const installationsWithAdmin = await getInstallationsWithAdmin({installations, login})
      const { data: info } = (await client.apps.get({}))
      return res.render('github-configuration.hbs', {
        csrfToken: req.csrfToken(),
        installations: installationsWithAdmin,
        info,
        jiraHost,
        clientKey
      })
    } catch (err) {
      // If we get here, there was either a problem decoding the JWT
      // or getting the data we need from GitHub, so we'll show the user an error.
      req.log.error(err)
      return next(err)
    }
  } else {
    return res.redirect(
      `${req.session.jiraHost}/plugins/servlet/upm/marketplace/plugins/com.github.integration.production`
    )
  }
}
