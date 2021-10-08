const chai = require('chai')
const { expect } = chai

const firestorm = require('../index')

const path = require('path')
const fs = require('fs')

const ADDRESS = 'http://127.0.0.1:8000/'
const TOKEN = 'NeverGonnaGiveYouUp'

const HOUSE_DATABASE_NAME = 'house'
const HOUSE_DATABASE_FILE = path.join(__dirname, `${ HOUSE_DATABASE_NAME }.json`)

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

let houseCollection // = undefined
let base // = undefined
let content
let tmp

const resetDatabaseContent = async() => {
  // reset the content of the database
  await base.write_raw(content).catch(err => console.error(err))

  houseCollection = firestorm.collection(HOUSE_DATABASE_NAME)
  const raw_house = JSON.parse(fs.readFileSync(HOUSE_DATABASE_FILE).toString())
  await houseCollection.write_raw(raw_house)
}

describe('GET operations', () => {
  before(async () => {
    base = firestorm.collection(DATABASE_NAME)

    const raw_content = fs.readFileSync(DATABASE_FILE).toString()
    content = JSON.parse(raw_content)

    await resetDatabaseContent()
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
          done(err)
        })
      })
    })
  })

  describe('search(searchOptions, random)', () => {
    let uncorrect = [null, 'gg', ''] // undefined works because random becomes default parameter false, so false works too
      uncorrect.forEach((unco) => {
        it(`${JSON.stringify(unco)} seed rejects`, done => {
          base.search([{
            criteria: "includes",
            field: "name",
            value: ""
          }], unco).then(res => done(`got ${JSON.stringify(res)} value`))
          .catch(() => { done() })
        })
      })

    it('true seed succeeds', (done) => {
      base.search([{
        criteria: "includes",
        field: "name",
        value: ""
      }], true).then(_ => done())
      .catch(err => {
        console.error(err)
        done('Should not reject with error ' + JSON.stringify(err))
      })
    })

    it('Gives the same result for the same seed', (done) => {
      const seed = Date.now()
      const intents = new Array(20);
      Promise.all(intents.map(e => {
        return base.search([{
          criteria: "includes",
          field: "name",
          value: ""
        }], seed)
      })).then(results => {
        for(let i = 1; i < results.length; ++i) {
          expect(results[0]).to.be.deep.equal(results[i], 'Same seed gave different results')
        }
        done()
      }).catch(err => {
        done('Should not reject with error ' + JSON.stringify(err))
      })
    })
  })

  describe('select(selectOptions)', () => {
    it('requires a fields field', (done) => {
      base.select(undefined)
      .then((res) => {
        done('Did not expect it to success')
      }).catch(() => done())
    })
    describe('requires field to be a string array', () => {
      // all uncorrect values must catch
      let uncorrect = [undefined, null, false, 5, 12.5, 'gg', {toto: 'tata'}]
      uncorrect.forEach((unco) => {
        it(`${JSON.stringify(unco)} value`, done => {
          base.select({ fields: unco })
          .then(res => done(`got ${JSON.stringify(res)} value`))
          .catch(() => { done() })
        })
      })
    })
      
    describe('Empty array passes', () => {
      [[], {}].forEach(val => {
        it(`${JSON.stringify(val)} value`, done => {
          base.select({ fields: val })
          .then(() => { done() })
          .catch(err => { done(err) })
        })
      })
    })

    describe(`must accept only string arrays`, () => {
      // uncorrect arrays
      uncorrect = [undefined, null, false, 5, 12.5, {}]
      uncorrect.forEach(async (unco) => {
        it(`[${JSON.stringify(unco)}] value`, done => {
          base.select({ fields: [unco] })
          .then(() => done(`[${JSON.stringify(unco)}] value passed`))
          .catch(() => { done() })
        })
      })
    })

    it('Gives correct value', done => {
      const fields_chosen = ['name', 'age']
      Promise.all([base.read_raw(), base.select({ fields: fields_chosen})])
      .then(results => {
        let raw = results[0]
        Object.keys(raw).forEach(k => {
          Object.keys(raw[k]).forEach(el_k => {
            if(!fields_chosen.includes(el_k) || typeof raw[k][el_k] === 'function') {
              delete raw[k][el_k]
            }
          })
        })
        let selectResult = results[1]
        Object.keys(selectResult).forEach(k => {
          delete selectResult[k][firestorm.ID_FIELD]
        })

        expect(selectResult).to.be.deep.equal(raw, `contents are different`)
        done()
      })
      .catch(err => done(err))
    })
  })

  describe('random(max, seed, offset)', () => {
    it('requires no parameters', (done) => {
      base.random()
      .then((res) => {
        done()
      }).catch(() => done('Did not expect it to fail'))
    })
    it('passes with undefined parameters', (done) => {
      base.random(undefined, undefined, undefined)
      .then((res) => {
        done()
      }).catch(() => done('Did not expect it to fail'))
    })

    describe('requires max parameter to be an integer >= -1', () => {
      // all uncorrect values must catch
      let uncorrect = [null, false, 'gg', 5.5, -5, -2] // undefined works because max is the whole collection then
      uncorrect.forEach((unco) => {
        it(`${JSON.stringify(unco)} value`, done => {
          base.random(unco)
          .then(res => done(`got ${JSON.stringify(res)} value`))
          .catch(() => { done() })
        })
      })
    })

    describe('requires seed parameter to be an integer', () => {
      // all uncorrect values must catch
      let uncorrect = [null, false, 'gg', 5.5] // undefined works because then seed is automatic
      uncorrect.forEach((unco) => {
        it(`${JSON.stringify(unco)} value`, done => {
          base.random(5, unco)
          .then(res => done(`got ${JSON.stringify(res)} value`))
          .catch(() => { done() })
        })
      })
    })

    it('does not pass if offset but no seed', () => {
      base.random(5, undefined, 5)
      .then(res => done(`got ${JSON.stringify(res)} value`))
      .catch(() => done())
    })

    describe('requires offset parameter to be an integer >= 0', () => {
      // all uncorrect values must catch
      let uncorrect = [null, false, 'gg', 5.5, -1] // undefined works because then offset is 0
      uncorrect.forEach((unco) => {
        it(`${JSON.stringify(unco)} value`, done => {
          base.random(5, 69, unco)
          .then(res => done(`got ${JSON.stringify(res)} value`))
          .catch(() => { done() })
        })
      })
    })
  })
})

