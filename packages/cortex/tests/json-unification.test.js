import o from 'ospec'

// Prolog imports should match flow.js
import prolog from '../vendor/tau-prolog/modules/core.js'
import importJsModule from '../vendor/tau-prolog/modules/js.js'
import importListsModule from '../vendor/tau-prolog/modules/lists.js'
import importPromisesModule from '../vendor/tau-prolog/modules/promises.js'


o.spec('JSON unification', () => {
  let session;
  const BASE_CODE = `
    :- use_module(library(lists)).
    :- use_module(library(js)).
  `

  async function consult(code) {
    await session.promiseConsult(code)
    session.thread.warnings.map(w =>
      console.warn(w.toJavaScript({ quoted: true }))
    )
  }
  async function query(code) {
    await session.promiseQuery(code)
    let answers = []
    for await (let answer of session.promiseAnswers()) {
      // console.log('->>', session.format_answer(answer), answer)
      // console.log('->>', answer)
      let result = {}
      for (let variable in answer.links) {
        result[variable] = answer.links[variable].toJavaScript({ quoted: true })
      }
      answers.push(result)
      // console.log(answers[answers.length-1])
    }
    return answers
  }

  o.beforeEach(async () => {
    session = prolog.create()
    prolog.__env = {
      foo: { x: 10, y: 20, z: 30 },
      bar: { a: null, b: undefined, c: true, d: false, e: '', f: 'FF', g: 'gg' },
      baz: {
        array: ['first', { rest: true }],
        inner: { x: 11, y: 22 }
      }
    }
    await consult(BASE_CODE)
  })

  o('null', async () => {
    const answers = await query(`prop(bar, Bar), prop(Bar, a, V).`)

    o(answers.length).equals(1)
    o(answers[0].V).equals(null)
  })

  o('undefined', async () => {
    const answers = await query(`prop(bar, Bar), prop(Bar, b, V).`)

    o(answers.length).equals(1)
    o('V' in answers[0]).equals(true)
    o(answers[0].V).equals(undefined)
  })

  o('true/false', async () => {
    const answers = await query(`prop(bar, Bar), prop(Bar, c, T), prop(Bar, d, F).`)

    o(answers.length).equals(1)
    o(answers[0].T).equals(true)
    o(answers[0].F).equals(false)
  })

  o('object match single property', async () => {
    const queries = [
      'prop(foo, Foo), Foo = { x: X }.',
      'prop(foo, Foo), { x: X } = Foo.',
      'prop(foo, { x: X }).',
    ]

    for (let q of queries) {
      const answers = await query(q)
      o(answers.length).equals(1)
      o(answers[0].X).equals(10n)
    }
  })

  o('object match flat', async () => {
    const answers = await query(`prop(foo, { x: X, y: Y, z: Z }).`)
    o(answers.length).equals(1)
    o(answers[0].X).equals(10n)
    o(answers[0].Y).equals(20n)
    o(answers[0].Z).equals(30n)
  })

  o('object special values', async () => {
    const answers = await query(`prop(bar, { a: A, b: B, c: C, d: D, e: E, f: F, g: G }).`)
    o(answers.length).equals(1)
    o(answers[0].A).equals(null)
    o(answers[0].B).equals(undefined)
    o(answers[0].C).equals(true)
    o(answers[0].D).equals(false)
    o(answers[0].E).equals("''")
    o(answers[0].F).equals("'FF'")
    o(answers[0].G).equals("gg")
  })

  o('nested object', async () => {
    const answers = await query(`prop(baz, { inner: { x: X } }).`)
    o(answers.length).equals(1)
    o(answers[0].X).equals(11n)
  })

  o('nested array', async () => {
    const answers = await query(`prop(baz, { array: [first, R] }).`)
    o(answers.length).equals(1)
    o(answers[0].R).deepEquals({ rest: true })
  })

  o('JS object equality', () => {})


  o('object variable key', async () => {
    const answers = await query(`prop(baz, { K: V }).`)
    o(answers.length).equals(0)
    // TODO
    // o(answers.length).equals(3)
  })

  o('object rest', async () => {
    // TODO (pipe syntax throws an error atm)
    // const answers = await query(`prop(baz, { x: X | Rest }).`)
    // o(answers.length).equals(1)
    // o(answers[0].R).deepEquals({ y: 20n, z: 30n })
  })

  o('invalid object match', async () => {
    const answers = await query(`prop(baz, { x: 10, [huh] }).`)
    o(answers.length).equals(0)
  })
})
