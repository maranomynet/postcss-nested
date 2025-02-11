let { equal, throws } = require('uvu/assert')
let { test } = require('uvu')
let postcss = require('postcss')

let plugin = require('./')

function run(input, output, opts) {
  let result = postcss([plugin(opts)]).process(input, { from: '/test.css' })
  equal(result.css, output)
  equal(result.warnings().length, 0)
}

test('unwraps rule inside rule', () => {
  run(
    'a { a: 1 } a { a: 1; b { b: 2; c { c: 3 } } }',
    'a { a: 1 } a { a: 1; } a b { b: 2; } a b c { c: 3 }'
  )
})

test('cleans rules after unwrap', () => {
  run('a { b .one {} b .two {} }', 'a b .one {} a b .two {}')
})

test('preserve empty rules if preserveEmpty is set to true', () => {
  run('a { b .one {} b .two {} }', 'a { } a b .one {} a b .two {}', {
    preserveEmpty: true
  })
})

test('hoists at-root', () => {
  run('a { & {} @at-root { b {} } }', 'a {} b {}')
})

test('at-root short hand', () => {
  run('a { & {} @at-root b { } }', 'a {} b {}')
})

test('replaces ampersand', () => {
  run('a { body &:hover b {} }', 'body a:hover b {}')
})

test('replaces ampersands', () => {
  run('a { &:hover, &:active {} }', 'a:hover, a:active {}')
})

test('replaces ampersand in string', () => {
  run('.block { &_elem {} }', '.block_elem {}')
})

test('unwrap rules inside at-rules', () => {
  run(
    '@media (max-width: 500px) { a { b {} } }',
    '@media (max-width: 500px) { a b {} }'
  )
})

test('unwraps at-rule', () => {
  run(
    'a { b { @media screen { width: auto } } }',
    '@media screen {a b { width: auto } }'
  )
})

test('unwraps at-rule with rules', () => {
  run(
    'a { @media screen { b { color: black } } }',
    '@media screen { a b { color: black } }'
  )
})

test('unwraps font-face to top level css', () => {
  run(
    '.a { @font-face { font-family:font; src:url() format("woff"); } }',
    '@font-face { font-family:font; src:url() format("woff"); }'
  )
})

test('unwraps multiple fonts to top level css', () => {
  run(
    '.a { @font-face { font-family:f1; } @font-face { font-family:f2; }}',
    '@font-face { font-family:f1; } @font-face { font-family:f2; }'
  )
})

test('unwraps at-rules', () => {
  run(
    'a { a: 1 } a { @media screen { @supports (a: 1) { a: 1 } } }',
    'a { a: 1 } @media screen { @supports (a: 1) { a { a: 1 } } }'
  )
})

test('unwraps at-rules with interleaved properties', () => {
  run(
    'a { a: 1 } a { color: red; @media screen { @supports (a: 1) { a: 1 } } background: green }',
    'a { a: 1 } a { color: red; } @media screen { @supports (a: 1) { a { a: 1 } } } a { background: green }'
  )
})

test('does not move custom at-rules', () => {
  run(
    '.one { @mixin test; } .two { @media screen { @mixin test; } } .three { @media screen { @mixin test { color: black } } } .four { @phone { color: black } }',
    '.one { @mixin test; } @media screen { .two { @mixin test } } @media screen { .three { @mixin test { color: black } } } @phone { .four { color: black } }',
    { bubble: ['phone'] }
  )
})

test('does not move custom at-rules placed under nested bubbling ones', () => {
  run(
    '.one { @supports (color: black) { @media screen { @mixin test; } } } .two { @supports (color: black) { @media screen { @mixin test { color: black } } } }',
    '@supports (color: black) { @media screen {.one { @mixin test } } } @supports (color: black) { @media screen { .two { @mixin test { color: black } } } }'
  )
})

test('supports bubble option with at-name', () => {
  run('a { @phone { color: black } }', '@phone {a { color: black } }', {
    bubble: ['@phone']
  })
})

test('unwraps keyframes', () => {
  run(
    'a { color: white; @keyframes name { to { color: black } } }',
    'a { color: white; } @keyframes name { to { color: black } }'
  )
})

test('supports unwrap option with at-name', () => {
  run('a { @phone { color: black } }', '@phone { color: black }', {
    unwrap: ['@phone']
  })
})

test('processes comma', () => {
  run('.one, .two { a {} }', '.one a, .two a {}')
})

test('processes comma with ampersand', () => {
  run('.one, .two { &:hover {} }', '.one:hover, .two:hover {}')
})

