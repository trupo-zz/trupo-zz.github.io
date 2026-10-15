// TrupoFormula: a small, safe arithmetic evaluator shared by the generator (Node) and the
// pages (browser). No eval, no Function: formulas are parsed into a tree and walked.
// Grammar: comparison := sum (('<'|'>'|'<='|'>='|'=='|'!=') sum)?
//          sum := product (('+'|'-') product)*;  product := unary (('*'|'/'|'%') unary)*
//          unary := ('-'|'+') unary | power;      power := primary ('^' unary)?
//          primary := number | name | name '(' args ')' | '(' comparison ')'
(function (g) {
  var FUNCS = {
    min: [1, 20, Math.min], max: [1, 20, Math.max],
    round: [1, 2, function (x, dp) { var f = Math.pow(10, dp || 0); return Math.round(x * f) / f; }],
    floor: [1, 1, Math.floor], ceil: [1, 1, Math.ceil], abs: [1, 1, Math.abs],
    sqrt: [1, 1, Math.sqrt], pow: [2, 2, Math.pow], log: [1, 1, Math.log],
    log10: [1, 1, function (x) { return Math.log(x) / Math.LN10; }], exp: [1, 1, Math.exp],
    'if': [3, 3, null]
  };
  var CONSTS = { pi: Math.PI, e: Math.E };
  var MAX_LEN = 500;

  function tokenize(src) {
    if (typeof src !== 'string' || !src.trim()) throw new Error('empty formula');
    if (src.length > MAX_LEN) throw new Error('formula longer than ' + MAX_LEN + ' chars');
    var out = [], i = 0, m;
    var re = /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|==|!=|[-+*\/%^(),<>]))/y;
    while (i < src.length) {
      if (/^\s*$/.test(src.slice(i))) break;
      re.lastIndex = i;
      m = re.exec(src);
      if (!m) throw new Error('unexpected character at ' + i + ': "' + src.slice(i).trim().charAt(0) + '"');
      if (m[1] !== undefined) out.push({ t: 'num', v: parseFloat(m[1]) });
      else if (m[2] !== undefined) out.push({ t: 'name', v: m[2] });
      else out.push({ t: 'op', v: m[3] });
      i = re.lastIndex;
    }
    return out;
  }

  function parse(src) {
    var toks = tokenize(src), p = 0;
    function peek(v) { return p < toks.length && toks[p].t === 'op' && toks[p].v === v; }
    function eat(v) { if (!peek(v)) throw new Error('expected "' + v + '"'); p++; }
    function comparison() {
      var l = sum();
      if (p < toks.length && toks[p].t === 'op' && /^(<|>|<=|>=|==|!=)$/.test(toks[p].v)) {
        var op = toks[p++].v; return { k: 'bin', op: op, l: l, r: sum() };
      }
      return l;
    }
    function sum() {
      var l = product();
      while (peek('+') || peek('-')) { var op = toks[p++].v; l = { k: 'bin', op: op, l: l, r: product() }; }
      return l;
    }
    function product() {
      var l = unary();
      while (peek('*') || peek('/') || peek('%')) { var op = toks[p++].v; l = { k: 'bin', op: op, l: l, r: unary() }; }
      return l;
    }
    function unary() {
      if (peek('-')) { p++; return { k: 'neg', a: unary() }; }
      if (peek('+')) { p++; return unary(); }
      return power();
    }
    function power() {
      var b = primary();
      if (peek('^')) { p++; return { k: 'bin', op: '^', l: b, r: unary() }; }
      return b;
    }
    function primary() {
      if (p >= toks.length) throw new Error('formula ends too early');
      var t = toks[p];
      if (t.t === 'num') { p++; return { k: 'num', v: t.v }; }
      if (t.t === 'name') {
        p++;
        if (peek('(')) {
          if (!Object.prototype.hasOwnProperty.call(FUNCS, t.v)) throw new Error('unknown function "' + t.v + '"');
          p++;
          var args = [];
          if (!peek(')')) { args.push(comparison()); while (peek(',')) { p++; args.push(comparison()); } }
          eat(')');
          var f = FUNCS[t.v];
          if (args.length < f[0] || args.length > f[1]) throw new Error(t.v + '() takes ' + f[0] + (f[1] !== f[0] ? '-' + f[1] : '') + ' arguments');
          return { k: 'call', f: t.v, args: args };
        }
        return { k: 'var', v: t.v };
      }
      if (peek('(')) { p++; var e = comparison(); eat(')'); return e; }
      throw new Error('unexpected "' + t.v + '"');
    }
    var ast = comparison();
    if (p !== toks.length) throw new Error('unexpected "' + toks[p].v + '"');
    return ast;
  }

  function names(ast, acc) {
    acc = acc || [];
    if (ast.k === 'var') { if (acc.indexOf(ast.v) < 0) acc.push(ast.v); }
    else if (ast.k === 'bin') { names(ast.l, acc); names(ast.r, acc); }
    else if (ast.k === 'neg') names(ast.a, acc);
    else if (ast.k === 'call') ast.args.forEach(function (a) { names(a, acc); });
    return acc;
  }

  function evaluate(ast, env) {
    switch (ast.k) {
      case 'num': return ast.v;
      case 'var':
        if (env && Object.prototype.hasOwnProperty.call(env, ast.v)) return env[ast.v];
        if (Object.prototype.hasOwnProperty.call(CONSTS, ast.v)) return CONSTS[ast.v];
        throw new Error('unknown name "' + ast.v + '"');
      case 'neg': return -evaluate(ast.a, env);
      case 'call':
        if (ast.f === 'if') return evaluate(ast.args[0], env) ? evaluate(ast.args[1], env) : evaluate(ast.args[2], env);
        return FUNCS[ast.f][2].apply(null, ast.args.map(function (a) { return evaluate(a, env); }));
      case 'bin':
        var l = evaluate(ast.l, env), r = evaluate(ast.r, env);
        switch (ast.op) {
          case '+': return l + r; case '-': return l - r; case '*': return l * r;
          case '/': return l / r; case '%': return l % r; case '^': return Math.pow(l, r);
          case '<': return l < r ? 1 : 0; case '>': return l > r ? 1 : 0;
          case '<=': return l <= r ? 1 : 0; case '>=': return l >= r ? 1 : 0;
          case '==': return l === r ? 1 : 0; case '!=': return l !== r ? 1 : 0;
        }
    }
    throw new Error('bad formula tree');
  }

  // Same output in Node and the browser: fixed decimals, thousands separators, trailing zeros trimmed.
  function format(x, precision) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var dp = precision == null ? 2 : precision;
    var s = Math.abs(x).toFixed(dp), parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts[1] ? parts[0] + '.' + parts[1].replace(/0+$/, '') : parts[0];
    out = out.replace(/\.$/, '');
    return (x < 0 && /[1-9]/.test(s) ? '-' : '') + out;
  }

  g.TrupoFormula = { parse: parse, evaluate: evaluate, names: names, format: format, FUNCS: Object.keys(FUNCS), CONSTS: Object.keys(CONSTS) };
})(typeof globalThis !== 'undefined' ? globalThis : window);
