// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// Query String Utilities

var QueryString = exports;
var urlDecode = process.binding('http_parser').urlDecode;


// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}


function charCode(c) {
  return c.charCodeAt(0);
}


// a safe fast alternative to decodeURIComponent
QueryString.unescapeBuffer = function(s, decodeSpaces) {
  var out = new Buffer(s.length);
  var state = 'CHAR'; // states: CHAR, HEX0, HEX1
  var n, m, hexchar;

  for (var inIndex = 0, outIndex = 0; inIndex <= s.length; inIndex++) {
    var c = s.charCodeAt(inIndex);
    switch (state) {
      case 'CHAR':
        switch (c) {
          case charCode('%'):
            n = 0;
            m = 0;
            state = 'HEX0';
            break;
          case charCode('+'):
            if (decodeSpaces) c = charCode(' ');
            // pass thru
          default:
            out[outIndex++] = c;
            break;
        }
        break;

      case 'HEX0':
        state = 'HEX1';
        hexchar = c;
        if (charCode('0') <= c && c <= charCode('9')) {
          n = c - charCode('0');
        } else if (charCode('a') <= c && c <= charCode('f')) {
          n = c - charCode('a') + 10;
        } else if (charCode('A') <= c && c <= charCode('F')) {
          n = c - charCode('A') + 10;
        } else {
          out[outIndex++] = charCode('%');
          out[outIndex++] = c;
          state = 'CHAR';
          break;
        }
        break;

      case 'HEX1':
        state = 'CHAR';
        if (charCode('0') <= c && c <= charCode('9')) {
          m = c - charCode('0');
        } else if (charCode('a') <= c && c <= charCode('f')) {
          m = c - charCode('a') + 10;
        } else if (charCode('A') <= c && c <= charCode('F')) {
          m = c - charCode('A') + 10;
        } else {
          out[outIndex++] = charCode('%');
          out[outIndex++] = hexchar;
          out[outIndex++] = c;
          break;
        }
        out[outIndex++] = 16 * n + m;
        break;
    }
  }

  // TODO support returning arbitrary buffers.

  return out.slice(0, outIndex - 1);
};


QueryString.unescape = function(s, decodeSpaces) {
  return QueryString.unescapeBuffer(s, decodeSpaces).toString();
};


QueryString.escape = function(str) {
  return encodeURIComponent(str);
};

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};


QueryString.stringify = QueryString.encode = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return Object.keys(obj).map(function(k) {
      var ks = QueryString.escape(stringifyPrimitive(k)) + eq;
      if (Array.isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + QueryString.escape(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + QueryString.escape(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return QueryString.escape(stringifyPrimitive(name)) + eq +
         QueryString.escape(stringifyPrimitive(obj));
};

// Parse a key=val string.
QueryString.parseOld = QueryString.decodeOld = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    try {
      k = decodeURIComponent(kstr);
      v = decodeURIComponent(vstr);
    } catch (e) {
      k = QueryString.unescape(kstr, true);
      v = QueryString.unescape(vstr, true);
    }

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (Array.isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

function utf8l(b){
  if (!(b & 0x80)) {
    return 1;
  } else if ((b & 0xE0) === 0xC0){
    return 2;
  } else if ((b & 0xF0) === 0xE0) {
    return 3;
  } else if ((b & 0xF8) === 0xF0) {
    return 4; 
  } else {
    return 0;
  }
}
var qsBuffers = [new Buffer(1),new Buffer(2),new Buffer(3),new Buffer(4)];

QueryString.parse = QueryString.decode = function fn(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';

  var maxKeys = 1000;

  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var o = {}, c='', v='', k='', i, state='key',len=0,encodeBuffer,
  // create a 4 length buffer to house a utf8 character
  encoded='',invalid = '',encodedCharCode=0,encodedLength=0,encodedChars=0;

  if (typeof qs !== 'string' || qs.length === 0) {
    return o;
  }

  for(i=0;i<qs.length;i++) {
    c = qs[i];
     
    if(c === sep) {
      if(k !== '') {
        if(hasOwnProperty(o,k)){
          if(Array.isArray(o[k])) o[k].push(v);
          else o[k] = [o[k],v];
        } else {
          o[k] = v;
        }
      }
      k = '';
      v = '';
      state = 'key';
      len++;
      if(maxKeys && len >= maxKeys) {
        break;
      }
      continue;  
    } else if(c === eq && state != 'value') {
      state = 'value';
      continue;
    } else if(c === "+") {
      c = " ";
    } else if(c === '%') {
      if(i+2 < qs.length) {
        // keep reading characters off as long as they are encoded.
        // write them into the buffer

        encodedChars = 0;
        invalid = '';

        encoded = qs[++i]+qs[++i];
        encodedCharCode = parseInt(encoded,16);
        if(isNaN(encodedCharCode)){
          c += encoded;
        } else {

          encodedLength = utf8l(encodedCharCode);
          encodeBuffer = qsBuffers[encodedLength-1];
          encodeBuffer.writeUInt8(encodedCharCode,encodedChars++);
 
          while(qs[i+1] === '%' && i+2 < qs.length && encodedChars < encodedLength){
            
            encoded = qs[i+2]+qs[i+3];
            i += 3;
            encodedCharCode = parseInt(encoded,16); 
            if(isNaN(encodedCharCode)) {
              invalid = '%'+encoded;
              break;
            } else {
              encodeBuffer.writeUInt8(encodedCharCode,encodedChars++);
            }
          }

          if(encodedChars == encodeBuffer.length){
            c = encodeBuffer.toString('utf8')
          } else {
            c = encodeBuffer.slice(0,encodedChars).toString('utf8');
          }
          c += invalid;
        }
      }
    }

    if(state === 'key'){
      k += c;
    } else {
      v += c;
    }	

  }

  if(state === 'value') {
    if(hasOwnProperty(o,k)) {
      if(Array.isArray(o[k])) o[k].push(v);
      else o[k] = [o[k],v];
    } else {
      o[k] = v;
    }
  }

  return o; 
}

/*

i tried to beat node buffer.. it's utf8 encoding is so fast its amazing.

function utf8c(length,charcode,bytes,number){
  var mask = [0x80,0xc0,0xe0,0xf0];
  bytes |= (charcode&~mask[length-1])<<(number-1)*6;
  return c;
}
*/
