const bodyParser = require('body-parser')
const express = require('express')
const path = require('path')
const sslify = require('express-sslify')

function getFrontendApp () {
  const frontend = express()
  frontend.use(bodyParser.urlencoded({ extended: false }))
  frontend.use(bodyParser.json())

  frontend.set('view engine', 'hbs')
  frontend.set('views', path.join(__dirname, '..', 'views'))

  frontend.use('/public/css-reset', express.static(path.join(__dirname, '..', 'node_modules/@atlaskit/css-reset/dist')))
  frontend.use('/public/atlassian-ui-kit', express.static(path.join(__dirname, '..', 'node_modules/@atlaskit/reduced-ui-pack/dist')))

  frontend.post('/permissions', (req, res) => {
    res.sendStatus(200)
  })

  frontend.get('/permissions', (req, res) => {
    res.render('permissions.hbs', {
      host: req.query.xdm_e
    })
  })

  return frontend
}

module.exports = (robot) => {
  const app = robot.route('/pages')

  if (process.env.FORCE_HTTPS) {
    app.use(sslify.HTTPS({ trustProtoHeader: true }))
  }

  app.use(getFrontendApp())
}
