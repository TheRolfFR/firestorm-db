const chai = require('chai')
const { expect } = chai

const firestorm = require('../index')

const path = require('path')
const fs = require('fs')
const { randomBytes } = require('crypto')

const ADDRESS = 'http://127.0.0.1:8000/'
const TOKEN = 'NeverGonnaGiveYouUp'

const DATABASE_NAME = 'base'
const DATABASE_FILE = path.join(__dirname, 'base.json')

console.log('Testing at address ' + ADDRESS + ' with token ' + TOKEN)

describe('Wrapper informations', () => {
  it('binds good address', function () {
    firestorm.address(ADDRESS)

    const actual = firestorm.address()
    expect(actual).to.equal(ADDRESS, 'Incorrect address bind')
  })
  it('binds good token', function () {
    firestorm.token(TOKEN)

    const actual = firestorm.token()
    expect(actual).to.equal(TOKEN, 'Incorrect token bind')
  })
})

let base // = undefined
let content

describe('GET operations', () => {
  before(() => {
    base = firestorm.collection(DATABASE_NAME)
  })

  content = JSON.parse(fs.readFileSync(DATABASE_FILE).toString())

  describe('read_raw()', () => {
    it('fails if table not found', (done) => {
      firestorm.collection('unknown').read_raw()
        .then(() => done(new Error('Request should not fullfill')))
        .catch((err) => {
          if('response' in err && err.response.status == 404) { done(); return }
          done(new Error('Should return 404'))
        })
    })

    it('returns the exact content of the file', (done) => {
      base.read_raw()
        .then(res => {
          Object.keys(res).forEach(key => delete res[key][firestorm.ID_FIELD])
          expect(res).deep.equals(content, 'Content different')
          done()
        })
        .catch(err => done(err))
    })
  });

  describe('get(key)', () => {
    it('string parameter should return the correct value', (done) => {
      base.get('0')
        .then(res => {
          delete res[firestorm.ID_FIELD] // normal, get gives an id field
          expect(res).deep.equals(content[0], 'Content different')
          done()
        })
        .catch(err => done(err))
    })
  
    it('number parameter should return the correct value', (done) => {
      base.get(0)
        .then(res => {
          delete res[firestorm.ID_FIELD] // normal, get gives an id field
          expect(res).deep.equals(content[0], 'Content different')
          done()
        })
        .catch(err => done(err))
    })

    it('string and number parameters gives the same result', (done) => {
      const ID = 1
      Promise.all([base.get(ID), base.get(String(ID))])
        .then((results) => {
          expect(results[0]).deep.equals(results[1], 'Content different')
          done()
        })
        .catch(err => done(err))
    });
  })

  describe('searchKeys(arrayKey)', () => {
    it('fails with incorrect parameters', (done) => {
      base.searchKeys(1,2,3)
        .then(() => {
          done(new Error('Parameter should be an array of string or number'))
        })
        .catch(err => {
          expect(err).to.equal('Incorrect keys')
          done()
        })
    })

    it('returns empty results when no found', (done) => {
      base.searchKeys([5, 7])
        .then((res) => { // expected []
          expect(res).to.be.a('array', 'Value should be an array')
          expect(res).to.have.lengthOf(0, 'Value should be empty array')
          done()
        })
        .catch(() => {
          done(new Error('Should not reject'))
        })
    })

    it('returns correct content', (done) => {
      base.searchKeys([0, 2])
        .then((res) => {
          res = res.map(el => { delete el[firestorm.ID_FIELD]; return el })
          const expected = [content[0], content[2]]

          expect(res).deep.equals(expected, 'Result content doesn\'t match')
          done()
        })
        .catch(() => {
          done(new Error('Should not reject'))
        })
    });
  })
})
