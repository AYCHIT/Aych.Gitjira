const transformPush = require('../transforms/push')

module.exports = async (context) => {
  const usernames = context.payload.commits.reduce((usernames, commit) => ([
    ...usernames,
    commit.author.username
  ]), [])

  const authorMap = (await Promise.all(usernames.map(async username => await context.github.users.getForUser({ username }))))
    .map(response => response.data)
    .reduce((authors, author) => ({
      ...authors,
      [author.login]: author
    }), {})

  const jiraPayload = transformPush(context.payload, authorMap)

  if (jiraPayload) {
    await context.jira.devinfo.updateRepository(jiraPayload)
  }
}
