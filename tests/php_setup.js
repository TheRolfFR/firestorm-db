const fs = require('fs').promises
const fse = require('fs-extra')
const path = require('path')
const os = require('os')
const glob = require("glob")
const copy = require('recursive-copy')
const child_process = require('child_process')

const PORT = 8000

const copyProm = (srcDir, destDir) => {
  return fs.copyFile(srcDir, destDir)
}

const globProm = (pattern) => {
  return new Promise((resolve, reject) => {
    glob(pattern, (err, res) => {
      if(err) reject(err)
      else resolve(res)
    })
  })
}

function execProm(cmd) {
  return new Promise((resolve) => {
   child_process.exec(cmd, (error, stdout, stderr) => {
    if (error) {
     console.warn(error);
    }
    resolve(stdout? stdout : stderr);
   }).unref();
  });
 }

console.log('Setupping PHP files...')
console.log('Creating tmp folder...')

async function setup_php() {
  // create tmp folder for PHP
  let tmpfolder
  child_process.execSync('rm -rf /tmp/php-*')
  
  await fs.mkdtemp(path.join(os.tmpdir(), 'php-'))
    .then((folder) => {
      tmpfolder = folder
      console.log(`Created ${tmpfolder}`)

      console.log('Moving PHP folder + Checking test php files + Creating files folder + Checking test databases...')
      return Promise.all([
        copy(path.join(process.cwd(), 'php'), tmpfolder),
        globProm(path.join(process.cwd(), 'tests', '*.php')),
        fs.mkdir(path.join(tmpfolder, 'files')),
        globProm(path.join(process.cwd(), 'tests', '*.json'))
      ])
    })
    .then((results) => {
      const glob_php = results[1]
      const glob_json = results[3]
      console.log('Copying php test files + test databases...')
      // console.log(glob_php, glob_json)

      const php_prom = glob_php.map(from => {
        const filename = path.basename(from)
        const to = path.join(tmpfolder, filename)
        console.log(`Copying ${filename}...`)

        return copyProm(from, to)
      })
      const json_prom = glob_json.map(from => {
        const filename = path.basename(from)
        console.log(`Copying ${filename}...`)
        const to = path.join(tmpfolder, 'files', filename)

        return copy(from, to)
      })
      return Promise.all([...php_prom, ...json_prom])
    })
    .then(async () => {
      // console.log(await (globProm(path.join(tmpfolder, '/**/*'))))
      const php_server_command = `sh tests/php_server_start.sh ${tmpfolder} ${PORT}`
      console.log('Starting php server with command "' + php_server_command + '"')
      const args = php_server_command.split(' ')
      const command = args.shift()

      child_process.spawn(command, args,{ stdio: 'ignore', detached: true }).unref()
    })
    .catch((err) => {
      console.trace(err)
      process.exit(1)
    })  
}

setup_php()