describe('PUT operations', () => {
  describe('write_raw operations', () => {
    it('Rejects when incorrect token', (done) => {
      firestorm.token('LetsGoToTheMall')
      
      base.write_raw({})
      .then(res => {
        done(res)
      }).catch(err => {
        if('response' in err && err.response.status == 403) { done(); return }
        done(new Error('Should return 403'))
      })
      .finally(() => {
        firestorm.token(TOKEN)
      })
    })


    describe('You must give him a correct value', () => {
      const incorrect_bodies = [undefined, null, false, 42, 6.9, 'ACDC', [1, 2, 3], ['I', 'will', 'find', 'you'], { '5': 'is' }]
      
      incorrect_bodies.forEach((body, index) => {
        it(`${JSON.stringify(body)} value rejects`, (done) => {
          base.write_raw(body)
            .then(res => {
              done(new Error(`Should not fullfill returning ${JSON.stringify(res) }`))
            })
            .catch(err => {
              if(index < 2) {
                expect(err).to.be.an('error')
                done()
              } else {
                if('response' in err && err.response.status == 400) { done(); return }
                done(new Error(`Should return 400 not ${ JSON.stringify(('response' in err && 'status' in err.response) ? err.response.status : err)}`))
              }
            })
        })
      })

      it('but it can write an empty content : {}', (done) => {
        base.write_raw({})
          .then(() => {
            done()
          })
          .catch(err => {
            console.trace(err)
            done(err)
          })
          .finally(async () => {
            await base.write_raw(content)
          })
      })
    })
  })

  describe('add operations', () => {
    it('must fail when not on an auto-key table', (done) => {
      houseCollection.add({
        room: 'Patio',
        size: 22.2,
        outdoor: true,
        furniture: ['table', 'chair', 'flowerpot']
      })
      .then(() => {
        done(new Error('This request should not fullfill'))
      })
      .catch((err) => {
        if('response' in err && err.response.status == 400) { done(); return }
        done(new Error(`Should return 400 not ${ JSON.stringify(('response' in err && 'status' in err.response) ? err.response.status : err)}`))
      })
    })

    it('must give incremented key when adding on a auto key auto increment', (done) => {
      const last_id = Object.keys(content).pop()
      base.add({
        "name": "Elliot Alderson",
        "age": 29,
        "handsome": true,
        "friends": ["Darlene", "Angela", "Tyrell"]
      })
      .then((id) => {
        expect(id).to.be.a('string')
        expect(id).to.equals(String(parseInt(last_id) + 1))
        done()
      })
      .catch((err) => {
        done(err)
      })
    })

    describe('It should not accept uncorrect values', () => {
      const uncorrect_values = [undefined, null, false, 16, 'Muse', [1, 2, 3]]
      // I wanted to to test [] but serialized it's the same as an empty object which must be accepted

      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, (done) => {
          base.add(unco)
            .then(res => {
              done(new Error(`Should not fullfill with res ${res}`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    describe('It should accept correct values', () => {
      const correct_values = [{}, {
        "name": "Elliot Alderson",
        "age": 29,
        "handsome": true,
        "friends": ["Darlene", "Angela", "Tyrell"]
      }]

      correct_values.forEach((co, index) => {
        it(`${ index === 0 ? 'Empty object' : 'Complex object' } should fullfill`, done => {
          base.add(co)
            .then(() => {
              done()
            })
            .catch(err => {
              done(err)
            })
        })
      })
    })
  })

  describe('addBulk operations', () => {
    it('must fullfill with empty array', done => {
      base.addBulk([])
        .then(res => {
          expect(res).to.deep.equal([])
          done()
        })
        .catch(err => {
          if('response' in err && err.response.status == 400) { done(err.response) }
          done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
        })
    })

    describe('must reject with uncorrect base values', () => {
      const uncorrect_values = [undefined, null, false, 16, 'Muse', [1, 2, 3]]


      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, done => {
          base.addBulk(unco)
            .then(res => {
              done(new Error(`Should not fullfill with res ${res}`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    describe('must reject with uncorrect array', () => {
      const uncorrect_values = [undefined, null, false, 16, 'Muse', [1, 2, 3]]

      uncorrect_values.forEach(unco => {
        it(`[${ JSON.stringify(unco) }] value rejects`, done => {
          base.addBulk([unco])
            .then(res => {
              done(new Error(`Should not fullfill with res ${res}`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify('response' in err ? err.response : err) }`))
            })
        })
      })
    })

    describe('Correct value should succeed', () => {
      it('should accept array with an empty object inside', done => {
        base.addBulk([{}])
          .then(res => {
            expect(res).to.be.a('array')
            expect(res).to.have.length(1)
            done()
          })
          .catch(err => {
            console.log(err)
            done(err)
          })
      })

      it('should accept correct array value', done => {
        const in_value = [{ a: 1 }, { b: 2 }, { c: 3 }]
        base.addBulk(in_value)
          .then(res => {
            expect(res).to.be.a('array')
            expect(res).to.have.length(3)
            res.forEach(id => {
              expect(id).to.be.a('string')
            })
            return Promise.all([res, base.searchKeys(res)])
          })
          .then(results => {
            const search_results = results[1]
            expect(search_results).to.be.a('array')
            expect(search_results).to.have.length(3)

            const ids_generated = results[0]
            // modify results and add ID
            in_value.map((el, index) => {
              el[firestorm.ID_FIELD] = ids_generated[index]

              return el
            })

            expect(search_results).to.be.deep.equals(in_value)
            done()
          })
          .catch(err => {
            console.error(err)
            done(err)
          })
      })
    })
  })

  describe('remove operations', () => {
    describe('must accept only string keys', () => {
      const uncorrect_values = [undefined, null, false, 16, 22.2, [], [1, 2, 3], {}, { "i'm": "batman"}]

      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, done => {
          base.remove(unco)
            .then(res => {
              done(new Error(`Should not fullfill with value ${  JSON.stringify(res) }`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    it('Succeeds if key entered does not exist', done => {
      base.remove('666')
        .then(() => done())
        .catch(done)
    })

    it('Succeeds if wanted element is actually deleted', done => {
      const ELEMENT_KEY_DELETED = '2'
      base.read_raw()
        .then(raw => {
          delete raw[ELEMENT_KEY_DELETED]

          return Promise.all([raw, base.remove(ELEMENT_KEY_DELETED)])
        })
        .then(results => {
          return Promise.all([results[0], base.read_raw()])
        })
        .then(results => {
          const expected = results[0]
          const actual = results[1]

          expect(expected).to.be.deep.equal(actual, 'Value must match')
          done()
        })
        .catch(done)
    })
  })

  describe('removeBulk operations', () => {
    describe('must accept only string array', () => {
      const uncorrect_values = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman"}]

      uncorrect_values.forEach(unco => {
        it(`[${ JSON.stringify(unco) }] value rejects`, done => {
          base.removeBulk([unco])
            .then(res => {
              done(new Error(`Should not fullfill with value ${  JSON.stringify(res) }`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) done()
              else done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    it('Succeeds with empty array', done => {
      base.removeBulk([])
        .then(() => done())
        .catch(done)
    })

    it('Succeeds if wanted elements are actually deleted', done => {
      const ELEMENT_KEY_DELETED = ['0', '2']
      base.read_raw()
        .then(raw => {
          ELEMENT_KEY_DELETED.forEach(k => delete raw[k])

          return Promise.all([raw, base.removeBulk(ELEMENT_KEY_DELETED)])
        })
        .then(results => {
          return Promise.all([results[0], base.read_raw()])
        })
        .then(results => {
          const expected = results[0]
          const actual = results[1]

          expect(expected).to.be.deep.equal(actual, 'Value must match')
          done()
        })
        .catch(done)
    })
  })

  describe('set operations', () => {
    before(() => {
      tmp = {
        "name": "Barry Allen",
        "age": 27,
        "handsome": true,
        "friends": ["Iris", "Cisco", "Caitlin", "Joe"]
      }
    })

    it('Should not succeed with no parameters in the methos', done => {
      base.set()
        .then(() => done(new Error('Should not fullfill')))
        .catch(() => done() )
    })

    describe('0 values fullfill', () => {
      const correct_values = ["0", 0, 0.00]

      correct_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value fullfills`, (done) => {
          base.set(unco, tmp)
            .then(res => {
              done()
            })
            .catch(err => {
              if('response' in err) console.log(err.response.data)
              done(new Error(err))
            })
        })
      })
    })

    describe('Key must be a string or an integer', () => {
      const uncorrect_values = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman"}]

      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, done => {
          base.set(unco, tmp)
            .then(res => {
              done(new Error(`Should not fullfill with value ${  JSON.stringify(res) }`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              else done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    describe('Value must be an object', () => {
      const uncorrect_values = [undefined, null, false, 16, 22.2, [1, 2, 3]]

      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, done => {
          base.set('1', unco)
            .then(res => {
              done(new Error(`Should not fullfill with value ${  JSON.stringify(res) }`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    it('must put the correct value', done => {
      base.set(42, tmp)
      .then(res => {
        expect(res).to.deep.equals({ "200": "Successful set command" }, 'Message returned should match')
        return base.get(42)
      })
      .then(expected => {
        tmp[firestorm.ID_FIELD] = '42'
        expect(expected).to.deep.equals(tmp)
        done()
      })
      .catch(done)
    })
  })

  describe('setBulk operations', () => {
    it('rejects with no args', done => {
      base.setBulk()
        .then(res => {
          done(res)
        })
        .catch(err => {
          if('response' in err && err.response.status == 400) { done(); return }
          done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
        })
    })
    it('Fullfills with two empty arrays', (done) => {
      base.read_raw()
        .then(before => {

          return Promise.all([before, base.setBulk([], [])])
        })
        .then(results => {
          const before = results[0]
          return Promise.all([before, base.read_raw()])
        })
        .then(results => {
          const expected = results[0]
          const after = results[1]

          expect(expected).to.deep.equal(after, 'Doing no operation doesn\'t change the content')
          done()
        })
        .catch(err => {
          done(err)
        })
    })

    it('Should reject when arrays are not the same size', (done) => {
      base.setBulk([], [tmp])
      .then(res => done(res))
      .catch(err => {
        if('response' in err && err.response.status == 400) { done(); return }
        done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
      })
    })

    describe('keys should be an array of string', () => {
      const uncorrect_values = [undefined, null, false, [], [1, 2, 3], {}, { "i'm": "batman"}]

      uncorrect_values.forEach(unco => {
        it(`[${ JSON.stringify(unco) }] value rejects`, (done) => {
          base.setBulk([unco], [tmp])
            .then(res => {
              done(new Error(`Should not fullfill with value ${  JSON.stringify(res) }`))
            })
            .catch(err => {
              if('response' in err && err.response.status == 400) { done(); return }
              done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
            })
        })
      })
    })

    it('sets things correctly with correct request', done => {
      base.setBulk(['6'], [tmp])
        .then(() => {
          return base.get('6')
        })
        .then(found => {
          tmp[firestorm.ID_FIELD] = '6' // add id field

          expect(tmp).to.deep.equal(found)
          done()
        })
        .catch(err => {
          done(new Error(err))
        })
    })
  })

  describe('editField operations', () => {
    before(async () => {
      await resetDatabaseContent()
    })

    describe('Reject with incorrect values', () => {
      const uncorrect_values = [undefined, null, false, 16, 0.5, '', 'gg', [], {}]

      uncorrect_values.forEach(unco => {
        it(`${ JSON.stringify(unco) } value rejects`, done => {
          base.editField(unco)
          .then(res => {
            done(new Error('Should not fullfill with ' + JSON.stringify(res)))
          })
          .catch(err => {
            if('response' in err && err.response.status == 400) { done(); return }
            done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
          })
        })
      })
    })

    describe('Rejects with missing arguments', () => {
      const args = [['id', '2'], ['field', 'name'], ['operation', 'set']]

      for(let i = 0; i < args.length; ++i) {
        let obj = {}
        args.slice(0, i + 1).forEach(el => {
          obj[el[0]] = el[1]
        })

        it(`${i+1} args is not enough`, done => {
          base.editField(obj)
          .then(res => {
            done(new Error('Should not fullfill with ' + JSON.stringify(res)))
          })
          .catch(err => {
            if('response' in err && err.response.status == 400) { done(); return }
            done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
          })
        })
      }
    })

    describe('Rejects operations with value required', () => {
      ['set', 'append', 'array-push', 'array-delete', 'array-slice'].forEach(op => {
        it(`${op} operation needs a value`, done => {
          base.editField({
            id: '2',
            operation: op,
            field: 'name'
          })
          .then(res => {
            done(new Error('Should not fullfill with ' + JSON.stringify(res)))
          })
          .catch(err => {
            if('response' in err && err.response.status == 400) { done(); return }
            done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
          })
        })
      })
    })

    it('Rejects with unknow operation', done => {
      base.editField({
        id: '2',
        operation: 'smile',
        field: 'name'
      })
      .then(res => {
        done(new Error('Should not fullfill with ' + JSON.stringify(res)))
      })
      .catch(err => {
        if('response' in err && err.response.status == 400) { done(); return }
        done(new Error(`Should return 400 not ${ JSON.stringify(err) }`))
      })
    })
  })
})
