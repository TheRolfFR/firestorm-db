const fs = require('fs').promises
const { existsSync } = require('fs')
const fse = require('fs-extra')
const path = require('path')
const os = require('os')
const glob = require("glob")
const copy = require('recursive-copy')
const child_process = require('child_process')

const PHP_SERVER_START_DELAY = 2000
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
        globProm(path.join(process.cwd(), 'php', '**/*.php')),
        fs.mkdir(path.join(tmpfolder, 'files')),
        globProm(path.join(process.cwd(), 'tests', '*.json'))
      ])
    })
    .then((results) => {
      const glob_php_files = results[0]

      const php_symbolic_link = glob_php_files.map(from => {
        const endPath = path.relative(path.join(process.cwd(), 'php'), from)
        const to = path.join(tmpfolder, endPath)
        console.log(`Linking ${endPath}...`)

        return fs.mkdir(path.dirname(to), { recursive: true }).then(() => {
          return fs.symlink(from, to, 'file')
        }).then(res => {
          console.log(`Linked ${endPath}`)
          return res
        })
      })
      const glob_json_files = results[2]
      console.log('Copying test databases...')

      const json_prom = glob_json_files.map(async from => {
        const filename = path.basename(from)
        console.log(`Copying ${filename}...`)
        const to = path.join(tmpfolder, 'files', filename)
        return copy(from, to).then(res => {
          console.log(`Copied ${filename}`)
          return res
        })
      })

      const get_test_php_files = globProm(path.join(process.cwd(), 'tests', '*.php'))

      return Promise.all([get_test_php_files, ...php_symbolic_link, ...json_prom])
    })
    .then(results => {
      console.log("Copying test php config files...")
      const glob_test_php_files = results[0]

      const php_prom = glob_test_php_files.map(from => {
        const filename = path.basename(from)
        const to = path.join(tmpfolder, filename)
        console.log(`Copying ${filename}...`)

        let prom = Promise.resolve()
        if(existsSync(to)) prom = fs.unlink(to)
        
        return prom.then(() => copyProm(from, to)).then(res => {
          console.log(`Copied ${filename}`)
          return res
        })
      })

      return Promise.all(php_prom)
    })
    .then(async () => {
      // console.log(await (globProm(path.join(tmpfolder, '/**/*'))))
      const php_server_command = `sh tests/php_server_start.sh ${tmpfolder} ${PORT}`
      console.log('Starting php server with command "' + php_server_command + '"')
      const args = php_server_command.split(' ')
      const command = args.shift()

      child_process.spawn(command, args,{ stdio: 'ignore', detached: true }).unref()

      console.log(`Waiting ${PHP_SERVER_START_DELAY}ms for the server to start...`)
      await pause(PHP_SERVER_START_DELAY)
    })
    .catch((err) => {
      console.trace(err)
      process.exit(1)
    })  
}

setup_php()

/**
 * Promisify setTimeout
 * @param {Number} ms Timeout in ms 
 * @param {Function} cb callback function after timeout
 * @param  {...any} args Optional return arguments
 * @returns {Promise<any>}
 */
const pause = (ms, cb, ...args) =>
  new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = !!cb ? await cb(...args) : undefined
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }, ms)
  })