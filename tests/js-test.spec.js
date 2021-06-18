const chai = require('chai')
const { expect } = chai

const firestorm = require('../index')

const path = require('path')
const fs = require('fs')

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
  before(async () => {
    base = firestorm.collection(DATABASE_NAME)

    const raw_content = fs.readFileSync(DATABASE_FILE).toString()
    content = JSON.parse(raw_content)

    console.log(content)

    // reset the content of the database
    await base.write_raw(content).catch(err => console.error(err))
  })


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

  describe('search(searchOptions)', () => {
    // [criteria, field, value, idsfound]
    const test_array = [
      ['!=', 'age' , 13, ['0', '2']],
      ['==', 'age', 13, ['1']],
      ['==', 'age', 25, []],
      ['>=', 'age', 0, ['0', '1', '2']],
      ['>=', 'age', 50, []],
      ['<=', 'age', 23, ['0', '1']],
      ['<=', 'age', 12, []],
      ['>', 'age', 23, ['2']],
      ['>', 'age', 45, []],
      ['<', 'age', 45, ['0','1']],
      ['<', 'age', 13, []],
      ['in', 'age', [23, 13], ['0', '1']],
      ['in', 'age', [21, 19], []],
      ['includes', 'name', 'Joy', ['0', '1', '2']],
      ['includes', 'name', 'Bobby', []],
      ['startsWith', 'name', 'Joy', ['0', '1']],
      ['startsWith', 'name', 'TheRolf', []],
      ['endsWith', 'name', 'Harper', ['0', '2']],
      ['endsWith', 'name', 'Wick', []],
      ['array-contains', 'qualities', 'strong', ['0', '1']],
      ['array-contains', 'qualities', 'handsome', []],
      ['array-contains-any', 'qualities', ['intelligent', 'calm'], ['0', '2']],
      ['array-contains-any', 'qualities', ['fast', 'flying'], []],
      ['array-length-eq', 'friends', 6, ['0']],
      ['array-length-eq', 'friends', 2, []],
      ['array-length-df', 'friends', 6, ['1', '2']],
      ['array-length-lt', 'friends', 6, ['1', '2']],
      ['array-length-lt', 'friends', 1, []],
      ['array-length-gt', 'friends', 1, ['0', '1']],
      ['array-length-gt', 'friends', 6, []],
      ['array-length-le', 'friends', 6, ['0', '1', '2']],
      ['array-length-le', 'friends', 1, ['2']],
      ['array-length-ge', 'friends', 3, ['0', '1']],
      ['array-length-ge', 'friends', 7, []],
    ]

    test_array.forEach(test_item => {
      const criteria = test_item[0]
      const field = test_item[1]
      const value = test_item[2]
      const ids_found = test_item[3]
      it(`${criteria} criteria${ids_found.length == 0 ? ' (empty result)' : ''}`, (done) => {
        base.search([{
          criteria: criteria,
          field: field,
          value: value
        }]).then((res) => {
          expect(res).to.be.a('array', 'Search result must be an array')
          expect(res).to.have.lengthOf(ids_found.length, 'Expected result have not correct length')
          expect(res.map(el => el[firestorm.ID_FIELD])).to.deep.equal(ids_found, 'Incorrect result search')
          done()
        }).catch(err => {
          console.error(err)
          done(err)
        })
      })
    })
  })
})

describe('PUT operations', () => {
  
})
