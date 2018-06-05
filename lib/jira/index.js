const bodyParser = require('body-parser')
const express = require('express')
const path = require('path')

const connect = require('./connect')
const install = require('./install')

module.exports = (robot) => {
  const router = robot.route('/jira')

  router.use(bodyParser.json())

  router.get('/atlassian-connect.json', connect)

  // Set up event handlers
  router.post('/events/installed', install)

  const frontend = express()
  frontend.set('view engine', 'hbs');
  frontend.set('views', path.join(__dirname, '..', '..', 'views'));

  frontend.get('/pages/permissions', (req, res) => {
    res.render('permissions.hbs')
  })

  router.use(frontend)
}
