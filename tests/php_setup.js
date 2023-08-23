const fs = require('fs').promises
const { existsSync } = require('fs')
const fse = require('fs-extra')
const path = require('path')
const os = require('os')
const glob = require("glob")
const copy = require('recursive-copy')
const child_process = require('child_process')
const net = require("net")

const PHP_SERVER_START_DELAY = 2000
const PORT = 8000

const globProm = (pattern) => {
  return new Promise((resolve, reject) => {
    glob(pattern, (err, res) => {
      if(err) reject(err)
      else resolve(res)
    })
  })
}

function execProm(cmd) {
  return new Promise((resolve, reject) => {
   child_process.exec(cmd, (error, stdout, stderr) => {
    if (error) {
      reject(error);
      return;
    }
    if (stderr) {
      reject(stderr);
      return;
    }

    resolve(stdout);
   });
  });
 }

/**
 * 
 * @param {Number} port port number
 * @returns {Promise<void>} resolves if opened
 */
function isPortOpen(port) {
  return new Promise((resolve, reject) => {
    let s = net.createServer()
    s.once("error", (err) => {
      s.close()
      if (err["code"] == "EADDRINUSE") {
        reject("Port " + port + ": " + err["code"])
      } else {
        resolve() // or throw error!!
      }
    })
    s.once("listening", () => {
      resolve()
      s.close()
    })
    s.listen(port)
  })
}

async function setup_php(nic_ip='127.0.0.1', port=PORT) {
  // create tmp folder for PHP
  let tmpFolder
  child_process.execSync('rm -rf /tmp/php-*')
  
  console.log("Verifying port opened...")
  return isPortOpen(port)
    .then(() => {
      console.log('Creating tmp folder...')
      return fs.mkdtemp(path.join(os.tmpdir(), 'php-'))
    })
    .then((folder) => {
      tmpFolder = folder
      console.log(`Created ${tmpFolder}`)
      console.log('Setup of PHP files...')

      console.log('Moving PHP folder + Checking test php files + Creating files folder + Checking test databases...')
      return Promise.all([
        globProm(path.join(process.cwd(), 'src/php', '**/*.php')),
        fs.mkdir(path.join(tmpFolder, 'files')),
        globProm(path.join(process.cwd(), 'tests', '*.json'))
      ])
    })
    .then((results) => {
      const glob_php_files = results[0]

      const php_symbolic_link = glob_php_files.map(from => {
        const endPath = path.relative(path.join(process.cwd(), 'src', 'php'), from)
        const to = path.join(tmpFolder, endPath)
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
        const to = path.join(tmpFolder, 'files', filename)
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
        const to = path.join(tmpFolder, filename)
        console.log(`Linking test ${filename}...`)

        let prom = Promise.resolve()
        if(existsSync(to)) prom = fs.unlink(to)
        
        return prom.then(() => fs.symlink(from, to, 'file')).then(res => {
          console.log(`Linked ${filename}`)
          return res
        })
      })

      return Promise.all(php_prom)
    })
    .then(async () => {
      // console.log(await (globProm(path.join(tmpFolder, '/**/*'))))
      const php_server_command = `sh tests/php_server_start.sh ${tmpFolder} ${nic_ip} ${port}`
      console.log('Starting php server with command "' + php_server_command + '"')
      const args = php_server_command.split(' ')
      const command = args.shift()

      child_process.spawn(command, args,{ stdio: 'ignore', detached: true }).unref()

      console.log(`Waiting ${PHP_SERVER_START_DELAY}ms for the server to start...`)
      return pause(PHP_SERVER_START_DELAY)
    })
    .then(() => {
      return Promise.resolve([nic_ip, port])
    })
}

/**
 * Promisify setTimeout
 * @param {Number} ms Timeout in ms 
 * @param {Function} cb callback function after timeout
 * @param  {...any} args Optional return arguments
 * @returns {Promise<any>}
 */
const pause = (ms, cb, ...args) =>
{
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
}

// export to use in JS
module.exports = setup_php;

if (typeof require !== "undefined" && require.main === module) {
  (async () => {
    let [_nic_ip, _port] = await setup_php()
    process.exit(0)
  })().catch(err => {
    console.trace(err)
    process.exit(1)
  })
}
