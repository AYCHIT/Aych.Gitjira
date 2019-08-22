const bodyParser = require('body-parser')
const express = require('express')
const path = require('path')
const session = require('cookie-session')
const csrf = require('csurf')
const Sentry = require('@sentry/node')

const oauth = require('./github-oauth')({
  githubClient: process.env.GITHUB_CLIENT_ID,
  githubSecret: process.env.GITHUB_CLIENT_SECRET,
  baseURL: process.env.APP_URL,
  loginURI: '/github/login',
  callbackURI: '/github/callback'
})

const getGitHubSetup = require('./get-github-setup')
const postGitHubSetup = require('./post-github-setup')
const getGitHubConfiguration = require('./get-github-configuration')
const postGitHubConfiguration = require('./post-github-configuration')
const listGitHubInstallations = require('./list-github-installations')
const getGitHubSubscriptions = require('./get-github-subscriptions')
const deleteGitHubSubscription = require('./delete-github-subscription')
const getGitHubLogin = require('./get-github-login')
const getJiraConfiguration = require('./get-jira-configuration')
const deleteJiraConfiguration = require('./delete-jira-configuration')

const getGithubClientMiddleware = require('./github-client-middleware')
const verifyJiraMiddleware = require('./verify-jira-middleware')

const retrySync = require('./retry-sync')

const api = require('../api')
const logMiddleware = require('../middleware/log-middleware')

module.exports = (appTokenGenerator) => {
  const githubClientMiddleware = getGithubClientMiddleware(appTokenGenerator)

  const app = express()
  const rootPath = path.join(__dirname, '..', '..')

  // The request handler must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler())

  // Parse URL-encoded bodies for Jira configuration requests
  app.use(bodyParser.urlencoded({ extended: false }))

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', true)
  }

  app.use(session({
    keys: [process.env.GITHUB_CLIENT_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    signed: true
  }))

  app.use(logMiddleware)
  app.use(githubClientMiddleware)

  app.use('/api', api)

  app.set('view engine', 'hbs')
  app.set('views', path.join(rootPath, 'views'))

  app.use('/public', express.static(path.join(rootPath, 'static')))
  app.use('/public/css-reset', express.static(path.join(rootPath, 'node_modules/@atlaskit/css-reset/dist')))
  app.use('/public/primer', express.static(path.join(rootPath, 'node_modules/primer/build')))
  app.use('/public/atlassian-ui-kit', express.static(path.join(rootPath, 'node_modules/@atlaskit/reduced-ui-pack/dist')))

  // setup simple middleware to store queryParams
  // so we can access them in /github/configuration later
  app.use(['/github/setup', '/github/redirect', '/github/configuration', '/github/installations'], (req, res, next) => {
    if (req._parsedUrl.search) {
      req.session.queryParams = req._parsedUrl.search
      next()
    } else {
      next()
    }
  })

  // setup route middlewares
  const csrfProtection = process.env.NODE_ENV === 'test'
    ? csrf({ ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'] })
    : csrf()

  app.get('/github/redirect', verifyJiraMiddleware, getGitHubLogin)

  app.get('/github/setup', csrfProtection, getGitHubSetup)
  app.post('/github/setup', csrfProtection, postGitHubSetup)

  app.get('/github/configuration', csrfProtection, getGitHubConfiguration)
  app.post('/github/configuration', csrfProtection, postGitHubConfiguration)

  app.get('/github/installations', csrfProtection, listGitHubInstallations)
  app.get('/github/subscriptions/:installationId', csrfProtection, getGitHubSubscriptions)
  app.post('/github/subscription', csrfProtection, deleteGitHubSubscription)

  app.get('/jira/configuration', csrfProtection, verifyJiraMiddleware, getJiraConfiguration)
  app.delete('/jira/configuration', verifyJiraMiddleware, deleteJiraConfiguration)
  app.post('/jira/sync', csrfProtection, verifyJiraMiddleware, retrySync)

  app.get('/', async (req, res, next) => {
    const { data: info } = (await res.locals.client.apps.get({}))

    res.redirect(info.external_url)
  })

  const addSentryContext = async (err, req, res, next) => {
    Sentry.withScope(async scope => {
      const jiraHost = (req && req.session && req.session.jiraHost) || (req && req.query && req.query.xdm_e)
      if (jiraHost) {
        scope.setTag('jiraHost', jiraHost)
      }

      if (req.body) {
        Sentry.setExtra('Body', req.body)
      }

      next(err)
    })
  }

  if (process.env.EXCEPTION_DEBUG_MODE || process.env.NODE_ENV === 'development') {
    app.get('/boom', (req, res, next) => { 'frontend boom'.nopenope() })
    app.post('/boom', (req, res, next) => { 'frontend boom'.nopenope() })
  }

  app.use(addSentryContext)
  // The error handler must come after controllers and before other error middleware
  app.use(Sentry.Handlers.errorHandler())

  const catchErrors = async (err, req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
      return next(err)
    }

    const errorCodes = {
      'Unauthorized': 401,
      'Forbidden': 403,
      'Not Found': 404
    }

    return res.status(errorCodes[err.message] || 400).render('github-error.hbs', {
      title: `GitHub + Jira integration`
    })
  }

  app.use(catchErrors)

  oauth.addRoutes(app)
  oauth.on('token', function (token, res, tokenRes, req) {
    req.session.githubToken = token.access_token
    let route
    if (req.session.queryParams) {
      route = ('/github/configuration' + req.session.queryParams)
    } else {
      route = ('/github/configuration')
    }
    return res.redirect(route)
  })

  return app
}