test('processes comma inside', () => {
  run('a, b { .one, .two {} }', 'a .one, a .two, b .one, b .two {}')
})

test('clears empty selector after comma', () => {
  run('a, b { .one, .two, {} }', 'a .one, a .two, b .one, b .two {}')
})

test('moves comment with rule', () => {
  run('a { /*B*/ b {} }', '/*B*/ a b {}')
})

test('moves comment with at-rule', () => {
  run('a { /*B*/ @media { one: 1 } }', '/*B*/ @media {a { one: 1 } }')
})

test('moves comment with declaration', () => {
  run('a { @media { /*B*/ one: 1 } }', '@media {a { /*B*/ one: 1 } }')
})

test('saves order of rules', () => {
  run('.one { & .two {} & .tree {} }', '.one .two {} .one .tree {}')
})

test('copies rule for declarations after nested rule', () => {
  run(
    'a { a: 1; &b { b: 2 } c: 1; &c { d: 5 } e: 6 } c { f: 1 }',
    'a { a: 1; } ab { b: 2 } a { c: 1; } ac { d: 5 } a { e: 6; } c { f: 1 }'
  )
})

test('copies rule for declarations after nested rule and before at-rule', () => {
  run(
    'a { &b { a: 1 } b: 2; @media { c: 3 } }',
    'ab { a: 1 } a { b: 2 } @media {a { c: 3 } }'
  )
})

test('does not replace ampersand inside string', () => {
  run(
    'div { &[data-category="sound & vision"] {} }',
    'div[data-category="sound & vision"] {}'
  )
})

test('replaces ampersand in adjacent sibling selector', () => {
  run('div { & + & {} }', 'div + div {}')
})

test('replaces ampersands in not selector', () => {
  run('.a { &:not(&.no) {} }', '.a:not(.a.no) {}')
})

test('correctly replaces tail ampersands', () => {
  run('.a { .b & {} }', '.b .a {}')
})

test('correctly replaces tail ampersands that are nested further down', () => {
  run('.a { .b { .c & {} } }', '.c .a .b {}')
})

test('correctly replaces tail ampersands that are nested inside ampersand rules', () => {
  run('.a { &:hover { .b { .c & {} } } }', '.c .a:hover .b {}')
})

test('preserves child order when replacing tail ampersands', () => {
  run(
    '.a { color: red; .first {} @mixinFirst; .b & {} @mixinLast; .last {} }',
    '.a { color: red; } .a .first {} .a { @mixinFirst; } .b .a {} .a { @mixinLast; } .a .last {}'
  )
})

test('handles :host selector case', () => {
  run(':host { &(:focus) {} }', ':host(:focus) {}')
})

test('works with other visitors', () => {
  let css = 'a{b{color:red}@mixin;}'
  let mixinPlugin = () => {
    return {
      postcssPlugin: 'mixin',
      AtRule: {
        mixin(node) {
          node.replaceWith('.in{.deep{color:blue}}')
        }
      }
    }
  }
  mixinPlugin.postcss = true
  let out = postcss([plugin, mixinPlugin]).process(css, {
    from: undefined
  }).css
  equal(out, 'a b{color:red}a .in .deep{color:blue}')
})

test('works with other visitors #2', () => {
  let css = 'a { @mixin; b {color:red} }'
  let mixinPlugin = () => {
    return {
      postcssPlugin: 'mixin',
      AtRule: {
        mixin(node) {
          node.replaceWith('.in { .deep {color:blue} }')
        }
      }
    }
  }
  mixinPlugin.postcss = true
  let out = postcss([plugin, mixinPlugin]).process(css, {
    from: undefined
  }).css
  equal(out, 'a .in .deep {color:blue} a b {color:red}')
})

test('shows clear errors on missed semicolon', () => {
  let css = 'a{\n  color: black\n  @mixin b { }\n}\n'
  throws(() => {
    css = postcss([plugin]).process(css, { from: undefined }).css
  }, '2:3: Missed semicolon')
})

test('shows clear errors on other errors', () => {
  let css = 'a{\n  -Option/root { }\n}\n'
  throws(() => {
    css = postcss([plugin]).process(css, { from: undefined }).css
  }, ':2:3: Unexpected')
})

test('third level dependencies', () => {
  run(
    '.text {&:hover{border-color: red;&:before{color: red;}}}',
    '.text:hover{border-color: red;}.text:hover:before{color: red;}'
  )
})

test('third level dependencies #2', () => {
  run('.selector{:global{h2{color:pink}}}', '.selector :global h2{color:pink}')
})

test.run()
