// Generated by CoffeeScript 1.6.3
(function() {
  var BOM, BOOL, CALLABLE, CHAR_PROXIES, CODE, COUGH_ALIASES, COUGH_ALIAS_MAP, COUGH_KEYWORDS, COMMENT, COMPARE, COMPOUND_ASSIGN, HEREDOC, HEREDOC_ILLEGAL, HEREDOC_INDENT, HEREGEX, HEREGEX_OMIT, IDENTIFIER, INDENTABLE_CLOSERS, INDEXABLE, INVERSES, JSTOKEN, JS_FORBIDDEN, JS_KEYWORDS, JS_PROSCRIBED_ID_CHARS, LINE_BREAK, LINE_CONTINUER, LOGIC, Lexer, MATH, MULTILINER, MULTI_DENT, NOT_REGEX, NOT_SPACED_REGEX, NUMBER, OPERATOR, PROSCRIBED_CHAR_CONVERSION, PROSCRIBED_ID_CHAR, REGEX, RELATION, RESERVED, Rewriter, SHIFT, SIMPLESTR, STRICT_PROSCRIBED, TRAILING_SPACES, UNARY, WHITESPACE, compact, count, invertLiterate, key, last, locationDataToString, repeat, starts, throwSyntaxError, _ref, _ref1,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  _ref = require('./rewriter'), Rewriter = _ref.Rewriter, INVERSES = _ref.INVERSES;

  _ref1 = require('./helpers'), count = _ref1.count, starts = _ref1.starts, compact = _ref1.compact, last = _ref1.last, repeat = _ref1.repeat, invertLiterate = _ref1.invertLiterate, locationDataToString = _ref1.locationDataToString, throwSyntaxError = _ref1.throwSyntaxError;

  exports.Lexer = Lexer = (function() {
    function Lexer() {}

    Lexer.prototype.tokenize = function(code, opts) {
      var consumed, i, tag, _ref2;
      if (opts == null) {
        opts = {};
      }
      this.literate = opts.literate;
      this.indent = 0;
      this.baseIndent = 0;
      this.indebt = 0;
      this.outdebt = 0;
      this.indents = [];
      this.ends = [];
      this.tokens = [];
      this.chunkLine = opts.line || 0;
      this.chunkColumn = opts.column || 0;
      code = this.clean(code);
      i = 0;
      while (this.chunk = code.slice(i)) {
        consumed = this.identifierToken() || this.commentToken() || this.whitespaceToken() || this.lineToken() || this.heredocToken() || this.stringToken() || this.numberToken() || this.regexToken() || this.jsToken() || this.literalToken();
        _ref2 = this.getLineAndColumnFromChunk(consumed), this.chunkLine = _ref2[0], this.chunkColumn = _ref2[1];
        i += consumed;
      }
      this.closeIndentation();
      if (tag = this.ends.pop()) {
        this.error("missing " + tag);
      }
      if (opts.rewrite === false) {
        return this.tokens;
      }
      return (new Rewriter).rewrite(this.tokens);
    };

    Lexer.prototype.clean = function(code) {
      if (code.charCodeAt(0) === BOM) {
        code = code.slice(1);
      }
      code = code.replace(/\r/g, '').replace(TRAILING_SPACES, '');
      if (WHITESPACE.test(code)) {
        code = "\n" + code;
        this.chunkLine--;
      }
      if (this.literate) {
        code = invertLiterate(code);
      }
      return code;
    };

    Lexer.prototype.identifierToken = function() {
      var affix, colon, colonOffset, forcedIdentifier, id, idLength, input, match, poppedToken, prev, tag, tagToken, _ref2, _ref3, _ref4, _ref5, _ref6;
      if (!(match = IDENTIFIER.exec(this.chunk))) {
        return 0;
      }
      input = match[0], id = match[1], colon = match[2];

      // The space of characters permitted in source-code IDENTIFIERs has been expanded.
      // An arobase is now permitted at any location within a IDENTIFER's name, and the
      // remaining charaters in the 'JS_PROSCRIBED_ID_CHARS' list are permitted at any
      // location except the initial position.
      affix = '_';
      if (PROSCRIBED_ID_CHAR.exec(id)) {
        for (_ref5 in (_ref6 = PROSCRIBED_CHAR_CONVERSION)) {
          id = id.replace(_ref6[_ref5][0], affix + _ref6[_ref5][1] + affix);
        }
      }

      idLength = id.length;
      poppedToken = void 0;
      if (id === 'own' && this.tag() === 'FOR') {
        this.token('OWN', id);
        return id.length;
      }
      forcedIdentifier = colon || (prev = last(this.tokens)) && (((_ref2 = prev[0]) === '.' || _ref2 === '?.' || _ref2 === '::' || _ref2 === '?::') || !prev.spaced && prev[0] === '@');
      tag = 'IDENTIFIER';
      if (!forcedIdentifier && (__indexOf.call(JS_KEYWORDS, id) >= 0 || __indexOf.call(COUGH_KEYWORDS, id) >= 0)) {
        tag = id.toUpperCase();
        if (tag === 'WHEN' && (_ref3 = this.tag(), __indexOf.call(LINE_BREAK, _ref3) >= 0)) {
          tag = 'LEADING_WHEN';
        } else if (tag === 'FOR') {
          this.seenFor = true;
        } else if (tag === 'UNLESS') {
          tag = 'IF';
        } else if (__indexOf.call(UNARY, tag) >= 0) {
          tag = 'UNARY';
        } else if (__indexOf.call(RELATION, tag) >= 0) {
          if (tag !== 'INSTANCEOF' && this.seenFor) {
            tag = 'FOR' + tag;
            this.seenFor = false;
          } else {
            tag = 'RELATION';
            if (this.value() === '!') {
              poppedToken = this.tokens.pop();
              id = '!' + id;
            }
          }
        }
      }
      if (__indexOf.call(JS_FORBIDDEN, id) >= 0) {
        if (forcedIdentifier) {
          tag = 'IDENTIFIER';
          id = new String(id);
          id.reserved = true;
        } else if (__indexOf.call(RESERVED, id) >= 0) {
          this.error("reserved word \"" + id + "\"");
        }
      }
      if (!forcedIdentifier) {
        if (__indexOf.call(COUGH_ALIASES, id) >= 0) {
          id = COUGH_ALIAS_MAP[id];
        }
        tag = (function() {
          switch (id) {
            case '!':
              return 'UNARY';
            case '==':
            case '!=':
              return 'COMPARE';
            case '&&':
            case '||':
              return 'LOGIC';

            // Add two new identifier tags ('DBL_BACKSLASH' and 'LAMBDA') on Jan 23, 2014.
            // 'BACKSLASH' assumes the former role of '\',
            //  i.e., it indicates a line continuation.
            case '\\\\':
              return 'DBL_BACKSLASH';

            // 'LAMBDA' is nearly synonymous with the pair 'PARAM_START'/'PARAM_END'.
            // However, it also allows for more concise syntax indicating currying.
            case '\\':
              return 'LAMBDA';

            // 'ALT_MODE_TOGGLE' toggles between the default
            // applicative style and the optional compositional style.
            case ';':
              return 'ALT_MODE_TOGGLE';

            case 'true':
            case 'false':
              return 'BOOL';
            case 'break':
            case 'continue':
              return 'STATEMENT';
            default:
              return tag;
          }
        })();
      }
      tagToken = this.token(tag, id, 0, idLength);
      if (poppedToken) {
        _ref4 = [poppedToken[2].first_line, poppedToken[2].first_column], tagToken[2].first_line = _ref4[0], tagToken[2].first_column = _ref4[1];
      }
      if (colon) {
        colonOffset = input.lastIndexOf(':');
        this.token(':', ':', colonOffset, colon.length);
      }
      return input.length;
    };

    Lexer.prototype.numberToken = function() {
      var binaryLiteral, lexedLength, match, number, octalLiteral;
      if (!(match = NUMBER.exec(this.chunk))) {
        return 0;
      }
      number = match[0];
      if (/^0[BOX]/.test(number)) {
        this.error("radix prefix '" + number + "' must be lowercase");
      } else if (/E/.test(number) && !/^0x/.test(number)) {
        this.error("exponential notation '" + number + "' must be indicated with a lowercase 'e'");
      } else if (/^0\d*[89]/.test(number)) {
        this.error("decimal literal '" + number + "' must not be prefixed with '0'");
      } else if (/^0\d+/.test(number)) {
        this.error("octal literal '" + number + "' must be prefixed with '0o'");
      }
      lexedLength = number.length;
      if (octalLiteral = /^0o([0-7]+)/.exec(number)) {
        number = '0x' + parseInt(octalLiteral[1], 8).toString(16);
      }
      if (binaryLiteral = /^0b([01]+)/.exec(number)) {
        number = '0x' + parseInt(binaryLiteral[1], 2).toString(16);
      }
      this.token('NUMBER', number, 0, lexedLength);
      return lexedLength;
    };

    Lexer.prototype.stringToken = function() {
      var octalEsc, quote, string, trimmed;
      switch (quote = this.chunk.charAt(0)) {
        case "'":
          string = SIMPLESTR.exec(this.chunk)[0];
          break;
        case '"':
          string = this.balancedString(this.chunk, '"');
      }
      if (!string) {
        return 0;
      }
      trimmed = this.removeNewlines(string.slice(1, -1));
      if (quote === '"' && 0 < string.indexOf('#{', 1)) {
        this.interpolateString(trimmed, {
          strOffset: 1,
          lexedLength: string.length
        });
      } else {
        this.token('STRING', quote + this.escapeLines(trimmed) + quote, 0, string.length);
      }
      if (octalEsc = /^(?:\\.|[^\\])*\\(?:0[0-7]|[1-7])/.test(string)) {
        this.error("octal escape sequences " + string + " are not allowed");
      }
      return string.length;
    };

    Lexer.prototype.heredocToken = function() {
      var doc, heredoc, match, quote;
      if (!(match = HEREDOC.exec(this.chunk))) {
        return 0;
      }
      heredoc = match[0];
      quote = heredoc.charAt(0);
      doc = this.sanitizeHeredoc(match[2], {
        quote: quote,
        indent: null
      });
      if (quote === '"' && 0 <= doc.indexOf('#{')) {
        this.interpolateString(doc, {
          heredoc: true,
          strOffset: 3,
          lexedLength: heredoc.length
        });
      } else {
        this.token('STRING', this.makeString(doc, quote, true), 0, heredoc.length);
      }
      return heredoc.length;
    };

    Lexer.prototype.commentToken = function() {
      var comment, here, match;
      if (!(match = this.chunk.match(COMMENT))) {
        return 0;
      }
      comment = match[0], here = match[1];
      if (here) {
        this.token('HERECOMMENT', this.sanitizeHeredoc(here, {
          herecomment: true,
          indent: repeat(' ', this.indent)
        }), 0, comment.length);
      }
      return comment.length;
    };

    Lexer.prototype.jsToken = function() {
      var match, script;
      if (!(this.chunk.charAt(0) === '`' && (match = JSTOKEN.exec(this.chunk)))) {
        return 0;
      }
      // The number of backticks delimiting JSTOKENs on each end has been changed from 1 to 2.
      this.token('JS', (script = match[0]).slice(2, -2), 0, script.length);
      return script.length;
    };

    Lexer.prototype.regexToken = function() {
      var flags, length, match, prev, regex, _ref2, _ref3;
      if (this.chunk.charAt(0) !== '/') {
        return 0;
      }
      if (match = HEREGEX.exec(this.chunk)) {
        length = this.heregexToken(match);
        return length;
      }
      prev = last(this.tokens);
      if (prev && (_ref2 = prev[0], __indexOf.call((prev.spaced ? NOT_REGEX : NOT_SPACED_REGEX), _ref2) >= 0)) {
        return 0;
      }
      if (!(match = REGEX.exec(this.chunk))) {
        return 0;
      }
      _ref3 = match, match = _ref3[0], regex = _ref3[1], flags = _ref3[2];
      if (regex.slice(0, 2) === '/*') {
        this.error('regular expressions cannot begin with `*`');
      }
      if (regex === '//') {
        regex = '/(?:)/';
      }
      this.token('REGEX', "" + regex + flags, 0, match.length);
      return match.length;
    };

    Lexer.prototype.heregexToken = function(match) {
      var body, flags, flagsOffset, heregex, plusToken, prev, re, tag, token, tokens, value, _i, _len, _ref2, _ref3, _ref4;
      heregex = match[0], body = match[1], flags = match[2];
      if (0 > body.indexOf('#{')) {
        re = this.escapeLines(body.replace(HEREGEX_OMIT, '$1$2').replace(/\//g, '\\/'), true);
        if (re.match(/^\*/)) {
          this.error('regular expressions cannot begin with `*`');
        }
        this.token('REGEX', "/" + (re || '(?:)') + "/" + flags, 0, heregex.length);
        return heregex.length;
      }
      this.token('IDENTIFIER', 'RegExp', 0, 0);
      this.token('CALL_START', '(', 0, 0);
      tokens = [];
      _ref2 = this.interpolateString(body, {
        regex: true
      });
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        token = _ref2[_i];
        tag = token[0], value = token[1];
        if (tag === 'TOKENS') {
          tokens.push.apply(tokens, value);
        } else if (tag === 'NEOSTRING') {
          if (!(value = value.replace(HEREGEX_OMIT, '$1$2'))) {
            continue;
          }
          value = value.replace(/\\/g, '\\\\');
          token[0] = 'STRING';
          token[1] = this.makeString(value, '"', true);
          tokens.push(token);
        } else {
          this.error("Unexpected " + tag);
        }
        prev = last(this.tokens);
        plusToken = ['+', '+'];
        plusToken[2] = prev[2];
        tokens.push(plusToken);
      }
      tokens.pop();
      if (((_ref3 = tokens[0]) != null ? _ref3[0] : void 0) !== 'STRING') {
        this.token('STRING', '""', 0, 0);
        this.token('+', '+', 0, 0);
      }
      (_ref4 = this.tokens).push.apply(_ref4, tokens);
      if (flags) {
        flagsOffset = heregex.lastIndexOf(flags);
        this.token(',', ',', flagsOffset, 0);
        this.token('STRING', '"' + flags + '"', flagsOffset, flags.length);
      }
      this.token(')', ')', heregex.length - 1, 0);
      return heregex.length;
    };

    Lexer.prototype.lineToken = function() {
      var diff, indent, match, noNewlines, size;
      if (!(match = MULTI_DENT.exec(this.chunk))) {
        return 0;
      }
      indent = match[0];
      this.seenFor = false;
      size = indent.length - 1 - indent.lastIndexOf('\n');
      noNewlines = this.unfinished();
      if (size - this.indebt === this.indent) {
        if (noNewlines) {
          this.suppressNewlines();
        } else {
          this.newlineToken(0);
        }
        return indent.length;
      }
      if (size > this.indent) {
        if (noNewlines) {
          this.indebt = size - this.indent;
          this.suppressNewlines();
          return indent.length;
        }
        if (!this.tokens.length) {
          this.baseIndent = this.indent = size;
          return indent.length;
        }
        diff = size - this.indent + this.outdebt;
        this.token('INDENT', diff, indent.length - size, size);
        this.indents.push(diff);
        this.ends.push('OUTDENT');
        this.outdebt = this.indebt = 0;
        this.indent = size;
      } else if (size < this.baseIndent) {
        this.error('missing indentation', indent.length);
      } else {
        this.indebt = 0;
        this.outdentToken(this.indent - size, noNewlines, indent.length);
      }
      return indent.length;
    };

    Lexer.prototype.outdentToken = function(moveOut, noNewlines, outdentLength) {
      var decreasedIndent, dent, lastIndent, _ref2;
      decreasedIndent = this.indent - moveOut;
      while (moveOut > 0) {
        lastIndent = this.indents[this.indents.length - 1];
        if (!lastIndent) {
          moveOut = 0;
        } else if (lastIndent === this.outdebt) {
          moveOut -= this.outdebt;
          this.outdebt = 0;
        } else if (lastIndent < this.outdebt) {
          this.outdebt -= lastIndent;
          moveOut -= lastIndent;
        } else {
          dent = this.indents.pop() + this.outdebt;
          if (outdentLength && (_ref2 = this.chunk[outdentLength], __indexOf.call(INDENTABLE_CLOSERS, _ref2) >= 0)) {
            decreasedIndent -= dent - moveOut;
            moveOut = dent;
          }
          this.outdebt = 0;
          this.pair('OUTDENT');
          this.token('OUTDENT', moveOut, 0, outdentLength);
          moveOut -= dent;
        }
      }
      this.indent = decreasedIndent;
      if (dent) {
        this.outdebt -= moveOut;
      }

      // A double semicolon has replaced the single semicolon.
      while (this.value() === ';;') {

        this.tokens.pop();
      }
      if (!(this.tag() === 'TERMINATOR' || noNewlines)) {
        this.token('TERMINATOR', '\n', outdentLength, 0);
      }
      return this;
    };

    Lexer.prototype.whitespaceToken = function() {
      var match, nline, prev;
      if (!((match = WHITESPACE.exec(this.chunk)) || (nline = this.chunk.charAt(0) === '\n'))) {
        return 0;
      }
      prev = last(this.tokens);
      if (prev) {
        prev[match ? 'spaced' : 'newLine'] = true;
      }
      if (match) {
        return match[0].length;
      } else {
        return 0;
      }
    };

    Lexer.prototype.newlineToken = function(offset) {

      // A double semicolon has replaced the single semicolon.
      while (this.value() === ';;') {

        this.tokens.pop();
      }
      if (this.tag() !== 'TERMINATOR') {
        this.token('TERMINATOR', '\n', offset, 0);
      }
      return this;
    };

    Lexer.prototype.suppressNewlines = function() {

      // Soraismsus Jan 23, 2014
      // '\\' has been replaced with either 'DBL_BACKSLASH' or '\\\\'
      if (this.tag() === 'DBL_BACKSLASH' || this.value() === '\\\\') {

        this.tokens.pop();
      }
      return this;
    };

    Lexer.prototype.literalToken = function() {
      var match, prev, tag, value, _ref2, _ref3, _ref4, _ref5, _ref6;
      if (match = OPERATOR.exec(this.chunk)) {
        value = match[0];
        if (CODE.test(value)) {
          this.tagParameters();
        }
      } else {
        value = this.chunk.charAt(0);
      }
      tag = value;
      prev = last(this.tokens);
      if (value === '=' && prev) {
        if (!prev[1].reserved && (_ref2 = prev[1], __indexOf.call(JS_FORBIDDEN, _ref2) >= 0)) {
          this.error("reserved word \"" + (this.value()) + "\" can't be assigned");
        }
        if ((_ref3 = prev[1]) === '||' || _ref3 === '&&') {
          prev[0] = 'COMPOUND_ASSIGN';
          prev[1] += '=';
          return value.length;
        }
      }

      // A double semicolon has replaced the single semicolon.
      if (value === ';;') {

        this.seenFor = false;
        tag = 'TERMINATOR';
      } else if (value === '`') {
        tag = 'APPLY';

        // The unicode point of bullet point (•) is \u2022.
        // '•' is an operator that requires its operand to 
        // immediately compose with the following function.
      } else if (value === '•') {
        tag = 'COMPOSE';

      } else if (__indexOf.call(MATH, value) >= 0) {
        tag = 'MATH';
      } else if (__indexOf.call(COMPARE, value) >= 0) {
        tag = 'COMPARE';
      } else if (__indexOf.call(COMPOUND_ASSIGN, value) >= 0) {
        tag = 'COMPOUND_ASSIGN';
      } else if (__indexOf.call(UNARY, value) >= 0) {
        tag = 'UNARY';
      } else if (__indexOf.call(SHIFT, value) >= 0) {
        tag = 'SHIFT';

      // '?' has been replaced with '??' to represent existential-logic-operator.
      } else if (__indexOf.call(LOGIC, value) >= 0 || value === '??' && (prev != null ? prev.spaced : void 0)) {

        tag = 'LOGIC';
      } else if (prev) {
        if (value === '(' && (_ref4 = prev[0], __indexOf.call(CALLABLE, _ref4) >= 0)) {
          tag = 'CALL_START';

        // A pipe has replaced '?' as the source-code glyph representing 'INDEX_SOAK'.
        } else if (value === '[' && !prev.spaced && ((_ref5 = prev[0], __indexOf.call(INDEXABLE, _ref5) >= 0) || prev[1] === '|' && (_ref6 = last(this.tokens, 1), !_ref6.spaced))) {

          tag = 'INDEX_START';
          if (prev[1] === '|') {
            prev[0] = 'INDEX_SOAK';
          }
        }
      }
      switch (value) {
        case '(':
        case '{':
        case '[':
          this.ends.push(INVERSES[value]);
          break;
        case ')':
        case '}':
        case ']':
          this.pair(value);
      }
      this.token(tag, value);
      return value.length;
    };

    Lexer.prototype.sanitizeHeredoc = function(doc, options) {
      var attempt, herecomment, indent, match, _ref2;
      indent = options.indent, herecomment = options.herecomment;
      if (herecomment) {
        if (HEREDOC_ILLEGAL.test(doc)) {
          this.error("block comment cannot contain \"*/\", starting");
        }
        if (doc.indexOf('\n') < 0) {
          return doc;
        }
      } else {
        while (match = HEREDOC_INDENT.exec(doc)) {
          attempt = match[1];
          if (indent === null || (0 < (_ref2 = attempt.length) && _ref2 < indent.length)) {
            indent = attempt;
          }
        }
      }
      if (indent) {
        doc = doc.replace(RegExp("\\n" + indent, "g"), '\n');
      }
      if (!herecomment) {
        doc = doc.replace(/^\n/, '');
      }
      return doc;
    };

    Lexer.prototype.tagParameters = function() {
      var i, stack, tok, tokens;
      if (this.tag() !== ')') {
        return this;
      }
      stack = [];
      tokens = this.tokens;
      i = tokens.length;
      tokens[--i][0] = 'PARAM_END';
      while (tok = tokens[--i]) {
        switch (tok[0]) {
          case ')':
            stack.push(tok);
            break;
          case '(':
          case 'CALL_START':
            if (stack.length) {
              stack.pop();
            } else if (tok[0] === '(') {
              tok[0] = 'PARAM_START';
              return this;
            } else {
              return this;
            }
        }
      }
      return this;
    };

    Lexer.prototype.closeIndentation = function() {
      return this.outdentToken(this.indent);
    };

    Lexer.prototype.balancedString = function(str, end) {
      var continueCount, i, letter, match, prev, stack, _i, _ref2;
      continueCount = 0;
      stack = [end];
      for (i = _i = 1, _ref2 = str.length; 1 <= _ref2 ? _i < _ref2 : _i > _ref2; i = 1 <= _ref2 ? ++_i : --_i) {
        if (continueCount) {
          --continueCount;
          continue;
        }
        switch (letter = str.charAt(i)) {
          case '\\':
            ++continueCount;
            continue;
          case end:
            stack.pop();
            if (!stack.length) {
              return str.slice(0, +i + 1 || 9e9);
            }
            end = stack[stack.length - 1];
            continue;
        }
        if (end === '}' && (letter === '"' || letter === "'")) {
          stack.push(end = letter);
        } else if (end === '}' && letter === '/' && (match = HEREGEX.exec(str.slice(i)) || REGEX.exec(str.slice(i)))) {
          continueCount += match[0].length - 1;
        } else if (end === '}' && letter === '{') {
          stack.push(end = '}');
        } else if (end === '"' && prev === '#' && letter === '{') {
          stack.push(end = '}');
        }
        prev = letter;
      }
      return this.error("missing " + (stack.pop()) + ", starting");
    };

    Lexer.prototype.interpolateString = function(str, options) {
      var column, errorToken, expr, heredoc, i, inner, interpolated, len, letter, lexedLength, line, locationToken, nested, offsetInChunk, pi, plusToken, popped, regex, rparen, strOffset, tag, token, tokens, value, _i, _len, _ref2, _ref3, _ref4;
      if (options == null) {
        options = {};
      }
      heredoc = options.heredoc, regex = options.regex, offsetInChunk = options.offsetInChunk, strOffset = options.strOffset, lexedLength = options.lexedLength;
      offsetInChunk || (offsetInChunk = 0);
      strOffset || (strOffset = 0);
      lexedLength || (lexedLength = str.length);
      tokens = [];
      pi = 0;
      i = -1;
      while (letter = str.charAt(i += 1)) {
        if (letter === '\\') {
          i += 1;
          continue;
        }
        if (!(letter === '#' && str.charAt(i + 1) === '{' && (expr = this.balancedString(str.slice(i + 1), '}')))) {
          continue;
        }
        if (pi < i) {
          tokens.push(this.makeToken('NEOSTRING', str.slice(pi, i), strOffset + pi));
        }
        if (!errorToken) {
          errorToken = this.makeToken('', 'string interpolation', offsetInChunk + i + 1, 2);
        }
        inner = expr.slice(1, -1);
        if (inner.length) {
          _ref2 = this.getLineAndColumnFromChunk(strOffset + i + 1), line = _ref2[0], column = _ref2[1];
          nested = new Lexer().tokenize(inner, {
            line: line,
            column: column,
            rewrite: false
          });
          popped = nested.pop();
          if (((_ref3 = nested[0]) != null ? _ref3[0] : void 0) === 'TERMINATOR') {
            popped = nested.shift();
          }
          if (len = nested.length) {
            if (len > 1) {
              nested.unshift(this.makeToken('(', '(', strOffset + i + 1, 0));
              nested.push(this.makeToken(')', ')', strOffset + i + 1 + inner.length, 0));
            }
            tokens.push(['TOKENS', nested]);
          }
        }
        i += expr.length;
        pi = i + 1;
      }
      if ((i > pi && pi < str.length)) {
        tokens.push(this.makeToken('NEOSTRING', str.slice(pi), strOffset + pi));
      }
      if (regex) {
        return tokens;
      }
      if (!tokens.length) {
        return this.token('STRING', '""', offsetInChunk, lexedLength);
      }
      if (tokens[0][0] !== 'NEOSTRING') {
        tokens.unshift(this.makeToken('NEOSTRING', '', offsetInChunk));
      }
      if (interpolated = tokens.length > 1) {
        this.token('(', '(', offsetInChunk, 0, errorToken);
      }
      for (i = _i = 0, _len = tokens.length; _i < _len; i = ++_i) {
        token = tokens[i];
        tag = token[0], value = token[1];
        if (i) {
          if (i) {
            plusToken = this.token('+', '+');
          }
          locationToken = tag === 'TOKENS' ? value[0] : token;
          plusToken[2] = {
            first_line: locationToken[2].first_line,
            first_column: locationToken[2].first_column,
            last_line: locationToken[2].first_line,
            last_column: locationToken[2].first_column
          };
        }
        if (tag === 'TOKENS') {
          (_ref4 = this.tokens).push.apply(_ref4, value);
        } else if (tag === 'NEOSTRING') {
          token[0] = 'STRING';
          token[1] = this.makeString(value, '"', heredoc);
          this.tokens.push(token);
        } else {
          this.error("Unexpected " + tag);
        }
      }
      if (interpolated) {
        rparen = this.makeToken(')', ')', offsetInChunk + lexedLength, 0);
        rparen.stringEnd = true;
        this.tokens.push(rparen);
      }
      return tokens;
    };

    Lexer.prototype.pair = function(tag) {
      var wanted;
      if (tag !== (wanted = last(this.ends))) {
        if ('OUTDENT' !== wanted) {
          this.error("unmatched " + tag);
        }
        this.outdentToken(last(this.indents), true);
        return this.pair(tag);
      }
      return this.ends.pop();
    };

    Lexer.prototype.getLineAndColumnFromChunk = function(offset) {
      var column, lineCount, lines, string;
      if (offset === 0) {
        return [this.chunkLine, this.chunkColumn];
      }
      if (offset >= this.chunk.length) {
        string = this.chunk;
      } else {
        string = this.chunk.slice(0, +(offset - 1) + 1 || 9e9);
      }
      lineCount = count(string, '\n');
      column = this.chunkColumn;
      if (lineCount > 0) {
        lines = string.split('\n');
        column = last(lines).length;
      } else {
        column += string.length;
      }
      return [this.chunkLine + lineCount, column];
    };

    Lexer.prototype.makeToken = function(tag, value, offsetInChunk, length) {
      var lastCharacter, locationData, token, _ref2, _ref3;
      if (offsetInChunk == null) {
        offsetInChunk = 0;
      }
      if (length == null) {
        length = value.length;
      }
      locationData = {};
      _ref2 = this.getLineAndColumnFromChunk(offsetInChunk), locationData.first_line = _ref2[0], locationData.first_column = _ref2[1];
      lastCharacter = Math.max(0, length - 1);
      _ref3 = this.getLineAndColumnFromChunk(offsetInChunk + lastCharacter), locationData.last_line = _ref3[0], locationData.last_column = _ref3[1];
      token = [tag, value, locationData];
      return token;
    };

    Lexer.prototype.token = function(tag, value, offsetInChunk, length, origin) {
      var token;
      token = this.makeToken(tag, value, offsetInChunk, length);
      if (origin) {
        token.origin = origin;
      }
      this.tokens.push(token);
      return token;
    };

    Lexer.prototype.tag = function(index, tag) {
      var tok;
      return (tok = last(this.tokens, index)) && (tag ? tok[0] = tag : tok[0]);
    };

    Lexer.prototype.value = function(index, val) {
      var tok;
      return (tok = last(this.tokens, index)) && (val ? tok[1] = val : tok[1]);
    };

    // Soraismus Jan 23, 2014
    // The single-backslash was removed from the list of patterns indicating an unfinished line.
    // Instead, a double-backslash (with the tag 'DBL_BACKSLASH') assumes this role.
    Lexer.prototype.unfinished = function() {
      var _ref2;
      return LINE_CONTINUER.test(this.chunk) || ((_ref2 = this.tag()) === 'DBL_BACKSLASH' || _ref2 === '.' || _ref2 === '?.' || _ref2 === '?::' || _ref2 === 'UNARY' || _ref2 === 'MATH' || _ref2 === '+' || _ref2 === '-' || _ref2 === 'SHIFT' || _ref2 === 'RELATION' || _ref2 === 'COMPARE' || _ref2 === 'LOGIC' || _ref2 === 'THROW' || _ref2 === 'EXTENDS');
    };

    Lexer.prototype.removeNewlines = function(str) {
      return str.replace(/^\s*\n\s*/, '').replace(/([^\\]|\\\\)\s*\n\s*$/, '$1');
    };

    Lexer.prototype.escapeLines = function(str, heredoc) {
      str = str.replace(/\\[^\S\n]*(\n|\\)\s*/g, function(escaped, character) {
        if (character === '\n') {
          return '';
        } else {
          return escaped;
        }
      });
      if (heredoc) {

        // TODO: Consider replacing single-backslash with double-backslash.
        return str.replace(MULTILINER, '\\n');

      } else {
        return str.replace(/\s*\n\s*/g, ' ');
      }
    };

    Lexer.prototype.makeString = function(body, quote, heredoc) {
      if (!body) {
        return quote + quote;
      }
      body = body.replace(RegExp("\\\\(" + quote + "|\\\\)", "g"), function(match, contents) {
        if (contents === quote) {
          return contents;
        } else {
          return match;
        }
      });
      body = body.replace(RegExp("" + quote, "g"), '\\$&');
      return quote + this.escapeLines(body, heredoc) + quote;
    };

    Lexer.prototype.error = function(message, offset) {
      var first_column, first_line, _ref2;
      if (offset == null) {
        offset = 0;
      }
      _ref2 = this.getLineAndColumnFromChunk(offset), first_line = _ref2[0], first_column = _ref2[1];
      return throwSyntaxError(message, {
        first_line: first_line,
        first_column: first_column
      });
    };

    return Lexer;

  })();

  JS_KEYWORDS = ['true', 'false', 'null', 'this', 'new', 'delete', 'typeof', 'in', 'instanceof', 'return', 'throw', 'break', 'continue', 'debugger', 'if', 'else', 'switch', 'for', 'while', 'do', 'try', 'catch', 'finally', 'class', 'extends', 'super'];

  COUGH_KEYWORDS = ['undefined', 'then', 'unless', 'until', 'loop', 'of', 'by', 'when'];

  COUGH_ALIAS_MAP = {
    and: '&&',
    or: '||',
    is: '==',
    isnt: '!=',
    not: '!',
    yes: 'true',
    no: 'false',
    on: 'true',
    off: 'false'
  };

  COUGH_ALIASES = (function() {
    var _results;
    _results = [];
    for (key in COUGH_ALIAS_MAP) {
      _results.push(key);
    }
    return _results;
  })();

  COUGH_KEYWORDS = COUGH_KEYWORDS.concat(COUGH_ALIASES);

  RESERVED = ['case', 'default', 'function', 'var', 'void', 'with', 'const', 'let', 'enum', 'export', 'import', 'native', '__hasProp', '__extends', '__slice', '__bind', '__indexOf', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'static', 'yield'];

  STRICT_PROSCRIBED = ['arguments', 'eval'];

  JS_FORBIDDEN = JS_KEYWORDS.concat(RESERVED).concat(STRICT_PROSCRIBED);

  exports.RESERVED = RESERVED.concat(JS_KEYWORDS).concat(COUGH_KEYWORDS).concat(STRICT_PROSCRIBED);

  exports.STRICT_PROSCRIBED = STRICT_PROSCRIBED;

  JS_PROSCRIBED_ID_CHARS = [/~/g, /\!/g, /@/g, /#/g, /%/g, /\^/g, /&/g, /\*/g, /-/g, /\+/g, /</g, />/g, /\//g, /\?/g];
  CHAR_PROXIES = ['tilde', 'bang', 'arobase', 'octothorpe', 'percent', 'caret', 'ampersand', 'asterisk', 'hyphen', 'plus', 'lessthan', 'greaterthan', 'slash', 'question'];

  PROSCRIBED_CHAR_CONVERSION = (function() {
    var _results;
    _results = [];
    for (_i = 0, _len = JS_PROSCRIBED_ID_CHARS.length; _i < _len; _i++) {
      _results.push([JS_PROSCRIBED_ID_CHARS[_i], CHAR_PROXIES[_i]]);
    }
    return _results;
  })();

  BOM = 65279;

  // The following characters are now permitted in source-code IDENTIFERs except in initial position.
  // (The arobase (@), however, is an exception: it may also be the first character of an INDENTIFIER.)
  PROSCRIBED_ID_CHAR = /[~!@#%\^&\*\-\+<>\/?]/;

  // Patterns for '\' (which represents 'LAMBDA') and '\\' (which indicates a line continuation) have been added.
  // A Pattern for one and only one semicolon (';') (which represents 'ALT_MODE_TOGGLE') has been added.
  // A string representing an IDENTIFIER may now include (but not start with) '?'.
  
  // TODO: Rewrite to prevent matching on ';:', '\:', or '\\:'. 
  IDENTIFIER = /^([@$A-Za-z_\x7f-\u2021\u2023-\uffff](?:[~!@#$%^&*<>\/?\w\x7f-\uffff]|\+(?!\+)|-(?!-))*|\\{1,2}|;(?!;))([^\n\S]*:(?!:))?/;

  NUMBER = /^0b[01]+|^0o[0-7]+|^0x[\da-f]+|^\d*\.?\d+(?:e[+-]?\d+)?/i;

  HEREDOC = /^("""|''')((?:\\[\s\S]|[^\\])*?)(?:\n[^\n\S]*)?\1/;

  // A pattern for ';;' (which represents line termination) has been added.
  // A pattern for '??' (which represent the existential logic operator) has been added.
  OPERATOR = /^(?:[-=]>|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|?<>])\2=?|\?(\.|::)|\.{2,3}|;;)/;

  WHITESPACE = /^[^\n\S]+/;

  COMMENT = /^###([^#][\s\S]*?)(?:###[^\n\S]*|###$)|^(?:\s*#(?!##[^#]).*)+/;

  CODE = /^[-=]>/;

  MULTI_DENT = /^(?:\n[^\n\S]*)+/;

  SIMPLESTR = /^'[^\\']*(?:\\[\s\S][^\\']*)*'/;

  // The double-backtick replaces the single-backtick, so that the 
  // single-backtick can signify immediate functional application/composition
  // (depending on context).
  JSTOKEN = /^``[^\\`]*(?:\\.[^\\`]*)*``/;

  REGEX = /^(\/(?![\s=])[^[\/\n\\]*(?:(?:\\[\s\S]|\[[^\]\n\\]*(?:\\[\s\S][^\]\n\\]*)*])[^[\/\n\\]*)*\/)([imgy]{0,4})(?!\w)/;

  HEREGEX = /^\/{3}((?:\\?[\s\S])+?)\/{3}([imgy]{0,4})(?!\w)/;

  HEREGEX_OMIT = /((?:\\\\)+)|\\(\s|\/)|\s+(?:#.*)?/g;

  MULTILINER = /\n/g;

  HEREDOC_INDENT = /\n+([^\n\S]*)/g;

  HEREDOC_ILLEGAL = /\*\//;

  LINE_CONTINUER = /^\s*(?:,|\??\.(?![.\d])|::)/;

  TRAILING_SPACES = /\s+$/;

  COMPOUND_ASSIGN = ['-=', '+=', '/=', '*=', '%=', '||=', '&&=', '?=', '<<=', '>>=', '>>>=', '&=', '^=', '|='];

  UNARY = ['!', '~', 'NEW', 'TYPEOF', 'DELETE', 'DO'];

  // '??' replaces '?' as the binary existence operator.
  LOGIC = ['&&', '||', '&', '|', '^', '??'];

  SHIFT = ['<<', '>>', '>>>'];

  COMPARE = ['==', '!=', '<', '>', '<=', '>='];

  MATH = ['*', '/', '%'];

  RELATION = ['IN', 'OF', 'INSTANCEOF'];

  BOOL = ['TRUE', 'FALSE'];

  NOT_REGEX = ['NUMBER', 'REGEX', 'BOOL', 'NULL', 'UNDEFINED', '++', '--'];

  NOT_SPACED_REGEX = NOT_REGEX.concat(')', '}', 'THIS', 'IDENTIFIER', 'STRING', ']');

  // The '?' has been removed, and 'ALT_MODE_TOGGLE' has been added.
  CALLABLE = ['IDENTIFIER', 'STRING', 'REGEX', ')', ']', '}', '::', '@', 'THIS', 'SUPER', 'ALT_MODE_TOGGLE'];

  INDEXABLE = CALLABLE.concat('NUMBER', 'BOOL', 'NULL', 'UNDEFINED');

  LINE_BREAK = ['INDENT', 'OUTDENT', 'TERMINATOR'];

  INDENTABLE_CLOSERS = [')', '}', ']'];

}).call(this);
