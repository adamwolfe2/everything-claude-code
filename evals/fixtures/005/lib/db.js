// CommonJS + a flat JSON file on purpose — this fixture must run with plain
// `node`, no build step, no real database, so the agent can actually execute
// it end to end.
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')

function read() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2) + '\n')
}

module.exports = { DB_PATH, read, write }
