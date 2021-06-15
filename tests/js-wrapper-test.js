const fs = require('fs').promises
const fse = require('fs-extra')
const path = require('path')
const os = require('os')
const glob = require("glob")
const copy = require('recursive-copy')

const moveProm = (srcDir, destDir) => {
  return new Promise((resolve, reject) => {
    fse.moveSync(srcDir, destDir, function(err) {
      if(err) reject(err)
      else resolve()
    })
  })
}

const globProm = (pattern) => {
  return new Promise((resolve, reject) => {
    glob(pattern, (err, res) => {
      if(err) reject(err)
      else resolve(res)
    })
  })
}

console.log('Setupping PHP files...')
console.log('Creating tmp folder...')

async function setup_php() {
  // create tmp folder for PHP
  let tmpfolder
  await fs.mkdtemp(path.join(os.tmpdir(), 'php-'))
    .then((folder) => {
      tmpfolder = folder
      console.log(`Created ${tmpfolder}`)
      console.log('Moving PHP folder...')
      return copy(path.join(process.cwd(), 'php'), tmpfolder)
    })
    .then(() => {
      console.log('Checking test php files...')
      return globProm(path.join(process.cwd(), 'tests', '*'))
    })
    .then((glob) => {
      console.log(glob)
      console.log('Copying config and tokens test files...')
      return Promise.all([
        copy(path.join(process.cwd(), 'tests', 'config.php'), tmpfolder),
        copy(path.join(process.cwd(), 'tests', 'tokens.php'), tmpfolder)
      ])
    })
    .then(() => {
      return fs.mkdir(path.join(tmpfolder, 'files'))
    })
    .then(() => {
      console.log('Copying test database...')
      return copy(path.join(process.cwd(), 'tests', 'base.json'), path.join(tmpfolder, 'files'))
    })
    .then(() => {
      return globProm(path.join(tmpfolder, '/**/*'))
    })
    .then((results) => {
      console.log(results)
    })
    .catch((err) => {
      console.trace(err)
      process.exit(1)
    })  
}

setup_php()
