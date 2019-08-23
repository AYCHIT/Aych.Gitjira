const parseSmartCommit = require('./smart-commit')
const { getJiraId } = require('../jira/util/id')

async function getLastCommit (context, issueKeys) {
  const { github, payload: { ref } } = context
  const { data: { object: { sha } } } = await github.gitdata.getReference(context.repo({ ref: 'heads/' + ref }))
  const { data: { commit, html_url: url } } = await github.repos.getCommit(context.repo({ sha }))

  return {
    author: {
      name: commit.author.name
    },
    authorTimestamp: commit.author.date,
    displayId: sha.substring(0, 6),
    fileCount: 0,
    hash: sha,
    id: sha,
    issueKeys,
    message: commit.message,
    url,
    updateSequenceId: Date.now()
  }
}

module.exports = async (context) => {
  if (context.payload.ref_type !== 'branch') return {}

  const { ref, repository } = context.payload

  const { issueKeys } = parseSmartCommit(ref)

  if (!issueKeys) {
    return {}
  }

  const lastCommit = await getLastCommit(context, issueKeys)
  const prettyPrint = require("pretty-print")
  console.log(`CONTEXT: ${prettyPrint(context)}`)


  return {
    data: {
      id: repository.id,
      name: repository.full_name,
      url: repository.html_url,
      branches: [
        {
          createPullRequestUrl: `${repository.html_url}/pull/new/${ref}`,
          lastCommit,
          id: getJiraId(ref),
          issueKeys,
          name: ref,
          url: `${repository.html_url}/tree/${ref}`,
          updateSequenceId: Date.now()
        }
      ],
      updateSequenceId: Date.now()
    }
  }
}
