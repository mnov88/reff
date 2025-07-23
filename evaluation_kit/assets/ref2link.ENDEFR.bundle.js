(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":1,"buffer":2,"ieee754":3}],3:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
(function (global,Buffer){(function (){
"use strict";

var _index = require("./lib/index.js");
var _converters = require("./lib/utils/converters.js");
var _letters = require("./lib/utils/letters.js");
var _index2 = require("./lib/rules/index.js");
var _index3 = require("./lib/jquery/index.js");
var _index4 = require("./lib/formatters/index.js");
var _index5 = require("./lib/filters/index.js");
var _functions = require("./lib/utils/functions.js");
var _index6 = require("./lib/ux/index.js");
var _index7 = require("./lib/settings/index.js");
var _index8 = require("./lib/manager/index.js");
var _index9 = require("./lib/alias/index.js");
/**
 * Will bootstrap the Ref2Link library in the environment it's been loaded (server-side or client-side).
 */
var isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();

/**
 * Prevent double inclusion - CONFLUENCE
 */
if (isBrowser) {
  var isAlreadyIncluded = false;
  try {
    isAlreadyIncluded = window.R2L && window.R2L.version === _index.R2L.getConstant("R2L_VERSION");
  } catch (e) {}
  if (isAlreadyIncluded) {
    throw new Error("Already included R2L library");
  }
}
console.debug("Initializing R2L");
_index.R2L.$el = null;
_index.R2L.version = _index.R2L.getConstant("R2L_VERSION");
_index.R2L.build = _index.R2L.getConstant("R2L_BUILD_INFO");
_index.R2L.info = "<p>Ref2link version: ".concat(_index.R2L.version, "</p>");
_index.R2L.errors = [];
_index.R2L.delimiter2RegExp = _functions.delimiter2RegExp;
_index.R2L.getNonCapturingPattern = _functions.getNonCapturingPattern;
_index.R2L.letters = _letters.letters;
_index.R2L.filters = _index.R2L.defaultFilters = {
  environments: ['*']
};
_index.R2L.settings = _index7.settings;
_index.R2L.dataRef2linkInitialAttribute = _index7.settings.dataInitialAttribute;
_index.R2L.dataRef2linkContextAttribute = _index7.settings.dataContextAttribute;
_index.R2L.ref2linkDataAttribute = _index7.settings.dataAttribute;
_index.R2L.maxReferenceLength = _index7.settings.maxReferenceLength;
_index.R2L.maxTitleLength = _index7.settings.maxTitleLength;
_index.R2L.editOptions = _index7.viewOptions; //DEPRECATED
_index.R2L.viewOptions = _index7.viewOptions;
_index.R2L.converters = _converters.converters;
_index.R2L.notooltipOptions = {
  tooltipTrigger: 'notooltip'
};
_index.R2L.options = {
  //defaults
  worker: false,
  // use the WebWorker when supported in the Browser
  aliases: false,
  // Boolean to turn the aliases on/off
  ai: false,
  // Boolean to enable AI feature and detect orphan subdivisions
  metadata: false,
  // equivalent with `linkeddata`
  /**
   * Possible values: [ 
   *     LD_MODE_ALL,             # Enables LD_MODE_* options below
   *     LD_MODE_METADATA,        # Load metadata (titles, OJ, dates) from Cellar
   *     LD_MODE_SEQ_NUMBER,      # Resolve ambiguos references
   *     LD_MODE_CHECK_EXISTS,    # Check existing CELEX ids and remove non-existent ones
   *     LD_ADVANCED_MODE_SHORT_TITLES,  # Advanced mode, needs to be explicitly enabled. Will parse the long titles extracted from Cellar to generate shorter references. 
   *     LD_ADVANCED_MODE_CORRECTIONS,   # Will query each act's corrections
   *     LD_ADVANCED_MODE_KM_HANDOC # Will query ULM's API for ARES data; Requires a valid ECAS ticket.
   * ]
   */
  linkedDataMode: [_index7.LD_MODE_ALL],
  // does not include the LD_ADVANCED_MODE_* features
  enableSpecialRules: true,
  language: false,
  // TARGET language iso3; 
  multiLanguage: false,
  // iso3 language list (separated by dash) for the EUR-Lex side-by-side. Example: 'ENG-FRA-SPA'
  pointInTime: null,
  // an optional YYYY-MM-DD date to append to ELI urls (instead of the default `/oj`)
  strictRules: {} // a map with rule types as keys which applies the `strict-pattern`. Example value: `{ "eurlex.act": true }`
};
_index.R2L.alias = new _index9.AliasManager();
_index.R2L.ldm = new _index8.LinkedDataManager();
_index.R2L.hooks = {};
_index.R2L.globalMatches = _index.R2L.globalViews = {};
(0, _index5.bindFilters)(_index.R2L);
(0, _index4.bindFormatters)(_index.R2L);
(0, _index2.bindRules)(_index.R2L);
(0, _index3.bindJquery)(_index.R2L);
_index.R2L.triggers = (0, _index6.getTriggers)(_index.R2L);

/** expose linked data methods on top level API */
_index.R2L.getCelexData = _index.R2L.ldm.getCelexData.bind(_index.R2L.ldm);
_index.R2L.getEliData = _index.R2L.ldm.getEliData.bind(_index.R2L.ldm);
_index.R2L.getAresData = _index.R2L.ldm.getAresData.bind(_index.R2L.ldm);
_index.R2L.getActsCitedByAct = _index.R2L.ldm.getActsCitedByAct.bind(_index.R2L.ldm);
_index.R2L.getActsCitingAct = _index.R2L.ldm.getActsCitingAct.bind(_index.R2L.ldm);
_index.R2L.getBasisActsByAct = _index.R2L.ldm.getBasisActsByAct.bind(_index.R2L.ldm);
_index.R2L.getActsByBasisAct = _index.R2L.ldm.getActsByBasisAct.bind(_index.R2L.ldm);
_index.R2L.getClassifications = _index.R2L.ldm.getClassifications.bind(_index.R2L.ldm);
_index.R2L.getEurlexContent = _index.R2L.ldm.getEurlexContent.bind(_index.R2L.ldm);
if (isBrowser) {
  /** For client env only */
  window.R2L = _index.R2L;
  if (window.$ && window.$.fn) {
    window.$.fn.ref2link = _index.R2L;
  }
  if (_index.R2L.options.worker && window.Worker) {
    _index.R2L.registerWorker();
  }

  // only bind tooltips when the library is integrated in a Browser. Server-side it does not make any sense, even if we have a virtual DOM set up.
  (0, _index6.bindTooltips)(_index.R2L);
} else {
  /** Server-side bindings */
  module.exports = _index.R2L;
  global.btoa = function (str) {
    return new Buffer(str).toString('base64');
  };
  global.R2L = _index.R2L;
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./lib/alias/index.js":5,"./lib/filters/index.js":6,"./lib/formatters/index.js":7,"./lib/index.js":8,"./lib/jquery/index.js":10,"./lib/manager/index.js":18,"./lib/rules/index.js":31,"./lib/settings/index.js":32,"./lib/utils/converters.js":53,"./lib/utils/functions.js":56,"./lib/utils/letters.js":57,"./lib/ux/index.js":63,"buffer":2}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AliasManager = void 0;
exports.calculateSubAlias = calculateSubAlias;
exports.getCelexFullTitlesQuery = getCelexFullTitlesQuery;
exports.replaceAliasMatches = replaceAliasMatches;
exports.replaceAliases = replaceAliases;
var _jquery = require("../jquery.js");
var _functions = require("../utils/functions.js");
var _index = require("../settings/index.js");
var _letters = require("../utils/letters.js");
var _index2 = require("../manager/index.js");
var _index3 = require("../transformers/utils/index.js");
var _processor = require("../utils/processor.js");
var _request = require("../utils/request.js");
var _ecas = require("../manager/ecas.js");
var _treaty = require("../manager/data/treaty.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * The ALIAS feature tricks Ref2Link into detecting legal references in the text by applying the rules 
 *   on a different text than the original input text. Once detected, the engine will revert to the original (alias reference) instead of the captured reference and continues its processing pipeline.
 * 
 * Example: 
 *     Input text: `Article 3 of GDPR is now repealed`;
 *     ALIAS_MAP: { GDPR: "Regulation (EU) 2016/679" }     # We define here that `GDPR` in text actually means `Regulation (EU) 2016/679`
 * 
 *     Text that Ref2Link will process: `Article 3 of Regulation (EU) 2016/679 is now repealed`;  # GDPR has been replaced by the formal legal reference so that Ref2Link can detect it.
 *     Detected reference (includes subdivision): `Article 3 of Regulation (EU) 2016/679`
 *     Processed reference (includes subdivision): `Article 3 of GDPR`
 * 
 * Prerequisite:
 *    It is important to remember that Ref2Link processes input in 2 steps: 
 *        1. Apply regular expressions to the text and replace detected references with intermediary `<ref2link-object oid="*"></ref2link-object>` nodes.
 *           This allows the engine to isolate references and avoid overlapping;
 *        2. Replace all intermediary nodes with the final hyperlinks;
 *  
 * 
 * Enabling aliases adds extra steps to the pipeline. Here is how it works:
 * 
 * 1. Submit input text for processing;
 *    Example input text: `C-99/99 lorem ipsum GDPR`
 * 
 * 2. If the ALIAS feature is enabled and we have aliases defined we proceed with the ALIAS replacement - @see `replaceAliases` function:
 *    ALIAS_MAP = { GDPR: "Regulation (EU) 2016/679" }
 *    
 *    Text now becomes: `C-99/99 lorem ipsum Regulation (EU) 2016/679`;
 *     
 *    *If we have no aliases enabled we skip this step and move to step 6;
 * 
 * 3. Parse the text.
 *    Text now becomes: `<ref2link-object oid="1"></ref2link-object> lorem ipsum <ref2link-object oid="2"></ref2link-object>`;
 *    
 * 4. Process the results of the parse operation - replace the detected back-references with their aliases - @see `replaceAliasMatches` function
 * 
 * 5. Post-process the input text and replace all `<ref2link-object>` intermediary elements with hyperlinks;
 * 
 */

var WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

/**
* Aliases manager
* 
* Provides the API methods to get/set alias maps (key => value pairs)
* The manager also provides functionality to load Aliases from Wikidata, for a specific language, using SPARQL queries.
* 
*/
var AliasManager = exports.AliasManager = /*#__PURE__*/function () {
  function AliasManager() {
    _classCallCheck(this, AliasManager);
    this.endpoint = WIKIDATA_ENDPOINT;

    /** 
     * Internal map used for aliases extracted from text (usually by an AI engine). 
     * Example local alias: 'article 3 thereof' which maps to a specific legal act.
     * 
     * This map needs to be reset before each parse operation
     */
    this.localMap = {};

    /**
     * Knowing that aliases are mapped to CELEX ids, ELIs and eurlex acts we can exclude rest of the target types
     */
    this.includeTypes = ['eurlex.act.1', 'eurlex.act.3', 'eurlex.celexId', 'ecli', 'eucase', 'eli.url', 'genericurl'];
  }
  _createClass(AliasManager, [{
    key: "getEndpoint",
    value: function getEndpoint() {
      return this.endpoint;
    }
  }, {
    key: "setEndpoint",
    value: function setEndpoint(endpoint) {
      this.endpoint = endpoint;
    }
  }, {
    key: "enable",
    value: function enable() {
      R2L.options.aliases = true;
    }
  }, {
    key: "disable",
    value: function disable() {
      R2L.options.aliases = false;
    }

    /**
     * 
     * @returns 
     */
  }, {
    key: "__getMap",
    value: function __getMap() {
      return R2L.getConstant("R2L_ALIAS_MAP") || {};
    }
  }, {
    key: "__setMap",
    value: function __setMap(map) {
      R2L.setConstant("R2L_ALIAS_MAP", map);
    }
  }, {
    key: "add",
    value: function add(obj) {
      this.__setMap(_objectSpread(_objectSpread({}, this.__getMap()), obj));
      return this.__getMap();
    }
  }, {
    key: "addLocal",
    value: function addLocal(obj) {
      this.localMap = _objectSpread(_objectSpread({}, this.localMap), obj);
      return this.localMap;
    }
  }, {
    key: "getAll",
    value: function getAll() {
      return this.__getMap();
    }
  }, {
    key: "getAllLocal",
    value: function getAllLocal() {
      return this.localMap;
    }
  }, {
    key: "get",
    value: function get(key) {
      return this.__getMap()[key];
    }
  }, {
    key: "reset",
    value: function reset() {
      this.__setMap({});
      this.localMap = {};
    }
  }, {
    key: "resetLocal",
    value: function resetLocal() {
      this.localMap = {};
    }
  }, {
    key: "remove",
    value: function remove(key) {
      var map = this.__getMap();
      delete map[key];
      this.__setMap(map);
    }

    /**
     * Runs a SPARQL query against Wikidata to fetch aliases
     * @param {String} type 'eurlex.act|eucase'
     * @param {String} langISO2 en/fr... 
     * @param {String} langISO3 eng/fra... 
     * @returns {Promise<Object>}
     */
  }, {
    key: "fetch",
    value: function fetch(type, langISO2, langISO3) {
      return (0, _request.getRequestPromise)(this.getEndpoint(), "GET", {
        query: this.buildQuery(type, langISO2, langISO3)
      }, {
        accept: 'application/sparql-results+json'
      });
    }

    /**
     * Will load aliases into the engine
     * @param {String} type 
     * @param {String} langISO2 
     * @param {String} langISO3
     * @returns {Promise<Object>}
     */
  }, {
    key: "load",
    value: function load(type, langISO2, langISO3) {
      var _this = this;
      return this.fetch(type, langISO2).then(function (response) {
        console.log(type, "Loaded aliases for lang", langISO2, langISO3, response);

        // process result
        return _this.processResponse(response, langISO3).then(function (aliasMap) {
          _this.add(aliasMap);
        });
      });
    }
  }, {
    key: "processResponse",
    value: function processResponse(response, langISO2, langISO3) {
      var map = {};
      try {
        var items = response.results.bindings.map(function (item) {
          return {
            celexId: item.celexId.value,
            label: item.label.value
          };
        });
        items.forEach(function (item) {
          map[item.label] = item.celexId;
        });
      } catch (e) {
        console.error(e);
      }
      return this.getShortTitles(Object.values(map), langISO3).then(function (titleMap) {
        //Turns Celex ids into an act eg: 32006L0066 => Directive 2006/66/EC which can be captured by the act rule (with subdivisions)
        Object.keys(map).forEach(function (aliasTitle) {
          // if refrence not found then fallback to the Celex
          map[aliasTitle] = titleMap[map[aliasTitle]] || map[aliasTitle];
        });
        return map;
      })["catch"](function (err) {
        console.error(err);
        return map;
      });
    }
  }, {
    key: "buildQuery",
    value: function buildQuery(type, langISO2, langISO3) {
      langISO2 = String(langISO2).toLowerCase();
      return "\n            SELECT DISTINCT ?label (MAX(?celex) as ?celexId)\n            WHERE \n            {\n            ?act wdt:P476 ?celex .\n            OPTIONAL {\n                ?act rdfs:label ?label .\n                FILTER (lang(?label) = '".concat(langISO2, "') .\n            }\n            FILTER (REGEX(?celex, \"^3....[LRD]....\")) .\n            FILTER (REGEX(?label, \"^.\")) .\n            FILTER (!REGEX(?label, \"[0-9]\")) .\n            }\n            GROUP BY ?label\n        ");
    }
  }, {
    key: "getAIAliases",
    value: function getAIAliases(text) {
      if (!R2L.options.ai) {
        return new Promise(function (resolve, reject) {
          console.debug("AI alias feature not enabled, no AI aliases found");
          resolve([]);
        });
      }
      return (0, _ecas.getEcasTicket)(_index.settings.constants.R2L_AI_ENDPOINT, R2L.ldm.proxyTicket).then(function (proxyTicket) {
        var headers = {
          Authorization: proxyTicket
        };
        return (0, _request.getRequestPromise)(_index.settings.constants.R2L_AI_ENDPOINT, "POST", {
          inputtext: text
        }, headers)["catch"](function (err) {
          console.error(err);
          return [];
        });
      })["catch"](function (err) {
        console.error(err);
        return [];
      });
    }

    /**
     * Turns Celex ids into an act eg: 32006L0066 => Directive 2006/66/EC which can be captured by the act rule (with subdivisions)
     *
     * @param {Array<String>} celexIds 
     * @param {String} langISO3 
     * @returns {Promise<Object>} Returns a KV map { [celexId] => short title }
     */
  }, {
    key: "getShortTitles",
    value: function getShortTitles(celexIds, langISO3) {
      var _this2 = this;
      // sector 1 is handled differently
      var treatyShortTitlesMap = this.extractTreatyShortTitlesMap(celexIds);
      // full titles required to extract short titles for sector 3
      return this.getFullTitles(celexIds, langISO3).then(function (titleMap) {
        return _objectSpread(_objectSpread({}, _this2.extractShortTitlesMap(titleMap)), treatyShortTitlesMap);
      })["catch"](function (err) {
        console.error(err);
        return {};
      });
    }
  }, {
    key: "extractTreatyShortTitlesMap",
    value: function extractTreatyShortTitlesMap(celexIds, langISO3) {
      celexIds = celexIds.filter(function (celexId) {
        return celexId.slice(0, 1) === '1';
      });
      console.debug("Extract treaty short titles", celexIds, langISO3);
      var map = {};
      celexIds.forEach(function (celexId) {
        var title = (0, _treaty.getEUTreatyShortTitle)(celexId, langISO3);
        if (title) {
          map[celexId] = title;
        }
      });
      return map;
    }

    /**
     * Process full title map and return the short titles
     * @param {Object} titleMap - { KV map of [celexId] => title }
     * @returns {Object} - { KV map of [celexId] => shortTitle }
     */
  }, {
    key: "extractShortTitlesMap",
    value: function extractShortTitlesMap(fullTitlesMap) {
      /**
       * We need to tune Ref2Link for parsing the titles effectively
       *   - Only use eurlex.act rules
       *   - disable linked data 
       */
      var _metadata = R2L.options.metadata;
      var _targets = R2L.filters.targets;
      var allTargets = [];
      R2L.getAllRules().forEach(function (r) {
        r.views.forEach(function (v) {
          allTargets.push(v.target);
        });
      });
      R2L.options.metadata = false;

      // eliminate eurlex.act.3 as it only deals with subdivisions in addition to the other act targets
      R2L.setFilter('targets', allTargets.filter(function (t) {
        return t.indexOf('eurlex.act') === 0 && t.indexOf('eurlex.act.3' !== 0);
      }), true);
      var inputs = [];
      // Ref2link will only process titles for Celex ids starting with "3"
      // for the others it will use placeholders 
      Object.keys(fullTitlesMap).forEach(function (celexId) {
        if (celexId.charAt(0) === '3') {
          inputs.push(fullTitlesMap[celexId]);
        } else {
          inputs.push("");
        }
      });

      // concatenate everything together for Ref2Link to process
      var inputText = inputs.map(function (input) {
        // sanitize input
        return (0, _index3.sanitize)(input);
      }).join("\t\t\t\t");
      return R2L.parse(inputText, "html").then(function (response) {
        // restore settings
        R2L.options.metadata = _metadata;
        R2L.setFilter('targets', _targets, true);

        // split back content and get first ref.
        var matches = response.result.split("\t\t\t\t").map(function (item, index) {
          // return first captured text from each part
          var regex = /<a[^>]*?data-short-reference=(["\'])?((?:.(?!\1|>))*.?)\1?/;
          var matches = item.match(regex);
          var match = matches ? matches[2] || null : null;
          // it's a short title only if the match is at the beginning

          var srcText = inputs[index].replace(new RegExp(String.fromCharCode(160), "g"), " ");
          // if the match is close to the beginning we use it
          if (match && srcText.indexOf(match) < 30) {
            return match;
          }
          return null;
        });

        // merge results together
        var shortTitlesMap = {};
        Object.keys(fullTitlesMap).forEach(function (celexId, index) {
          shortTitlesMap[celexId] = matches[index];
        });
        return shortTitlesMap;
      });
    }

    /**
     * Get full act titles from Cellar
     * @param {Array<String>} celexIds
     * @param {String} langISO3
     * 
     * @returns {Object} Returns a KV map: { [celexId] => title }   
     */
  }, {
    key: "getFullTitles",
    value: function getFullTitles(celexIds, langISO3) {
      // first we query the titles from Cellar
      var query = getCelexFullTitlesQuery(celexIds, langISO3);
      return (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index2.LD_TYPE_CELEX), "POST", {
        query: query,
        format: 'application/json',
        origin: '*',
        target: _index2.LD_TARGET_CELLAR
      }).then(function (response) {
        var map = {};
        // fill map with empty values as some ids might not be found
        celexIds.forEach(function (celexId) {
          map[celexId.toUpperCase()] = null;
        });
        try {
          response.results.bindings.forEach(function (binding) {
            map[binding.id.value.replace("celex:", "").toUpperCase()] = (0, _index3.sanitize)(binding.title.value);
          });
        } catch (e) {
          console.error(e);
        }
        return map;
      });
    }
  }]);
  return AliasManager;
}();
/**
 * Add tolerance to alias definitions (replace " ", "&" with all variants)
 * 
 * @param {String} alias 
 * @param {boolean} isRaw - whether to escape the pattern or not
 * 
 * @returns {String} 
 */
function getRegExp(alias, isRaw) {
  // use the full space pattern
  var spacePattern = "(?:(?:(?:[\\u00a0\\u202F ]|(?:\\u2003|(?:(?:\\x26(?:amp;)?)emsp;))|(?:\\u2002|(?:(?:\\x26(?:amp;)?)ensp;))|(?:\\u2005|(?:(?:\\x26(?:amp;)?)emsp14;))|(?:(?:\\x26(?:amp;)?)nbsp;))+))";
  var ampPattern = "&(?:amp;)?";
  var quotePattern = "(?:['`’])";
  if (!isRaw) {
    alias = (0, _functions.regExpEscape)(alias);
  }
  return alias.replace(new RegExp(" ", 'g'), spacePattern).replace(new RegExp("&", 'g'), ampPattern).replace(new RegExp("'", 'g'), quotePattern);
}
function getCelexFullTitlesQuery(celexIds, langISO3) {
  langISO3 = String(langISO3 || "ENG").toUpperCase(); // default to english
  // unique ids only
  celexIds = celexIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });

  //only support acts for now (ids starting with '3')
  celexIds = celexIds.filter(function (id) {
    return id.slice(0, 1) === '3';
  });
  var filters = "FILTER (?workId IN (";
  for (var i = 0; i < celexIds.length; i++) {
    filters += "\"celex:".concat(celexIds[i], "\", \"celex:").concat(celexIds[i], "\"^^xsd:string"); // query both types
    if (i < celexIds.length - 1) {
      filters += ",";
    }
  }
  filters += "))";
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id \n        ?title \n        WHERE {  \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title\n            }\n            graph ?g { \n                ?exp cdm:expression_uses_language lang:".concat(langISO3, " . \n            }  \n            ?s cdm:work_id_document ?workId.\n            ").concat(filters, "\n        }    \n    ");
  return query;
}

/**
 * Alias replacement in text, based on the Alias maps provided as input to Ref2Link.
 * 
 * Example: 
 *     Input text: "GDPR is now in use."
 *     Defined alias map: { "GDPR": "Regulation (EU) 2016/679"}
 * 
 *     Output text: "Regulation (EU) 2016/679 is now in use."
 * 
 * This result will be again submitted for parsing and the newly detected references will be merged with the previous parsing results.
 * 
 * @param {String} text - Input text AFTER the initial Ref2Link processing, which contains <ref2link-object> nodes for the initially detected references.
 * @param {Object} extracts - previously detected references (before Alias processing) which need to be 
 * temporarily eliminated from the text so that the second Ref2Link processing (the Alias processing) 
 * does not interfere with them. We temporarily replace them with '***' masks.
 * 
 * @returns {Object} text with replaced aliases
 */
function replaceAliases(text, extracts) {
  text = text || '';
  var letterPattern = "[/0-9" + _letters.letters.latin + _letters.letters.cyrillic + _letters.letters.greek + _letters.letters.specialChars + "]";
  var lookahead = (0, _functions.getLookAhead)(letterPattern);
  var lookbehind = (0, _functions.getLookBehind)(letterPattern);
  var offsets = [];
  var map = R2L.alias.getAll();
  if (R2L.options.ai) {
    // we keep the AI retrieved aliases separately (in a 'localMap')
    // here we merge the 2 maps together
    // the AI engine should have populated the local map if any were detected 
    map = _objectSpread(_objectSpread({}, R2L.alias.getAllLocal()), map);
  }

  // We now use the alias map in the text to do the replacements.
  // First we strip the text of already detected references
  for (var i = extracts.length - 1; i >= 0; i--) {
    var ex = extracts[i];
    var length = (ex.$this.attr(R2L.dataRef2linkInitialAttribute) || "").trim().length;
    var extractHtml = '<ref2link-object oid="' + (0, _processor.padCounter)(i) + '"></ref2link-object>';
    var wildcard = "";
    for (var _i = 0; _i < length; _i++) {
      wildcard += "*";
    }
    text = text.split(extractHtml).join(wildcard);
  }
  ;

  // build global pattern of aliases
  var globalPatterns = [];
  var args;
  var sortedKeys = Object.keys(map).sort(function (a, b) {
    return a.length > b.length ? -1 : 1;
  });
  sortedKeys.forEach(function (key) {
    var isRegex = key.substr(0, 1) === "/" && key.substr(key.length - 1, 1) === "/";
    var r = isRegex ? key.substr(1, key.length - 2) : getRegExp(key);
    var slots = 1;
    //clean internal capture groups
    if (isRegex) {
      r = r.replace(new RegExp("\\((?!\\?:)", "g"), function (match, index) {
        if (index >= 1 && r[index - 1] !== "\\") {
          return "(?:";
        } else {
          return match;
        }
      });
    }
    globalPatterns.push({
      key: key,
      regexp: '(' + r + ')',
      value: map[key],
      slots: slots,
      isRegex: isRegex
    });
  });
  if (globalPatterns.length === 0) {
    return {
      text: text,
      offsets: offsets
    };
  }
  var globalPattern = new RegExp('(?![\r\n\v\f])' + lookbehind + "(?:".concat(globalPatterns.map(function (g) {
    return g.regexp;
  }).join('|'), ")") + lookahead, 'ig');
  while (args = globalPattern.exec(text)) {
    var index = null;
    for (var _i2 = 1; _i2 < args.length; _i2++) {
      if (args[_i2]) {
        index = _i2;
        break;
      }
    }
    var reg = void 0;
    var key = globalPatterns[index - 1].key;
    if (globalPatterns[index - 1].isRegex) {
      key = key.substr(1, key.length - 2);
      reg = new RegExp((0, _functions.regExpEscape)(key));
    } else {
      reg = new RegExp(globalPatterns[index - 1].regexp);
    }
    var matches = reg.exec(args[0]);
    var pattern = globalPatterns[index - 1];
    var offset = {
      source: args[0],
      replacement: pattern.isRegex ? replaceBackrefs(matches, pattern.value) : pattern.value,
      position: args.index
    };
    offsets.push(offset);
  }
  var cursorOffset = 0;
  // Add after-replacement offsets too
  offsets.map(function (o, index) {
    o.replacementPosition = o.position + cursorOffset;
    cursorOffset += o.replacement.length - o.source.length;
  });
  var currentDelta = 0;
  var currentCursor = 0;
  offsets.forEach(function (offset) {
    currentCursor = offset.position + currentDelta;
    text = text.slice(0, currentCursor) + offset.replacement + text.slice(currentCursor + offset.source.length, text.length);
    currentDelta += offset.replacement.length - offset.source.length;
  });
  return {
    text: text,
    offsets: offsets
  };
}
var replaceBackrefs = function replaceBackrefs(args, val) {
  if (!args) {
    return val;
  }
  for (var i = 0; i < args.length; i++) {
    if (!args[i]) {
      continue;
    }
    var regex = new RegExp("\\{\\{\\s?\\$" + i + "\\s?\\}\\}", "g");
    val = val.replace(regex, args[i]);
  }
  return val;
};

/**
 * Mutates the `matches` (Ref2Link processing result) object to merge the alias processing result
 * @param {Object} matches 
 * @param {Object} replaceAliasesResult 
 * @returns {Object} matches
 */
function replaceAliasMatches(matches, replaceAliasesResult) {
  var offsets = _toConsumableArray(replaceAliasesResult.offsets);
  offsets = offsets.sort(function (a, b) {
    return a.replacement.length > b.replacement.length ? -1 : 1;
  });

  // we need to replace the match (+ its offsets and its key) back with the alias

  // all the matches should be alias-based
  Object.keys(matches).forEach(function (key) {
    var newMatch = matches[key];
    newMatch.offsets = newMatch.offsets.map(function (matchOffset) {
      var aliasOffset = null;
      if (matchOffset.context.indexOf(matchOffset.match) === -1) {
        return matchOffset;
      }

      // get the correct offset using the replacementPosition of the alias offsets
      var referenceStart = matchOffset.position - matchOffset.context.indexOf(matchOffset.match);
      var referenceEnd = referenceStart + matchOffset.context.length;
      for (var i = 0; i < replaceAliasesResult.offsets.length; i++) {
        if (replaceAliasesResult.offsets[i].replacementPosition >= referenceStart && replaceAliasesResult.offsets[i].replacementPosition < referenceEnd) {
          // can also be the next alias offset
          aliasOffset = replaceAliasesResult.offsets[i];
          break;
        }
      }
      if (aliasOffset) {
        matchOffset = replaceFn(matchOffset, aliasOffset.replacement, aliasOffset.source);
        matchOffset.alias = aliasOffset;
        //adjust position by applying the delta of its aliasOffset
        matchOffset.position += aliasOffset.position - aliasOffset.replacementPosition;
        matchOffset.positionDelta = aliasOffset.source.length - aliasOffset.replacement.length;
      }
      return matchOffset;
    });
  });
  var newMatches = {};

  // replace keys and match objects
  Object.keys(matches).forEach(function (key) {
    for (var i = 0; i < matches[key].offsets.length; i++) {
      var matchOffset = matches[key].offsets[i];
      if (matchOffset.alias) {
        var newKey = key.replace(matchOffset.alias.replacement, matchOffset.alias.source);
        var newMatch = matches[key];
        newMatches[newKey] = replaceFn(newMatch, matchOffset.alias.replacement, matchOffset.alias.source);
        break;
      } else {
        newMatches[key] = matches[key];
      }
    }
  });

  // we also need to adjust the offsets for refs that are not aliases now
  var offsetsArr = [];
  // apply all position deltas caused by aliases
  Object.values(newMatches).forEach(function (match) {
    match.offsets.forEach(function (offset) {
      // find all matches with a lower position and apply delta
      offsetsArr.push(offset);
    });
  });
  // sort matches by position
  offsetsArr.sort(function (off1, off2) {
    if (off1.alias && !off2.alias) {
      return off1.alias.replacementPosition < off2.position ? -1 : 1;
    }
    if (off2.alias && !off1.alias) {
      return off1.position < off2.alias.replacementPosition ? -1 : 1;
    }
    return off1.position < off2.position ? -1 : 1;
  });
  offsetsArr.forEach(function (offset, index) {
    for (var idx = 0; idx < index; idx++) {
      // apply all deltas from aliases
      if (!offset.alias && offsetsArr[idx].positionDelta) {
        offset.position += offsetsArr[idx].positionDelta;
      }
    }
  });
  return newMatches;
}

// reuse the same element
var _textarea;
var replaceFn = function replaceFn(obj, search, replace) {
  var subAlias = calculateSubAlias(search, replace, obj.context);
  console.debug("Subalias", subAlias);
  search = subAlias.search;
  replace = subAlias.replace;
  var searchRegexp = new RegExp((0, _functions.regExpEscape)(search), 'g');

  // use a text area which is not vulnerable to XSS injection as it will not process tags (only entities)
  _textarea = _textarea || document.createElement("textarea");
  _textarea.innerHTML = replace;
  var replaceTextContent = _textarea.value;
  obj.match = obj.match.replace(searchRegexp, replace);
  if (obj.reference) {
    obj.reference = obj.reference.replace(searchRegexp, replace);
  }
  if (obj.wholeMatch) {
    obj.wholeMatch = obj.wholeMatch.replace(searchRegexp, replace);
  }
  if (obj.context) {
    obj.context = obj.context.replace(searchRegexp, replace);
  }
  if (obj.link) {
    obj.link = obj.link.replace(searchRegexp, replace);
  }
  if (obj.views) {
    Object.keys(obj.views).forEach(function (k) {
      if (k === 'table') {
        return;
      }

      // Only replace the content and some attributes. We must be careful not to replace inside hrefs.
      try {
        var $el = (0, _jquery.$)(obj.views[k]);
        if ($el.length) {
          $el[0].textContent = $el[0].textContent.replace(searchRegexp, replaceTextContent);
          //$el.html($el.html().replace(searchRegexp, replace));

          if ($el.attr(R2L.dataRef2linkInitialAttribute)) {
            $el.attr(R2L.dataRef2linkInitialAttribute, $el.attr(R2L.dataRef2linkInitialAttribute).replace(searchRegexp, replace));
          }
          obj.views[k] = $el[0].outerHTML;
        } else {
          obj.views[k] = obj.views[k].replace(searchRegexp, replace);
        }
      } catch (e) {
        // table view, ignore
      }
    });
  }
  if (obj.alternatives) {
    obj.alternatives = obj.alternatives.map(function (alt) {
      try {
        var $el = (0, _jquery.$)(alt.view);
        if ($el.length) {
          // replace textContent as it is not escaped
          $el[0].textContent = $el[0].textContent.replace(searchRegexp, replaceTextContent);
          //$el.html($el.html().replace(searchRegexp, replace));
          if ($el.attr(R2L.dataRef2linkInitialAttribute)) {
            $el.attr(R2L.dataRef2linkInitialAttribute, $el.attr(R2L.dataRef2linkInitialAttribute).replace(searchRegexp, replace));
          }
          if ($el.attr(R2L.dataRef2linkContextAttribute)) {
            $el.attr(R2L.dataRef2linkContextAttribute, $el.attr(R2L.dataRef2linkContextAttribute).replace(searchRegexp, replace));
          }
          alt.view = $el[0].outerHTML;
        } else {
          alt.view = alt.view.replace(searchRegexp, replace);
        }
      } catch (e) {
        // table view, ignore
      }
      alt.reference = alt.reference.replace(searchRegexp, replace);
      alt.match = alt.match.replace(searchRegexp, replace);
      alt.wholeMatch = alt.wholeMatch.replace(searchRegexp, replace);
      alt.context = alt.context.replace(searchRegexp, replace);
      alt.link = alt.link.replace(searchRegexp, replace);
      return alt;
    });
  }
  return obj;
};

/**
 * Substract the common block from 2 strings. Example: 
 *   str1 = 'Article 12(4) and (5) of Directive 2004/109/EC of the European Commission regarding bla bla'
 *   str2 = 'Article 12(4) and (5) of that Directive'
 *   context = 'Article 12(4) and (5) of Directive 2004/109/EC'
 * Returns: { search: 'that Directive', replace: 'Directive 2004/109/EC' }
 * @param {String} str1 
 * @param {String} str2 
 * 
 * @returns {Object}
 */
function calculateSubAlias(str1, str2, context) {
  // if the alias coming from OpenAI is too verbose and Ref2Link only matches a part of it we drop the ending
  if (str1.indexOf(context) === 0 && str1.length > context.length) {
    str1 = context;
  }
  var length1 = str1.length;
  var length2 = str2.length;
  var minLength = length1 < length2 ? length1 : length2;
  var stopper = 0;
  for (var i = 0; i < minLength; i++) {
    if (str1[i] !== str2[i]) {
      stopper = i;
      break;
    }
  }
  return {
    search: str1.substr(stopper),
    replace: str2.substr(stopper)
  };
}

},{"../jquery.js":9,"../manager/data/treaty.js":16,"../manager/ecas.js":17,"../manager/index.js":18,"../settings/index.js":32,"../transformers/utils/index.js":49,"../utils/functions.js":56,"../utils/letters.js":57,"../utils/processor.js":60,"../utils/request.js":61}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bindFilters = bindFilters;
var _jquery = require("../jquery.js");
var _index = require("../rules/index.js");
var _functions = require("../utils/functions.js");
var _filterInitialized = false;
function bindFilters(R2L) {
  R2L.getInitialFilters = function () {
    var filters = {};
    /** Only in browser env we try to read querystring params of the library */
    if (typeof window === "undefined") {
      return filters;
    }
    try {
      var scriptSrc = (0, _jquery.$)('script[src*="ref2link"]').first().attr('src');
      var sqv = decodeURIComponent(scriptSrc.indexOf('?') >= 0 ? scriptSrc.split('?').pop() : '');
      var lqv = decodeURIComponent(document.location.href.indexOf('?') >= 0 ? document.location.href.split('?').pop() : '');
      var qv = [sqv, lqv].join('&');
      if (qv) {
        var parts = qv.split('&');
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].split('=');
          if (p && p.length > 1 && p[1] && p[1] !== '_default') {
            if (p[0] == 're' || p[0] == 'ruleenvironment') {
              filters['environments'] = p[1].split(',');
            }
            if (p[0] == 'rt' || p[0] == 'ruletarget') {
              filters['targets'] = p[1].split(',');
            }
            if (p[0] == 'rr' || p[0] == 'ruletype') {
              filters['types'] = p[1].split(',');
            }
            if (p[0] == 'sort') {
              filters['sort'] = p[1];
            }
            if (p[0] == 'views' && !isNaN(p[1])) {
              filters['views'] = parseInt(p[1]);
            }
          }
        }
      }
    } catch (e) {}
    return filters;
  };
  R2L.resetFilters = function () {
    if (_filterInitialized) {
      return;
    }
    _filterInitialized = true;
    var filters = R2L.getInitialFilters();
    R2L.filters = R2L.defaultFilters;
    Object.keys(filters, function (filterName) {
      var filterValue = filters[filterName];
      R2L.setFilter(filterName, filterValue);
    });
  };
  R2L.setFilter = function (searchedField, searchValue, preserveRuntime) {
    if (Array.isArray(searchValue)) {
      _filterInitialized = true;
      if (searchedField == 'environments') {
        // always add public rules
        (0, _index.clearRuntimeRules)();
        var filteredEnvironments = [],
          globalEnvironments = Object.keys(R2L.getGlobalEnvironments());
        searchValue.forEach(function (_searchVal) {
          if (globalEnvironments.indexOf('' + _searchVal) >= 0) {
            filteredEnvironments.push('' + _searchVal);
          }
        });
        if (filteredEnvironments.indexOf('*') < 0) {
          filteredEnvironments.push('*');
        }
        searchValue = filteredEnvironments;
        R2L.filters['environments'] = searchValue;
      }
      R2L.filters[searchedField] = searchValue;
      /** see what targets match now that the env changed; reset targets with views that are in environment */
      var filteredRules = R2L.getAllRules(),
        availableTargets = [];
      filteredRules.forEach(function (_filteredRule) {
        _filteredRule.views.forEach(function (_view) {
          var targetName = _view.target;
          if (availableTargets.indexOf(targetName) < 0) {
            availableTargets.push(targetName);
          }
        });
      });
      if (R2L.filters['targets'] && R2L.filters['targets'].length) {
        R2L.filters['targets'] = (0, _functions.intersect)(R2L.filters['targets'], availableTargets);
      } else {
        R2L.filters['targets'] = availableTargets;
      }
      if (R2L.filters['targets'].indexOf('table') === -1) {
        R2L.filters['targets'].push('table');
      }
      if (R2L.filters.hasOwnProperty('targets') && R2L.filters.targets.length === 0 || R2L.filters.hasOwnProperty('types') && R2L.filters.types.length === 0) {
        R2L.filters['targets'] = ['NONEOFTHISMATCHES'];
      }
      if (R2L.filters.hasOwnProperty('excludetargets')) {
        R2L.filters['excludetargets'].map(function (excludeTarget) {
          R2L.filters['targets'] = R2L.filters['targets'].filter(function (t) {
            return t.indexOf(excludeTarget) === -1;
          });
        });
      }
      (0, _index.clearRuntimeRules)();
      if (!preserveRuntime) {
        R2L.clearCache();
      }
    }
  };

  /** application parameters placeholders ; the generated file might have other values set in parameters.xml **/
  var _viewOptions = {};
  try {
    _viewOptions = JSON.parse(R2L.getConstant("R2L_VIEW_OPTIONS"));
  } catch (e) {
    console.error(e);
  }
  R2L.linkClassName = _viewOptions['linkClassName'];
  R2L.viewUsesTarget = _viewOptions['viewUsesTarget'];
  R2L.viewTitlePrefix = _viewOptions['viewTitlePrefix'];
  R2L.viewTitleSuffix = _viewOptions['viewTitleSuffix'];

  // when document is ready reset the filters
  (0, _jquery.$)(R2L.resetFilters);
}

},{"../jquery.js":9,"../rules/index.js":31,"../utils/functions.js":56}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bindFormatters = bindFormatters;
var _jquery = require("../jquery.js");
var _decorators = require("../utils/decorators.js");
var _functions = require("../utils/functions.js");
var _index = require("../settings/index.js");
var _data = require("../utils/data.js");
function bindFormatters(R2L) {
  /**
  * Build output nodes from the references map. Group/count accordingly.
  *
  * @param {Object} references
  */
  R2L.getNodes = function (references) {
    var _this = this;
    var idx = 0;
    var rendered = {};
    var nodes = new Array();
    // compute targets list 
    var _allViewTargets = (0, _functions.getAllViewTargetMap)(true);
    Object.keys(references).forEach(function (_refKey) {
      if (!references[_refKey]) {
        return;
      }
      var _ref = references[_refKey];
      for (var k = 0; k < _ref.offsets.length; k++) {
        var views = [];
        var offsetUid = _ref.match;
        var urls = [];
        var attributesList = (0, _functions.extractOrderedAttributes)(_ref.offsets[k].alternatives);
        var label = _ref.match;
        if (Object.keys(_ref.offsets[k].views).length === 0 || Object.keys(_ref.offsets[k].views).length === 1 && _ref.offsets[k].views['table']) {
          // skipping invalid ref or ref filtered by linked data
          continue;
        }
        Object.keys(_ref.offsets[k].views).forEach(function (_view) {
          var view = _ref.offsets[k].views[_view];
          if (!view) {
            return;
          }
          if (String(_view) === "table") {
            label = view;
            offsetUid = view;
          } else {
            views.push('<view target="' + (0, _functions.escapeHTML)(_view) + '"' + '>' + '<![CDATA[' + view + ']]>' + '</view>');
            var $view = (0, _jquery.$)(view);
            if ($view.attr("href")) {
              if (urls.indexOf($view.attr("href")) === -1) {
                urls.push({
                  title: $view.attr("title"),
                  href: $view.attr("href"),
                  target: _view,
                  fullTitle: (0, _functions.getFullTitle)($view.attr("title"), _ref.offsets[k].alternatives.filter(function (a) {
                    return a.viewName === _view;
                  }).map(function (a) {
                    return a.groupTarget;
                  }).pop()),
                  baseTarget: (0, _functions.getBaseTargetName)(_view),
                  position: _ref.offsets[k].position
                });
              }
            } else {
              // can be a nested link
              $view = (0, _jquery.$)(view).children("a");
              if ($view.attr("href")) {
                if (urls.indexOf($view.attr("href")) === -1) {
                  urls.push({
                    title: $view.attr("title"),
                    fullTitle: (0, _functions.getFullTitle)($view.attr("title"), _ref.offsets[k].alternatives.filter(function (a) {
                      return a.viewName === _view;
                    }).map(function (a) {
                      return a.groupTarget;
                    }).pop()),
                    href: $view.attr("href"),
                    target: _view,
                    baseTarget: (0, _functions.getBaseTargetName)(_view),
                    position: _ref.offsets[k].position
                  });
                }
              }
            }
          }
        });
        var data = (0, _functions.buildAttributesData)(attributesList);
        var linkedDataId = (0, _data.extractLinkedDataId)(data);
        if (linkedDataId) {
          var binding = _this.ldm.getMetadataById(linkedDataId);
          data.metadata = binding && binding.data ? binding.data : {};
        }
        if (rendered[offsetUid]) {
          rendered[offsetUid].data.push(data);
          rendered[offsetUid].urls = urls;
          rendered[offsetUid].matches.push({
            uuid: (0, _functions.getUuid)(),
            views: views,
            position: _ref.offsets[k].position,
            positionDelta: _ref.offsets[k].alias ? _ref.offsets[k].alias.source.length - _ref.offsets[k].alias.replacement.length : 0,
            match: _ref.offsets[k].match,
            context: _ref.offsets[k].context,
            alias: _ref.offsets[k].alias
          });
          rendered[offsetUid].count++;
          continue;
        }
        var node = {
          output: "",
          number: idx + 1,
          count: 1,
          data: [],
          urls: urls,
          reference: label.trim(),
          type: _ref.offsets[k].rule.baseType ? _ref.offsets[k].rule.baseType : _ref.offsets[k].rule.type,
          libelle: _ref.offsets[k].rule.baseLibelle ? _ref.offsets[k].rule.baseLibelle : _ref.offsets[k].rule.ruleLibelle,
          matches: []
        };
        node.data.push(data);
        node.output += (0, _functions.indent)(1, '<record number="$nodeNumber">');
        node.output += (0, _functions.indent)(2, '<reference count="$nodeCounter' + (idx + 1) + '">' + node.reference + '</reference>');
        node.output += (0, _functions.indent)(2, '<type>' + (0, _functions.escapeHTML)(node.type) + '</type>');
        node.output += (0, _functions.indent)(2, '<libelle>' + (0, _functions.escapeHTML)(node.libelle) + '</libelle>');
        if (_index.settings.views) {
          node.output += '$matches' + (idx + 1);
          node.output += '$urls' + (idx + 1);
        }
        node.output += (0, _functions.indent)(1, '</record>');
        idx++;
        rendered[offsetUid] = node;
        node.matches.push({
          uuid: (0, _functions.getUuid)(),
          views: views,
          position: _ref.offsets[k].position,
          positionDelta: _ref.offsets[k].alias ? _ref.offsets[k].alias.source.length - _ref.offsets[k].alias.replacement.length : 0,
          match: _ref.offsets[k].match,
          context: _ref.offsets[k].context,
          alias: _ref.offsets[k].alias
        });
        nodes.push(node);
      }
    });
    for (var i = nodes.length - 1; i >= 0; i--) {
      var matchStr = "";
      matchStr += (0, _functions.indent)(2, "<matches>");
      nodes[i].output = nodes[i].output.replace("$nodeCounter" + (i + 1), nodes[i].count);
      nodes[i].matches.sort(function (a, b) {
        return a.position < b.position ? -1 : 1;
      });
      for (var mI = 0; mI < nodes[i].matches.length; mI++) {
        var m = nodes[i].matches[mI];
        if (mI === 0) {
          nodes[i].position = m.position;
        }
        matchStr += (0, _functions.indent)(3, "<match position='".concat(m.position, "' context='").concat((0, _functions.escapeHTML)(m.context), "' reference='").concat((0, _functions.escapeHTML)(m.match), "'>"));
        for (var vI = 0; vI < m.views.length; vI++) {
          matchStr += (0, _functions.indent)(4, m.views[vI]);
        }
        matchStr += (0, _functions.indent)(3, "</match>");
      }
      matchStr += (0, _functions.indent)(2, "</matches>");
      var urlStr = "";
      if (nodes[i].urls.length > 0) {
        urlStr += (0, _functions.indent)(2, '<urls>');
        for (var urlIndex = 0; urlIndex < nodes[i].urls.length; urlIndex++) {
          urlStr += (0, _functions.indent)(3, "<url position=\"".concat(nodes[i].urls[urlIndex].position, "\" target=\"").concat(nodes[i].urls[urlIndex].target, "\">").concat(nodes[i].urls[urlIndex].href, "</url>"));
        }
        urlStr += (0, _functions.indent)(2, '</urls>');
      }
      nodes[i].output = nodes[i].output.replace("$urls" + (i + 1), urlStr);
      nodes[i].output = nodes[i].output.replace("$matches" + (i + 1), matchStr);
    }
    nodes = R2L.applySort(nodes);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].output = nodes[i].output.replace("$nodeNumber", i + 1);
    }
    return nodes;
  };
  R2L.formatters = {
    xml: function xml(references, text) {
      var nodes = R2L.getNodes(references);
      return {
        result: "<resultset size=\"".concat(nodes.length, "\">\r\n\n                    ").concat(nodes.map(function (node) {
          return node.output;
        }).join(""), "\r\n\n                    </resultset>"),
        type: 'application/xml',
        nodes: nodes,
        ext: 'xml'
      };
    },
    json: function json(references, text) {
      var nodes = R2L.getNodes(references);
      return {
        result: nodes.map(function (node) {
          // filter out data which can't be grouped by. this data belong to the 'matches' sub-elements
          delete node["output"];
          delete node["position"];
          return node;
        }),
        size: nodes.length,
        type: 'application/json',
        ext: 'json'
      };
    },
    html: function html(references, text, linkedData) {
      var html = linkedData ? (0, _decorators.insertLinkedData)(R2L.replaceHtml(text, references), linkedData) : R2L.replaceHtml(text, references);
      html = (0, _decorators.insertNodeData)(html, references);
      return {
        result: html,
        type: 'text/html',
        ext: 'html'
      };
    }
  };

  /**
   * Will flatten the Ref2Link JSON data structure, which groups references by their 'match'
   * The ordered nodes will not perform any grouping and will return 
   *   each detected reference (subdivision) in order, including duplicates
   * 
   * @param {Array<R2LNode>} nodes expects as input the JSON nodes list
   * @returns {Array<R2LOrderedNode>} 
   */
  R2L.getOrderedNodes = function (nodes) {
    var arr = [];
    nodes.forEach(function (node) {
      node.matches.forEach(function (match) {
        arr.push({
          alias: match.alias,
          match: match.match,
          context: match.context,
          position: match.position,
          type: node.type,
          reference: node.reference,
          urls: node.urls,
          data: node.data
        });
      });
    });
    arr.sort(function (a, b) {
      return a.position < b.position ? -1 : 1;
    });
    // add local position
    var currentContext;
    var currentContextPosition = -1;
    for (var i = 0; i < arr.length; i++) {
      if (currentContext !== arr[i].context) {
        arr[i].localPosition = 0;
        currentContextPosition = arr[i].position;
        currentContext = arr[i].context;
      } else if (arr[i - 1] && arr[i].position < arr[i - 1].position - arr[i - 1].localPosition + arr[i - 1].context.length) {
        arr[i].localPosition = arr[i].position - currentContextPosition;
      } else {
        arr[i].localPosition = 0;
        currentContextPosition = arr[i].position;
        currentContext = arr[i].context;
      }
    }
    return arr;
  };
}
;

},{"../jquery.js":9,"../settings/index.js":32,"../utils/data.js":54,"../utils/decorators.js":55,"../utils/functions.js":56}],8:[function(require,module,exports){
(function (global){(function (){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.R2L = void 0;
var _jquery = require("./jquery.js");
var _functions = require("./utils/functions.js");
var _letters = require("./utils/letters.js");
var _processor = require("./utils/processor.js");
var _list = require("./utils/list.js");
var _index2 = require("./ux/index.js");
var _index3 = require("./settings/index.js");
var _index4 = require("./alias/index.js");
var _shared = require("./utils/shared.js");
var _index5 = require("./transformers/index.js");
var _index6 = require("./transformers/utils/index.js");
var _filter = require("./transformers/filter.js");
var _index7 = require("./translations/index.js");
var _index8 = require("./jquery/index.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// R2L global. Must be exposed globally: `window.R2L` (browser) or `global.R2L` (server-side)
var R2L = exports.R2L = {};

// Confluence binding
var _jQuery = _jquery.$;

// We can't do much without JQuery
if (!_jQuery) {
  throw new Error("JQuery is not loaded.");
}

// alias function
R2L.getJQuery = R2L.getJquery = function () {
  return _jQuery;
};

/**
 * Inject JQuery dependency
 * @param {JQuery} jQuery 
 */
R2L.setJQuery = function (jQuery) {
  _jQuery = jQuery;
};

/**
 * Constants are properties pre-set by the JSON rules file loaded into the library. Source language and the corresponding base64-encoded rules are among them.
 * @see R2L.settings.constants  
 * @param {String} name
 * 
 * @returns
 */
R2L.getConstant = function (name) {
  var isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();
  if (!isBrowser && global && global["R2L_CONSTANTS"]) {
    // defaults
    if (name === "R2L_EULANG") {
      return _index3.settings.constants[name];
    }
    return global["R2L_CONSTANTS"][name];
  }
  return _index3.settings.constants[name];
};
R2L.setConstant = function (name, value) {
  var isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();
  if (!isBrowser && global && global["R2L_CONSTANTS"]) {
    global["R2L_CONSTANTS"][name] = value;
  }
  _index3.settings.constants[name] = value;
};

/**
 * Apply rules to text 
 * @param {String} text
 * @param {Object} globalRule (optional)
 * @param {Boolean} isAlias (optional) - when it's an alias parse we need to polish the matches before saving them
 * 
 * @returns {Promise<Object>} returns a `matches` object
 */
R2L.applyGlobalRule = function (text, globalRule, isAlias) {
  var matches = {};
  try {
    if (!globalRule) {
      /** Guard checks optimization */
      var rules = this.runGuards(text, this.getRules());
      globalRule = this.compileGlobalRule(rules);
    }
    matches = (0, _functions.cleanMatches)(R2L.applyMultipleRules(text, globalRule, [], 0));
  } catch (e) {
    console.error(e);
  }

  // linked-data processing
  return (0, _index5.fillPlaceholders)(matches).then(function (matches) {
    return (0, _filter.filterTargets)(matches).then(function (matches) {
      if (!isAlias) {
        R2L.setGlobalMatches(matches);
      }
      return matches;
    });
  });
};

/**
 * Synchronous parsing API (will clear linked-data placeholders)
 * @param {string} text 
 * @param {Object} globalRule 
 * @param {boolean} isAlias 
 */
R2L.applyGlobalRuleSync = function (text, globalRule, isAlias) {
  if (!globalRule) {
    /** Guard checks optimization */
    var rules = this.runGuards(text, this.getRules());
    globalRule = this.compileGlobalRule(rules);
  }
  var matches = R2L.applyMultipleRules(text, globalRule, [], 0);
  matches = (0, _functions.cleanMatches)(matches);
  matches = (0, _filter.clearLdTargets)(matches);
  matches = (0, _index6.clearPlaceholders)(matches);
  if (!isAlias) {
    R2L.setGlobalMatches(matches);
  }
  return matches;
};

/**
 * Iterator function that abstracts over the webworker execution, making it behave like a Regexp iterator
 * 
 * @param {String} text 
 * @param {RegExp} multiMatchPattern 
 * @param {Number} level
 * 
 * @returns {Array<String>} Regex matches
 */
var _executor = function _executor(text, multiMatchPattern, level) {
  var data = level === 0 ? _shared.sharedCtx.getData(text) : null;
  if (R2L.options.worker && level === 0 && data && Array.isArray(data.matches)) {
    if (data.matches.length > data.cursor) {
      data.cursor++;
      multiMatchPattern.lastIndex = data.matches[data.cursor - 1].lastIndex;
      return data.matches[data.cursor - 1].args;
    } else {
      // we reached the end of the matches
      return false;
    }
  } else {
    return multiMatchPattern.exec(text);
  }
};

/**
 * Actual parsing function. Calls itself recursively in case of lists
 * Should not be called from the outside
 * @param {String} text - text to parse
 * @param {RegExp} multiMatchRule - For level 0 it is the compiled global rule (celex|ecli|act|eucase...). For level 1 it is the list-item pattern.
 * @param {Array<Ref2link>} history - list items are stored for passing data in-between 
 * @param {Number} level - the recursion level (0 or 1)
 * 
 * @returns {Object} matches - map of matches
 */
R2L.applyMultipleRules = function (text, multiMatchRule, history, level) {
  var args,
    matches = {};
  var rules = multiMatchRule.rules,
    multiMatchPattern = multiMatchRule.pattern,
    lastIndex = 0;
  if (!rules.length) {
    return {};
  }
  if (!history) {
    history = [];
  }
  if (!level) {
    level = 0;
  }
  detection: while (args = _executor(text, multiMatchPattern, level)) {
    var match = args[0],
      startPosition = multiMatchPattern.lastIndex - match.length;
    if (!match) {
      /** pattern matched empty string; the regexp will infinitely recurse */
      multiMatchPattern.lastIndex++;
      lastIndex = multiMatchPattern.lastIndex;
    }
    if (level === 0) {
      //polyfill for engines not supporting negative lookbehind 
      if (startPosition > 1) {
        var letterPattern = "[/0-9" + _letters.letters.latin + _letters.letters.cyrillic + _letters.letters.greek + _letters.letters.specialChars + "]";
        if (new RegExp(letterPattern, 'i').test(text[startPosition - 1])) {
          console.debug("Discarding match because of left neighbour", text[startPosition - 1]);
          continue;
        }
      }

      /** smooth over args since some rules have multiple groups */
      var offset = 0;
      for (var i = 0; i < rules.length; i++) {
        offset += rules[i].slots;
        if (rules[i].slots === 2) {
          args.splice(offset, 1);
          offset -= 1;
        }
      }
    }

    /** scan which of the arguments is not empty and apply respective rule */
    for (var i = 1; i <= args.length; i++) {
      if (args[i] && i - 1 < rules.length) {
        var itemMatches = {},
          rule = rules[i - 1];
        var trimPattern = rule ? rule.trimPattern || rule["trim-pattern"] : null;
        if (trimPattern) {
          try {
            var trimRegex = new RegExp(trimPattern);
            match = match.replace(trimRegex, '');
          } catch (e) {
            // move on
          }
        }

        /** check the skip rule */
        var skipPattern = rule ? rule.skipPattern || rule["skip-pattern"] : null;
        if (skipPattern) {
          try {
            var skipRegex = new RegExp(skipPattern);
            if (skipRegex.test(match)) {
              multiMatchPattern.lastIndex = multiMatchPattern.lastIndex - match.length + 1;
              lastIndex = multiMatchPattern.lastIndex;
              continue detection;
            }
          } catch (e) {
            // move on
          }
        }

        /** check the strict rule settings and patterns */
        var strictPattern = rule ? rule.strictPattern || rule["strict-pattern"] : null;
        if (level === 0 && strictPattern && R2L.options.strictRules && (R2L.options.strictRules[rule.baseType] || R2L.options.strictRules[rule.type])) {
          try {
            var strictRegex = new RegExp(strictPattern, "i");
            if (!strictRegex.test(match)) {
              // no need to move cursor back, let detection skip this ref
              //multiMatchPattern.lastIndex = multiMatchPattern.lastIndex - match.length + 1;
              //lastIndex = multiMatchPattern.lastIndex;
              continue detection;
            }
          } catch (e) {
            // move on
          }
        }
        var ruleType = rule.type;
        var title = match;
        var reference = match;
        if (rule.allowTitle) {
          var normalizePattern = function normalizePattern(p, iFlag, surroundAndEscape) {
            surroundAndEscape = surroundAndEscape || false;
            var pattern = (p.source || p).replace(/^\/|\/[giumxns]*$/g, '');
            if (surroundAndEscape) {
              pattern = '(' + (0, _functions.getNonCapturingPattern)(pattern) + ')';
            }
            return new RegExp(pattern, 'gm' + iFlag);
          };
          var fullPattern = normalizePattern(rule.fullPattern, rule.casesensitive ? '' : 'i');
          var fullArgs = fullPattern.exec(args[i]);
          var controlExpr = "(?:[^\\]\\|\\r\\n\\v]*)";
          ruleType = String(fullArgs ? fullArgs[1] || '' : '').trim();
          reference = fullArgs ? fullArgs[2] || fullArgs[4] || '' : '';
          title = fullArgs ? fullArgs[3] || '' : '';
          if (!reference || reference.length > R2L.settings.maxReferenceLength || ruleType && rule.type.toLowerCase() !== ruleType.toLowerCase()) {
            multiMatchPattern.lastIndex = startPosition + 1;
            continue detection;
          }
          if (title) {
            if (title.length > R2L.settings.maxTitleLength) {
              title = match = reference;
              multiMatchPattern.lastIndex = startPosition + reference.length;
            } else {
              controlExpr = "\\[" + controlExpr + "\\s*\\|\\s*(?:[^\\]\\n\\r\\v]*?)\\]";
            }
          } else {
            if (!rule.forced && !ruleType) {
              match = String(R2L.converters.trim(reference, '[]') || '').trim();
              reference = match;
            }
          }
          controlExpr = '(' + (0, _functions.regExpEscape)(rule.type) + ')' + (rule.forced ? '' : '?') + "[\t ]*" + controlExpr;
          controlExpr = new RegExp(controlExpr, 'i');
          if (!controlExpr.test(match)) {
            multiMatchPattern.lastIndex = ++lastIndex;
            continue detection;
          }
        } else {
          if (level === 1) {
            title = null;
          }
        }
        lastIndex = multiMatchPattern.lastIndex;
        if (level === 0) {
          history = [];
        }

        /** If there's an itemRule go straight to item matching */
        if (rule.itemRule) {
          var itemMultiMatchRule = R2L.compileGlobalRule([rule.itemRule]);
          itemMatches = R2L.applyMultipleRules(match, itemMultiMatchRule, history, 1);
        } else {
          var appliedRule = R2L.applyRule(match, rule, rule.customTitle ? null : title, match, history);
          if (appliedRule) {
            match = appliedRule.wholeMatch;
            appliedRule.startPosition = startPosition;
            if (!rule.itemRule) {
              itemMatches[match] = appliedRule;
              if (level === 1) {
                history.push(appliedRule);
              }
            }
          } else {
            console.debug('Multi match, no rule match', i, match, rule, appliedRule);
          }
        }
        if (level === 0 && history.length > 1) {
          var listRef = (0, _list.getListCore)(history[0].rule, history[0].matches);
          if (listRef.length === 0) {
            /** Inverted lists might need some help */
            for (var hI = 0; hI < history.length; hI++) {
              if (hI > 0) {
                /**
                 * We clone identifiers forward eg:
                 * articles 5 paragraphs 6, 7       # 6 & 7 are paragraphs of art. 5
                 */
                (0, _list.cloneListIdentifiers)(history[hI - 1], history[hI]);
              }
              if (hI < history.length - 1) {
                /**
                 * We clone list core data from the last element in the case of inverted lists
                 * 
                 * articles 5, 6, 7 of Dir. 78/99   # articles 5, 6 need directive info
                 */
                (0, _list.cloneListCore)(history[history.length - 1], history[hI]);

                /** 
                 * If identifiers are not complete we copy those also 
                 */
                var identifiers = (0, _list.getListIdentifiers)(history[history.length - 1].rule, history[history.length - 1].matches);

                /**
                 * points 5 and 7 of article 2(3) Dir. 78/99      # point 5 & 7 belongs to an article
                 */
                var coreIdentifiers = (0, _list.getCoreIdentifiers)(history[hI].rule, history[hI].matches);
                if (coreIdentifiers.length === 0 && identifiers.length > 0) {
                  (0, _list.cloneCoreIdentifiers)(history[history.length - 1], history[hI]);
                }
              }
              var hItem = history[hI];

              /** Re-render */
              var sPos = hItem.startPosition;
              var appliedRule = R2L.applyRule(hItem.reference, hItem.rule, hItem.link, hItem.wholeMatch, [], history[hI].matches);
              if (appliedRule) {
                match = appliedRule.wholeMatch;
                appliedRule.startPosition = sPos;
                itemMatches[match] = appliedRule;
              }
            }
          }
        }
        if (level === 0 && rule["item-pattern"]) {
          Object.keys(itemMatches).forEach(function (itemKey) {
            var itemReference = itemMatches[itemKey];
            itemReference.startPosition = startPosition + itemReference.startPosition;
          });
        }
        Object.keys(itemMatches).forEach(function (_itemMatch) {
          var _item = itemMatches[_itemMatch];
          if (!matches.hasOwnProperty(_itemMatch)) {
            if (Object.keys(_item.views).length > 0) {
              matches[_itemMatch] = _item;
            }
          }
        });
        if (level === 0 && Object.keys(itemMatches).length > 0) {
          Object.keys(itemMatches).forEach(function (_itemMatch) {
            var _item = itemMatches[_itemMatch];
            if (!matches[_itemMatch]) {
              return;
            }
            matches[_itemMatch].offsets.push({
              matches: _item.matches,
              match: _itemMatch,
              position: _item.startPosition,
              views: _item.views,
              rule: rule,
              counter: 1,
              alternatives: _item.alternatives,
              context: args[0]
            });
            matches[_itemMatch].counter++;
          });
          Object.keys(itemMatches).forEach(function (_itemMatch) {
            var _item = itemMatches[_itemMatch];
            if (!matches[_itemMatch]) {
              return;
            }
            Object.keys(_item.alternatives).forEach(function (_index) {
              var _alternative = _item.alternatives[_index];
              _alternative.context = args[0];
              try {
                if (_alternative.viewName === 'table') {
                  return;
                }
                var _v = (0, _jquery.$)(_alternative.view);
                _v.attr(R2L.dataRef2linkContextAttribute, args[0]);
                _alternative.view = _v[0].outerHTML;
              } catch (e) {
                console.error(e);
              }
            });
          });
        }
      }
    }
  }
  return matches;
};

/**
 * Apply sort over a list of nodes
 * @param {Array<Object>} list - list of nodes
 * 
 * @returns {Array<Object>} sorted list
 */
R2L.applySort = function (nodes) {
  if (nodes.length < 2) {
    return nodes;
  }

  /* Supported sort fields */
  var fields = new Array("count", "position", "reference", "type", "libelle");
  var sort = _index3.settings.sort.toLowerCase();
  if (typeof sort !== "string") {
    return nodes;
  }
  var pieces = sort.split(".");
  var direction = "asc";
  var field = pieces[0];
  if (fields.indexOf(field) === -1) {
    return nodes;
  }
  if (pieces.length > 1) {
    direction = pieces[1] === "asc" || pieces[1] === "desc" ? pieces[1] : direction;
  }
  nodes.sort(function (a, b) {
    if (direction === "asc") {
      return a[field] < b[field] ? -1 : 1;
    } else {
      return a[field] > b[field] ? -1 : 1;
    }
  });
  return nodes;
};

/**
 * (DEPRECATED) Helper function to get the last results. Previous parsing is required.
 * @param {String} format - xml/json/html
 * 
 * @returns {Object|null} - result 
 */
R2L.getFormattedReferences = function (format) {
  format = format || 'html';
  if (format === 'ref2table') {
    format = 'xml';
  }
  if (!this.$el) {
    return null;
  }
  var formatter = format,
    references = this.$el.getReferences();
  ;
  if (Object.prototype.toString.call(format) === "[object String]") {
    formatter = this.formatters[format];
  }
  if (format === 'html') {
    // we already have the html content from the parsed node
    return {
      result: this.$el.html(),
      type: 'text/html',
      ext: 'html'
    };
  } else {
    return formatter(references);
  }
};

/**
 * Removes anchor links which contain an annotation eg: "(12)"
 * NOT IN USE
 * @param {String} text 
 * @returns {String} 
 */
R2L.parseAnnotations = function (text) {
  var $el = (0, _jquery.$)("<div>" + text + "</div>");
  var links = $el.find("a").toArray();
  links = links.filter(function (link) {
    return /\(\d+\)/.test((0, _jquery.$)(link).text());
  });
  links.map(function (link) {
    text = text.replace(new RegExp((0, _functions.regExpEscape)(link.outerHTML), 'g'), "");
  });
  return text;
};

/**
 * Replace the default link with an alternative
 * @param {Object} target - the ref2link object 
 * @param {Object} alternative - the rendered alternative object
 */
R2L.setAlternative = function (target, alternative) {
  try {
    var $self = (0, _jquery.$)(target).closest(R2L.settings["class"] + ', .ref2link-tooltip'),
      $parents = $self.parents(R2L.settings["class"] + ', .ref2link-tooltip').last(),
      $view = (0, _jquery.$)(alternative.view);
    if ($parents.length) {
      $self = $parents;
    }
    if (!$self.length || !$view.length) {
      return;
    }
    var reference = $self.getRef2linkMatch();
    $view.setRef2linkMatch(reference);
    $self.replaceWith($view);
  } catch (e) {}
};

/**
 * Remove the link from a reference
 */
R2L.removeReference = function (target) {
  var $container = (0, _jquery.$)(target).parentsUntil(":not(.".concat(_index3.settings.generatedClassName, ")"));
  if ($container.length) {
    return $container.unparseTextRules();
  }
  return (0, _jquery.$)(target).unparseTextRules();
};

/**
 * Fetch linked data
 * @param {Array<Ref2Link>} nodes from the scan
 * 
 * @returns {Promise<Object>} Key-value object with CELEX/ELI identifiers as keys
 */
R2L.loadMetadata = function (nodes) {
  return this.ldm.fetch(nodes).then(function (data) {
    (0, _index2.resetTooltips)();
    return data;
  })["catch"](function (e) {
    console.error(e);
  });
};

/**
 * Expose label translation fn
 */
R2L.getTranslation = _index7.getTranslation;

/**
 * Apply an order map to ref2link
 * 
 *  { ruletype1: [target1, target2 ...], ruletype2: [target3, target1, target2], ... }
 * 
 * @param {Object} order
 */
R2L.setViewOrder = function (order) {
  var rules = this.getRules();
  var _loop = function _loop(ruleType) {
    rules.filter(function (r) {
      return r.type === ruleType || r.baseType === ruleType;
    }).map(function (rule) {
      rule.views.map(function (view) {
        var index = order[ruleType].indexOf(view.target);
        view.order = index === -1 ? view.order + order[ruleType].length : index;
        return view;
      });
      // child rule update
      if (rule.itemRule && rule.itemRule.views) {
        rule.itemRule.views.map(function (view) {
          var index = order[ruleType].indexOf(view.baseTarget);
          if (index === -1) {
            index = order[ruleType].indexOf(view.target);
          }
          view.order = index === -1 ? view.order + order[ruleType].length : index;
          return view;
        });
      }
    });
  };
  for (var ruleType in order) {
    _loop(ruleType);
  }
};

/**
 * Apply an order map to ref2link
 * @deprecated use `R2L.setViewOrder()`
 */
R2L.applyViewOrder = R2L.setViewOrder;

/**
 * Set view options (attributes) eg: 'target=_self'
 * { 
 *   ruletype1: { target1: {target: '_self'}, target2: {target: '_blank'} ...}, 
 *   ruletype2: {target3: {target: '_self'}...}
 * }
 */
R2L.setViewAttributes = function (viewAttributes) {
  this.settings.viewAttributes = viewAttributes;
};

/**
 * Returns view attribute settings. Pass a view name (target) to return attributes for that target only
 * @param {String} viewName (optional) 
 * @returns 
 */
R2L.getViewAttributes = function (viewName) {
  if (!viewName) {
    return this.settings.viewAttributes || null;
  }
  if (this.settings.viewAttributes) {
    var viewAttributes = this.settings.viewAttributes;
    try {
      for (var _ruleType in viewAttributes) {
        if (viewAttributes[_ruleType] && viewAttributes[_ruleType][viewName]) {
          return viewAttributes[_ruleType][viewName];
        }
      }
    } catch (e) {
      console.error(e);
      // move on
    }
  }
  return null;
};

/**
 * Direct parse API method
 * @param {String} text
 * @param {String} format (html|xml|json)
 * @param {Object} opts @see R2L.options
 * 
 * @returns {Promise<Object>}
 */
R2L.parse = function (text, format, opts) {
  if (opts) {
    this.setOptions(opts);
  }
  format = String(format).toLowerCase();
  return new Promise(function (resolve, reject) {
    // we first process aliases and then we do a single global parse

    var replaceAliasesResult;
    (R2L.options.aliases ? R2L.alias.getAIAliases(text) : Promise.resolve([])).then(function (localAliasItems) {
      console.debug("AI aliases extracted", localAliasItems);
      var localAliasMap = {};
      localAliasItems.forEach(function (item) {
        localAliasMap[item.context] = item.act;
      });
      R2L.alias.resetLocal();
      R2L.alias.addLocal(localAliasMap);
      replaceAliasesResult = (0, _index4.replaceAliases)(text, []);
      var tempText = replaceAliasesResult.text;

      // run parser again after replacing aliases
      var rules = R2L.getRules();
      rules = R2L.runGuards(tempText, rules);
      var globalRule = R2L.compileGlobalRule(rules);
      return R2L.applyGlobalRule(tempText, globalRule, true);
    }).then(function (newMatches) {
      newMatches = (0, _index4.replaceAliasMatches)(newMatches, replaceAliasesResult);
      R2L.setGlobalMatches(newMatches);
      resolver(format, text, newMatches, resolve);
    })["catch"](function (e) {
      console.error("Failed to apply globalRule", e);
      resolver(format, text, {}, resolve);
    });
  });
};

/**
 * Expose function to directly replace a string
 * @param {String} html
 * @param {Object} matches
 * 
 * @returns {String} Final content with links
 */
R2L.replaceHtml = function (html, matches) {
  var temp = (0, _processor.replaceHtmlNodes)(html, matches);
  return (0, _processor.unExtractRaw)(temp);
};

/**
 * Will replace detected references with <a> tags, operating on the current node.
 * This helps preserve existing DOM events.
 * 
 * @param {HTMLElement} node 
 * @param {Object} matches 
 * @returns {HTMLElement} Node with (detected) text nodes replaced as `<a>` tags 
 */
R2L.replaceDOM = function (node, matches) {
  node = (0, _processor.replaceDOMNodes)(node, matches);
  if (node) {
    (0, _processor.unExtractNode)(node);
  }
  return node;
};

/**
 * Import new rules object (result of the compilation) 
 * @param {Object} constants
 * 
 * @returns {Boolean}
 */
R2L.importRules = function (constants) {
  var lang = constants.R2L_DEFAULT_LANG_ISO3 || null;
  var langMap = R2L.getConstant('R2L_EULANG');
  if (lang && !langMap.get(String(lang).toUpperCase())) {
    return false;
  }
  this.setConstant('R2L_DEFAULT_LANG_ISO3', lang);
  this.setConstant('R2L_TYPED_RULES', constants.R2L_TYPED_RULES);
  this.clearCache();
  this.reloadRules();
  return true;
};
R2L.clearCache = function () {
  this.globalMatches = {};
  this.globalViews = {};
  (0, _processor.clearTextCaches)();
  (0, _processor.clearExtracts)();
  // the Shared Context object should not be exposed
  _shared.sharedCtx.clear();
  (0, _index8.clearTooltips)();
  this.ldm.clearCache();
};
R2L.unbind = function () {
  this.unbindTooltips();
};

/**
 * Configuration of options
 * @param ${options} object 
 */
R2L.setOptions = function (options) {
  if (!options) {
    return;
  }
  if (options.worker !== undefined) {
    options.worker = Boolean(options.worker);
    if (Boolean(R2L.options.worker) !== Boolean(options.worker)) {
      if (options.worker) {
        R2L.registerWorker();
      } else {
        R2L.destroyWorker();
      }
    }
  }
  if (options.enableSpecialRules !== undefined) {
    options.enableSpecialRules = Boolean(options.enableSpecialRules);
    if (Boolean(R2L.options.enableSpecialRules) !== options.enableSpecialRules) {
      R2L.options.enableSpecialRules = options.enableSpecialRules;
      R2L.reloadRules();
    }
  }

  // linkeddata/metadata equivalency
  if (options.linkeddata !== undefined && options.metadata === undefined) {
    options.metadata = options.linkeddata;
  }
  if (options.metadata !== undefined) {
    options.metadata = Boolean(options.metadata);
    if (Boolean(R2L.options.metadata) !== options.metadata) {
      R2L.options.ruleHeading = options.metadata ? R2L.viewOptions.enhancedHeading : '';
    }
  }
  if (options.linkedDataMode) {
    var ldOpts = [_index3.LD_MODE_ALL, _index3.LD_ADVANCED_MODE_SHORT_TITLES, _index3.LD_ADVANCED_MODE_CORRECTIONS, _index3.LD_MODE_METADATA, _index3.LD_ADVANCED_MODE_KM_HANDOC, _index3.LD_ADVANCED_MODE_KM_CIS, _index3.LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT, _index3.LD_MODE_SEQ_NUMBER, _index3.LD_MODE_CHECK_EXISTS];
    if (Array.isArray(options.linkedDataMode)) {
      options.linkedDataMode = options.linkedDataMode.filter(function (o) {
        return ldOpts.indexOf(o) !== -1;
      });
    } else if (typeof options.linkedDataMode === "string" && ldOpts.indexOf(options.linkedDataMode) > -1) {
      options.linkedDataMode = [options.linkedDataMode];
    } else {
      options.linkedDataMode = [_index3.LD_MODE_ALL];
    }
  }
  if (options.pointInTime !== undefined) {
    R2L.ldm.clearCache();
  }
  R2L.options = _objectSpread(_objectSpread({}, R2L.options), options);
  console.debug("Configured R2L options", R2L.options);
};

/**
 * Check if a certain linked-data mode is active
 * @param {String} mode
 * @returns {Boolean} 
 */
R2L.hasLinkedDataMode = function (mode) {
  // LD_MODE_ALL does not include advanced modes
  if ([_index3.LD_ADVANCED_MODE_CORRECTIONS, _index3.LD_ADVANCED_MODE_KM_HANDOC, _index3.LD_ADVANCED_MODE_SHORT_TITLES, _index3.LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT].indexOf(mode) !== -1) {
    return this.options.linkedDataMode.indexOf(mode) > -1;
  }
  return Array.isArray(this.options.linkedDataMode) && (this.options.linkedDataMode.indexOf(mode) > -1 || this.options.linkedDataMode.indexOf(_index3.LD_MODE_ALL) > -1);
};

/** 
 * Set target language
 * @param {string} - ISO 3 language 
 */
R2L.setLanguage = function (language) {
  var parts = String(language).split("-");
  if (parts.length > 1) {
    this.options.language = parts[0];
    // multi language detected
    this.options.multiLanguage = language;
  } else {
    this.options.language = language;
  }
};

/** 
 * Get current target language
 * @returns {String} - ISO 3 language (or empty string)
 */
R2L.getLanguage = function () {
  var lang = this.options.language;
  return lang || '';
};

/** 
 * Set multi language 
 * @param {string} - ISO 3 language list separated by dash or comma eg: ENG-FRA
 */
R2L.setMultiLanguage = function (multiLanguage) {
  if (multiLanguage) {
    multiLanguage = String(multiLanguage).replace(/,/g, "-");
  }
  this.options.multiLanguage = multiLanguage;
};

/** 
 * Get current multi-language
 * @returns {String} - ISO 3 language list separated by dash eg: ENG-FRA (or empty string)
 */
R2L.getMultiLanguage = function () {
  var lang = this.options.multiLanguage;
  return lang || '';
};
R2L.registerWorker = function () {
  if (this.worker || !window.Worker) {
    return false;
  }

  // URL.createObjectURL
  window.URL = window.URL || window.webkitURL;
  var response = "\n    self.addEventListener('message', function(event) {\n        var matches = [];\n        while((args = event.data.pattern.exec(event.data.text))) {\n            matches.push({\n                args: args,\n                lastIndex: event.data.pattern.lastIndex\n            });\n        }\n        postMessage({ uuid: event.data.uuid, text: event.data.text, matches: matches });\n    });";
  var blob;
  try {
    blob = new Blob([response], {
      type: 'application/javascript'
    });
  } catch (e) {
    // Backwards-compatibility
    window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
    blob = new BlobBuilder();
    blob.append(response);
    blob = blob.getBlob();
  }

  // init worker
  this.worker = new Worker(URL.createObjectURL(blob));
  this.worker.onmessage = function (e) {
    if (e.data) {
      _shared.sharedCtx.setMatches(e.data.uuid, e.data.text, e.data.matches);
      _shared.sharedCtx.callback(e.data.uuid, e.data.text);
      _shared.sharedCtx.reset(e.data.uuid);
    }
  };
};
R2L.destroyWorker = function () {
  if (this.worker) {
    this.worker.terminate();
    this.worker = null;
  }
};

/**
 * Utility function used by the `R2L.parse()` API to resolve a promise with data 
 */
function resolver(format, text, matches, resolve) {
  // send results
  switch (format) {
    case "html":
      if (R2L.options && R2L.options.metadata) {
        // linked data is enabled?
        R2L.loadMetadata(R2L.getNodes(matches)).then(function (linkedData) {
          resolve(R2L.formatters.html(matches, text, linkedData));
        })["catch"](function (e) {
          console.error("Failed to load metadata", e);
          resolve(R2L.formatters.html(matches, text, {}));
        });
      } else {
        resolve(R2L.formatters.html(matches, text));
      }
      break;
    case "xml":
      // no linked-data
      resolve(R2L.formatters.xml(matches, text));
      break;
    case "json":
      if (R2L.options && R2L.options.metadata) {
        // linked data is enabled?
        R2L.loadMetadata(R2L.getNodes(matches)).then(function (linkedData) {
          resolve(R2L.formatters.json(matches, text)); // will include linked data 
        })["catch"](function (e) {
          console.error("Failed to load metadata", e);
          resolve(R2L.formatters.json(matches, text));
        });
      } else {
        resolve(R2L.formatters.json(matches, text));
      }
      break;
    default:
      resolve(text);
      break;
  }
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./alias/index.js":5,"./jquery.js":9,"./jquery/index.js":10,"./settings/index.js":32,"./transformers/filter.js":33,"./transformers/index.js":37,"./transformers/utils/index.js":49,"./translations/index.js":51,"./utils/functions.js":56,"./utils/letters.js":57,"./utils/list.js":58,"./utils/processor.js":60,"./utils/shared.js":62,"./ux/index.js":63}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.$ = void 0;
// Confluence binding
var _jQuery = typeof AJS !== "undefined" && AJS.$ ? AJS.$ : typeof jQuery !== "undefined" ? jQuery : null;
if (!_jQuery && typeof $ !== "undefined") {
  _jQuery = $;
}
var $ = exports.$ = _jQuery;

},{}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.R2L_INITIAL_DATA_ATTR = void 0;
exports.bindJquery = bindJquery;
exports.clearTooltips = clearTooltips;
var _jquery = require("../jquery.js");
var _index = require("../ux/index.js");
var _functions = require("../utils/functions.js");
var _processor = require("../utils/processor.js");
var _index2 = require("../alias/index.js");
var _index3 = require("../settings/index.js");
var _shared = require("../utils/shared.js");
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function clearTooltips() {
  (0, _jquery.$)('.ref2link-tooltip').remove();
}
var R2L_INITIAL_DATA_ATTR = exports.R2L_INITIAL_DATA_ATTR = "initial";

/**
 * Binds the JQuery API to the `$` prototype, allowing users to call Ref2Link-specific methods on JQuery nodes:
 *   $('.selector').parseDeferred()
 *  
 * @param {Object} R2L 
 */
function bindJquery(R2L) {
  /**
   * Parses one JQuery object with a set of rules
   * @param {Array} rules
   * @param {Boolean} useWorker - whether to use the WebWorker (needs to be enabled)
   * @param {Boolean} withLinkedData - whether to preload metadata (needs to be enabled)
   * @returns {Promise<JQuery>} 
   */
  _jquery.$.fn.parseReferences = function (rules, useWorker, withLinkedData) {
    rules = rules || R2L.getRules();
    clearTooltips();
    // reset extracts (keep last 30 seconds extracts to avoid removing items from a parallel search)
    (0, _processor.clearExtracts)(30000);
    console.debug("Extracts size", (0, _processor.getExtracts)());
    (0, _index.bindTooltips)(R2L);
    var $self = (0, _jquery.$)(this);
    var initialContent = $self.html();
    $self.data(R2L_INITIAL_DATA_ATTR, initialContent);
    var html = '';
    $self.each(function () {
      // REFTOLINK-1367 - use tabs instead of spaces
      html += (0, _jquery.$)(this).html() + "\t";
    });

    /** Guard checks optimization */
    rules = R2L.runGuards(html, rules);
    var globalRule = R2L.compileGlobalRule(rules);
    if (useWorker && R2L.worker) {
      return new Promise(function (resolve, reject) {
        var uuid = (0, _functions.getUuid)();
        _shared.sharedCtx.setCallback(uuid, html, function () {
          var promises = [];

          // if aliases are enabled we parse each node separately inside parseNodeReferences()
          (R2L.options.aliases ? Promise.resolve({}) : R2L.applyGlobalRule(html, globalRule)).then(function (matches) {
            $self.each(function () {
              promises.push((0, _jquery.$)(this).parseNodeReferences(matches));
            });
            Promise.all(promises).then(function (values) {
              if (R2L.options.metadata && withLinkedData) {
                setTimeout(function () {
                  R2L.loadMetadata($self.getFormattedReferences("json").result).then(function (result) {
                    resolve($self);
                  })["catch"](function (e) {
                    console.error(e);
                    resolve($self);
                  });
                }, 0);
              } else {
                resolve($self);
              }
            });
          });
        });
        R2L.worker.postMessage({
          text: html,
          uuid: uuid,
          pattern: globalRule.pattern
        });
      });
    } else {
      return new Promise(function (resolve, reject) {
        var promises = [];
        (R2L.options.aliases ? Promise.resolve({}) : R2L.applyGlobalRule(html, globalRule)).then(function (matches) {
          $self.each(function () {
            promises.push((0, _jquery.$)(this).parseNodeReferences(matches));
          });
          Promise.all(promises).then(function () {
            if (R2L.options.metadata && withLinkedData) {
              setTimeout(function () {
                R2L.loadMetadata($self.getFormattedReferences("json").result).then(function (result) {
                  resolve($self);
                })["catch"](function (e) {
                  console.error(e);
                  resolve($self);
                });
              }, 0);
            } else {
              resolve($self);
            }
          });
        });
      });
    }
  };

  /**
   * Performs the replacement of parsed content into a JQuery node
   * Runs an extra parse operation if aliases are enabled
   * @param {Object} matches 
   * @returns {Promise<JQuery>}
   */
  _jquery.$.fn.parseNodeReferences = function (matches) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      var $self = (0, _jquery.$)(_this);
      if (!R2L.options.aliases) {
        //already parsed
        $self = (0, _jquery.$)(R2L.replaceDOM($self[0], matches));
        $self.attr(_index3.settings.parsedAttribute);
        resolve(_this);
        return;
      } else {
        var replaceAliasesResult;
        R2L.alias.getAIAliases($self.text()).then(function (localAliasItems) {
          console.debug("AI aliases", localAliasItems);
          var localAliasMap = {};
          localAliasItems.forEach(function (item) {
            localAliasMap[item.context] = item.act;
          });

          // when running on multiple nodes we should be careful about race conditions
          R2L.alias.resetLocal();
          R2L.alias.addLocal(localAliasMap);
          // parsing will follow
          var html = $self.html();
          replaceAliasesResult = (0, _index2.replaceAliases)(html, (0, _processor.getExtracts)());
          var tempHtml = replaceAliasesResult.text;
          var rules = R2L.getRules();
          rules = R2L.runGuards(tempHtml, rules);
          var globalRule = R2L.compileGlobalRule(rules);
          return R2L.applyGlobalRule(tempHtml, globalRule, true);
        }).then(function (newMatches) {
          newMatches = (0, _index2.replaceAliasMatches)(newMatches, replaceAliasesResult);
          R2L.setGlobalMatches(newMatches);
          $self = (0, _jquery.$)(R2L.replaceDOM($self[0], newMatches));
          $self.attr(_index3.settings.parsedAttribute);
          resolve(_this);
        });
      }
    });
  };
  _jquery.$.fn.reverse = _jquery.$.fn.reverse || [].reverse;

  /**
   * @returns {Array<Object>} 
   */
  _jquery.$.fn.getReferences = function () {
    var inTextMatches = _functions.getReferences.call(this);
    var asArray = [];
    Object.keys(inTextMatches || {}).forEach(function (_matchKey) {
      asArray.push(inTextMatches[_matchKey]);
    });
    return asArray;
  };

  /**
   * Returns formatted references object (json/xml/html)
   * @param {String} format 
   * @returns {Object}
   */
  _jquery.$.fn.getFormattedReferences = function (format) {
    format = format || 'identity';
    var formatter = format,
      references = (0, _jquery.$)(this).getReferences();
    ;
    if (Object.prototype.toString.call(format) === "[object String]") {
      formatter = R2L.formatters[format];
    }
    return formatter(references, (0, _jquery.$)(this).data(R2L_INITIAL_DATA_ATTR) || "");
  };
  _jquery.$.fn.setAlternative = function (alternative) {
    R2L.setAlternative.call(R2L, this, alternative);
  };
  _jquery.$.fn.removeReference = function () {
    return R2L.removeReference(this);
  };
  _jquery.$.fn.getR2L = function () {
    return R2L;
  };
  _jquery.$.fn.setRef2linkMatch = function (ref2link) {
    var isMultiple = 0;
    ref2link.alternatives.sort(_index.orderSorter);
    for (var i = 0; i < ref2link.alternatives.length; i++) {
      isMultiple++;
      if (isMultiple >= 2) {
        break;
      }
    }
    ;
    (0, _jquery.$)(this).data(R2L.settings.dataAttribute, ref2link);
    if (isMultiple >= 2) {
      (0, _jquery.$)(this).addClass(_index3.settings.multipleGeneratedClassName);
    }
    return (0, _jquery.$)(this).addClass(_index3.settings.generatedClassName);
  };
  _jquery.$.fn.getRef2linkMatch = function () {
    var $this = (0, _jquery.$)(this),
      ref2link = $this.data(R2L.settings.dataAttribute) || {};
    if (_jquery.$.isEmptyObject(ref2link)) {
      ref2link = R2L.getGlobalMatch($this.attr(R2L.dataRef2linkInitialAttribute), $this.attr(R2L.dataRef2linkContextAttribute));
    }
    if (_jquery.$.isEmptyObject(ref2link)) {
      /** not parsed or no matches */
      return ref2link;
    }
    ref2link.reference = ref2link.hasOwnProperty('match') ? ref2link.match : $this.html();
    return ref2link;
  };
  _jquery.$.fn.unparseTextRules = function () {
    /** undo all links with their initial full match */
    ((0, _jquery.$)(this).is(".".concat(_index3.settings.generatedClassName)) ? (0, _jquery.$)(this) : (0, _jquery.$)(this).find(".".concat(_index3.settings.generatedClassName))).each(function () {
      var $ref2linkContainer = (0, _jquery.$)(this).parentsUntil(":not(.".concat(_index3.settings.generatedClassName, ")"));
      if (!$ref2linkContainer.length) {
        $ref2linkContainer = (0, _jquery.$)(this);
      }
      var reference = $ref2linkContainer.attr(R2L.settings.dataInitialAttribute);
      (0, _jquery.$)(this).replaceWith(reference);
    });
    (0, _processor.clearTextCaches)();
    clearTooltips();
  };

  /**
   * Wrapper parser of multiple JQuery objects with a set of rules
   * Will also load linked-data (asynchronously) if the option is enabled
   * @param {Array} rules
   * @returns {Array<Promise<JQuery>>} 
   */
  _jquery.$.fn.parseDeferred = function (rules) {
    if (!Array.isArray(rules) || !rules.length) {
      rules = R2L.getRules();
    }
    var s = new Date().getTime();
    var stack = [];
    // store the element 
    R2L.$el = (0, _jquery.$)(this);
    (0, _jquery.$)(this).each(function () {
      var self = this,
        $self = (0, _jquery.$)(self);
      var p = new Promise(function (resolve, reject) {
        if ((0, _jquery.$)(self).is("[".concat(_index3.settings.parsedAttribute, "]"))) {
          return reject(false);
        }
        var text = $self.html();
        setTimeout(function () {
          $self.parseReferences(rules, R2L.worker ? true : false).then(function ($el) {
            (0, _jquery.$)(self).trigger('before-replace.ref2link').attr(_index3.settings.parsedAttribute, true).trigger('after-replace.ref2link');
            resolve((0, _jquery.$)(self));
          });
        }, 1);
      });
      stack.push(p);
    });
    stack = stack.map(function (promise) {
      var resolver, rejecter;
      var parser = new Promise(function (resolve, reject) {
        resolver = resolve;
        rejecter = reject;
      });
      return {
        p: promise,
        resolver: resolver,
        rejecter: rejecter,
        parser: parser
      };
    });
    var elements = _toConsumableArray(stack);
    Promise.all(stack.map(function (item) {
      return item.p;
    })).then(function (values) {
      setTimeout(function () {
        /** now that processing has finished reset parsed nodes status */
        (0, _jquery.$)("[".concat(_index3.settings.parsedAttribute, "]")).addClass('ref2link-container').removeAttr(_index3.settings.parsedAttribute);
        var duration = new Date().getTime() - s;
        console.log('Parsed in ', duration, 'ms');
        elements.forEach(function (p, index) {
          p.resolver(values[index]);
        });

        // linked data is fetched independently from the parsing 
        if (R2L.options.metadata) {
          setTimeout(function () {
            R2L.loadMetadata(R2L.getFormattedReferences("json").result).then(function (result) {
              (0, _jquery.$)(document).trigger('ref2link.ld', true);
            })["catch"](function (e) {
              (0, _jquery.$)(document).trigger('ref2link.ld', false);
              console.error(e);
            });
          }, 0);
        }
      }, 0);
    });
    return stack.map(function (item) {
      return item.parser;
    });
  };
  _jquery.$.fn.parseTextRules = _jquery.$.fn.parseDeferred;
}

},{"../alias/index.js":5,"../jquery.js":9,"../settings/index.js":32,"../utils/functions.js":56,"../utils/processor.js":60,"../utils/shared.js":62,"../ux/index.js":63}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.appendCorrectionsData = appendCorrectionsData;
exports.getCorrectionsData = getCorrectionsData;
exports.getCorrectionsQuery = getCorrectionsQuery;
var _index = require("../index.js");
var _request = require("../../utils/request.js");
function appendCorrectionsData(response, langISO3) {
  return new Promise(function (resolve, reject) {
    var celexIds = [];
    if (!response || !response.results || !response.results.bindings) {
      resolve(response);
      return;
    }
    response.results.bindings.forEach(function (binding) {
      var idList = binding && binding.id ? binding.id.value : "";
      var ids = String(idList || "").split(",").filter(function (id) {
        return !!id;
      }).map(function (id) {
        return id.replace("celex:", "");
      });
      celexIds = celexIds.concat(ids);
    });
    // unique ids only
    celexIds = celexIds.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
    // remove ids which are already corrections (ending with 'R(01)')
    celexIds = celexIds.filter(function (id) {
      return !/R\(\d+\)$/.test(id);
    });
    if (celexIds.length === 0) {
      resolve(response);
      return;
    }
    getCorrectionsData(celexIds, langISO3).then(function (correctionsResponse) {
      try {
        var correctionCelexIds = correctionsResponse.results.bindings.map(function (res) {
          return res.correctionCelexId.value;
        });
        response.results.bindings = response.results.bindings.map(function (binding) {
          // append correction data
          binding["correctionCelexIds"] = {
            datatype: "http://www.w3.org/2001/XMLSchema#string",
            type: "typed-literal",
            value: correctionCelexIds.filter(function (id) {
              return id.indexOf(binding.id.value.replace("celex:", "") + "R(") === 0;
            }).join(",")
          };
          return binding;
        });
      } catch (e) {
        console.error(e);
      }
      resolve(response);
    }, function (err) {
      console.error(err);
      resolve(response);
    });
  });
}
function getCorrectionsData(celexIds, langISO3) {
  var query = getCorrectionsQuery(celexIds, langISO3);
  var format = 'application/json';
  return (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
    query: query,
    format: format,
    origin: '*',
    target: _index.LD_TARGET_CELLAR
  });
}

/**
 * Build query for corrections data
 * @param {Array<string>} celexIds 
 * @param {string} langISO3
 * @returns 
 */
function getCorrectionsQuery(celexIds, langISO3) {
  langISO3 = langISO3 || "ENG";
  langISO3 = String(langISO3).toUpperCase();
  var filters = "FILTER (?workId IN (";
  for (var i = 0; i < celexIds.length; i++) {
    filters += "\"celex:".concat(celexIds[i], "\", \"celex:").concat(celexIds[i], "\"^^xsd:string"); // query both types
    if (i < celexIds.length - 1) {
      filters += ",";
    }
  }
  filters += "))";
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?corrCelexId as ?correctionCelexId\n        \n    WHERE {  \n        ?s cdm:work_id_document ?workId.\n        ".concat(filters, "\n\n        # CORRECTIONS\n        ?corr cdm:resource_legal_corrects_resource_legal ?s .\n        ?corr cdm:resource_legal_id_celex ?corrCelexId .\n        FILTER exists {\n            ?expCorr cdm:expression_belongs_to_work ?corr .\n            ?expCorr cdm:expression_uses_language lang:").concat(langISO3, "\n        }\n    }");
  return query;
}

},{"../../utils/request.js":61,"../index.js":18}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseJoinedCaseResponse = parseJoinedCaseResponse;
/**
 * Process Cellar response - format joined cases as CSV with first case being the one with the judgement;
 * Example: 
 *     id: `celex:62011CA0229`
 *     title: `C-229/11,C-230/11`
 * @param {CellarResponse} response 
 * 
 * @return {CellarResponse}
 */
function parseJoinedCaseResponse(response) {
  response.results.bindings = response.results.bindings.map(function (result) {
    var parts = result.title.value.split(":");
    var title = parts[0] || '';
    title = title.replaceAll("‑", "-").replace("Affaires jointes ", "").replace(/\s?et\sles\saffaires\sjointes\s?/g, "");
    title = title.replace(/\s?(?:à|et)\s?/g, ",").replace(".", "");
    title = title.split(",").map(function (item) {
      return item.trim().replace("affaire ", "").replace(/\s/, " ");
    }).filter(function (caseLabel) {
      return caseLabel.indexOf('C-') === 0 || caseLabel.indexOf('T-') === 0;
    }).join(",");
    result.title.value = title;
    return result;
  });
  return response;
}

},{}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractOjData = extractOjData;
exports.translateOjData = translateOjData;
var _index = require("../../translations/index.js");
/**
 * Extracts information from the OJ label returned by SPARQL queries 
 * Example: OJ L 119, 4.5.2016, p. 1–88
 * @param {String} ojLabel 
 * @returns {Object} 
 */
function extractOjData(ojLabel) {
  var regex = /OJ ([a-zA-Z-]+) (\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4}), p\. (\d+)-(\d+)/i;
  var regexActByAct = /OJ ([a-zA-Z-]+) (\d{4})\/(\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4})/i;
  var regexWithoutPage = /OJ ([a-zA-Z-]+) (\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4})/i;
  var matches = regex.exec(ojLabel);
  if (!matches) {
    matches = regexActByAct.exec(ojLabel);
    if (!matches) {
      matches = regexWithoutPage.exec(ojLabel);
      if (!matches) {
        return null;
      } else {
        return {
          ojPart: matches[1],
          ojNumber: matches[2],
          ojPublicationDate: matches[3],
          ojPublicationDateDay: matches[3].split(".")[0],
          ojPublicationDateMonth: matches[3].split(".")[1],
          ojPublicationDateYear: matches[3].split(".")[2],
          isActByAct: false,
          isNoPage: true
        };
      }
    } else {
      return {
        ojPart: matches[1],
        ojPartPrefix: matches[1] === 'C' ? 'C/' : '',
        ojYear: matches[2],
        ojNumber: matches[3],
        ojPublicationDate: matches[4],
        ojPublicationDateDay: matches[4].split(".")[0],
        ojPublicationDateMonth: matches[4].split(".")[1],
        ojPublicationDateYear: matches[4].split(".")[2],
        isActByAct: true,
        isNoPage: false
      };
    }
  } else {
    return {
      ojPart: matches[1],
      ojNumber: matches[2],
      ojPublicationDate: matches[3],
      ojPublicationDateDay: matches[3].split(".")[0],
      ojPublicationDateMonth: matches[3].split(".")[1],
      ojPublicationDateYear: matches[3].split(".")[2],
      ojPageFirst: matches[4],
      ojPageLast: matches[5],
      isActByAct: false,
      isNoPage: false
    };
  }
}

/**
 * Translate OJ label
 * @param {*} response 
 * @param {*} langISO2 
 * @returns 
 */
function translateOjData(response, langISO2) {
  if (!response || !response.results || !response.results.bindings) {
    return response;
  }
  response.results.bindings = response.results.bindings.map(function (binding) {
    try {
      if (!binding.oj || !binding.oj.value) {
        return binding;
      }
      var ojString = binding.oj.value;
      var ojData = extractOjData(ojString);
      if (ojData) {
        if (ojData.isActByAct) {
          binding.oj.value = (0, _index.getTranslation)('official.journal.label.new', langISO2, ojData);
        } else if (ojData.isNoPage) {
          binding.oj.value = (0, _index.getTranslation)('official.journal.label.nopage', langISO2, ojData);
        } else {
          binding.oj.value = (0, _index.getTranslation)('official.journal.label', langISO2, ojData);
        }
      }
      return binding;
    } catch (e) {
      console.debug(e); //missing OJ data; moving on;
      return binding;
    }
  });
  return response;
}

},{"../../translations/index.js":51}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.appendPointInTimeData = appendPointInTimeData;
var _index = require("../index.js");
var _request = require("../../utils/request.js");
var _celex = require("../query/celex.js");
var _index2 = require("../../translations/index.js");
var _oj = require("./oj.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Will apply the Point-in-time parameter to the Cellar response by overriding the linked-data of the original acts with the consolidated acts if needed. 
 * Example: 
 *   pointInTime = 2023-01-01; 
 *   text = 32006R0765; 
 * 
 * Output: 
 *   title: Consolidated text: Council Regulation (EC) No 765/2006 of 18 May 2006 concerning restrictive measures in view of the situation in Belarus and the involvement of Belarus in the Russian aggression against Ukraine
 *   eli: http://data.europa.eu/eli/reg/2006/765/2022-07-20
 * 
 * @param {R2LCellarResponse} response 
 * @param {String} langISO3 
 * 
 * @return {Promise<R2LCellarResponse>}
 */
function appendPointInTimeData(response, langISO3) {
  return new Promise(function (resolve, reject) {
    var celexIds = [];
    if (!response || !response.results || !response.results.bindings) {
      resolve(response);
      return;
    }
    response.results.bindings.forEach(function (binding) {
      var idList = binding && binding.consolidatedId ? binding.consolidatedId.value : "";
      var ids = String(idList || "").split(",").filter(function (id) {
        return !!id;
      }).map(function (id) {
        return id.replace("celex:", "");
      });
      celexIds = celexIds.concat(ids);
    });
    // unique ids only
    celexIds = celexIds.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
    console.debug("Extracted CELEX ids", celexIds);
    if (celexIds.length === 0) {
      resolve(response);
      return;
    }

    // load linked data for all these CELEX ids
    var query = (0, _celex.getCelexQuery)(celexIds, langISO3);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*',
      target: _index.LD_TARGET_CELLAR
    }).then(function (consolidationResponse) {
      // apply OJ translations
      var langISO2 = (0, _index2.getISO2Lang)((langISO3 || "ENG").toUpperCase());
      consolidationResponse = (0, _oj.translateOjData)(consolidationResponse, langISO2);

      // merge the data
      var celexDataMap = {};
      consolidationResponse.results.bindings.forEach(function (binding) {
        var id = String(binding && binding.id ? binding.id.value : "").replace("celex:", "");
        if (binding.title && binding.title.value) {
          binding.title.value = (0, _index2.getTranslation)('eurlex.consolidated.text', langISO2) + ': ' + binding.title.value;
        }
        celexDataMap[id] = binding;
      });
      response.results.bindings = response.results.bindings.map(function (binding) {
        // override data if found in the consolidation map
        if (binding.consolidatedId && celexDataMap[binding.consolidatedId.value]) {
          var _binding = celexDataMap[binding.consolidatedId.value];
          // add a  property to keep track of the original CELEX id and the consolidation CELEX id
          if (binding.id) {
            _binding.originalId = {
              type: 'xsd: string',
              value: binding.id.value
            };
          }
          if (binding.eli) {
            _binding.originalEli = {
              type: 'xsd: string',
              value: binding.eli.value
            };
          }

          // we merge some data from the main act
          var obj = _objectSpread(_objectSpread({}, _binding), {
            force: binding.force,
            dateForce: binding.dateForce,
            dateValidity: binding.dateValidity,
            repealCelexId: binding.repealCelexId,
            repealEli: binding.repealEli,
            lastRepealCelexId: binding.lastRepealCelexId,
            lastRepealEli: binding.lastRepealEli
          });
          return obj;
        }
        return binding;
      });
      resolve(response);
    })["catch"](function (e) {
      console.error(e);
      resolve(response);
    });
  });
}

},{"../../translations/index.js":51,"../../utils/request.js":61,"../index.js":18,"../query/celex.js":21,"./oj.js":13}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.appendShortTitlesData = appendShortTitlesData;
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function appendShortTitlesData(response, langISO3) {
  return new Promise(function (resolve, reject) {
    if (!response || !response.results || !response.results.bindings) {
      resolve(response);
      return;
    }
    var fullTitlesMap = {};
    response.results.bindings.forEach(function (binding) {
      var id = binding && binding.id ? binding.id.value : "";
      id = id.replace("celex:", "");
      if (binding.title && binding.title.value) {
        fullTitlesMap[id] = binding.title.value;
      }
    });
    if (Object.keys(fullTitlesMap).length === 0) {
      resolve(response);
      return;
    }
    var treatyShortTitlesMap = R2L.alias.extractTreatyShortTitlesMap(Object.keys(fullTitlesMap), langISO3);
    R2L.alias.extractShortTitlesMap(fullTitlesMap).then(function (shortTitlesMap) {
      // append results to response
      shortTitlesMap = _objectSpread(_objectSpread({}, shortTitlesMap), treatyShortTitlesMap);
      try {
        response.results.bindings = response.results.bindings.map(function (binding) {
          var id = (binding && binding.id ? binding.id.value : "").replace("celex:", "");
          if (shortTitlesMap[id]) {
            binding.shortTitle = {
              datatype: "http://www.w3.org/2001/XMLSchema#string",
              type: "typed-literal",
              value: shortTitlesMap[id]
            };
          }
          return binding;
        });
      } catch (e) {
        console.error(e);
      }
      resolve(response);
    })["catch"](function (err) {
      console.error(err);
      resolve(response);
    });
  });
}

},{}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TFEU_TRANSLATIONS_LONG = exports.TFEU_TRANSLATIONS = exports.TEU_TRANSLATIONS_LONG = exports.TEU_TRANSLATIONS = exports.SHORT_TITLE_WITH_ARTICLE_TEMPLATE = exports.SHORT_TITLE_WITH_ANNEX_TEMPLATE = exports.SHORT_TITLE_TEMPLATE = exports.LISBON_TRANSLATIONS_LONG = exports.LISBON_TRANSLATIONS = exports.EURATOM_TRANSLATIONS_LONG = exports.EURATOM_TRANSLATIONS = exports.ECSC_TREATY_LONG = exports.ECSC_TREATY = void 0;
exports.getAcronym = getAcronym;
exports.getAnnexNo = getAnnexNo;
exports.getArticleNo = getArticleNo;
exports.getEUTreatyShortTitle = getEUTreatyShortTitle;
var _index = require("../../translations/index.js");
var SHORT_TITLE_WITH_ARTICLE_TEMPLATE = exports.SHORT_TITLE_WITH_ARTICLE_TEMPLATE = {
  'EN': 'Article {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}',
  'FR': 'Article {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}',
  'DE': 'Artikel {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}'
};
var SHORT_TITLE_WITH_ANNEX_TEMPLATE = exports.SHORT_TITLE_WITH_ANNEX_TEMPLATE = {
  'EN': 'Annex {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}',
  'FR': 'Annexe {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}',
  'DE': 'ANHANG {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}'
};
var SHORT_TITLE_TEMPLATE = exports.SHORT_TITLE_TEMPLATE = {
  'EN': '{{ TREATY_ACRONYM }}',
  'FR': '{{ TREATY_ACRONYM }}',
  'DE': '{{ TREATY_ACRONYM }}'
};
var TEU_TRANSLATIONS = exports.TEU_TRANSLATIONS = {
  'EN': 'TEU',
  'FR': 'TUE',
  'DE': 'EUV'
};
var TEU_TRANSLATIONS_LONG = exports.TEU_TRANSLATIONS_LONG = {
  'EN': 'Treaty on European Union',
  'FR': 'Traité sur l\'Union européenne',
  'DE': 'Vertrag über die Europäische Union'
};
var TFEU_TRANSLATIONS = exports.TFEU_TRANSLATIONS = {
  'EN': 'TFEU',
  'FR': 'TFUE',
  'DE': 'AEUV'
};
var TFEU_TRANSLATIONS_LONG = exports.TFEU_TRANSLATIONS_LONG = {
  'EN': 'Treaty on the Functioning of the EU',
  'FR': 'Traité sur le fonctionnement de l\'UE',
  'DE': 'Vertrag über die Arbeitsweise der EU'
};
var EURATOM_TRANSLATIONS = exports.EURATOM_TRANSLATIONS = {
  'EN': 'EAEC',
  'FR': 'CEEA',
  'DE': 'EAG'
};
var EURATOM_TRANSLATIONS_LONG = exports.EURATOM_TRANSLATIONS_LONG = {
  'EN': 'EAEC Treaty',
  'FR': 'traité CEEA',
  'DE': 'EAG-Vertrag'
};
var LISBON_TRANSLATIONS = exports.LISBON_TRANSLATIONS = {
  'EN': 'Treaty of Lisbon',
  'FR': 'Traité de Lisbonne',
  'DE': 'Vertrag von Lissabon'
};
var LISBON_TRANSLATIONS_LONG = exports.LISBON_TRANSLATIONS_LONG = LISBON_TRANSLATIONS;
var ECSC_TREATY = exports.ECSC_TREATY = {
  'EN': 'ECSC',
  'FR': 'CECA',
  'DE': 'EGKS'
};
var ECSC_TREATY_LONG = exports.ECSC_TREATY_LONG = {
  'EN': 'ECSC Treaty',
  'FR': 'traité CECA',
  'DE': 'EGKS-Vertrag'
};
function getAcronym(celexId, langISO2) {
  var root = String(celexId).slice(1, 6);
  var hasSubdivision = getAnnexNo(celexId) || getArticleNo(celexId);
  if (root === '2016M') {
    return hasSubdivision ? TEU_TRANSLATIONS[langISO2] : TEU_TRANSLATIONS_LONG[langISO2];
  }
  if (root === '2016E') {
    return hasSubdivision ? TFEU_TRANSLATIONS[langISO2] : TFEU_TRANSLATIONS_LONG[langISO2];
  }
  if (root === '2016A') {
    return hasSubdivision ? EURATOM_TRANSLATIONS[langISO2] : EURATOM_TRANSLATIONS_LONG[langISO2];
  }
  if (root === '2007L') {
    return hasSubdivision ? LISBON_TRANSLATIONS[langISO2] : LISBON_TRANSLATIONS_LONG[langISO2];
  }
  if (root === '1951K') {
    return hasSubdivision ? ECSC_TREATY[langISO2] : ECSC_TREATY_LONG[langISO2];
  }
  return null;
}
function getArticleNo(celexId) {
  var digits = String(celexId).slice(-3);
  if (/^\d+$/gi.exec(digits)) {
    return String(parseInt(digits));
  }
  return null;
}
function getAnnexNo(celexId) {
  var matches = /N(\d+)$/gi.exec(String(celexId));
  if (matches && matches[1]) {
    return String(parseInt(matches[1]));
  }
  return null;
}

/**
 * Returns a short title for an EU treaty, based on the CELEX id.
 * @param {String} celexId 
 * @param {String} langISO3
 * 
 * @return {String|null} 
 */
function getEUTreatyShortTitle(celexId, langISO3) {
  langISO3 = langISO3 || 'ENG';
  var langISO2 = (0, _index.getISO2Lang)(langISO3);
  var articleNo = getArticleNo(celexId);
  var annexNo = getAnnexNo(celexId);
  var annexNoRoman = R2L.converters.toRoman(annexNo);
  var acronym = getAcronym(celexId, langISO2);
  var tmpl = SHORT_TITLE_TEMPLATE;
  if (articleNo) {
    tmpl = SHORT_TITLE_WITH_ARTICLE_TEMPLATE;
  }
  if (annexNoRoman) {
    tmpl = SHORT_TITLE_WITH_ANNEX_TEMPLATE;
  }
  if (acronym && tmpl[langISO2]) {
    return tmpl[langISO2].replace('{{ TREATY_ACRONYM }}', acronym).replace('{{ TREATY_ARTICLE_NO }}', articleNo).replace('{{ TREATY_ANNEX_NO }}', annexNoRoman);
  }
  return null;
}

},{"../../translations/index.js":51}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEcasTicket = getEcasTicket;
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
/**
 * Fetch ECAS ticket for a target url
 * @param {String} targetUrl 
 * @param {String} forcedProxyTicket 
 * 
 * @return {Promise<String>} ECAS proxy ticket
 */
function getEcasTicket(targetUrl, forcedProxyTicket) {
  return new Promise(function (resolve, reject) {
    if (forcedProxyTicket) {
      resolve(forcedProxyTicket);
      return;
    }
    if ((typeof OpenIdConnect === "undefined" ? "undefined" : _typeof(OpenIdConnect)) === 'object' && typeof OpenIdConnect.getAuthorizationHeaders === 'function') {
      OpenIdConnect.getAuthorizationHeaders(targetUrl, function (res) {
        var ticket = res ? (res.Authorization || "").replace("cas_ticket ", "") : "";
        if (!ticket) {
          reject(new Error("No ticket retrieved"));
        } else {
          resolve(ticket);
        }
      }, function (err) {
        console.error(err);
        reject(err);
      });
    } else {
      reject(new Error("Failed to retrieve ECAS ticket"));
    }
  });
}

},{}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SPARQL_STATUS_SUCCESS = exports.SPARQL_STATUS_PENDING = exports.SPARQL_STATUS_INIT = exports.SPARQL_STATUS_ERROR = exports.LinkedDataManager = exports.LD_TYPE_PROCEDURE = exports.LD_TYPE_OJ = exports.LD_TYPE_HANDOC = exports.LD_TYPE_FINLEX = exports.LD_TYPE_ELI = exports.LD_TYPE_ECLI = exports.LD_TYPE_CONSIL = exports.LD_TYPE_CIS = exports.LD_TYPE_CELEX = exports.LD_TARGET_KM = exports.LD_TARGET_FINLEX = exports.LD_TARGET_ELI = exports.LD_TARGET_CELLAR = exports.LD_CELEX_SUFFIXES = exports.CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY = exports.CELLAR_JOINED_EUCASE_DATA_CACHE_KEY = exports.Binding = void 0;
exports.cleanLinkedDataBinding = cleanLinkedDataBinding;
exports.getLinkedDataLanguage = getLinkedDataLanguage;
exports.sanitizeLinkedDataBinding = sanitizeLinkedDataBinding;
var _index = require("../settings/index.js");
var _index2 = require("../translations/index.js");
var _celex = require("./query/celex.js");
var _eli = require("./query/eli.js");
var _ecli = require("./query/ecli.js");
var _finlex = require("./query/finlex.js");
var _corrections = require("./data/corrections.js");
var _data = require("../utils/data.js");
var _short_titles = require("./data/short_titles.js");
var _functions = require("../utils/functions.js");
var _request = require("../utils/request.js");
var _oj = require("./data/oj.js");
var _ecas = require("./ecas.js");
var _cluster = require("./query/cluster.js");
var _classifications = require("./query/classifications.js");
var _eurlex = require("./parser/eurlex.js");
var _footnote = require("./modifiers/footnote.js");
var _proc = require("./query/proc.js");
var _pit = require("./data/pit.js");
var _consil = require("./query/consil.js");
var _treaty = require("./data/treaty.js");
var _oj2 = require("./query/oj.js");
var _joined_eucase = require("./query/joined_eucase.js");
var _joined_eucase2 = require("./data/joined_eucase.js");
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
var SPARQL_STATUS_INIT = exports.SPARQL_STATUS_INIT = 'init';
var SPARQL_STATUS_SUCCESS = exports.SPARQL_STATUS_SUCCESS = 'success';
var SPARQL_STATUS_PENDING = exports.SPARQL_STATUS_PENDING = 'pending';
var SPARQL_STATUS_ERROR = exports.SPARQL_STATUS_ERROR = 'error';
var CELLAR_JOINED_EUCASE_DATA_CACHE_KEY = exports.CELLAR_JOINED_EUCASE_DATA_CACHE_KEY = 'CELLAR:JOINED_EUCASE_DATA';
var CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY = exports.CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY = 'CELLAR:JOINED_EUCASE_PROCESSED_DATA';
var LD_TYPE_CELEX = exports.LD_TYPE_CELEX = 'celex';
var LD_TYPE_OJ = exports.LD_TYPE_OJ = 'oj';
var LD_TYPE_ECLI = exports.LD_TYPE_ECLI = 'ecli';
var LD_TYPE_ELI = exports.LD_TYPE_ELI = 'eli';
var LD_TYPE_PROCEDURE = exports.LD_TYPE_PROCEDURE = 'procedure';
var LD_TYPE_CONSIL = exports.LD_TYPE_CONSIL = 'consil';
var LD_TYPE_HANDOC = exports.LD_TYPE_HANDOC = 'handoc';
var LD_TYPE_CIS = exports.LD_TYPE_CIS = 'cis';
var LD_TYPE_FINLEX = exports.LD_TYPE_FINLEX = 'finlex-eli';
var LD_CELEX_SUFFIXES = exports.LD_CELEX_SUFFIXES = ["", "-0", "-1", "-2", "-3", "-4", "-5", "-6", "-7", "-8", "-9", "-10"];
var LD_TARGET_CELLAR = exports.LD_TARGET_CELLAR = 'cellar';
var LD_TARGET_FINLEX = exports.LD_TARGET_FINLEX = 'finlex';
var LD_TARGET_ELI = exports.LD_TARGET_ELI = 'eli';
var LD_TARGET_KM = exports.LD_TARGET_KM = 'km';

/**
 * Holds metadata associated to a reference
 */
var Binding = exports.Binding = /*#__PURE__*/_createClass(
/**
 * Constructs a binding object. Holds error state. 
 * @param {Object} data - Data object as returned by the SPARQL query @CELLAR
 * @param {string} type   
 * @param {string} status 
 */
function Binding(data, type, status) {
  _classCallCheck(this, Binding);
  this.data = data;
  this.type = type;
  this.status = status;
});
/**
 * 
 * @param {Binding} binding 
 * @returns {Object}
 */
function cleanLinkedDataBinding(binding) {
  var data = binding.data;
  Object.keys(data).forEach(function (key) {
    var v = data[key];
    if (v) {
      delete v.datatype;
      data[key] = v;
    }
  });
  return data;
}

/**
 * 
 * @param {Binding} binding 
 * @returns 
 */
function sanitizeLinkedDataBinding(binding) {
  if (_typeof(binding) !== 'object' || _typeof(binding.data) !== 'object') {
    return binding;
  }
  Object.keys(binding.data || {}).forEach(function (key) {
    var v = binding.data[key];
    if (v && typeof v.value === "string") {
      v.value = (0, _functions.sanitizeHtml)(v.value);
    }
  });
  return binding;
}

/**
 * The LinkedDataManager is responsible for fetching linked-data from external repositories
 * It can fetch data based on: 
 *   - CELEX and ECLI identifiers - using the Publication Office Cellar repository
 *   - Finnish ELI identifiers - using the Finlex Graph
 * 
 * DO NOT TRUST THE DATA
 * Make sure the data is sanitized and contains no HTML entities
 */
var LinkedDataManager = exports.LinkedDataManager = /*#__PURE__*/function () {
  function LinkedDataManager() {
    _classCallCheck(this, LinkedDataManager);
    /* Holds raw linked-data object (KV) */
    this._metadata = {};
    this.status = SPARQL_STATUS_INIT;
    this.supportedTypes = [LD_TYPE_CELEX, LD_TYPE_OJ, LD_TYPE_CONSIL, LD_TYPE_CIS, LD_TYPE_PROCEDURE, LD_TYPE_ECLI, LD_TYPE_ELI, LD_TYPE_FINLEX, LD_TYPE_HANDOC];
    this.proxyTicket = null;
    this.user = null;
    this._customHeaders = {};
    this._localCache = {};
  }
  _createClass(LinkedDataManager, [{
    key: "getCustomHeaders",
    value: function getCustomHeaders() {
      return this._customHeaders;
    }
  }, {
    key: "setCustomHeaders",
    value: function setCustomHeaders(customHeaders) {
      this._customHeaders = customHeaders;
    }
  }, {
    key: "getStatus",
    value: function getStatus() {
      return this.status;
    }
  }, {
    key: "setProxyTicket",
    value: function setProxyTicket(proxyTicket) {
      this.proxyTicket = proxyTicket;
    }
  }, {
    key: "setUser",
    value: function setUser(user) {
      this.user = user;
    }
  }, {
    key: "getEndpoint",
    value: function getEndpoint(type) {
      if (type === LD_TYPE_FINLEX) {
        return _index.settings.constants.R2L_FINLEX_ENDPOINT;
      } else {
        return _index.settings.constants.R2L_PUBLICATIONS_ENDPOINT;
      }
    }
  }, {
    key: "getEurlexContentEndpoint",
    value: function getEurlexContentEndpoint(type) {
      return _index.settings.constants.R2L_CONTENT_ENDPOINT;
    }

    /**
     * @param {String} id
     * @returns {Binding|null} 
     */
  }, {
    key: "getMetadataById",
    value: function getMetadataById(id) {
      return this._metadata[id];
    }
  }, {
    key: "getMetadata",
    value:
    /**
     * Get metadata by a list of ids 
     * @param {string[]} ids 
     */
    function getMetadata(ids) {
      var _this = this;
      if (Array.isArray(ids)) {
        var data = {};
        ids.forEach(function (id) {
          if (_this._metadata[id]) {
            data[id] = _this._metadata[id];
          }
        });
        return data;
      } else {
        return this._metadata;
      }
    }
  }, {
    key: "setMetadata",
    value: function setMetadata(metadata) {
      // sanitize all strings coming from Cellar (REFTOLINK-1523)
      Object.keys(metadata).forEach(function (key) {
        metadata[key] = sanitizeLinkedDataBinding(metadata[key]);
      });
      this._metadata = _objectSpread(_objectSpread({}, this._metadata), metadata);
    }
  }, {
    key: "clearCache",
    value: function clearCache() {
      this._metadata = {};
    }
  }, {
    key: "getOjData",
    value: function getOjData(ojIds, format) {
      var langISO3 = R2L.getLanguage() || 'ENG';
      var query = (0, _oj2.getOjQuery)(ojIds, langISO3);
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        // apply OJ translations
        var langISO2 = (0, _index2.getISO2Lang)((langISO3 || "ENG").toUpperCase());
        response = (0, _oj.translateOjData)(response, langISO2);
        var promises = [];

        // explicit LD_ADVANCED_MODE_CORRECTIONS mode (must be set via the API)
        // Note: it will not be included in the "all" mode

        if (R2L.options.pointInTime) {
          promises.push((0, _pit.appendPointInTimeData)(response, langISO3));
        }
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
          promises.push((0, _corrections.appendCorrectionsData)(response, langISO3));
        }

        // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
        // Note: it will not be included in the "all" mode
        // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
          promises.push((0, _short_titles.appendShortTitlesData)(response, langISO3));
        }
        if (promises.length) {
          return Promise.all(promises).then(function (responses) {
            return responses[promises.length - 1];
          })["catch"](function (err) {
            console.error(err);
            return response;
          });
        } else {
          return response;
        }
      });
    }
  }, {
    key: "getCelexData",
    value: function getCelexData(celexIds, format) {
      var langISO3 = R2L.getLanguage() || 'ENG';
      var query = (0, _celex.getCelexQuery)(celexIds, langISO3);
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        // apply OJ translations
        var langISO2 = (0, _index2.getISO2Lang)((langISO3 || "ENG").toUpperCase());
        response = (0, _oj.translateOjData)(response, langISO2);
        var promises = [];

        // explicit LD_ADVANCED_MODE_CORRECTIONS mode (must be set via the API)
        // Note: it will not be included in the "all" mode

        if (R2L.options.pointInTime) {
          promises.push((0, _pit.appendPointInTimeData)(response, langISO3));
        }
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
          promises.push((0, _corrections.appendCorrectionsData)(response, langISO3));
        }

        // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
        // Note: it will not be included in the "all" mode
        // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
          promises.push((0, _short_titles.appendShortTitlesData)(response, langISO3));
        }
        if (promises.length) {
          return Promise.all(promises).then(function (responses) {
            return responses[promises.length - 1];
          })["catch"](function (err) {
            console.error(err);
            return response;
          });
        } else {
          return response;
        }
      });
    }
  }, {
    key: "getEurlexContent",
    value: function getEurlexContent(node) {
      var langISO3 = R2L.getLanguage() || 'ENG';
      var langISO2 = (0, _index2.getISO2Lang)((langISO3 || "ENG").toUpperCase());
      var celex = node.data[0].celex;
      // celex id can also be present in linked data (ECLI)
      if (!celex && node.data[0].metadata && node.data[0].metadata.celexId) {
        celex = String(node.data[0].metadata.celexId.value).replace("celex:", "");
      }

      // pass ELI if present and point in time is enabled
      var eliUrl = node.urls.filter(function (url) {
        return ["eurlex.act.eli", "eurlex.oj.eli", "eurlex.intlagr.eli", "eliurl"].indexOf(url.baseTarget) !== -1;
      }).pop();

      // when point in time is enabled we use the ELI
      var eli = R2L.options.pointInTime && eliUrl ? "/eli" + eliUrl.href.split("/eli")[1] : null;
      var linkedDataEli = node.data[0].metadata && node.data[0].metadata.eli ? node.data[0].metadata.eli.value : null;

      // if no CELEX then use eli if available
      if (eli) {
        // use the linked data ELI if present as it will contain the latest consolidation URL
        var href = linkedDataEli || eli;
        eli = "/eli" + href.split("/eli")[1];
      }
      return (0, _request.getEurlexRequestPromise)(this.getEurlexContentEndpoint(), "GET", {
        lang: langISO2,
        celex: celex,
        eli: eli
      }).then(function (response) {
        return (0, _eurlex.parseEurlexResponse)(response, node);
      });
    }
  }, {
    key: "getProcedureData",
    value: function getProcedureData(procedureIds, format) {
      var langISO3 = R2L.getLanguage() || 'ENG';
      var query = (0, _proc.getProcedureQuery)(procedureIds, langISO3);
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_PROCEDURE), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return (0, _proc.processProcResponse)(response, langISO3);
      });
    }
  }, {
    key: "getEcliData",
    value: function getEcliData(ecliIds, format) {
      var query = (0, _ecli.getEcliQuery)(ecliIds, R2L.getLanguage() || 'ENG');
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_ECLI), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      });
    }
  }, {
    key: "getConsilData",
    value: function getConsilData(consilIds, format) {
      var langISO3 = R2L.getLanguage() || 'ENG';
      var query = (0, _consil.getConsilQuery)(consilIds, langISO3);
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return (0, _consil.processConsilResponse)(response, langISO3);
      });
      ;
    }
  }, {
    key: "getFinlexEliData",
    value: function getFinlexEliData(eliIds, format) {
      var query = (0, _finlex.getFinlexEliQuery)(eliIds, R2L.getLanguage() || "ENG");
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_FINLEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_FINLEX
      });
    }
  }, {
    key: "getEliData",
    value: function getEliData(eliIds, format) {
      var _this2 = this;
      var langISO3 = R2L.getLanguage() || "ENG";
      // filter out /eli/L/ ids because they are not in Cellar
      eliIds = eliIds.filter(function (eliId) {
        return eliId.indexOf('/eli/L/') === -1;
      });
      if (eliIds.length === 0) {
        //return Promise.resolve(null);
      }
      format = format || 'application/json';
      var computedEliIdsMap = {};
      var computedEliIds = eliIds;
      eliIds.forEach(function (eliId) {
        computedEliIdsMap[eliId] = eliId;
      });

      // get all ELI consolidations first
      // we don't need to lookup eli ids with /oj
      var consolidationEliIds = eliIds.filter(function (eid) {
        return eid.slice(-3) !== '/oj';
      });
      var consolidationsQuery = (0, _eli.getEliConsolidationsQuery)(consolidationEliIds);
      return (consolidationEliIds.length > 0 ? (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_ELI), "POST", {
        query: consolidationsQuery,
        format: format,
        origin: '*',
        target: LD_TARGET_ELI
      }) : Promise.resolve(null)).then(function (consolidationEliResponse) {
        if (consolidationEliResponse) {
          // we override the ELI data with ids having the dates closest to ours
          computedEliIdsMap = (0, _eli.computeEliIdsMap)(eliIds, consolidationEliResponse.results.bindings);
          // we rebuild the map
          computedEliIds = Object.values(computedEliIdsMap);
        }
        var query = (0, _eli.getEliQuery)(computedEliIds, R2L.getLanguage() || "ENG");
        return (0, _request.getRequestPromise)(_this2.getEndpoint(LD_TYPE_ELI), "POST", {
          query: query,
          format: format,
          origin: '*',
          target: LD_TARGET_ELI
        });
      }).then(function (response) {
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
          return (0, _corrections.appendCorrectionsData)(response, langISO3);
        } else {
          return Promise.resolve(response);
        }
      }).then(function (response) {
        // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
        // Note: it will not be included in the "all" mode
        // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
        if (langISO3 && R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
          return (0, _short_titles.appendShortTitlesData)(response, langISO3);
        } else {
          return Promise.resolve(response);
        }
      }).then(function (response) {
        var langISO2 = (0, _index2.getISO2Lang)((langISO3 || "ENG").toUpperCase());
        response = (0, _oj.translateOjData)(response, langISO2);
        response._computedEliIdsMap = computedEliIdsMap;
        return response;
      });
    }

    /**
     * Retrieve ARES data from ULM's KM api 
     * 
     * @param {Array<String>} aresHandocIds 
     * @param {String} format
     * 
     * @return Promise<Object> 
     */
  }, {
    key: "getAresData",
    value: function getAresData(aresHandocIds, format) {
      var _this3 = this;
      var body = {
        handoc: aresHandocIds
      };
      format = format || 'application/json';
      return (0, _ecas.getEcasTicket)(this.getEndpoint(LD_TYPE_HANDOC), this.proxyTicket).then(function (proxyTicket) {
        var headers = {
          Authorization: proxyTicket
        };
        return (0, _request.getRequestPromise)(_this3.getEndpoint(LD_TYPE_HANDOC), "POST", {
          query: JSON.stringify(body),
          format: format,
          origin: '*',
          target: LD_TARGET_KM
        }, headers).then(function (response) {
          return response;
        });
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Retrieve data for multiple types from ULM's KM api 
     * 
     * @param {Object} body - Example: { handoc: ["id1", "id2"], cis: ["id3", "id4"]} 
     * @param {String} format
     * 
     * @return Promise<Object> 
     */
  }, {
    key: "getKMData",
    value: function getKMData(body, format) {
      var _this4 = this;
      format = format || 'application/json';
      return (0, _ecas.getEcasTicket)(this.getEndpoint(LD_TYPE_HANDOC), this.proxyTicket).then(function (proxyTicket) {
        var headers = {
          Authorization: proxyTicket
        };
        return (0, _request.getRequestPromise)(_this4.getEndpoint(LD_TYPE_HANDOC), "POST", {
          query: JSON.stringify(body),
          format: format,
          origin: '*',
          target: LD_TARGET_KM
        }, headers).then(function (response) {
          return response;
        });
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Returns a list of citations with titles for a CELEX id
     * @param {String} celexId 
     * @param {String} searchText (optional) 
     * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law) 
     */
  }, {
    key: "getActsCitedByAct",
    value: function getActsCitedByAct(celexId, searchText, documentType) {
      var query = (0, _cluster.getActsCitedByActQuery)(celexId, R2L.getLanguage() || "ENG", searchText, documentType);
      var format = 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return response;
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Returns a list of acts that cite this act (CELEX id)
     * @param {String} celexId 
     * @param {String} searchText (optional)
     * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law)
     */
  }, {
    key: "getActsCitingAct",
    value: function getActsCitingAct(celexId, searchText, documentType) {
      var query = (0, _cluster.getActsCitingActQuery)(celexId, R2L.getLanguage() || "ENG", searchText, documentType);
      var format = 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return response;
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Returns a list of acts that are based on this act
     * @param {String} celexId 
     * @param {String} searchText  (optional)
     */
  }, {
    key: "getActsByBasisAct",
    value: function getActsByBasisAct(celexId, searchText) {
      var query = (0, _cluster.getActsByBasisActQuery)(celexId, R2L.getLanguage() || "ENG", searchText);
      var format = 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return response;
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Returns the base acts for this act (CELEX id)
     * @param {String} celexId 
     * @param {String} searchText
     */
  }, {
    key: "getBasisActsByAct",
    value: function getBasisActsByAct(celexId, searchText) {
      var query = (0, _cluster.getBasisActsByActQuery)(celexId, R2L.getLanguage() || "ENG", searchText);
      var format = 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return response;
      })["catch"](function (err) {
        console.error(err);
      });
    }

    /**
     * Returns classifications (EUROVOC descriptors and subject matter) for a CELEX id
     * @param {String} celexId 
     * @param {String} format (optional) - defaults to 'application/json'
     */
  }, {
    key: "getClassifications",
    value: function getClassifications(celexId, format) {
      // ISO2 language
      var query = (0, _classifications.getClassificationsQuery)(celexId, getLinkedDataLanguage());
      format = format || 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        return response;
      })["catch"](function (err) {
        console.error(err);
      });
    }
  }, {
    key: "getJoinedCaseDataByCaseLabel",
    value: function getJoinedCaseDataByCaseLabel(caseLabel) {
      var processedData = this._localCache[CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY];
      if (!processedData) {
        var data = this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY];
        if (!data) {
          return null;
        }
        processedData = {};

        // create a map for fast lookups
        data.results.bindings.map(function (binding) {
          var caseLabels = binding.title.value.split(",").map(function (cl) {
            return cl.replace(/\s/g, "").replace("‑", "-");
          });
          caseLabels.forEach(function (caseLabel) {
            processedData[caseLabel] = binding.title.value.split(",");
          });
        });
        this._localCache[CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY] = processedData;
      }
      var rawCaseLabel = String(caseLabel).replace(/\s/g, "").replaceAll("‑", "-");
      // look for the label in the joined cases list
      var item = processedData[rawCaseLabel];
      console.debug("Getting joined case data by case", rawCaseLabel, item);
      return item;
    }
  }, {
    key: "getJoinedCaseData",
    value: function getJoinedCaseData() {
      var _this5 = this;
      if (this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY]) {
        return Promise.resolve(this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY]);
      }
      var query = (0, _joined_eucase.getJoinedCaseQuery)();
      var format = 'application/json';
      return (0, _request.getRequestPromise)(this.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
      }).then(function (response) {
        var parsedResponse = (0, _joined_eucase2.parseJoinedCaseResponse)(response);
        _this5._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY] = parsedResponse;
        return parsedResponse;
      })["catch"](function (err) {
        console.error(err);
        throw err;
      });
    }

    /**
     * Checks whether the external linked data respositories are up by running a dummy query/request.
     * @param {string} ldTarget
     * 
     * @return {Promise<boolean>} 
     */
  }, {
    key: "checkHealth",
    value: function checkHealth(ldTarget) {
      var _this6 = this;
      ldTarget = ldTarget || LD_TARGET_CELLAR; // default to Cellar
      return new Promise(function (resolve, reject) {
        if (ldTarget !== LD_TARGET_CELLAR) {
          //@TODO implement health check for other targets (Finlex/HRS)
          resolve(true);
        }
        var query = "SELECT * WHERE {\n                ?s ?p ?o\n            }\n            LIMIT 1";
        var format = 'application/json';
        return (0, _request.getRequestPromise)(_this6.getEndpoint(LD_TARGET_CELLAR), "POST", {
          query: query,
          format: format,
          origin: '*',
          target: LD_TARGET_CELLAR
        }).then(function (response) {
          resolve(response && response.results && response.results.bindings && response.results.bindings.length === 1 ? true : false);
        })["catch"](function (err) {
          console.error(err);
          resolve(false);
        });
      });
    }

    /**
     * Main linked-data retrieval method - will fetch data for all supported node types. A map of linked data ids can directly be passed as `defaultData`.
     * 
     * @param {Array<R2LNode>} nodes 
     * @param {Object} defaultData - pre-defined map of linked data ids (optional)
     * 
     * @returns {Object} A key-value map of linked-data ids (CELEX/ECLI/ELI...) => data 
     */
  }, {
    key: "fetch",
    value: function fetch(nodes, defaultData) {
      var _this7 = this;
      this.status = SPARQL_STATUS_PENDING;
      var data = defaultData || (0, _data.extractLinkedDataIds)(nodes);
      var celexIds = data[LD_TYPE_CELEX];
      var ecliIds = data[LD_TYPE_ECLI];
      var consilIds = data[LD_TYPE_CONSIL];
      var eliIds = data[LD_TYPE_ELI];
      var procedureIds = data[LD_TYPE_PROCEDURE];
      var finlexEliIds = data[LD_TYPE_FINLEX];
      var aresHandocIds = data[LD_TYPE_HANDOC];
      var cisIds = data[LD_TYPE_CIS];
      var ojIds = data[LD_TYPE_OJ];

      // if the METADATA mode is off we don't load anything 
      if (!R2L.hasLinkedDataMode(_index.LD_MODE_METADATA)) {
        return new Promise(function (resolve, reject) {
          resolve({});
        });
      }

      // CELEX
      var p1 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (celexIds.length === 0) {
          resolve();
          return;
        }
        _this7.getCelexData(celexIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.originalId && binding.originalId.value && !metadata[binding.originalId.value.replace("celex:", "")]) {
                metadata[binding.originalId.value.replace("celex:", "")] = new Binding(binding, LD_TYPE_CELEX, SPARQL_STATUS_SUCCESS);
              }

              // only first result is relevant in case of duplication
              if (binding.id && binding.id.value && !metadata[binding.id.value.replace("celex:", "")]) {
                metadata[binding.id.value.replace("celex:", "")] = new Binding(binding, LD_TYPE_CELEX, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          //set false when failed to fetch metadata
          celexIds.forEach(function (celexId) {
            metadata[celexId] = new Binding(null, LD_TYPE_CELEX, SPARQL_STATUS_ERROR);
          });
          _this7.setMetadata(metadata);
          resolve(null);
        });
      });

      // ECLI
      var p2 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (ecliIds.length === 0) {
          resolve();
          return;
        }
        _this7.getEcliData(ecliIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.id && binding.id.value && !metadata[binding.id.value]) {
                metadata[binding.id.value] = new Binding(binding, LD_TYPE_ECLI, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          //set false when failed to fetch metadata
          ecliIds.forEach(function (ecliId) {
            metadata[ecliId] = new Binding(null, LD_TYPE_ECLI, SPARQL_STATUS_ERROR);
          });
          _this7.setMetadata(metadata);
          resolve(null);
        });
      });

      // FINLEX
      var p3 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (finlexEliIds.length === 0) {
          resolve();
          return;
        }
        _this7.getFinlexEliData(finlexEliIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.id && binding.id.value) {
                metadata[binding.id.value] = new Binding(binding, LD_TYPE_FINLEX, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          console.error(err);
          resolve(null);
        });
      });

      // ELI
      var p4 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (eliIds.length === 0) {
          resolve();
          return;
        }
        _this7.getEliData(eliIds).then(function (response) {
          if (response) {
            var computedEliIdsMap = response._computedEliIdsMap;
            if (response && response.results && response.results.bindings) {
              Object.keys(computedEliIdsMap).forEach(function (key) {
                // find the right binding
                var binding = response.results.bindings.filter(function (b) {
                  return b && b.eli && b.eli.value === computedEliIdsMap[key];
                }).pop();
                if (binding) {
                  metadata[key] = new Binding(binding, LD_TYPE_ELI, SPARQL_STATUS_SUCCESS);
                }
              });
            }
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          console.error(err);
          resolve(null);
        });
      });

      // ARES Handoc
      var p5 = new Promise(function (resolve, reject) {
        var metadata = {};
        var hasHandocData = true;
        var hasCisData = true;
        if (R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_KM_HANDOC) === -1 || aresHandocIds.length === 0) {
          hasHandocData = false;
        }
        if (R2L.options.linkedDataMode.indexOf(_index.LD_ADVANCED_MODE_KM_CIS) === -1 || cisIds.length === 0) {
          hasCisData = false;
        }
        if (!hasHandocData && !hasCisData) {
          resolve();
          return;
        }
        _this7.getKMData(_defineProperty(_defineProperty({}, LD_TYPE_HANDOC, aresHandocIds), LD_TYPE_CIS, cisIds)).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.id && binding.id.value) {
                metadata[binding.id.value] = new Binding(binding, binding.type.value, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          console.error(err);
          resolve(null);
        });
      });

      // Parlamentary Procedure
      var p6 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (procedureIds.length === 0) {
          resolve();
          return;
        }
        _this7.getProcedureData(procedureIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.id && binding.id.value) {
                metadata[binding.id.value] = new Binding(binding, LD_TYPE_PROCEDURE, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          console.error(err);
          resolve(null);
        });
      });

      // Council docs (consil)
      var p7 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (consilIds.length === 0) {
          resolve();
          return;
        }
        _this7.getConsilData(consilIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.id && binding.id.value) {
                metadata[binding.id.value.replace("consil:", "")] = new Binding(binding, LD_TYPE_CONSIL, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          console.error(err);
          resolve(null);
        });
      });

      // OJ
      var p8 = new Promise(function (resolve, reject) {
        var metadata = {};
        if (ojIds.length === 0) {
          resolve();
          return;
        }
        _this7.getOjData(ojIds).then(function (data) {
          if (data && data.results && data.results.bindings) {
            data.results.bindings.map(function (binding) {
              if (binding.originalId && binding.originalId.value && !metadata[binding.originalId.value.replace("oj:", "")]) {
                metadata[binding.originalId.value.replace("oj:", "")] = new Binding(binding, LD_TYPE_OJ, SPARQL_STATUS_SUCCESS);
              }

              // only first result is relevant in case of duplication
              if (binding.id && binding.id.value && !metadata[binding.id.value.replace("oj:", "")]) {
                metadata[binding.id.value.replace("oj:", "")] = new Binding(binding, LD_TYPE_OJ, SPARQL_STATUS_SUCCESS);
              }
            });
          }
          _this7.setMetadata(metadata);
          resolve(data);
        })["catch"](function (err) {
          //set false when failed to fetch metadata
          celexIds.forEach(function (celexId) {
            metadata[celexId] = new Binding(null, LD_TYPE_OJ, SPARQL_STATUS_ERROR);
          });
          _this7.setMetadata(metadata);
          resolve(null);
        });
      });

      // group all promises
      return Promise.all([p1, p2, p3, p4, p5, p6, p7, p8]).then(function (results) {
        _this7.status = SPARQL_STATUS_SUCCESS;
        return _this7.getMetadata([].concat(_toConsumableArray(celexIds), _toConsumableArray(ecliIds), _toConsumableArray(eliIds), _toConsumableArray(finlexEliIds), _toConsumableArray(aresHandocIds), _toConsumableArray(procedureIds), _toConsumableArray(consilIds), _toConsumableArray(ojIds)));
      })["catch"](function (e) {
        _this7.status = SPARQL_STATUS_ERROR;
        console.error(e);
        return {};
      });
    }
  }]);
  return LinkedDataManager;
}(); // bind functions
LinkedDataManager.prototype.fixCaseLawCitation = _footnote.fixCaseLawCitation;
LinkedDataManager.prototype.cleanFootnote = _footnote.cleanFootnote;
LinkedDataManager.prototype.parseFragment = _eurlex.parseFragment;
LinkedDataManager.prototype.getEUTreatyShortTitle = _treaty.getEUTreatyShortTitle;
LinkedDataManager.prototype.getJoinedCasesTranslation = _footnote.getJoinedCasesTranslation;
LinkedDataManager.prototype.FOOTNOTE_BLACKLIST = _footnote.FOOTNOTE_BLACKLIST;

/**
 * Target language takes priority over source language
 * @returns {string} Language ISO2 format
 */
function getLinkedDataLanguage() {
  var langMap = R2L.getConstant('R2L_EULANG');
  return langMap.get(String(R2L.getLanguage().toUpperCase()) || "ENG");
}

},{"../settings/index.js":32,"../translations/index.js":51,"../utils/data.js":54,"../utils/functions.js":56,"../utils/request.js":61,"./data/corrections.js":11,"./data/joined_eucase.js":12,"./data/oj.js":13,"./data/pit.js":14,"./data/short_titles.js":15,"./data/treaty.js":16,"./ecas.js":17,"./modifiers/footnote.js":19,"./parser/eurlex.js":20,"./query/celex.js":21,"./query/classifications.js":22,"./query/cluster.js":23,"./query/consil.js":24,"./query/ecli.js":25,"./query/eli.js":26,"./query/finlex.js":27,"./query/joined_eucase.js":28,"./query/oj.js":29,"./query/proc.js":30}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FOOTNOTE_BLACKLIST = void 0;
exports.cleanFootnote = cleanFootnote;
exports.fixCaseLawCitation = fixCaseLawCitation;
exports.getJoinedCasesTranslation = getJoinedCasesTranslation;
var ANY_CHAR = "[a-zа-яα-ωÄäÅåáàâĂăĄąĀāĊċĆćČčçĎďĐđĘęĖėëéèêĒēĚěĢģĠġĦħïÎîÌìÍíĪīĮΊίįĶķŁłĹĺĽľĻļŃńŇňÑñŅņöÔôÓóŐőÒòÕõØøŔŕŘřŚśŠšȘșẞßȚțŤťüŮůùÚúŰűûŪūŲųŸÿŻżŹźŽžŒœÆæΐ]";

/**
 * We should NOT indicate the jurisdiction when querying titles in Cellar. We apply a regex to remove it in all languages.
 * 
 * Cellar: Judgment of the Court (Fifth Chamber) of 14 December 2000. # Italian Republic v Commission of the European
 * Correct format: Judgment of 14 December 2000. # Italian Republic v Commission of the European
 * 
 * @param {String} title
 * @param {String} langISO2
 * 
 * @return {String} title 
 */
function fixCaseLawCitation(title, langISO2) {
  title = String(title);
  langISO2 = langISO2 || 'EN';
  var regex;
  // EN
  switch (langISO2) {
    case 'EN':
      regex = new RegExp("^(?:Judgment)\\s(?:of)(.*?)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      // Judgment of the General Court (Fourth Chamber), 11 December 2013
      break;
    case 'FR':
      regex = new RegExp("^(?:Arrêt)(.*?)\\s(?:du)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", 'gi');
      // Arrêt du Tribunal (quatrième chambre) du 11 décembre 2013
      break;
    case 'DE':
      // Urteil des Gerichts (Vierte Kammer) vom 11. Dezember 2013
      regex = new RegExp("^(?:Urteil)(.*?)\\s(?:vom)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'ES':
      // Sentencia del Tribunal General (Sala Cuarta) de 11 de diciembre de 2013.
      regex = new RegExp("^(?:Sentencia)(.*?)\\s(?:de)\\s\\d{1,2}\\s(?:de)\\s" + ANY_CHAR + "+\\s(?:de)\\s\\d{4}", "gi");
      break;
    case 'PT':
      // Acórdão do Tribunal de Justiça (Primeira Secção) de 29 de outubro de 2015
      regex = new RegExp("^(?:Acórdão)(.*?)\\s(?:de)\\s\\d{1,2}\\s(?:de)\\s" + ANY_CHAR + "+\\s(?:de)\\s\\d{4}", "gi");
      break;
    case 'NL':
      // Arrest van het Gerecht (Vierde kamer) van 11 december 2013  
      regex = new RegExp("^(?:Arrest)(.*?)\\s(?:van)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'IT':
      // Sentenza del Tribunale (Quarta Sezione) dell’11 dicembre 2013. (del 14 dicembre)
      regex = new RegExp("^(?:Sentenza)(.*?)\\s(?:del(?:l’|\\s))\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'DA':
      // Domstolens dom (Første Afdeling) af 29. oktober 2015. => Dom af 29. oktober 2015.
      regex = new RegExp("^(.*?)\\s(?:dom(?=\\s))(.*?)\\s(?:af)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'CS':
      // Rozsudek Soudního dvora (prvního senátu) ze dne 29. října 2015.
      regex = new RegExp("^(?:Rozsudek)(.*?)\\s(?:ze\\sdne)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'HR':
      // Presuda Suda (prvo vijeće) od 29. listopada 2015.
      regex = new RegExp("^(?:Presuda)(.*?)\\s(?:od)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'SL':
      // Sodba Sodišča (prvi senat) z dne 29. oktobra 2015.
      regex = new RegExp("^(?:Sodba)(.*?)\\s(?:z\\sdne)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'SK':
      // Rozsudok Súdneho dvora (prvá komora) z 29. októbra 2015
      regex = new RegExp("^(?:Rozsudok)(.*?)\\s(?:zo?)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'ET':
      // Kohtuotsus, Euroopa Kohus, 12. juuli 2005... => Kohtuotsus 12. juuli 2005...
      // Euroopa Kohtu otsus (esimene koda), 29.10.2015... => Otsus, 29.10.2015.
      regex = new RegExp("^(?:(.*?)\\s)?(?:(?:Kohtu)?otsus)(.*?),\\s\\d{1,2}\\.(?:\\d{1,2}\\.|\\s" + ANY_CHAR + "+\\s)\\d{4}", "gi");
      break;
    case 'FI':
      // Unionin tuomioistuimen tuomio (ensimmäinen jaosto) 29.10.2015. => Tuomio 29.10.2015.
      regex = new RegExp("^(.*?)(?:tuomio)(.*?)\\s\\d{1,2}(?:\\.\\d{1,2}\\.|\\s(?:päivänä)\\s" + ANY_CHAR + "+\\s)\\d{4}", "gi");
      break;
    case 'SV':
      // Domstolens dom (första avdelningen) av den 29 oktober 2015. => Dom av den 29 oktober 2015.
      // Personaldomstolens dom av den 30 januari 2013, Wahlström/Frontex => Dom av den 30 januari 2013, Wahlström/Frontex
      regex = new RegExp("^(.*?)\\s(?:dom(?=\\s))(.*?)\\s(?:(?:av\\s)?den)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'LV':
      // Tiesas spriedums (pirmā palāta) 2015. gada 29. oktobrī. => Spriedums 2015. gada 29. oktobrī.
      // Vispārējās tiesas 2013. gada 15. janvāra spriedums Spānija/Komisija T-54/11, ECLI:EU:T:2013:10, 29. punkts. => 2013. gada 15. janvāra spriedums Spānija/Komisija T-54/11, ECLI:EU:T:2013:10, 29. punkts.
      regex = new RegExp("^(.*?)(?:(?:(?:spriedums)(.*?)\\s\\d{4}\\.\\s(?:gada)\\s\\d{1,2}\\.\\s?" + ANY_CHAR + "+\\.)|(?:\\d{4}\\.\\s(?:gada)\\s\\d{1,2}\\.\\s?" + ANY_CHAR + "+\\.?\\s(?:spriedums)))", "gi");
      break;
    case 'LT':
      // 2015 m. spalio 29 d. Teisingumo Teismo (pirmoji kolegija) sprendimas.
      regex = new RegExp("^\\d{4}\\sm\\.\\s" + ANY_CHAR + "+\\s(?:\\d{1,2})\\s(?:d\\.)(.*?)\\s(?:sprendimas)", "gi");
      break;
    case 'MT':
      // Sentenza tal-Qorti tal-Ġustizzja (L-Ewwel Awla) tad-29 ta’ Ottubru 2015.
      regex = new RegExp("^(?:Sentenza)(.*?)\\s(?:ta[dlst]-)\\d{1,2}\\s(?:ta[’'])\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'PL':
      // Wyrok Trybunału (pierwsza izba) z dnia 29 października 2015 
      regex = new RegExp("^(?:Wyrok)(.*?)\\s(?:z\\sdnia)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'RO':
      // Hotărârea Tribunalului (Camera a patra) din 11 decembrie 2013
      regex = new RegExp("^(?:Hotărârea)(.*?)\\s(?:din(?:\\sdata\\sde)?)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'BG':
      // Решение на Съда (първи състав) от 29 октомври 2015 г
      regex = new RegExp("^(?:Решение)(.*?)\\s(?:от)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'EL':
      // Απόφαση του Δικαστηρίου (τμήμα μείζονος συνθέσεως) της 19ης Ιανουαρίου 2010.
      regex = new RegExp("^(?:Απόφαση)(.*?)\\s(?:της)\\s\\d{1,2}(?:" + ANY_CHAR + "{1,7})?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
      break;
    case 'HU':
      // A Törvényszék 2013. január 15-i ítélete, Spanyolország kontra Bizottság, => 2013. január 15-i ítélete, Spanyolország kontra Bizottság, .
      regex = new RegExp("^(.*?)(?:(?:\\d{4}\\.\\s" + ANY_CHAR + "+\\s\\d{1,2}-i\\s(?:ítélete?)))", "gi");

      // custom treatment for HU: #REFTOLINK-2132
      var regexCustom1 = /(A\s(?:Bíróság|Törvényszék)\s(.+?\s\d+)\.-i\sítélete?:\s(\d{4})\.?)/gi;
      var parts1 = regexCustom1.exec(title);
      if (parts1) {
        title = title.replace(parts1[1], parts1[3] + '. ' + parts1[2] + '-i ítélet');
      }
      var regexCustom2 = /(A\s(?:Bíróság|Törvényszék)\sítélete?,?\s(?:\(.+?\),\s)?(\d{4}\.?\s.+?\s\d+\.?))/gi;
      var parts2 = regexCustom2.exec(title);
      if (parts2) {
        title = title.replace(parts2[1], parts2[2] + '-i ítélet');
      }

      // no ending 'e'
      title = title.replace(/\sítélete,/gi, ' ítélet,');
      break;
    default:
      return title;
  }
  var parts = regex.exec(title);
  if (parts) {
    if (parts[1]) {
      title = title.replace(parts[1], "");
    }
    if (parts[2]) {
      title = title.replace(parts[2], "");
    }
  }
  title = title.trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// Remove unwanted text: (recast | text with EEA relevance)
var FOOTNOTE_BLACKLIST = exports.FOOTNOTE_BLACKLIST = [{
  match: /(?:\(преработен текст\)|\(?Текст от значение за ЕИП\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// BG
{
  match: /(?:\(versión refundida\)|\(?Texto pertinente a efectos del EEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// ES
{
  match: /(?:\(přepracované znění\)|\(?Text s významem pro EHP\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// CS
{
  match: /(?:\(omarbejdning\)|\(?EØS-relevant tekst\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// DA
{
  match: /(?:\(Neufassung\)|\(?Text von Bedeutung für den EWR\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// DE
{
  match: /(?:\(uuesti sõnastatud\)|\(?EMPs kohaldatav tekst\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// ET
{
  match: /(?:\(αναδιατύπωση\)|\(?Κείμενο που παρουσιάζει ενδιαφέρον για τον ΕΟΧ\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// EL
{
  match: /(?:\(recast\)|\(?Text with EEA relevance\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// EN
{
  match: /(?:\(refonte\)|\(?Texte présentant de l'intérêt pour l'EEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// FR
{
  match: /(?:\(preinaka\)|\(?Tekst značajan za EGP\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// HR
{
  match: /(?:\(rifusione\)|\(?Testo rilevante ai fini del SEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// IT
{
  match: /(?:\(pārstrādāta redakcija\)|\(?Dokuments attiecas uz EEZ\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// LV
{
  match: /(?:\(nauja redakcija\)|\(?Tekstas svarbus EEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// LT
{
  match: /(?:\(átdolgozás\)|\(?EGT-vonatkozású szöveg\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// HU
{
  match: /(?:\(riformulazzjoni\)|\(?Test b'rilevanza għaż-ŻEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// MT
{
  match: /(?:\(herschikking\)|\(?Voor de EER relevante tekst\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// NL
{
  match: /(?:\(przekształcenie\)|\(?Tekst mający znaczenie dla EOG\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// PL
{
  match: /(?:\(reformulação\)|\(?Texto relevante para efeitos do EEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// PT
{
  match: /(?:\(reformare\)|\(?Text cu relevanță pentru SEE\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// RO
{
  match: /(?:\(prepracované znenie\)|\(?Text s významom pre EHP\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// SK
{
  match: /(?:\(prenovitev\)|\(?Besedilo velja za EGP\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// SL
{
  match: /(?:\(uudelleenlaadittu\)|\(?ETA:n kannalta merkityksellinen teksti\.?\s?\)?)/g,
  replace: '',
  applyForAll: false
},
// FI
{
  match: /(?:\(omarbetning\)|\(?Text av betydelse för EES\.?\)?)/g,
  replace: '',
  applyForAll: false
},
// SV
{
  match: '<i></i>,',
  replace: ',',
  applyForAll: true
}, {
  match: '. )',
  replace: ')',
  applyForAll: true
}, {
  match: '.).',
  replace: ')',
  applyForAll: true
}, {
  match: ', ,',
  replace: ',',
  applyForAll: true
}, {
  match: '  .',
  replace: '.',
  applyForAll: true
}, {
  match: ' .',
  replace: '.',
  applyForAll: true
}, {
  match: ' , ',
  replace: ', ',
  applyForAll: true
}, {
  match: '. (',
  replace: ' (',
  applyForAll: true
}, {
  match: '( ',
  replace: '(',
  applyForAll: true
}, {
  match: ' )',
  replace: ')',
  applyForAll: true
}, {
  match: / n\. o /g,
  replace: ' n.º ',
  applyForAll: true
}, {
  match: /[\u00a0\u202F ][\u00a0\u202F ]+/g,
  replace: ' ',
  applyForAll: true
} // multiple spaces
];
function cleanFootnote(footnote, onlyApplyForAll) {
  for (var i = 0; i < FOOTNOTE_BLACKLIST.length; i++) {
    if (onlyApplyForAll) {
      if (FOOTNOTE_BLACKLIST[i].applyForAll) {
        footnote = footnote.replace(FOOTNOTE_BLACKLIST[i].match, FOOTNOTE_BLACKLIST[i].replace);
      }
    } else {
      footnote = footnote.replace(FOOTNOTE_BLACKLIST[i].match, FOOTNOTE_BLACKLIST[i].replace);
    }
  }
  return footnote;
}
function getJoinedCasesTranslation(caseLabels, langISO2) {
  var andOperator = ', ';
  switch (langISO2.toUpperCase()) {
    case 'BG':
      andOperator = ' и ';
      break;
    case 'CS':
      andOperator = ' a ';
      break;
    case 'DA':
      andOperator = ' og ';
      break;
    case 'EL':
      andOperator = ' και ';
      break;
    case 'EN':
      andOperator = ' and ';
      break;
    case 'ES':
      andOperator = ' y ';
      break;
    case 'DE':
      andOperator = ' und ';
      break;
    case 'ET':
      andOperator = ' ja ';
      break;
    case 'FR':
      andOperator = ' et ';
      break;
    case 'GA':
      andOperator = ' agus ';
      break;
    case 'HR':
      andOperator = ' i ';
      break;
    case 'HU':
      andOperator = ' és ';
      break;
    case 'IT':
      andOperator = ' e ';
      break;
    case 'MT':
      andOperator = ' u ';
      break;
    case 'NL':
      andOperator = ' en ';
      break;
    case 'PL':
      andOperator = ' i ';
      break;
    case 'PT':
      andOperator = ' e ';
      break;
    case 'RO':
      andOperator = ' și ';
      break;
    case 'SK':
      andOperator = ' a ';
      break;
    case 'SL':
      andOperator = ' in ';
      break;
    case 'FI':
      andOperator = ' ja ';
      break;
    case 'SV':
      andOperator = ' och ';
      break;
  }
  var str = '';
  caseLabels.forEach(function (label, index) {
    if (index < caseLabels.length - 2) {
      str += label + ', ';
    } else if (index < caseLabels.length - 1) {
      str += label + andOperator;
    } else {
      str += label;
    }
  });
  return str;
}

},{}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cleanHtmlContent = cleanHtmlContent;
exports.parseEurlexResponse = parseEurlexResponse;
exports.parseFragment = parseFragment;
var _jquery = require("../../jquery.js");
var ERROR_PARAGRAPH_NOT_FOUND = 'paragraph.not.found';
var ERROR_ARTICLE_NOT_FOUND = 'article.not.found';
var ERROR_POINT_NOT_FOUND = 'point.not.found';
var ERROR_SUBDIVISION_NOT_FOUND = 'subdivision.not.found';
var ARTICLE_LABEL_REGEX = 'Член|Artículo|Článek|Artikel|Artikel|Artikkel|Άρθρο|Article|Airteagal|Članak|Articolo|pants|straipsnis|cikk|Artikolu|Artykuł|Artigo|Articolul|Článok|Člen|artikla';
var ANNEX_LABEL_REGEX = 'ПРИЛОЖЕНИЕ|ANEXO|PŘÍLOHA|BILAG|ANHANG|LISA|ΠΑΡΑΡΤΗΜΑ|ANNEXE|ANNEX|IARSCRÍBHINN|PRILOG|ALLEGATO|PIELIKUMS|PRIEDAS|MELLÉKLET|ANNESS|BIJLAGE|ZAŁĄCZNIK|ANEXA|PRÍLOHA|PRILOG|LIITE|BILAGA';
var ROMAN_LABEL_REGEX = '(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})(\\.?)';
var ANNEX_NUMBER_REGEX = '(?:(' + ROMAN_LABEL_REGEX + ')|\\d+)';
var UNIQUE_ANNEX_REGEX = new RegExp("^(" + ANNEX_LABEL_REGEX + ")$", "gi");
function isEUTreaty(node) {
  return String(node.data[0].celex).substr(0, 1) === '1';
}

/**
 * Extract Eurlex subdivision up to point level. Only works on the new XHTML generation of acts.
 * @param {String} response 
 * @param {R2LNode} node 
 * 
 * @return String
 */
function parseEurlexResponse(response, node) {
  var celex = node.data[0]['celex'] || null;
  var sector = celex ? celex.substr(0, 1) : null;

  // annexes, recitals and articles are top-level subdivisions for sectors 1,2,3,4,5
  var annex = node.data[0]['offset-annex'] || null;
  var recital = node.data[0]['offset-rct'] || null;
  var article = node.data[0]['offset-art'] || null;

  // case law (ECLI) has paragraphs as top-level subidvisions
  var paragraph = node.data[0]['offset-p'] || null;
  var point = node.data[0]['offset-pt'] || null;
  response = cleanHtmlContent(response || '');
  if (!article && !annex && !recital) {
    // no top-level subdivision found, can only be and ECLI with paragraphs
    if (node.type === 'ecli') {
      return parseEcliResponse(response, node);
    } else {
      return {
        id: null,
        header: null,
        subheader: null,
        content: null,
        subdivisions: [],
        error: ERROR_SUBDIVISION_NOT_FOUND
      };
    }
  }
  if (paragraph) {
    paragraph = String(paragraph).padStart(3, '0');
  }
  if (point) {
    point = point.toLowerCase();
  }
  var doc = document.implementation.createHTMLDocument('virtual');
  var $el = (0, _jquery.$)("<div>" + response + "</div>", doc);

  // ELI urls return the full page
  if ($el.find("#textTabContent").length > 0) {
    $el = (0, _jquery.$)("<div>" + $el.find("#textTabContent").html() + "</div>", doc);
  }
  var resultString;
  var articleResultString;
  var selector;
  var id; // article or annex HTML attribute to extract, will be used as anchor for direct links
  var header; // article title/header
  var subheader; // article subheader

  var isPoint = false;
  var isParagraph = false;
  var error = null;
  var articleIdentifier = getArticleIdentifier($el, article);
  var isNewTemplate = articleIdentifier ? true : false;

  // annex finder
  if (annex) {
    // ELI lookup first
    var annexSelectorEli = "#anx_" + annex;
    var $foundEl = $el.find(annexSelectorEli);
    if ($foundEl.length > 0) {
      resultString = $foundEl[0].innerHTML;
    } else {
      // legacy content
      // selector for 'Annex X' titles
      var annexSelector = ".oj-doc-ti, .doc-ti";
      var annexRegex = new RegExp("^(?:((" + ANNEX_LABEL_REGEX + ")\\s" + ANNEX_NUMBER_REGEX + ")|(" + ANNEX_NUMBER_REGEX + "\\s(" + ANNEX_LABEL_REGEX + ")))$", "gi");
      var res = $el.find(annexSelector);
      var castAnnexNumber = R2L.converters.roman(annex);
      res.each(function (index, elem) {
        var txt = elem.textContent.trim().replace(/&nbsp;/g, " ");
        if (txt.match(annexRegex)) {
          // get content
          var annexRomanNumber = txt.replace(new RegExp("/^" + ANNEX_LABEL_REGEX, "gi"), '').replace('.', '').trim();
          var annexNumber = R2L.converters.roman(annexRomanNumber);
          // should work for both roman and arabic numbers
          if (String(annexNumber) === String(castAnnexNumber)) {
            id = elem.getAttribute("id");
            var $parent = $el.find('#' + id).parent();
            if ($parent.length) {
              resultString = $parent[0].outerHTML;
            }
            // break
            return false;
          }
        }

        // could be an unique annex
        if (String(castAnnexNumber) === '1' && txt.match(UNIQUE_ANNEX_REGEX)) {
          // unique annex will have no number in the table of contents but Ref2Link considers it as Annex 1
          id = elem.getAttribute("id");
          var _$parent = $el.find('#' + id).parent();
          if (_$parent.length) {
            resultString = _$parent[0].outerHTML;
          }
          return false;
        }
      });
    }
  }
  // recital finder
  else if (recital) {
    // ELI lookup first
    var recitalSelectorEli = "#rct_" + recital;
    var _$foundEl = $el.find(recitalSelectorEli);
    if (_$foundEl.length > 0) {
      resultString = _$foundEl[0].innerHTML;
    } else {
      // legacy content 
      $el.find("table").each(function (index, elem) {
        var $cols = (0, _jquery.$)(elem).find("col[width='4%'], col[width='96%']");
        var $recitalElem = (0, _jquery.$)(elem).find("td:first-child p");
        var recitalNumber = $recitalElem.text().replace('(', '').replace(')', '');
        if ($cols.length === 2 && String(recitalNumber) === String(recital)) {
          var $recitalVal = (0, _jquery.$)(elem).find("td:last-child p");
          resultString = '<p>' + $recitalVal.text() + '</p>';
          // break
          return false;
        }
      });
    }
  } else if (isNewTemplate) {
    // article finder
    var articleSelector = articleIdentifier ? "#" + articleIdentifier : null;
    var artPaddedNo = String(article).padStart(3, '0');
    var fallbackSelector;
    if (article && paragraph && point) {
      selector = "#" + artPaddedNo + "\\." + paragraph + " table";
      fallbackSelector = "#" + artPaddedNo + "\\." + paragraph;
      isParagraph = true;
      isPoint = true;
    } else if (article && paragraph) {
      selector = "#" + artPaddedNo + "\\." + paragraph;
      fallbackSelector = "#" + articleIdentifier;
      isParagraph = true;
    } else if (article && point) {
      selector = "#" + articleIdentifier + " table";
      fallbackSelector = "#" + articleIdentifier;
      isPoint = true;
    } else if (article) {
      selector = "#" + articleIdentifier;
    }

    // we need the article selector just to get the title and id for the anchor;
    var _res = selector ? $el.find(selector) : null;
    var articleRes = null;
    if (articleSelector) {
      articleRes = $el.find(articleSelector);
    }
    if (_res && _res.length > 0) {
      // remove header/subheader from content
      resultString = isPoint ? '' : _res[0].outerHTML;
      // get the point using the index (each <table> should be a point)
      var pointMap = {};
      if (isPoint) {
        // create a map eg. { 'a': [p0], 'b': [p1, p2], 'c': [p3], ...}
        _res.each(function (index, currentNode) {
          var matchPoint = currentNode.textContent.trim().match(/^\(([a-z])+\)/)[1];
          if (matchPoint) {
            pointMap[matchPoint] = pointMap[String(matchPoint).toLowerCase()] || [];
            pointMap[matchPoint].push(currentNode);
          }
        });
        if (pointMap[point]) {
          resultString = '';
          pointMap[point].forEach(function (node) {
            resultString += node.outerHTML;
          });
        } else {
          // fallback to parent
          resultString = $el.find(fallbackSelector).html();
          error = ERROR_POINT_NOT_FOUND;
        }
      }
    } else {
      resultString = '';
      if (isParagraph) {
        // try to get the paragraph using the legacy method
        var resultParagraphString = extractParagraphString($el.find(fallbackSelector).html(), paragraph);
        if (resultParagraphString) {
          resultString = resultParagraphString;
        } else {
          error = ERROR_PARAGRAPH_NOT_FOUND;
        }
      }
      if (isPoint) {
        error = ERROR_POINT_NOT_FOUND;
        if (isParagraph) {
          resultString = $el.find(fallbackSelector).html(); // try to get fallback content
        }
      }
    }
    if (articleRes && articleRes.length > 0) {
      articleResultString = articleRes[0].outerHTML;
    }
    if (articleResultString) {
      // extract header and id
      header = (0, _jquery.$)(articleResultString).find(".oj-ti-art").text().trim();
      if (!header) {
        header = (0, _jquery.$)(articleResultString).find(".ti-art").text().trim();
      }
      if (header) {
        header = String(header).replace(/&nbsp;/g, " ");
      }
      id = (0, _jquery.$)(articleResultString).find(".oj-ti-art").attr("id");
      if (!id) {
        id = (0, _jquery.$)(articleResultString).find(".ti-art").attr("id");
      }
      subheader = (0, _jquery.$)(articleResultString).find(".oj-sti-art").text().trim();
      if (!subheader) {
        subheader = (0, _jquery.$)(articleResultString).find(".sti-art").text().trim();
      }
      if (!subheader) {
        subheader = (0, _jquery.$)(articleResultString).find(".eli-title").text().trim();
      }
    } else {
      error = ERROR_ARTICLE_NOT_FOUND;
    }
    if (!resultString && articleResultString) {
      //return article contents instead
      resultString = articleResultString;
    }
  }

  /** old style acts, no indexed ids */else {
    var customHeaderSelector = null;
    // Old treaties use this structure: #TexteOnly
    if ($el.find('#TexteOnly').length > 0) {
      if (isEUTreaty(node)) {
        resultString = $el.find('#TexteOnly')[0] ? $el.find('#TexteOnly')[0].innerHTML : '';
      } else {
        if (article) {
          var articleNumber = parseInt(article);
          var nextArticleNumber = articleNumber + 1;
          var articleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + articleNumber + " ?\\.?o?°?)|(" + articleNumber + "\\.?\\s(" + ARTICLE_LABEL_REGEX + ")))$", "gi");
          var nextArticleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + nextArticleNumber + " ?\\.?o?°?)|(" + nextArticleNumber + "\\.?\\s?(" + ARTICLE_LABEL_REGEX + ")))$", "gi");

          // get All p
          var pElements = $el.find("#TexteOnly p");
          var _res2 = '';
          var _startRecording = false;
          pElements.each(function (index, elem) {
            if (elem.innerHTML.trim().replace(/&nbsp;/g, " ").match(articleRegex) && !_startRecording) {
              _startRecording = true;
            } else if (elem.innerHTML.trim().replace(/&nbsp;/g, " ").match(nextArticleRegex)) {
              _startRecording = false;
              return false;
            }
            if (_startRecording) {
              _res2 += elem.outerHTML;
            }
          });
          resultString = _res2;
        } else {
          resultString = '';
        }
      }
      customHeaderSelector = 'p > strong';
    } else {
      selector = '.ti-art';
      try {
        var articleElements = $el.find(selector);
        var startElem;
        var stopElem;
        var _articleNumber = node.data[0]['offset-art'];
        var _articleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + _articleNumber + " ?\\.?o?°?)|(" + _articleNumber + "\\.?\\s(" + ARTICLE_LABEL_REGEX + ")))$", "gi");
        if (articleElements.length === 0) {
          articleElements = $el.find(".oj-ti-art"); // try second selector
        }
        if (articleElements.length === 0) {
          articleElements = $el.find(".title-article-norm"); // try the revision selector
        }
        articleElements.each(function (index, elem) {
          var txt = elem.innerHTML.trim().replace(/&nbsp;/g, " ");
          if (txt.match(_articleRegex)) {
            startElem = elem;
          } else if (startElem && !stopElem) {
            stopElem = elem;
          }
        });
        if (!stopElem) {
          stopElem = $el.find('hr');
        }
        if (startElem) {
          resultString = startElem.outerHTML;
          var ongoing = true;
          $el.find(startElem).nextUntil(stopElem).each(function (index, elem) {
            if ((0, _jquery.$)(elem).prop("tagName") !== 'P' && (0, _jquery.$)(elem).prop("tagName") !== 'DIV' && (0, _jquery.$)(elem).prop("tagName") !== 'TABLE' && !(0, _jquery.$)(elem).hasClass('norm') && !(0, _jquery.$)(elem).hasClass('modref')) {
              ongoing = false;
            } else {
              if ((0, _jquery.$)(elem).attr('id')) {
                ongoing = false;
              }
            }
            if (ongoing) {
              resultString += elem.outerHTML;
            }
          });
        }
      } catch (e) {
        console.error('Error extracting article', e);
      }
    }

    // can't move forward without the article
    if (!resultString) {
      return {
        id: id || null,
        header: null,
        subheader: null,
        content: null,
        subdivisions: [],
        error: ERROR_ARTICLE_NOT_FOUND
      };
    }
    var $article = (0, _jquery.$)("<div>" + resultString + "</div>", doc);

    // go deeper to paragraph level
    if (paragraph && resultString) {
      var _resultParagraphString = extractParagraphString(resultString, paragraph);
      if (_resultParagraphString) {
        resultString = _resultParagraphString;
      } else {
        error = ERROR_PARAGRAPH_NOT_FOUND;
      }

      // we can have points without paragraphs (not supported for legacy HTML structure)
      if (point && paragraph) {
        var $paragraph = (0, _jquery.$)("<div>" + _resultParagraphString + "</div>");
        // try to find paragraph
        try {
          var _pointMap = {};
          // create a map eg. { 'a': [p0], 'b': [p1, p2], 'c': [p3], ...}
          $paragraph.find("table").each(function (index, currentNode) {
            var matchPoint = currentNode.textContent.trim().match(/^\(?([a-z])+\)/)[1];
            if (matchPoint) {
              _pointMap[matchPoint] = _pointMap[String(matchPoint).toLowerCase()] || [];
              _pointMap[matchPoint].push(currentNode);
            }
          });
          if (_pointMap[point]) {
            resultString = '';
            _pointMap[point].forEach(function (node) {
              resultString += node.outerHTML;
            });
          } else {
            // try to get <P> starting with eg: (a) or a) eg: Framework Decision 2002/584/JHA – Article 27 par 3 pt g
            resultString = '';
            var nextPoint = String.fromCharCode(point.charCodeAt(0) + 1);
            $paragraph.children().each(function (index, currentNode) {
              var textPoint = (0, _jquery.$)(currentNode).text().substring(0, 3);
              var regexPoint = new RegExp("^\\(?" + point + "\\)", "g");
              var regexNextPoint = new RegExp("^\\(?" + nextPoint + "\\)", "g");
              var regexAllPoint = new RegExp("^\\(?[a-z]\\)", "g");
              if ((0, _jquery.$)(currentNode).prop("tagName") === 'P' && textPoint.match(regexPoint)) {
                startRecording = true;
              }
              // find next point
              else if ((0, _jquery.$)(currentNode).prop("tagName") === 'P' && textPoint.match(regexNextPoint)) {
                startRecording = false;
              }
              // if last point then stop
              else if ((0, _jquery.$)(currentNode).prop("tagName") === 'P' && !textPoint.match(regexAllPoint)) {
                startRecording = false;
              }
              if (startRecording) {
                resultString += currentNode.outerHTML;
              }
            });
          }
          if (!resultString || resultString.length < 1) {
            error = ERROR_POINT_NOT_FOUND;
          }
        } catch (e) {
          console.error('Error extracting point', e);
        }
      }
    }
    if ($article.html()) {
      if (customHeaderSelector) {
        header = $el.find(customHeaderSelector).first().text().trim();
      } else {
        // extract header
        header = $article.find(".ti-art").text().trim();
      }
      if (!header) {
        header = $article.find(".oj-ti-art").text().trim();
      }
      if (header) {
        header = String(header).replace(/&nbsp;/g, " ");
      }

      // extract id
      id = $article.find(".ti-art").attr("id");
      if (!id) {
        id = $article.find(".oj-ti-art").attr("id");
      }
      if (!customHeaderSelector) {
        subheader = $article.find(".sti-art").text().trim();
        if (!subheader) {
          subheader = $article.find(".oj-sti-art").text().trim();
        }
        if (!subheader) {
          subheader = $article.find('.stitle-article-norm').text().trim();
        }
      }
    }
  }
  var $result = (0, _jquery.$)("<div>" + resultString + "</div>", doc);

  // remove header/subheader from content
  $result.find(".ti-art,.sti-art,.oj-ti-art,.oj-sti-art,.eli-title").remove();
  var parsedHtml = $result.html();
  var subdivisions = sector === "3" ? extractSubdivisions($el) : []; // we only extract subdivisions for sector 3

  var eurlexData = {
    id: id,
    header: header,
    subheader: subheader,
    content: parsedHtml,
    subdivisions: subdivisions,
    error: error
  };
  console.debug("Eurlex data", eurlexData);
  return eurlexData;
}
function extractSubdivisions($el) {
  var selector = '.ti-art';
  var subdivisions = [];
  var articleElements = $el.find(selector);
  if (articleElements.length === 0) {
    articleElements = $el.find(".title-article-norm"); // try the revision selector
  }
  articleElements.each(function (index, elem) {
    if (elem.textContent.trim().match(new RegExp(ARTICLE_LABEL_REGEX, 'gi'))) {
      var txt = elem.innerHTML.trim().replace(/&nbsp;/g, " ");
      var currentArticleNumber = txt.replace(new RegExp(ARTICLE_LABEL_REGEX, 'gi'), '').replace('.', '').replace('°', '').trim();
      // collect all article/id pairs
      subdivisions.push({
        type: 'article',
        offset: String(currentArticleNumber),
        id: (0, _jquery.$)(elem).attr('id')
      });
    }
  });
  var annexSelector = ".oj-doc-ti, .doc-ti";
  var annexRegex = new RegExp("^(?:((" + ANNEX_LABEL_REGEX + ")\\s" + ANNEX_NUMBER_REGEX + ")|(" + ANNEX_NUMBER_REGEX + "\\s(" + ANNEX_LABEL_REGEX + ")))$", "gi");
  var res = $el.find(annexSelector);
  res.each(function (index, elem) {
    if (elem.textContent.trim().match(annexRegex) || elem.textContent.trim().match(UNIQUE_ANNEX_REGEX)) {
      // get content
      // get content
      var annexRomanNumber = elem.textContent.trim().replace(new RegExp("/^" + ANNEX_LABEL_REGEX, "gi"), '').replace('.', '').trim();
      if (!annexRomanNumber) {
        annexRomanNumber = 'I'; // default to 1
      }
      var annexNumber = R2L.converters.roman(annexRomanNumber);

      // collect all article/id pairs
      subdivisions.push({
        type: 'annex',
        offset: String(annexNumber),
        id: (0, _jquery.$)(elem).attr('id')
      });
    }
  });
  return subdivisions;
}
function parseEcliResponse(response, node) {
  var paragraph = node.data[0]['offset-p'] || null;
  if (!paragraph) {
    return {
      id: null,
      header: null,
      subheader: null,
      content: null,
      subdivisions: [],
      error: ERROR_SUBDIVISION_NOT_FOUND
    };
  }
  var doc = document.implementation.createHTMLDocument('virtual');
  var $el = (0, _jquery.$)("<div>" + response + "</div>", doc);
  var resultString;
  var $anchor = $el.find("a[name=point" + paragraph + "], p[id=point" + paragraph + "]");
  if ($anchor.length > 0) {
    if ($anchor[0].nodeName === 'P') {
      var $parent = $anchor.closest("table");
      if ($parent.length) {
        resultString = $parent[0].outerHTML;
      }
    } else if ($anchor[0].nodeName === 'A') {
      var _$parent2 = $anchor.closest("p");
      if (_$parent2.length > 0) {
        resultString = _$parent2[0].outerHTML;
        var $nextAnchor = $el.find("a[name=point" + (parseInt(paragraph) + 1) + "]");
        var $stopElement = $nextAnchor ? $nextAnchor.closest("p") : $el.find(".C41DispositifIntroduction");
        var ongoing = true;
        $el.find(_$parent2).nextUntil($stopElement).each(function (index, elem) {
          if (!(0, _jquery.$)(elem).hasClass("C09Marge0avecretrait") && !(0, _jquery.$)(elem).hasClass("C01PointnumeroteAltN") && !(0, _jquery.$)(elem).hasClass("C02AlineaAltA")) {
            ongoing = false;
          }
          if (ongoing) {
            resultString += elem.outerHTML;
          }
        });
      }
    }
  } else {
    // legacy ECLI acts, we need to extract paragraphs
    var $elements = $el.find("#TexteOnly").children();
    var paragraphs = [];
    var isNext = false;
    var stop = false;
    $elements.each(function (index, elem) {
      var $el = (0, _jquery.$)(elem);
      if (elem.nodeName === 'P' && $el.find("a[name=MO]").length > 0) {
        isNext = true;
        // next '<em>' contains the paragraphs
      }
      if (isNext && elem.nodeName === 'EM' && !stop) {
        var ps = (0, _jquery.$)(elem).children("P");
        ps.each(function (index, para) {
          paragraphs.push(para);
        });
      }
      if (elem.nodeName === 'P' && $el.find("a[name=DI]").length > 0) {
        stop = true;
      }
    });
    console.debug("We have extracted paragraphs", paragraphs);
    var numberedParagraphs = [];
    var matches;
    var currentNumber = 0;
    paragraphs.forEach(function (para) {
      var txt = para.textContent;
      if (matches = txt.match(/^(\d+)\.?\s/)) {
        // next paragraph coming, increment index
        if (parseInt(matches[1]) === currentNumber + 2) {
          currentNumber++;
        }
        if (parseInt(matches[1]) === currentNumber + 1) {
          numberedParagraphs[currentNumber] = [];
          numberedParagraphs[currentNumber].push(para);
        }
      } else {
        // multiple paragraphs for this number, we push to the arr
        if (numberedParagraphs[currentNumber]) {
          numberedParagraphs[currentNumber].push(para);
        }
      }
    });
    resultString = '';
    if (numberedParagraphs[paragraph - 1]) {
      numberedParagraphs[paragraph - 1].forEach(function (p) {
        resultString += p.outerHTML;
      });
    }
  }
  return {
    id: "point" + paragraph,
    header: null,
    subheader: null,
    content: resultString,
    subdivisions: [],
    error: null
  };
}

/**
 * Will extract specific paragraph content from an article content
 * 
 * @param {String} resultString 
 * @param {String} paragraph 
 */
function extractParagraphString(resultString, paragraph) {
  var startRecording = false;
  var resultParagraphString = '';
  var $article = (0, _jquery.$)("<div>" + resultString + "</div>");
  try {
    $article.children().each(function (index, currentNode) {
      // paragraph needs to start with one of the following formats: 
      //  - 2. lorem ipsum...
      //  - (2) lorem ipsum...
      if (((0, _jquery.$)(currentNode).prop("tagName") === 'P' || (0, _jquery.$)(currentNode).prop("tagName") !== 'TABLE') && ((0, _jquery.$)(currentNode).text().trim().startsWith(parseInt(paragraph) + '.') || (0, _jquery.$)(currentNode).text().trim().startsWith('(' + parseInt(paragraph) + ')'))) {
        startRecording = true;
      }

      // find next paragraph 
      else if (((0, _jquery.$)(currentNode).prop("tagName") === 'P' || (0, _jquery.$)(currentNode).prop("tagName") !== 'TABLE') && ((0, _jquery.$)(currentNode).text().trim().startsWith(parseInt(paragraph) + 1 + '.') || (0, _jquery.$)(currentNode).text().trim().startsWith('(' + (parseInt(paragraph) + 1) + ')'))) {
        startRecording = false;
      }

      // if last paragraph then stop
      else if ((0, _jquery.$)(currentNode).prop("tagName") === 'P' && (0, _jquery.$)(currentNode).attr('id')) {
        startRecording = false;
      } else if ((0, _jquery.$)(currentNode).prop("tagName") !== 'P' && (0, _jquery.$)(currentNode).prop("tagName") !== 'TABLE') {
        startRecording = false;
      }
      if (startRecording) {
        resultParagraphString += (0, _jquery.$)(currentNode).get(-1).outerHTML;
      }
    });
  } catch (e) {
    console.error('Error extracting paragraph', e);
  }
  return resultParagraphString;
}

/**
 * Parse subdivision fragment from Cellar
 * Example: A02P1 => article 2 paragraph 1
 *           N 32 => paragraph 32
 *   Lists:  N 02 05 07 => paragraphs 2, 5, 7
 * @param {String} fragment
 * @param {String} celex
 * 
 * @return {String} 
 */
function parseFragment(fragment, celex) {
  var parsed = fragment;

  // N 03 or P3 04 05-07 08 ...  (only digits, dashes and spaces)
  var paragraphRegex = /^(?:N|P)\s?([0-9-\s\.]+)$/g;
  var matches = paragraphRegex.exec(fragment);
  if (Array.isArray(matches) && matches[1]) {
    var ref = matches[1];
    ref = ref.replace(/\s?-\s?/gi, "-").trim();
    var nums = ref.split(" ");
    nums = nums.map(function (num) {
      if (num.substr(0, 1) === '0') {
        num = num.substr(1);
      }
      return num;
    });
    var labels = ["par. ", "par. "];
    // secondary law (directives/regulations use N for annex)
    if (fragment.substr(0, 1) === "N" && celex && ["1", "2", "3"].indexOf(celex.substr(0, 1)) !== -1) {
      labels = ["anx. ", "anx. "];
    }
    parsed = (nums.length < 2 ? labels[0] : labels[1]) + nums.join(", ");
    return parsed;
  }

  // P1L3
  var paragraph2Regex = /^P(\d+)(?:L(\d+))?$/g;
  var matchesP2 = paragraph2Regex.exec(fragment);
  if (Array.isArray(matchesP2) && matchesP2[1]) {
    parsed = "par. " + matchesP2[1];
    if (matchesP2[2]) {
      parsed += " al. " + parseInt(matchesP2[2]);
    }
    return parsed;
  }

  // N6PT1; N1A09; N
  var paragraph3Regex = /^N(\d+|)(?:A(\d+))?(?:P(\d+))?(?:L(\d+))?(?:PT(\d+))?$/g;
  var matchesP3 = paragraph3Regex.exec(fragment);
  if (Array.isArray(matchesP3) && (matchesP3[1] || matchesP3[1] === '')) {
    parsed = (celex && ["1", "2", "3"].indexOf(celex.substr(0, 1)) !== -1 ? "anx. " : "par. ") + (matchesP3[1] || '1');
    if (matchesP3[2]) {
      parsed += " art. " + parseInt(matchesP3[2]);
    }
    if (matchesP3[3]) {
      parsed += " par. " + parseInt(matchesP3[3]);
    }
    if (matchesP3[4]) {
      parsed += " al. " + parseInt(matchesP3[4]);
    }
    if (matchesP3[5]) {
      parsed += " pnt. " + parseInt(matchesP3[5]);
    }
    return parsed;
  }

  // C1
  var recitalRegex = /^(?:C)((?:\s?\d{1,6}(?:\s-\s\d{1,6})?){1,4})$/g;
  var matchesRecital = recitalRegex.exec(fragment);
  if (Array.isArray(matchesRecital) && matchesRecital[1]) {
    var refR = matchesRecital[1];
    refR = refR.replace(/\s-\s/gi, "-").trim();
    var numsR = refR.split(" ");
    numsR = numsR.map(function (num) {
      if (num.substr(0, 1) === '0') {
        num = num.substr(1);
      }
      return num;
    });
    parsed = (numsR.length < 2 ? "rct. " : "rct. ") + numsR.join(", ");
    return parsed;
  }

  // A02P1; A02P1LB; 
  var artRegex = /^A(\d+(?:BIS)?)(?:(?:P|\.)(\d+))?(?:L(\d+|[A-Z]))?/g;
  var matchesArt = artRegex.exec(fragment);
  if (Array.isArray(matchesArt) && matchesArt[1]) {
    if (matchesArt[1].substr(0, 1) === '0') {
      matchesArt[1] = matchesArt[1].substr(1);
    }
    parsed = "art. " + matchesArt[1];
    if (matchesArt[2]) {
      parsed += " par. " + parseInt(matchesArt[2]);
    }
    if (matchesArt[3]) {
      // we use Pt. for letters and Al. for numeric values
      if (!isNaN(matchesArt[3])) {
        parsed += " al. " + matchesArt[3];
      } else {
        parsed += " pnt. " + String(matchesArt[3]).toLowerCase();
      }
    }
    return parsed;
  }
  var lineRegex = /^L(\d+)$/g;
  var matchesLine = lineRegex.exec(fragment);
  if (Array.isArray(matchesLine) && matchesLine[1]) {
    parsed = "al. " + matchesLine[1];
    return parsed;
  }
  var titRegex = /^TIT(\d+)$/g;
  var matchesTit = titRegex.exec(fragment);
  if (Array.isArray(matchesTit) && matchesTit[1]) {
    parsed = "tit. " + matchesTit[1];
    return parsed;
  }
  return parsed;
}
function getArticleIdentifier($el, artNo) {
  var articleIdentifier = null;

  // We check the ELI identifier if nothing found above
  // Note: article numbers can have suffixes eg. '21a'; 
  var testNewTemplate = $el.find("#art_" + artNo);
  if (testNewTemplate.length > 0) {
    articleIdentifier = "art_" + artNo;
  } else {
    var artPaddedNo = String(artNo).padStart(3, '0');
    testNewTemplate = $el.find("#" + artPaddedNo);
    if (testNewTemplate.length > 0) {
      // id is the art number
      articleIdentifier = artPaddedNo;
    }
  }
  return articleIdentifier;
}

/**
 * EUR-Lex HTML content cleaner
 * @param {String} content 
 */
function cleanHtmlContent(content) {
  content = content.replaceAll('<span class="super">o</span>', '°');
  var doc = document.implementation.createHTMLDocument('virtual');
  var $el = (0, _jquery.$)("<div>" + content + "</div>", doc);
  $el.find('a').each(function (index, anchor) {
    // we only keep hrefs to legal-content, where we replace the root with the eurlex domain

    var href = anchor.href;
    if (/\.\/(?:\.\.\/)+legal-content\//gi.test(href)) {
      href = 'https://eur-lex.europa.eu/legal-content/' + href.split('/legal-content/')[1];
      anchor.href = href;
    } else {
      anchor.removeAttribute("href");
    }
  });

  // remove all images, scripts
  $el.find('script,img,meta').each(function (index, elem) {
    elem.parentNode.removeChild(elem);
  });

  // remove all "src"'s
  $el.find('[src]').each(function (index, elem) {
    elem.removeAttribute("src");
  });
  return $el.html();
}

},{"../../jquery.js":9}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCelexQuery = void 0;
/**
 * Query by CELEX ids
 * @param {Array<String>} celexIds 
 * @param {String} langISO3 (optional, will default to ENG)
 * 
 * @returns {String}
 */
var getCelexQuery = exports.getCelexQuery = function getCelexQuery(celexIds, langISO3) {
  var langISO3s = langISO3 ? [String(langISO3).toUpperCase()] : ["ENG", "FRA"]; // default to english or french
  var langISO3Filters = "FILTER (?lang IN (";
  for (var i = 0; i < langISO3s.length; i++) {
    langISO3Filters += "lang:".concat(langISO3s[i]);
    if (i < langISO3s.length - 1) {
      langISO3Filters += ",";
    }
  }
  langISO3Filters += "))";

  // unique ids only
  celexIds = celexIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (?workId IN (";
  for (var _i = 0; _i < celexIds.length; _i++) {
    filters += "\"celex:".concat(celexIds[_i], "\", \"celex:").concat(celexIds[_i], "\"^^xsd:string"); // query both types
    if (_i < celexIds.length - 1) {
      filters += ",";
    }
  }
  filters += "))";
  var pointInTimeFilter1 = '';
  var pointInTimeFilter2 = '';
  var pointInTimeFilter3 = '';
  var pointInTimeFilter4 = '';
  if (R2L.options.pointInTime) {
    pointInTimeFilter1 = "FILTER(?consolidatedDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter2 = "FILTER(?consolidatedDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter3 = "FILTER(?repealDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter4 = "FILTER(?repealDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
  }
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?date ?id \n            ?title \n            ?baseTitle\n            ?eli \n            ?ecli\n            ?force \n            MIN(?dateForce) as ?dateForce\n            (REPLACE(?oj, \" /, \\\\.\\\\.\", \"\", \"i\") as ?oj)\n            ?ojId \n            ?ojResourceUrl\n            ?ojDate\n            ?consolidatedDate \n            ?consolidatedEli \n            ?consolidatedId\n            MAX(?dateValidity) as ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?dossierTitle\n            ?lang\n{\n        SELECT \n            ?date ?workId as ?id \n            ?title \n            ?baseTitle\n            ?eli \n            ?ecli\n            ?force \n            ?dateForce \n            (IF(BOUND(?ojIdOld), ?ojIdOld, ?ojActId) as ?ojId)\n            (IF(BOUND(?ojResourceUrlOld), ?ojResourceUrlOld, ?ojActResourceUrl) as ?ojResourceUrl)\n            (IF(BOUND(?ojDateOld), ?ojDateOld, ?ojActDate) as ?ojDate)\n            (IF(BOUND(?ojOld), ?ojOld, CONCAT(CONCAT(CONCAT(CONCAT(CONCAT(REPLACE(STR(?ojCollectionDocumentIdentifier ) , \"-\", \" \", \"i\"), \" \"), CONCAT(?ojActYear, \"/\"))), CONCAT(?ojActNumber, \", \")), \n            CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 9, 2), \".\"), CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 6, 2), \".\")), SUBSTR(STR(?ojActDate), 1, 4)))) as ?oj)\n            ?consolidatedDate \n            ?consolidatedEli \n            ?consolidatedId\n            ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?dossierTitle\n            ?lang\n        WHERE {  \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title_ .\n                OPTIONAL {\n                    ?exp owl:sameAs ?resourceUrl .\n                    FILTER (REGEX(?resourceUrl, \"resource/oj/\"))\n                }\n            }\n            graph ?g { \n                ?exp cdm:expression_uses_language ?lang\n                ".concat(langISO3Filters, "\n            }  \n\n            ?s cdm:work_date_document ?date .\n            ?s rdf:type ?type .\n            ?s cdm:work_id_document ?workId.\n            OPTIONAL {\n                ?s2 cdm:work_id_document ?workId.\n                ?s2 cdm:work_part_of_dossier ?dossier.\n                ?dossier cdm:dossier_title ?dossierTitle\n            }\n            OPTIONAL {\n                ?s cdm:case-law_ecli ?ecli\n            }\n            OPTIONAL {\n                ?s cdm:resource_legal_date_end-of-validity ?dateValidity .\n            }\n            ").concat(filters, "\n\n            OPTIONAL {\n                # CONSOLIDATION\n                ?actConsolidated cdm:act_consolidated_based_on_resource_legal ?s .\n                ?actConsolidated cdm:act_consolidated_date ?consolidatedDate .\n                ?actConsolidated cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce .\n                ?actConsolidated cdm:resource_legal_eli ?consolidatedEli . \n                ?actConsolidated cdm:work_id_document ?consolidatedId_ .\n                \n                # we only need results before the end of the act validity\n                ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity .\n\n                ").concat(pointInTimeFilter1, "\n                FILTER (?consolidatedDateEntryForce < ?act_end_of_validity)     \n                FILTER regex(str(?consolidatedId_), \"celex:\")     \n                # latest consolidation date only\n                FILTER not exists {\n                    ?actConsolidated2 cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce2 .\n                    ?actConsolidated2 cdm:act_consolidated_date ?consolidatedDate2 .\n                    ?actConsolidated2 cdm:act_consolidated_based_on_resource_legal ?s .\n                    ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity2 .\n                    ").concat(pointInTimeFilter2, "\n                    FILTER (?consolidatedDateEntryForce2 > ?consolidatedDateEntryForce AND (?consolidatedDateEntryForce2 < ?act_end_of_validity2))\n                }\n\n                BIND(SUBSTR(?consolidatedId_, 7) as ?consolidatedId)\n            }\n            OPTIONAL {\n                # REPEALING\n                ?actRepeal cdm:resource_legal_repeals_resource_legal ?s .\n                ?actRepeal cdm:resource_legal_eli ?repealEli . \n                ?actRepeal cdm:work_date_document ?repealDate . \n                ?actRepeal cdm:work_id_document ?repealCelexId_.\n                ").concat(pointInTimeFilter3, "\n                FILTER regex(str(?repealCelexId_), \"celex:\")                    \n                BIND(SUBSTR(?repealCelexId_, 7) as ?repealCelexId)\n\n                OPTIONAL {\n                    # REPEALING LAST\n                    ?lastActRepeal cdm:resource_legal_repeals_resource_legal+ ?s .\n                    ?lastActRepeal cdm:resource_legal_eli ?lastRepealEli . \n                    ?lastActRepeal cdm:work_id_document ?lastRepealCelexId_.\n                    FILTER regex(str(?lastRepealCelexId_), \"celex:\")                    \n                    FILTER not exists {\n                       ?actRepeal_ cdm:resource_legal_repeals_resource_legal ?lastActRepeal .\n                       ?actRepeal_ cdm:work_date_document ?repealDate2\n                       ").concat(pointInTimeFilter4, "\n                    } \n                    BIND(SUBSTR(?lastRepealCelexId_, 7) as ?lastRepealCelexId)\n                }\n            }\n            OPTIONAL {\n                ?s cdm:resource_legal_eli ?eli .\n            }\n            OPTIONAL {\n                # FORCE\n                ?s cdm:resource_legal_in-force ?force .\n                ?s cdm:resource_legal_date_entry-into-force ?dateForce .\n            }        \n            OPTIONAL {\n                # MANIFEST \n                ?manif cdm:manifestation_manifests_expression ?exp. \n                ?manif cdm:manifestation_type ?manifType .\n                FILTER(STR(?manifType)=\"print\" || BOUND(?ojPageFirst)) .\n\n                # MANIFEST OJ PAGE (optional)\n                OPTIONAL {\n                    ?manif cdm:manifestation_official-journal_part_page_first ?ojPageFirst.\n                    ?manif cdm:manifestation_official-journal_part_page_last ?ojPageLast.\n                }\n\n                ?manif cdm:manifestation_part_of_manifestation ?parentManif.\n                OPTIONAL {\n                    ?parentManif owl:sameAs ?langSpecificManif.\n                }\n                OPTIONAL {\n                    ?manif owl:sameAs ?manifOjResourceUrl .\n                    # We need to use the MANIFEST to get to the OJ\n                    FILTER (STRSTARTS(STR(?manifOjResourceUrl), \"http://publications.europa.eu/resource/oj/\"))\n                }\n\n                # OJ info\n                ?s cdm:resource_legal_published_in_official-journal ?q .\n                ?q cdm:official-journal_part_of_collection_document ?ojPartOld .\n                ?q cdm:official-journal_number ?ojNumberOld .\n                OPTIONAL {\n                    ?q cdm:official-journal_class ?ojClassOld .\n                }\n                ?ojPartOld skos:prefLabel ?ojPartLabelOld .\n                ?q cdm:official-journal_volume ?ojVolumeOld .\n                ?q cdm:publication_general_date_publication ?ojDateOld .\n                \n                # cross match with parent OJ resource\n                ?q owl:sameAs ?mainOjResourceUrlOld .\n                ?q cdm:work_id_document ?ojIdOld.\n                \n                # multiple OJ publications can cause trouble so we cross-match the OJ url with the manifest's (where available)\n                FILTER (!BOUND(?langSpecificManif) || STRSTARTS(STR(?langSpecificManif), STR(?mainOjResourceUrlOld)) || (REGEX(STR(?langSpecificManif), 'resource/oj/DD_')))\n                FILTER (STRSTARTS(STR(?ojIdOld), \"oj:\") AND STRSTARTS(STR(?mainOjResourceUrlOld), \"http://publications.europa.eu/resource/oj/\")) \n                BIND(?mainOjResourceUrlOld as ?ojResourceUrlOld)\n\n                BIND(CONCAT(STR(DAY(?ojDateOld)), \n                \".\", \n                STR(MONTH(?ojDateOld)), \n                \".\", \n                STR(YEAR(?ojDateOld))) as ?ojDatePublicationOld)\n\n                # OJ label; do not modify as it will be processed for translation\n                BIND(IF(BOUND(?ojPartLabelOld), \n                CONCAT(CONCAT(REPLACE(?ojPartLabelOld, \"-\", \" \", \"i\"), \" \", \n                CONCAT(?ojNumberOld, \n                CONCAT(IF (STR(?ojClassOld) != \"R\", ?ojClassOld, \"\"),\n                CONCAT(\", \", CONCAT($ojDatePublicationOld,\n                    CONCAT(IF(BOUND(?ojPageFirst), \", p. \", \"\"), \n                    CONCAT(IF(BOUND(?ojPageFirst), xsd:integer(?ojPageFirst), \"\"), \n                    CONCAT(IF(BOUND(?ojPageLast), \"-\", \"\"), IF(BOUND(?ojPageLast), xsd:integer(?ojPageLast), \"\")))))))))), \"\") as ?ojOld) .\n\n                FILTER (lang(?ojPartLabelOld) = \"en\" )\n            }\n\n            # OJ act-by-act (not in use as it is very slow)\n            OPTIONAL {\n                FILTER NOT EXISTS {\n                    ?s cdm:resource_legal_published_in_official-journal ?_ojTemp\n                }\n                ?s cdm:official-journal-act_date_publication ?ojActDate .\n                ?s cdm:official-journal-act_part_of_collection_document ?ojCollectionDocument .\n                ?ojCollectionDocument dc:identifier ?ojCollectionDocumentIdentifier .\n                ?s cdm:official-journal-act_subsubsection_oj ?ojSubsection .\n                ?s cdm:official-journal-act_number ?ojActNumber .\n                ?s cdm:official-journal-act_year ?ojActYear .\n                \n                ?s cdm:work_id_document ?ojActId. \n                FILTER (STRSTARTS(STR(?ojActId), \"oj:\"))\n                ?s cdm:resource_legal_eli ?ojActResourceUrl . \n            } \n\n            BIND(CONCAT(?title_, IF(BOUND(?ecli), CONCAT(\"\\nECLI identifier: \", ?ecli), \"\")) as ?title) \n            BIND(?title_ as ?baseTitle)\n        }\n    }\n    ORDER BY ?id ?lang");
  return query;
};

},{}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getClassificationsQuery = getClassificationsQuery;
/**
 * Build classifications query (eurovoc + subject matters) for a specific CELEX id
 * @param {String} celexIds
 * @returns {String} 
 */
function getClassificationsQuery(celexId, langISO2) {
  var filters = "FILTER (?workId IN (\"celex:".concat(celexId, "\", \"celex:").concat(celexId, "\"^^xsd:string))"); // query both types

  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n    PREFIX skos-xl: <http://www.w3.org/2008/05/skos-xl#>\n    PREFIX core: <http://www.w3.org/2004/02/skos/core#>\n    SELECT  \n    DISTINCT ?eurovoc ?eurovocLabel ?subjectMatter ?subjectMatterLabel\n    WHERE {  \n      ?exp cdm:expression_belongs_to_work ?s .\n      ?exp cdm:expression_title ?title_ . \n      ?s cdm:work_id_document ?workId.\n      ?s cdm:work_is_about_concept_eurovoc ?eurovoc .\n      ?eurovoc skos:prefLabel ?eurovocLabel.  \n      ?s cdm:resource_legal_is_about_subject-matter ?subjectMatter .\n      ?subjectMatter skos:prefLabel ?subjectMatterLabel. \n        ".concat(filters, ".\n        FILTER (lang(?eurovocLabel) = \"").concat(String(langISO2).toLowerCase(), "\" AND lang(?subjectMatterLabel) = \"").concat(String(langISO2).toLowerCase(), "\")\n    }");
  return query;
}

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getActsByBasisActQuery = getActsByBasisActQuery;
exports.getActsCitedByActQuery = getActsCitedByActQuery;
exports.getActsCitingActQuery = getActsCitingActQuery;
exports.getBasisActsByActQuery = getBasisActsByActQuery;
var _functions = require("../../utils/functions");
/**
 * Build query to retrieve all the acts cited by a specific CELEX id
 * @param {String} celexIds
 * @param {String} langISO3
 * @param {String} searchText (optional)
 * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law)
 * @returns {String} 
 */
function getActsCitedByActQuery(celexId, langISO3, searchText, documentType) {
  var filters = "FILTER (?workId IN (\"celex:".concat(celexId, "\", \"celex:").concat(celexId, "\"^^xsd:string))"); // query both types

  var searchTextEscaped = searchText ? (0, _functions.normalizeString)((0, _functions.regExpEscape)(searchText.toLowerCase())).replaceAll('"', '\\"') : null;
  var searchFilter = searchTextEscaped ? "FILTER(regex(?title, \"".concat(searchTextEscaped, "\", \"i\" ))") : "";
  var docTypeFilter = documentType ? "FILTER(STRSTARTS(?citedWorkId, \"celex:".concat(documentType, "\"))") : "FILTER(STRSTARTS(?citedWorkId, \"celex\"))";
  var searchTriples = searchTextEscaped ? "\n        ?exp cdm:expression_belongs_to_work ?citedWork .\n        ?exp cdm:expression_title ?title .\n        ?exp cdm:expression_uses_language ?lang .\n        filter(?lang=lang:".concat(langISO3.toUpperCase(), ").") : "";
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?workId as ?id ?citedWorkId ?citedWorkEcli ?fragmentCitedTarget ?fragmentCitedSource\n        WHERE {  \n            ?exp cdm:expression_belongs_to_work ?s .\n\n            ?s cdm:work_cites_work ?citedWork .\n            OPTIONAL {\n                ?citedWork cdm:case-law_ecli ?citedWorkEcli\n            }\n            ?citedWork cdm:work_id_document ?citedWorkId .\n            ".concat(searchTriples, "\n            OPTIONAL{\n                ?bn owl:annotatedSource ?s.\n                ?bn owl:annotatedTarget ?citedWork.\n                ?bn owl:annotatedProperty <http://publications.europa.eu/ontology/cdm#work_cites_work>.\n                OPTIONAL{\n                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_cited_target> ?fragmentCitedTarget.\n                }\n                OPTIONAL{\n                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_citing_source> ?fragmentCitedSource.\n                }\n          }\n            ");
  query += " \n            ?s cdm:work_id_document ?workId.\n            ".concat(filters, ".\n            ").concat(searchFilter, "\n            ").concat(docTypeFilter, "\n        }\n        order by ?citedWorkId  ?fragmentCitedTarget ?fragmentCitedSource\n        LIMIT 501\n        ");
  return query;
}

/**
 * Build list of acts citing a specific CELEX id
 * @param {String} celexIds
 * @param {String} langISO3
 * @param {String} searchText (optional)
 * @param {String} documentType - celex sector number (3 for legal acts, 6 for case law)
 * @returns {String} 
 */
function getActsCitingActQuery(celexId, langISO3, searchText, documentType) {
  var filters = "FILTER (?workId IN (\"celex:".concat(celexId, "\", \"celex:").concat(celexId, "\"^^xsd:string))"); // query both types

  var searchTextEscaped = searchText ? (0, _functions.normalizeString)((0, _functions.regExpEscape)(searchText.toLowerCase())).replaceAll('"', '\\"') : null;
  var searchFilter = searchTextEscaped ? "FILTER(regex(?title, \"".concat(searchTextEscaped, "\", \"i\" ))") : "";
  var docTypeFilter = documentType ? "FILTER(STRSTARTS(?citingWorkId, \"celex:".concat(documentType, "\"))") : "FILTER(STRSTARTS(?citingWorkId, \"celex\"))";
  var searchTriples = searchTextEscaped ? "\n        ?exp cdm:expression_belongs_to_work ?citingWork .\n        ?exp cdm:expression_title ?title .\n        ?exp cdm:expression_uses_language ?lang .\n        filter(?lang=lang:".concat(langISO3.toUpperCase(), ").") : "";
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?workId as ?id ?citingWorkId ?citingWorkEcli ?fragmentCitedTarget ?fragmentCitedSource\n        WHERE {  \n            ".concat(searchTriples, "\n            ?citingWork cdm:work_cites_work ?s .\n            OPTIONAL {\n                ?citingWork cdm:case-law_ecli ?citingWorkEcli\n            }\n            ?citingWork cdm:work_id_document ?citingWorkId .\n            OPTIONAL{\n                ?bn owl:annotatedSource ?citingWork.\n                ?bn owl:annotatedTarget ?s.\n                ?bn owl:annotatedProperty <http://publications.europa.eu/ontology/cdm#work_cites_work>.\n                OPTIONAL{\n                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_cited_target> ?fragmentCitedTarget.\n                }\n                OPTIONAL{\n                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_citing_source> ?fragmentCitedSource.\n                }\n          }\n            ");
  query += " \n            ?s cdm:work_id_document ?workId.\n            ".concat(filters, "\n            ").concat(searchFilter, "\n            ").concat(docTypeFilter, "\n            FILTER(!regex(?citingWorkId, \"_SUM$\") AND !regex(?citingWorkId, \"_INF$\"))\n        }\n        order by ?citingWorkId  ?fragmentCitedTarget ?fragmentCitedSource\n        LIMIT 501\n        ");
  return query;
}

/**
* Build query to retrieve all the acts that this act is based on
* @param {String} celexId
* @param {String} langISO3
* @returns {String} 
*/
function getBasisActsByActQuery(celexId, langISO3) {
  var filters = "FILTER (?workId IN (\"celex:".concat(celexId, "\", \"celex:").concat(celexId, "\"^^xsd:string))"); // query both types

  var query = "\n       PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n       PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n       PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n       PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n       PREFIX dc:<http://purl.org/dc/elements/1.1/>\n       PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n       PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n       PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n       PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n       SELECT DISTINCT \n       ?workId as ?id ?basisWorkId\n        WHERE {  \n            ?exp cdm:expression_belongs_to_work ?s .\n\n            ?s cdm:resource_legal_based_on_resource_legal ?basisWork .\n            ?basisWork cdm:work_id_document ?basisWorkId .\n            FILTER(STRSTARTS(?basisWorkId, \"celex\")) .\n            ?s cdm:work_id_document ?workId.";
  query += " \n        ".concat(filters, ".\n    }\n    order by ?basisWorkId\n    LIMIT 501\n    ");
  return query;
}

/**
* Build query to retrieve all the acts that use this act as a legal basis
* @param {String} celexId
* @param {String} langISO3
* @returns {String} 
*/
function getActsByBasisActQuery(celexId, langISO3) {
  var filters = "FILTER (?workId IN (\"celex:".concat(celexId, "\", \"celex:").concat(celexId, "\"^^xsd:string))"); // query both types

  var query = "\n       PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n       PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n       PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n       PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n       PREFIX dc:<http://purl.org/dc/elements/1.1/>\n       PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n       PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n       PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n       PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n       SELECT DISTINCT \n       ?workId as ?id ?resultingWorkId\n        WHERE {  \n            ?exp cdm:expression_belongs_to_work ?s .\n\n            ?resultingWork cdm:resource_legal_based_on_resource_legal ?s .\n            ?resultingWork cdm:work_id_document ?resultingWorkId .\n            FILTER(STRSTARTS(?resultingWorkId, \"celex\")) .\n            ?s cdm:work_id_document ?workId.";
  query += " \n        ".concat(filters, ".\n    }\n    order by ?resultingWorkId\n    LIMIT 501\n    ");
  return query;
}

},{"../../utils/functions":56}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processConsilResponse = exports.getConsilQuery = void 0;
/**
 * Consil ids query
 * @param {Array<String>} consilIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
var getConsilQuery = exports.getConsilQuery = function getConsilQuery(consilIds, langISO3) {
  var langISO3Filters = "FILTER (?workLang IN (lang:".concat(String(langISO3).toUpperCase(), ", lang:ENG, lang:FRA))");
  consilIds = consilIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var i = 0; i < consilIds.length; i++) {
    filters += "?id=\"consil:".concat(consilIds[i], "\"^^xsd:string");
    if (i < consilIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var query = "\n    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        SELECT DISTINCT\n            ?id\n            ?title\n            ?date\n            ?workLang as ?lang\n        WHERE {\n            \n            ".concat(filters, "\n        \n            ?work cdm:work_id_document ?id .\n            ?work cdm:work_date_document ?date .\n   \n            ?exp cdm:expression_belongs_to_work ?work .\n            ?exp cdm:expression_title ?title .\n            ?exp cdm:expression_uses_language ?workLang .\n            ").concat(langISO3Filters, "\n        }\n        ORDER BY ?id ?workLang\n    ");
  return query;
};
var processConsilResponse = exports.processConsilResponse = function processConsilResponse(response, langISO3) {
  // resolve language
  var idMap = {};
  response.results.bindings = response.results.bindings.map(function (binding) {
    if (binding.title && binding.title.value) {
      binding.title.value = binding.title.value.replace(new RegExp("&#13;\n", 'g'), ' ');
    }
    if (!idMap[binding.id.value]) {
      idMap[binding.id.value] = [];
    }
    idMap[binding.id.value].push(binding);
    return binding;
  });
  var newBindings = [];
  // default to english or french
  Object.keys(idMap).forEach(function (id) {
    var foundLang = idMap[id].filter(function (m) {
      return m.lang.value === 'http://publications.europa.eu/resource/authority/language/' + String(langISO3).toUpperCase();
    }).pop();
    if (!foundLang) {
      foundLang = idMap[id].filter(function (m) {
        return m.lang.value === 'http://publications.europa.eu/resource/authority/language/ENG';
      }).pop();
    }
    if (!foundLang) {
      foundLang = idMap[id].filter(function (m) {
        return m.lang.value === 'http://publications.europa.eu/resource/authority/language/FRA';
      }).pop();
    }
    if (foundLang) {
      newBindings.push(foundLang);
    }
  });
  response.results.bindings = newBindings;
  return response;
};

},{}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEcliQuery = void 0;
/**
 * ECLI ids query
 * @param {Array<String>} ecliIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
var getEcliQuery = exports.getEcliQuery = function getEcliQuery(ecliIds, langISO3) {
  var langISO3s = langISO3 ? [String(langISO3).toUpperCase()] : ["ENG", "FRA"]; // default to english or french
  var langISO3Filters = "FILTER (?lang IN (";
  for (var i = 0; i < langISO3s.length; i++) {
    langISO3Filters += "lang:".concat(langISO3s[i]);
    if (i < langISO3s.length - 1) {
      langISO3Filters += ",";
    }
  }
  langISO3Filters += "))";
  ecliIds = ecliIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var _i = 0; _i < ecliIds.length; _i++) {
    filters += "?ecli=\"".concat(ecliIds[_i], "\"^^xsd:string");
    if (_i < ecliIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT ?workId as ?celexId ?date ?ecli as ?id ?title_ as ?title ?force ?dossierTitle ?lang WHERE {   \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title_\n            }\n            graph ?g { \n                ?exp cdm:expression_uses_language ?lang\n                ".concat(langISO3Filters, "\n            }       \n        \n            ?s cdm:case-law_ecli ?ecli .\n            ?s cdm:work_date_document ?date .\n            ?s cdm:work_id_document ?workId.\n\n            OPTIONAL {\n                ?s2 cdm:case-law_ecli ?ecli .\n                ?s2 cdm:work_part_of_dossier ?dossier.\n                ?dossier cdm:dossier_title ?dossierTitle\n            }\n\n            ").concat(filters, " .\n            FILTER regex(str(?workId), \"celex\")\n            FILTER (!regex(str(?workId), \"_\"))\n            OPTIONAL {\n                ?s cdm:resource_legal_in-force ?force .\n            }\n        }\n        ORDER BY ?id ?lang\n    ");
  return query;
};

},{}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEliQuery = exports.getEliConsolidationsQuery = exports.computeEliIdsMap = void 0;
/**
 * Query by ELI ids
 * @param {Array<String>} eliIds
 * @param {String} langISO3
 *
 * @returns {String}
 */
var getEliQuery = exports.getEliQuery = function getEliQuery(eliIds, langISO3) {
  langISO3 = langISO3 || 'ENG';
  langISO3 = String(langISO3).toUpperCase();
  eliIds = eliIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var i = 0; i < eliIds.length; i++) {
    // provides better perfs for small eli sets but is unreliable. @TODO verify . 
    if (eliIds.length < 10) {
      filters += "?eli = \"".concat(eliIds[i], "\"^^<http://www.w3.org/2001/XMLSchema#anyURI>");
    } else {
      filters += "(STR(?eli) = \"".concat(eliIds[i], "\")");
    }
    if (i < eliIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var pointInTimeFilter1 = '';
  var pointInTimeFilter2 = '';
  var pointInTimeFilter3 = '';
  var pointInTimeFilter4 = '';
  if (R2L.options.pointInTime) {
    pointInTimeFilter1 = "FILTER(?consolidatedDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter2 = "FILTER(?consolidatedDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter3 = "FILTER(?repealDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter4 = "FILTER(?repealDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
  }
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT\n            ?date \n            ?id \n            ?title \n            ?eli \n            ?force \n            MIN(?dateForce) as ?dateForce \n            (REPLACE(?oj, \" /, \\\\.\\\\.\", \"\", \"i\") as ?oj)\n            ?ojResourceUrl\n            ?consolidatedDate \n            ?consolidatedEli\n            ?consolidatedId\n            ?initialEli\n            ?initialForce\n            ?initialDateValidity\n            ?finalConsolidatedEli\n            ?finalConsolidatedDate\n            MAX(?dateValidity) as ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?lang\n        {\n        SELECT\n            ?date ?workId as ?id \n            ?title_ as ?title \n            ?eli \n            ?force \n            ?dateForce \n\n            (IF(BOUND(?ojIdOld), ?ojIdOld, ?ojActId) as ?ojId)\n            (IF(BOUND(?ojResourceUrlOld), ?ojResourceUrlOld, ?ojActResourceUrl) as ?ojResourceUrl)\n            (IF(BOUND(?ojDateOld), ?ojDateOld, ?ojActDate) as ?ojDate)\n            (IF(BOUND(?ojOld), ?ojOld, CONCAT(CONCAT(CONCAT(CONCAT(CONCAT(REPLACE(STR(?ojCollectionDocumentIdentifier ) , \"-\", \" \", \"i\"), \" \"), CONCAT(?ojActYear, \"/\"))), CONCAT(?ojActNumber, \", \")), \n            CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 9, 2), \".\"), CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 6, 2), \".\")), SUBSTR(STR(?ojActDate), 1, 4)))) as ?oj)\n\n            ?consolidatedDate \n            ?consolidatedEli\n            ?consolidatedId\n            ?initialCelexId \n            ?initialEli\n            ?initialForce\n            ?initialDateValidity\n            ?finalConsolidatedEli\n            ?finalConsolidatedDate\n            ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?lang\n        WHERE {                  \n            graph ?ge {                     \n                ?exp cdm:expression_belongs_to_work ?s .                    \n                ?exp cdm:expression_title ?title_ .\n                OPTIONAL {\n                    ?exp owl:sameAs ?resourceUrl .\n                    FILTER (REGEX(?resourceUrl, \"resource/oj/\"))    \n                }           \n            }                \n            graph ?g {                     \n                ?exp cdm:expression_uses_language ?lang                    \n                filter(?lang=lang:".concat(langISO3, ").                  \n            }    \n\n            ?s cdm:resource_legal_eli ?eli .\n            ").concat(filters, "\n            {\n                ?s cdm:work_date_document ?date .\n                ?s rdf:type ?type .\n                ?s cdm:work_id_document ?workId\n                FILTER (STRSTARTS(?workId, \"celex:\")) . \n            }\t\t\n\n            OPTIONAL {\n                ?s cdm:case-law_ecli ?ecli\n            }\n            OPTIONAL {\n                ?s cdm:resource_legal_date_end-of-validity ?dateValidity .\n            }\n\n            OPTIONAL {\n                # INITIAL ACT\n                ?s cdm:act_consolidated_consolidates_resource_legal ?actInitial .\n                ?actInitial cdm:resource_legal_eli ?initialEli . \n                ?actInitial cdm:work_id_document ?initialCelexId .\n                # STATUS OF THE INITIAL ACT\n                ?actInitial cdm:resource_legal_in-force ?initialForce .\n\n                BIND(REPLACE(?initialEli, \"/oj\", \"\", \"i\") AS ?initialEliRaw) .\n\n                FILTER regex(str(?initialCelexId), \"celex:\") \n                # make sure we focus on the right consolidated act REFTOLINK-1310\n                FILTER STRSTARTS(?eli, ?initialEliRaw) \n\n                FILTER regex(str(?initialCelexId), \"celex:\") \n                FILTER NOT EXISTS {\n                    ?actInitial cdm:resource_legal_corrects_resource_legal ?corrigendumEli .\n                }\n\n                OPTIONAL {\n                    ?actInitial cdm:resource_legal_date_end-of-validity ?initialDateValidity .\n                }\n\n                # GET FINAL CONSOLIDATION OF INITIAL ACT\n                OPTIONAL {\n                    ?finalActConsolidated cdm:act_consolidated_based_on_resource_legal ?actInitial .\n                    ?finalActConsolidated cdm:act_consolidated_date ?finalConsolidatedDate .\n                    ?finalActConsolidated cdm:resource_legal_eli ?finalConsolidatedEli . \n                    # latest consolidation date only\n                    filter not exists {\n                        ?finalActConsolidated2 cdm:act_consolidated_based_on_resource_legal ?actInitial .\n                        ?finalActConsolidated2 cdm:act_consolidated_date ?finalConsolidatedDate2\n                        filter (?finalConsolidatedDate2 > ?finalConsolidatedDate)\n                    }\n                }\n            }\n            OPTIONAL {\n                # CONSOLIDATION\n                ?actConsolidated cdm:act_consolidated_based_on_resource_legal ?s .\n                ?actConsolidated cdm:act_consolidated_date ?consolidatedDate .\n                ?actConsolidated cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce .\n                ?actConsolidated cdm:resource_legal_eli ?consolidatedEli . \n                ?actConsolidated cdm:work_id_document ?consolidatedId_ .\n                \n                # we only need results before the end of the act validity\n                ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity .\n\n                ").concat(pointInTimeFilter1, "\n                FILTER (?consolidatedDateEntryForce < ?act_end_of_validity)     \n                FILTER regex(str(?consolidatedId_), \"celex:\")     \n                # latest consolidation date only\n                FILTER not exists {\n                    ?actConsolidated2 cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce2 .\n                    ?actConsolidated2 cdm:act_consolidated_based_on_resource_legal ?s .\n                    ?actConsolidated2 cdm:act_consolidated_date ?consolidatedDate2 .\n                    ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity2 .\n                    ").concat(pointInTimeFilter2, "\n                    FILTER (?consolidatedDateEntryForce2 > ?consolidatedDateEntryForce AND (?consolidatedDateEntryForce2 < ?act_end_of_validity2))\n                }\n                BIND(SUBSTR(?consolidatedId_, 7) as ?consolidatedId)\n            }\n            OPTIONAL {\n                # REPEALING\n                ?actRepeal cdm:resource_legal_repeals_resource_legal ?s .\n                ?actRepeal cdm:resource_legal_eli ?repealEli . \n                ?actRepeal cdm:work_date_document ?repealDate . \n                ?actRepeal cdm:work_id_document ?repealCelexId_.\n                ").concat(pointInTimeFilter3, "\n                FILTER regex(str(?repealCelexId_), \"celex:\")                    \n                BIND(SUBSTR(?repealCelexId_, 7) as ?repealCelexId)\n                OPTIONAL {\n                    # REPEALING LAST\n                    ?lastActRepeal cdm:resource_legal_repeals_resource_legal+ ?s .\n                    ?lastActRepeal cdm:resource_legal_eli ?lastRepealEli . \n                    ?lastActRepeal cdm:work_id_document ?lastRepealCelexId_.\n                    FILTER regex(str(?lastRepealCelexId_), \"celex:\")                    \n                    FILTER not exists {\n                       ?actRepeal_ cdm:resource_legal_repeals_resource_legal ?lastActRepeal .\n                       ?actRepeal_ cdm:work_date_document ?repealDate2\n                       ").concat(pointInTimeFilter4, "\n                    } \n                    BIND(SUBSTR(?lastRepealCelexId_, 7) as ?lastRepealCelexId)\n                }\n            }\n            OPTIONAL {\n                # FORCE\n                ?s cdm:resource_legal_in-force ?force .\n                ?s cdm:resource_legal_date_entry-into-force ?dateForce .\n            }        \n            OPTIONAL {\n                # MANIFEST \n                ?manif cdm:manifestation_manifests_expression ?exp. \n                ?manif cdm:manifestation_type ?manifType .\n                FILTER(STR(?manifType)=\"print\" || BOUND(?ojPageFirst)) .\n\n                # MANIFEST OJ PAGE\n                OPTIONAL {\n                    ?manif cdm:manifestation_official-journal_part_page_first ?ojPageFirst.\n                    ?manif cdm:manifestation_official-journal_part_page_last ?ojPageLast.\n                }\n                OPTIONAL {\n                    ?manif owl:sameAs ?manifOjResourceUrl .\n                    # We need to use the MANIFEST to get to the OJ\n                    FILTER (STRSTARTS(STR(?manifOjResourceUrl), \"http://publications.europa.eu/resource/oj/\"))\n                }\n\n                # OJ info\n                ?s cdm:resource_legal_published_in_official-journal ?q .\n                ?q cdm:official-journal_part_of_collection_document ?ojPartOld .\n                ?q cdm:official-journal_number ?ojNumberOld .\n                OPTIONAL {\n                    ?q cdm:official-journal_class ?ojClassOld .\n                }\n                ?ojPartOld skos:prefLabel ?ojPartLabelOld .\n                ?q cdm:official-journal_volume ?ojVolumeOld .\n                ?q cdm:publication_general_date_publication ?ojDateOld .\n                \n                BIND(CONCAT(STR(DAY(?ojDateOld)), \n                \".\", \n                STR(MONTH(?ojDateOld)), \n                \".\", \n                STR(YEAR(?ojDateOld))) as ?ojDatePublicationOld)\n\n                # cross match with parent OJ resource\n                ?q owl:sameAs ?mainOjResourceUrlOld .\n                ?q cdm:work_id_document ?ojIdOld.\n                \n                # multiple OJ publications can cause trouble so we cross-match the OJ url with the manifest's (where available)\n                # DISABLED - using the first result \n                # FILTER (!BOUND(?manifOjResourceUrl) || STRSTARTS(STR(?manifOjResourceUrl), STR(?mainOjResourceUrlOld)) || (REGEX(STR(?langSpecificManif), 'resource/oj/DD_')))\n                FILTER (STRSTARTS(STR(?ojIdOld), \"oj:\") AND STRSTARTS(STR(?mainOjResourceUrlOld), \"http://publications.europa.eu/resource/oj/\")) \n                BIND(?mainOjResourceUrlOld as ?ojResourceUrlOld)\n\n                # OJ label; do not modify as it will be processed for translation\n                BIND(IF(BOUND(?ojPartLabelOld), \n                CONCAT(CONCAT(REPLACE(?ojPartLabelOld, \"-\", \" \", \"i\"), \" \", \n                CONCAT(?ojNumberOld, \n                CONCAT(IF (STR(?ojClassOld) != \"R\", ?ojClass, \"\"),\n                CONCAT(\", \", CONCAT($ojDatePublicationOld,\n                    CONCAT(IF(BOUND(?ojPageFirst), \", p. \", \"\"), \n                    CONCAT(IF(BOUND(?ojPageFirst), xsd:integer(?ojPageFirst), \"\"), \n                    CONCAT(IF(BOUND(?ojPageLast), \"-\", \"\"), IF(BOUND(?ojPageLast), xsd:integer(?ojPageLast), \"\")))))))))), \"\") as ?ojOld) .\n\n\n                FILTER ( lang(?ojPartLabelOld) = \"en\" )\n            }\n            \n            # OJ act-by-act (not in use as it is very slow)\n            OPTIONAL {\n                FILTER NOT EXISTS {\n                    ?s cdm:resource_legal_published_in_official-journal ?_ojTemp\n                }\n                ?s cdm:official-journal-act_date_publication ?ojActDate .\n                ?s cdm:official-journal-act_part_of_collection_document ?ojCollectionDocument .\n                ?ojCollectionDocument dc:identifier ?ojCollectionDocumentIdentifier .\n                ?s cdm:official-journal-act_subsubsection_oj ?ojSubsection .\n                ?s cdm:official-journal-act_number ?ojActNumber .\n                ?s cdm:official-journal-act_year ?ojActYear .\n                \n                ?s cdm:work_id_document ?ojActId. \n                FILTER (STRSTARTS(STR(?ojActId), \"oj:\"))\n                ?s cdm:resource_legal_eli ?ojActResourceUrl . \n            } \n        }\n    }");
  return query;
};
var getEliConsolidationsQuery = exports.getEliConsolidationsQuery = function getEliConsolidationsQuery(eliIds) {
  // remove last segment
  eliIds = eliIds.map(function (eid) {
    return eid.split("/").slice(0, -1).join("/") + "/";
  });
  // unique values
  eliIds = eliIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var i = 0; i < eliIds.length; i++) {
    filters += "(STRSTARTS(STR(?eli), \"".concat(eliIds[i], "\"))");
    if (i < eliIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT\n        ?eli \n    WHERE {                  \n        ?exp cdm:expression_belongs_to_work ?s .                                       \n        ?s cdm:resource_legal_eli ?eli .\n        ".concat(filters, "\n\n        ?s cdm:work_id_document ?workId .\n        FILTER (STRSTARTS(?workId, \"celex:\")) . \n}");
  return query;
};
var computeEliIdsMap = exports.computeEliIdsMap = function computeEliIdsMap(eliIds, consolidationEliIds) {
  consolidationEliIds = consolidationEliIds.map(function (item) {
    return item.eli.value;
  });
  consolidationEliIds.sort(function (a, b) {
    return a < b ? -1 : 1;
  });
  var computedEliIds = eliIds.map(function (eliId) {
    var eliRoot = eliId.split("/").slice(0, -1).join("/") + "/";
    var filtered = consolidationEliIds.filter(function (consEliId) {
      return consEliId.indexOf(eliRoot) === 0;
    });
    var found = filtered[filtered.length - 1] || eliId; // default is last one - the `/oj`
    // return last element from filtered smaller than our eliId
    if (eliId.slice(-3) !== "/oj") {
      for (var i = 0; i < filtered.length; i++) {
        if (filtered[i] <= eliId) {
          found = filtered[i];
        }
        if (filtered[i] > eliId) {
          break;
        }
      }
    }
    return [eliId, found];
  });
  console.debug("Computed ELI ids", computedEliIds);
  var map = {};
  computedEliIds.forEach(function (item) {
    map[item[0]] = item[1];
  });
  return map;
};

},{}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFinlexEliQuery = void 0;
var getFinlexEliQuery = exports.getFinlexEliQuery = function getFinlexEliQuery(eliIds, langISO3) {
  langISO3 = String(langISO3).toUpperCase();
  // unique ids only
  eliIds = eliIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var i = 0; i < eliIds.length; i++) {
    filters += "?eli = <".concat(eliIds[i], ">");
    if (i < eliIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var query = "\n    prefix xsd: <http://www.w3.org/2001/XMLSchema#>\n    prefix dct: <http://purl.org/dc/terms/>\n    prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    prefix owl: <http://www.w3.org/2002/07/owl#>\n    prefix skos: <http://www.w3.org/2004/02/skos/core#>\n    prefix foaf: <http://xmlns.com/foaf/0.1/>\n    prefix eli: <http://data.europa.eu/eli/ontology#>\n    \n    SELECT distinct ?title ?date ?publicationDate ?id {\n        \n        ?eli eli:date_document ?date .\n        ?eli eli:date_publication ?publicationDate .\n        ?eli eli:is_realized_by ?eliFin .\n        ?eliFin eli:language <http://publications.europa.eu/resource/authority/language/FIN> .\n        ?eliFin eli:title ?t .\n        BIND (?eli as ?id) .\n        BIND (CONCAT(STR(?t), \n            CONCAT(\n                CONCAT(\"\\n\\nPublication date: \", STR(?publicationDate) ), \n                CONCAT(\"\\nDocument date: \", STR(?date) ) \n            )\n        ) as ?title)\n        ".concat(filters, "\n    }\n   ");
  return query;
};

},{}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getJoinedCaseQuery = getJoinedCaseQuery;
function getJoinedCaseQuery() {
  return "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id ?title\n    WHERE {  \n        ?exp cdm:expression_belongs_to_work ?s .\n        ?exp cdm:expression_title ?title .\n        ?exp cdm:expression_uses_language ?lang\n        FILTER (?lang IN (lang:FRA))\n          \n        ?s cdm:work_id_document ?workId.\n        ?s cdm:resource_legal_type ?type .\n        ?s cdm:resource_legal_id_sector \"6\"^^xsd:string .         \n        FILTER (?type IN (\"TA\"^^xsd:string, \"CA\"^^xsd:string))\n        FILTER (REGEX(?title, \"^Affaires.jointes\") AND REGEX(STR(?workId), \"^celex:6\"))\n    }";
}

},{}],29:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getOjQuery = void 0;
/**
 * Query by OJ ids
 * @param {Array<String>} ojIds 
 * @param {String} langISO3 (optional, will default to ENG)
 * 
 * @returns {String}
 */
var getOjQuery = exports.getOjQuery = function getOjQuery(ojIds, langISO3) {
  var langISO3s = langISO3 ? [String(langISO3).toUpperCase()] : ["ENG", "FRA"]; // default to english or french
  var langISO3Filters = "FILTER (?lang IN (";
  for (var i = 0; i < langISO3s.length; i++) {
    langISO3Filters += "lang:".concat(langISO3s[i]);
    if (i < langISO3s.length - 1) {
      langISO3Filters += ",";
    }
  }
  langISO3Filters += "))";

  // unique ids only
  ojIds = ojIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (?workId IN (";
  for (var _i = 0; _i < ojIds.length; _i++) {
    filters += "\"oj:".concat(ojIds[_i], "\", \"oj:").concat(ojIds[_i], "\"^^xsd:string"); // query both types
    if (_i < ojIds.length - 1) {
      filters += ",";
    }
  }
  filters += "))";
  var pointInTimeFilter1 = '';
  var pointInTimeFilter2 = '';
  var pointInTimeFilter3 = '';
  var pointInTimeFilter4 = '';
  if (R2L.options.pointInTime) {
    pointInTimeFilter1 = "FILTER(?consolidatedDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter2 = "FILTER(?consolidatedDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter3 = "FILTER(?repealDate < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
    pointInTimeFilter4 = "FILTER(?repealDate2 < \"".concat(R2L.options.pointInTime, "\"^^xsd:date)");
  }
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?date ?id \n            ?title \n            ?baseTitle\n            ?eli \n            ?ecli\n            ?force \n            MIN(?dateForce) as ?dateForce\n            (REPLACE(?oj, \" /, \\\\.\\\\.\", \"\", \"i\") as ?oj)\n            ?ojId \n            ?ojResourceUrl\n            ?ojDate\n            ?consolidatedDate \n            ?consolidatedEli \n            ?consolidatedId\n            MAX(?dateValidity) as ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?lang\n{\n        SELECT \n            ?date ?workId as ?id \n            ?title \n            ?baseTitle\n            ?eli \n            ?ecli\n            ?force \n            ?dateForce \n            (IF(BOUND(?ojIdOld), ?ojIdOld, ?ojActId) as ?ojId)\n            (IF(BOUND(?ojResourceUrlOld), ?ojResourceUrlOld, ?ojActResourceUrl) as ?ojResourceUrl)\n            (IF(BOUND(?ojDateOld), ?ojDateOld, ?ojActDate) as ?ojDate)\n            (IF(BOUND(?ojOld), ?ojOld, CONCAT(CONCAT(CONCAT(CONCAT(CONCAT(REPLACE(STR(?ojCollectionDocumentIdentifier ) , \"-\", \" \", \"i\"), \" \"), CONCAT(?ojActYear, \"/\"))), CONCAT(?ojActNumber, \", \")), \n            CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 9, 2), \".\"), CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 6, 2), \".\")), SUBSTR(STR(?ojActDate), 1, 4)))) as ?oj)\n            ?consolidatedDate \n            ?consolidatedEli \n            ?consolidatedId\n            ?dateValidity\n            ?repealCelexId \n            ?repealEli\n            ?lastRepealCelexId\n            ?lastRepealEli\n            ?resourceUrl\n            ?lang\n        WHERE {  \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title_ .\n                OPTIONAL {\n                    ?exp owl:sameAs ?resourceUrl .\n                    FILTER (REGEX(?resourceUrl, \"resource/oj/\"))\n                }\n            }\n            graph ?g { \n                ?exp cdm:expression_uses_language ?lang\n                ".concat(langISO3Filters, "\n            }  \n            ?s cdm:work_date_document ?date .\n            ?s rdf:type ?type .\n            ?s cdm:work_id_document ?workId.\n            OPTIONAL {\n                ?s cdm:case-law_ecli ?ecli\n            }\n            OPTIONAL {\n                ?s cdm:resource_legal_date_end-of-validity ?dateValidity .\n            }\n            ").concat(filters, "\n\n            OPTIONAL {\n                # CONSOLIDATION\n                ?actConsolidated cdm:act_consolidated_based_on_resource_legal ?s .\n                ?actConsolidated cdm:act_consolidated_date ?consolidatedDate .\n                ?actConsolidated cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce .\n                ?actConsolidated cdm:resource_legal_eli ?consolidatedEli . \n                ?actConsolidated cdm:work_id_document ?consolidatedId_ .\n                \n                # we only need results before the end of the act validity\n                ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity .\n\n                ").concat(pointInTimeFilter1, "\n                FILTER (?consolidatedDateEntryForce < ?act_end_of_validity)     \n                FILTER regex(str(?consolidatedId_), \"celex:\")     \n                # latest consolidation date only\n                FILTER not exists {\n                    ?actConsolidated2 cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce2 .\n                    ?actConsolidated2 cdm:act_consolidated_date ?consolidatedDate2 .\n                    ?actConsolidated2 cdm:act_consolidated_based_on_resource_legal ?s .\n                    ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity2 .\n                    ").concat(pointInTimeFilter2, "\n                    FILTER (?consolidatedDateEntryForce2 > ?consolidatedDateEntryForce AND (?consolidatedDateEntryForce2 < ?act_end_of_validity2))\n                }\n\n                BIND(SUBSTR(?consolidatedId_, 7) as ?consolidatedId)\n            }\n            OPTIONAL {\n                # REPEALING\n                ?actRepeal cdm:resource_legal_repeals_resource_legal ?s .\n                ?actRepeal cdm:resource_legal_eli ?repealEli . \n                ?actRepeal cdm:work_date_document ?repealDate . \n                ?actRepeal cdm:work_id_document ?repealCelexId_.\n                ").concat(pointInTimeFilter3, "\n                FILTER regex(str(?repealCelexId_), \"celex:\")                    \n                BIND(SUBSTR(?repealCelexId_, 7) as ?repealCelexId)\n\n                OPTIONAL {\n                    # REPEALING LAST\n                    ?lastActRepeal cdm:resource_legal_repeals_resource_legal+ ?s .\n                    ?lastActRepeal cdm:resource_legal_eli ?lastRepealEli . \n                    ?lastActRepeal cdm:work_id_document ?lastRepealCelexId_.\n                    FILTER regex(str(?lastRepealCelexId_), \"celex:\")                    \n                    FILTER not exists {\n                       ?actRepeal_ cdm:resource_legal_repeals_resource_legal ?lastActRepeal .\n                       ?actRepeal_ cdm:work_date_document ?repealDate2\n                       ").concat(pointInTimeFilter4, "\n                    } \n                    BIND(SUBSTR(?lastRepealCelexId_, 7) as ?lastRepealCelexId)\n                }\n            }\n            OPTIONAL {\n                ?s cdm:resource_legal_eli ?eli .\n            }\n            OPTIONAL {\n                # FORCE\n                ?s cdm:resource_legal_in-force ?force .\n                ?s cdm:resource_legal_date_entry-into-force ?dateForce .\n            }        \n            OPTIONAL {\n                # MANIFEST \n                ?manif cdm:manifestation_manifests_expression ?exp. \n                ?manif cdm:manifestation_type ?manifType .\n                FILTER(STR(?manifType)=\"print\" || BOUND(?ojPageFirst)) .\n\n                # MANIFEST OJ PAGE (optional)\n                OPTIONAL {\n                    ?manif cdm:manifestation_official-journal_part_page_first ?ojPageFirst.\n                    ?manif cdm:manifestation_official-journal_part_page_last ?ojPageLast.\n                }\n\n                ?manif cdm:manifestation_part_of_manifestation ?parentManif.\n                OPTIONAL {\n                    ?parentManif owl:sameAs ?langSpecificManif.\n                }\n                OPTIONAL {\n                    ?manif owl:sameAs ?manifOjResourceUrl .\n                    # We need to use the MANIFEST to get to the OJ\n                    FILTER (STRSTARTS(STR(?manifOjResourceUrl), \"http://publications.europa.eu/resource/oj/\"))\n                }\n\n                # OJ info\n                ?s cdm:resource_legal_published_in_official-journal ?q .\n                ?q cdm:official-journal_part_of_collection_document ?ojPartOld .\n                ?q cdm:official-journal_number ?ojNumberOld .\n                OPTIONAL {\n                    ?q cdm:official-journal_class ?ojClassOld .\n                }\n                ?ojPartOld skos:prefLabel ?ojPartLabelOld .\n                ?q cdm:official-journal_volume ?ojVolumeOld .\n                ?q cdm:publication_general_date_publication ?ojDateOld .\n                \n                # cross match with parent OJ resource\n                ?q owl:sameAs ?mainOjResourceUrlOld .\n                ?q cdm:work_id_document ?ojIdOld.\n                \n                # multiple OJ publications can cause trouble so we cross-match the OJ url with the manifest's (where available)\n                FILTER (!BOUND(?langSpecificManif) || STRSTARTS(STR(?langSpecificManif), STR(?mainOjResourceUrlOld)))\n                FILTER (STRSTARTS(STR(?ojIdOld), \"oj:\") AND STRSTARTS(STR(?mainOjResourceUrlOld), \"http://publications.europa.eu/resource/oj/\")) \n                BIND(?mainOjResourceUrlOld as ?ojResourceUrlOld)\n\n                BIND(CONCAT(STR(DAY(?ojDateOld)), \n                \".\", \n                STR(MONTH(?ojDateOld)), \n                \".\", \n                STR(YEAR(?ojDateOld))) as ?ojDatePublicationOld)\n\n                # OJ label; do not modify as it will be processed for translation\n                BIND(IF(BOUND(?ojPartLabelOld), \n                CONCAT(CONCAT(REPLACE(?ojPartLabelOld, \"-\", \" \", \"i\"), \" \", \n                CONCAT(?ojNumberOld, \n                CONCAT(IF (STR(?ojClassOld) != \"R\", ?ojClassOld, \"\"),\n                CONCAT(\", \", CONCAT($ojDatePublicationOld,\n                    CONCAT(IF(BOUND(?ojPageFirst), \", p. \", \"\"), \n                    CONCAT(IF(BOUND(?ojPageFirst), xsd:integer(?ojPageFirst), \"\"), \n                    CONCAT(IF(BOUND(?ojPageLast), \"-\", \"\"), IF(BOUND(?ojPageLast), xsd:integer(?ojPageLast), \"\")))))))))), \"\") as ?ojOld) .\n\n                FILTER (lang(?ojPartLabelOld) = \"en\" )\n            }\n\n            # OJ act-by-act (not in use as it is very slow)\n            OPTIONAL {\n                FILTER NOT EXISTS {\n                    ?s cdm:resource_legal_published_in_official-journal ?_ojTemp\n                }\n                ?s cdm:official-journal-act_date_publication ?ojActDate .\n                ?s cdm:official-journal-act_part_of_collection_document ?ojCollectionDocument .\n                ?ojCollectionDocument dc:identifier ?ojCollectionDocumentIdentifier .\n                ?s cdm:official-journal-act_subsubsection_oj ?ojSubsection .\n                ?s cdm:official-journal-act_number ?ojActNumber .\n                ?s cdm:official-journal-act_year ?ojActYear .\n                \n                ?s cdm:work_id_document ?ojActId. \n                FILTER (STRSTARTS(STR(?ojActId), \"oj:\"))\n                ?s cdm:resource_legal_eli ?ojActResourceUrl . \n            } \n\n            BIND(CONCAT(?title_, IF(BOUND(?ecli), CONCAT(\"\\nECLI identifier: \", ?ecli), \"\")) as ?title) \n            BIND(?title_ as ?baseTitle)\n        }\n    }\n    ORDER BY ?id ?lang");
  return query;
};

},{}],30:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processProcResponse = exports.getProcedureQuery = void 0;
/**
 * Parlamentary Procedure ids query
 * @param {Array<String>} procIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
var getProcedureQuery = exports.getProcedureQuery = function getProcedureQuery(procIds, langISO3) {
  var langISO3Filters = "FILTER (?workLang IN (lang:".concat(String(langISO3).toUpperCase(), ", lang:ENG, lang:FRA))");
  procIds = procIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (";
  for (var i = 0; i < procIds.length; i++) {
    filters += "?id=\"".concat(procIds[i], "\"^^xsd:string");
    if (i < procIds.length - 1) {
      filters += " || ";
    }
  }
  filters += ")";
  var query = "\n    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        SELECT DISTINCT\n            ?id\n            ?workLang as ?lang\n            ?dateAdopted\n            ?isAdopted\n            ?publishedWorkId\n            ?workTitle as ?baseTitle\n            CONCAT((CONCAT(?dossierType, CONCAT(CONCAT('(', CONCAT(?dossierYear, ')'), ?dossierRef)))), CONCAT(': ', ?workTitle)) AS ?title\n            (CONCAT(?dossierType, CONCAT(CONCAT('(', CONCAT(?dossierYear, ')'), ?dossierRef)))) AS ?reference\n        WHERE {\n            ?s cdm:procedure_code_interinstitutional_reference_procedure ?id\n            ".concat(filters, "\n            ?s cdm:dossier_contains_work ?work .\n            OPTIONAL {\n                ?s cdm:dossier_date_adopted ?dateAdopted.    \n            }\n            ?s cdm:dossier_adopted-proposal ?isAdopted .\n\n            # find OJ publication\n            OPTIONAL {\n                ?s cdm:dossier_contains_event ?evt .\n                ?evt cdm:event_legal_has_type_concept_type_event_legal <http://publications.europa.eu/resource/authority/event/PUB_OJ> .\n                ?evt cdm:event_legal_contains_work ?publishedWork .\n                ?publishedWork cdm:work_id_document ?publishedWorkId \n                FILTER regex(str(?publishedWorkId), \"celex\")\n            }\n\n            ?s cdm:dossier_number_reference ?dossierRef.   \n            ?s cdm:dossier_type_reference ?dossierType.  \n            ?s cdm:dossier_year_reference ?dossierYear.  \n            ?s cdm:dossier_contains_work ?work.\n\n            ?work cdm:work_id_document ?workId.\n            ?work cdm:work_date_document ?workDate\n            FILTER NOT EXISTS {\n                ?s cdm:dossier_contains_work ?work2.\n                ?work2 cdm:work_date_document ?workDate2\n                FILTER (?workDate2 > ?workDate)\n            }\n   \n            ?exp cdm:expression_belongs_to_work ?work .\n            ?exp cdm:expression_title ?workTitle .\n            ?exp cdm:expression_uses_language ?workLang .\n            ").concat(langISO3Filters, "\n        }\n        ORDER BY ?id ?lang\n    ");
  return query;
};
var processProcResponse = exports.processProcResponse = function processProcResponse(response, langISO3) {
  // resolve language
  var idMap = {};
  response.results.bindings = response.results.bindings.map(function (binding) {
    if (binding.title && binding.title.value) {
      binding.title.value = binding.title.value.replace(new RegExp("&#13;\n", 'g'), ' ');
      // add status
      if (binding.isAdopted.value === '1') {
        binding.title.value += '\n' + "✔ Completed";
        if (binding.publishedWorkId) {
          binding.title.value += " (Adopted act: ".concat(String(binding.publishedWorkId.value).replace("celex:", ""), ")");
        }
      } else {
        binding.title.value += '\n' + "↻ Ongoing";
      }
    }
    if (!idMap[binding.id.value]) {
      idMap[binding.id.value] = [];
    }
    idMap[binding.id.value].push(binding);
    return binding;
  });
  var newBindings = [];
  // default to english or french
  Object.keys(idMap).forEach(function (id) {
    var foundLang = idMap[id].filter(function (m) {
      return m.lang.value === 'http://publications.europa.eu/resource/authority/language/' + String(langISO3).toUpperCase();
    }).pop();
    if (!foundLang) {
      foundLang = idMap[id].filter(function (m) {
        return m.lang.value === 'http://publications.europa.eu/resource/authority/language/ENG';
      }).pop();
    }
    if (!foundLang) {
      foundLang = idMap[id].filter(function (m) {
        return m.lang.value === 'http://publications.europa.eu/resource/authority/language/FRA';
      }).pop();
    }
    if (foundLang) {
      newBindings.push(foundLang);
    }
  });
  response.results.bindings = newBindings;
  return response;
};

},{}],31:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.bindRules = bindRules;
exports.clearRef2LinkRules = clearRef2LinkRules;
exports.clearRuntimeRules = clearRuntimeRules;
var _jquery = require("../jquery.js");
var _letters = require("../utils/letters.js");
var _base = require("../utils/base64.js");
var _index = require("../ux/index.js");
var _converters = require("../utils/converters.js");
var _lzstring = _interopRequireDefault(require("../utils/lzstring.js"));
var _list = require("../utils/list.js");
var _functions = require("../utils/functions.js");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Internal variables to store rules/patterns
 */
var _ref2linkRules = [];
var _runtimeRules = [];
var _namedPatterns = {};
function clearRuntimeRules() {
  _runtimeRules = [];
}
function clearRef2LinkRules() {
  _ref2linkRules = [];
}

/**
 * Binds the API functions to work with rules
 * @param {Object} R2L 
 */
function bindRules(R2L) {
  var rK, rV;
  try {
    rK = JSON.parse(R2L.getConstant("R2L_RULE_MAP"));
    rV = JSON.parse(R2L.getConstant("R2L_VIEW_MAP"));
  } catch (e) {
    rK = {};
    rV = {};
    console.error(e);
  }
  R2L.compileGlobalRule = function (rules) {
    var patterns = [];
    var offset = 0;
    rules.forEach(function (_rule) {
      if (_rule.hasOwnProperty('views') && _rule.views && _rule.views.hasOwnProperty('length') && _rule.views.length) {
        offset += parseInt(_rule.slots);
        var p = '' + (_rule.fullPattern.source || _rule.fullPattern);
        var nonCapturing = R2L.getNonCapturingPattern(p);
        nonCapturing = nonCapturing.replace('{$i}', offset);
        patterns.push('(' + nonCapturing + ')');
      }
    });
    var joinedPattern = '(?:' + patterns.join('|') + ')';
    var letterPattern = "[/0-9" + _letters.letters.latin + _letters.letters.cyrillic + _letters.letters.greek + _letters.letters.specialChars + "]";
    var lookahead = (0, _functions.getLookAhead)(letterPattern);
    var lookbehind = (0, _functions.getLookBehind)(letterPattern);
    return {
      'pattern': new RegExp('(?![\r\n\v\f])' + lookbehind + joinedPattern + lookahead, 'ig'),
      'rules': rules
    };
  };
  R2L.addRules = function (rules) {
    // Only IE11 lacks Regex negative lookbehind - still in use in Word2016
    var hasNegativeLookbehind = (0, _functions.supportNegativeLookbehind)();
    console.debug("Negative lookbehind support", hasNegativeLookbehind);
    _runtimeRules = [];
    rules.forEach(function (_rule) {
      // Our patterns use negative lookbehind for improved detection. 
      // If it is not supported by the underlying platform we need to remove these parts from the patterns as they will not compile.
      if (!hasNegativeLookbehind) {
        var r = new RegExp("\\(\\?<!((?!\\)).)+\\)", "g");
        //replace pattern
        _rule.p = _rule.p.replace(r, "");
        if (_rule.ip) {
          //replace item pattern
          _rule.ip = _rule.ip.replace(r, "");
        }
      }
      R2L.addRule(_rule);
    });
    R2L.getAllRules().map(function (rule) {
      // append common targets if needed
      if (rule.commonRules.length > 0) {
        rule.views = rule.views.map(function (v) {
          v.common = false;
          return v;
        });
        rule.commonRules.map(function (commonRuleType) {
          var commonRule = R2L.getAllRules().filter(function (r) {
            return r.type === commonRuleType;
          }).pop();
          var views = commonRule ? commonRule.views : null;
          if (views) {
            views = views.map(function (v) {
              // common views have a flag
              v.common = true;
              return v;
            });
            rule.views = rule.views.concat(views);
            if (rule.itemRule) {
              rule.itemRule.views = rule.views;
            }
          }
        });
      } else {
        rule.views = rule.views.map(function (view) {
          view.common = false;
          return view;
        });
      }
    });
  };
  R2L.reloadRules = function () {
    _ref2linkRules = [];
    this.addRules(JSON.parse(_lzstring["default"].decompressFromBase64(R2L.getConstant("R2L_TYPED_RULES"))));
  };
  R2L.addRule = function (ruleSpecs) {
    var rule = R2L.compileRule(ruleSpecs);
    if (!rule) {
      return;
    }
    rule.allowTitle = !!rule.allowTitle && R2L.options.enableSpecialRules;
    _ref2linkRules.push(rule);
    R2L.globalMatches = {}; // at least one rule changed; reset all matches
  };
  R2L.getNamedRule = function (name) {
    if (_namedPatterns.hasOwnProperty(name)) {
      return _namedPatterns[name];
    }
    var namedRule;
    _ref2linkRules.forEach(function (rule, i) {
      if (rule.name === name) {
        namedRule = rule;
        return false;
      }
    });
    if (namedRule) {
      return namedRule;
    }
    return null;
  };
  R2L.getRules = function (filters) {
    if (!_runtimeRules.length) {
      _runtimeRules = R2L.getFilteredRules(filters || R2L.filters, true);
    }
    return _runtimeRules;
  };
  R2L.getAllRules = function () {
    return _ref2linkRules;
  };
  R2L.getConverterRules = function () {
    var rules = [];
    _ref2linkRules.forEach(function (_ref2linkRule) {
      if (_ref2linkRule.converter) {
        rules.push(_ref2linkRule);
      }
    });
    return rules;
  };
  R2L.getFilteredRules = function (filters, includePublic) {
    var _this = this;
    var rules = [];
    _ref2linkRules.forEach(function (_ref2linkRule) {
      if (!_this.options.enableSpecialRules && _ref2linkRule.forced) {
        return;
      }
      if (_ref2linkRule.converter) {
        return;
      }

      /** filter rules */
      if (!filters.hasOwnProperty('types') || !filters.types || !filters.types.length || filters.types.indexOf(_ref2linkRule.type) >= 0) {
        var rule = Object.assign({}, _ref2linkRule),
          views = [],
          foundView = false;
        rule.views = views;
        (_ref2linkRule.views || []).forEach(function (_view) {
          /** if filters types is false then include it if has the right env */
          var isPublic = includePublic && _view.environments.indexOf('*') >= 0,
            hasEnv = isPublic || !!(0, _functions.intersect)(filters.environments, _view.environments).length,
            hasTarget = !filters.hasOwnProperty('targets') || !filters.targets || !filters.targets.length || filters.targets.indexOf(_view.target) >= 0,
            isTargetAllowed = hasEnv && filters.types === false;
          if ((hasEnv || isPublic) && (hasTarget || isTargetAllowed)) {
            views.push(Object.assign({}, _view));
            foundView = true;
          }
        });

        // only table view - do not include rule
        if (views.length === 1 && views[0].target === "table") {
          foundView = false;
        }
        if (foundView) {
          views.sort(_index.orderSorter);
          rules.push(rule);
        }
      }
    });
    rules.sort(_index.orderSorter);
    return rules;
  };
  R2L.getGlobalTypes = function () {
    var types = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      if (!_ref2linkRule.type) {
        return;
      }
      types[_ref2linkRule.type] = _ref2linkRule.ruleLibelle || _ref2linkRule.name;
    });
    return types;
  };
  R2L.getGlobalTargets = function () {
    var targets = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      _ref2linkRule.views.forEach(function (_view) {
        targets[_view.target] = _view.target;
      });
    });
    return targets;
  };
  R2L.getGlobalTypeTargets = function () {
    var data = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      if (!_ref2linkRule.type) {
        return;
      }
      var type = _ref2linkRule.type;
      var label = _ref2linkRule.ruleLibelle || _ref2linkRule.name;
      data[type] = [];
      _ref2linkRule.views.forEach(function (_view) {
        // we exclude the common views
        if (_ref2linkRule.common || !_view.common) {
          data[type].push({
            target: _view.target,
            label: label
          });
        }
      });
    });
    return data;
  };
  R2L.getBaseTypeTargets = function () {
    var data = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      if (!_ref2linkRule.type) {
        return;
      }
      var baseType = _ref2linkRule.baseType || _ref2linkRule.type;
      var label = _ref2linkRule.baseLibelle || _ref2linkRule.ruleLibelle || _ref2linkRule.name;
      data[baseType] = data[baseType] || {
        targets: [],
        types: [],
        label: label
      };
      data[baseType].types.push(_ref2linkRule.type);
      _ref2linkRule.views.forEach(function (_view) {
        if (_ref2linkRule.common || !_view.common) {
          data[baseType].targets.push({
            target: _view.target,
            baseTarget: _view.baseTarget,
            baseLabel: label,
            label: _ref2linkRule.ruleLibelle || _ref2linkRule.name
          });
        }
      });
    });
    return data;
  };
  R2L.getFiltersWithDependencies = function () {
    var byEnv = {};
    var byRule = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      var rule = _ref2linkRule;
      if (!byRule.hasOwnProperty(rule.type)) {
        byRule[rule.type] = [];
      }
      (_ref2linkRule.views || []).forEach(function (_view) {
        var view = _view;
        (_view.environments || []).forEach(function (_env) {
          if (!byEnv.hasOwnProperty(_env)) {
            byEnv[_env] = {
              types: [],
              targets: []
            };
          }
          if (byEnv[_env].types.indexOf(rule.type) < 0) {
            byEnv[_env].types.push(rule.type);
          }
          if (byEnv[_env].targets.indexOf(view.target) < 0) {
            byEnv[_env].targets.push(view.target);
          }
        });
        byRule[rule.type].push(view.target);
      });
    });
    return {
      byEnvironment: byEnv,
      byRule: byRule
    };
  };
  R2L.getGlobalEnvironments = function () {
    var envs = {};
    _ref2linkRules.forEach(function (_ref2linkRule) {
      _ref2linkRule.views.forEach(function (_view) {
        _view.environments.forEach(function (_env) {
          envs[_env] = _env;
        });
      });
    });
    envs['*'] = 'Public';
    return envs;
  };
  R2L.compileGuards = function (rules) {
    var map = {};
    for (var i = 0; i < rules.length; i++) {
      if (rules[i]["guard-pattern"]) {
        if (!map[rules[i]["guard-pattern"]]) {
          map[rules[i]["guard-pattern"]] = {
            ruleTypes: [],
            found: false
          };
        }
        map[rules[i]["guard-pattern"]].ruleTypes.push(rules[i].type);
      }
    }
    return map;
  };

  /**
   * Optimize detection by dropping useless rules according to guard patterns.
   * Use case: 
   *   The EUR-Lex act rule has a guard pattern that looks for a (directive|regulation|resolution|common position) label in the input text. 
   *   If the input text does not contain this label it makes no sense to attempt matching the EUR-Lex act rule at all as it will definitely not find anything.
   *   This quick lookup for the label is very fast and can improve detection speed significantly.  
   * 
   * @see <guard-pattern> definitions in the XML rules (eg. `eurlex/rule_act.xml`)
   * 
   * @param string text
   * @param Object[] rules
   */
  R2L.runGuards = function (text, rules) {
    var letterPattern = "[0-9" + _letters.letters.latin + _letters.letters.cyrillic + _letters.letters.greek + _letters.letters.specialChars + "]";
    var lookahead = (0, _functions.getLookAhead)(letterPattern);
    var guards = this.compileGuards(rules);
    for (var pattern in guards) {
      var reg = new RegExp(pattern + lookahead, "i");
      if (!reg.test(text)) {
        rules = rules.filter(function (rule) {
          return guards[pattern].ruleTypes.indexOf(rule.type) === -1;
        });
      }
    }
    console.debug("Guard check done");
    // applying pattern optimizers based on text. 
    // @see R2L.settings.patternOptimizers

    var t0 = performance.now();
    Object.keys(R2L.settings.patternOptimizers || {}).forEach(function (optimizerKey) {
      var optimizers = R2L.settings.patternOptimizers[optimizerKey];
      console.debug("[PATTERN OPTIMIZERS] Running for key:", optimizerKey);
      // Each optmizer runs only once
      var handled = false;
      optimizers.forEach(function (optimizer) {
        if (handled) {
          return;
        }
        var found = optimizer.guardRegExp.test(text);
        console.debug("[PATTERN OPTIMIZERS] Found extended pattern?", found, optimizer.guardRegExp);
        if (found) {
          return;
        }
        console.debug("[PATTERN OPTIMIZERS] Proceed with replacement");
        var searchRegExp = new RegExp((0, _functions.regExpEscape)(optimizer.searchSubpattern), 'g');
        var replaceSubpattern = optimizer.replaceSubpattern;
        handled = true;
        rules = rules.map(function (rule) {
          var newRule = _objectSpread({}, rule); //deep copy
          var replacedPatternSource = newRule.pattern.source.replace(searchRegExp, replaceSubpattern);
          var replacedFullPatternSource = newRule.fullPattern.source.replace(searchRegExp, replaceSubpattern);
          newRule.pattern = new RegExp(replacedPatternSource, newRule.pattern.flags);
          newRule.fullPattern = new RegExp(replacedFullPatternSource, newRule.fullPattern.flags);
          if (newRule["item-pattern"]) {
            var replacedItemPattern = newRule["item-pattern"].replace(searchRegExp, replaceSubpattern);
            newRule["item-pattern"] = replacedItemPattern;

            // Update Item rule
            if (newRule.itemRule) {
              var replacedItemPatternSource = newRule.itemRule.pattern.source.replace(searchRegExp, replaceSubpattern);
              var replacedFullItemPatternSource = newRule.itemRule.fullPattern.source.replace(searchRegExp, replaceSubpattern);
              newRule.itemRule = _objectSpread({}, newRule.itemRule); // deep copy
              newRule.itemRule.pattern = new RegExp(replacedItemPatternSource, newRule.itemRule.pattern.flags);
              newRule.itemRule.fullPattern = new RegExp(replacedFullItemPatternSource, newRule.itemRule.fullPattern.flags);
            }
          }

          // deep copy
          return newRule;
        });
      });
    });
    console.debug("[PATTERN OPTIMIZERS] DONE", performance.now() - t0, "ms");
    return rules;
  };
  R2L.lintRule = function (rule) {
    var result = {
      warnings: [],
      errors: []
    };
    try {
      rule.pattern = new RegExp(rule.pattern, "gm" + (rule.casesensitive ? '' : 'i'));
      if (rule.hasOwnProperty('fullPattern') && rule.fullPattern) {
        rule.fullPattern = new RegExp(rule.fullPattern, 'gm' + (rule.casesensitive ? '' : 'i'));
      }
    } catch (e) {
      if (('' + e).toLowerCase().indexOf('invalid escape') >= 0) {
        result.warnings.push('' + e);
      } else {
        result.errors.push('' + e);
      }
    }
    return result;
  };
  R2L.compileRule = function (rule, noUnpacking) {
    rule.allowTitle = rule.allowTitle && R2L.options.enableSpecialRules !== false;
    var unpack = noUnpacking ? false : true;
    if (unpack) {
      var unpackedRule = {};
      Object.keys(rK).forEach(function (destKey) {
        unpackedRule[destKey] = rule[rK[destKey]];
      });
      if (unpackedRule.hasOwnProperty('views') && Array.isArray(unpackedRule.views)) {
        var unpackedViews = [],
          unpackedView;
        unpackedRule['views'].forEach(function (_view) {
          var view = _view;
          unpackedView = {};
          Object.keys(rV).forEach(function (destKey) {
            unpackedView[destKey] = view[rV[destKey]];
          });
          unpackedViews.push(unpackedView);
        });
        unpackedRule['views'] = unpackedViews;
      }
      rule = unpackedRule;
    }
    var linterResult = R2L.lintRule(rule);
    rule.errors = linterResult.errors;
    rule.warnings = linterResult.warnings;
    var fullPatternCompiler = function fullPatternCompiler(rule) {
      if (rule.hasOwnProperty('type') && rule.type) {
        rule.allowTitle = !!rule.allowTitle && R2L.options.enableSpecialRules;
        var forced = rule.hasOwnProperty('forced') && rule.forced ? '' : '?';
        var typePattern = '(' + (rule.forced && !R2L.options.enableSpecialRules ? '1jf9jqgk' : (0, _functions.regExpEscape)(rule.type)) + ')';
        var simplifiedPattern = (0, _functions.getNonCapturingPattern)(rule.pattern.source || rule.pattern);
        var titlePattern = '[^\\]]+?';
        var beginning = rule.allowTitle ? '\\[' + forced : '';
        var ending = rule.allowTitle ? '\\]' + forced : '';

        /**
         * $1 - type, $2 - match, $3 - title, $4 - match
         */
        var expr = '(?:' + typePattern + forced + '(?:' + '(?:' + '\\[' + '(' + (rule.allowTitle ? simplifiedPattern : 'm2CVjK') + ')' + '\\s?\\|\\s?' + '(' + titlePattern + ')' + '\\s?\\]' + ')' + '|' + '(?:' + beginning + '(' + simplifiedPattern + ')' + ending + ')' + ')' + ')';
        try {
          return new RegExp(expr, 'gi');
        } catch (e) {
          console.error(rule.type, e);
          return null;
        }
      }
      return rule.pattern;
    };
    rule.fullPattern = fullPatternCompiler(rule);
    if (!rule.fullPattern) {
      return null;
    }
    rule.matches = function (text) {
      return rule.pattern.test(text);
    };
    if (rule["item-pattern"]) {
      rule.itemRule = R2L.compileRule({
        name: rule.name + '-item',
        pattern: rule["item-pattern"],
        skipPattern: rule["skip-pattern"],
        trimPattern: rule["trim-pattern"],
        fullPattern: fullPatternCompiler({
          force: rule.itemForced,
          pattern: rule['item-pattern']
        }),
        type: rule['itemType'],
        ld: rule['ld'],
        baseType: rule["baseType"],
        baseLibelle: rule["baseLibelle"],
        forced: rule['itemForced'],
        ruleLibelle: rule["ruleLibelle"] + ' item',
        prefix: rule["prefix"],
        skip: rule["skip"],
        vars: rule["vars"],
        identifiers: rule["identifiers"],
        coreIdentifiers: rule["coreIdentifiers"],
        commonRules: rule["commonRules"],
        shared: rule["shared"],
        views: rule.views,
        isListItem: true
      }, true);
    }
    if (rule.hasOwnProperty('views') && Array.isArray(rule.views)) {
      rule.views.sort(_index.orderSorter);
      rule.views.forEach(function (_view) {
        // use R2L.converters.* to prefix functions
        var converterNames = Object.keys(_converters.converters).sort(function (a, b) {
          return a.length > b.length ? -1 : 1;
        });
        if (_view.template !== "function(){return '{{ $match }}';}") {
          if (typeof _view.template === 'string') {
            converterNames.forEach(function (converterName) {
              _view.template = _view.template.replace(new RegExp('(?<!\\.)' + converterName + '\\(', 'g'), 'R2L.converters.' + converterName + '(');
            });
          }
          try {
            eval(' _view.template = function(){ return (' + _view.template + ').apply(this, arguments);}');
          } catch (e) {
            console.error(e);
            throw e;
          }
        } else {
          _view.template = function () {
            return arguments;
          };
        }
        if (_view.hasOwnProperty('condition')) {
          if (typeof _view.condition === 'string') {
            converterNames.forEach(function (converterName) {
              _view.condition = _view.condition.replace(new RegExp('(?<!\\.)' + converterName + '\\(', 'g'), 'R2L.converters.' + converterName + '(');
            });
          }
          try {
            eval('_view.condition = function(){ return (' + (_view.condition ? _view.condition : 'function(){return true;}') + ').apply(this, arguments);}');
          } catch (e) {
            console.error(e);
            throw e;
          }
        } else {
          _view.condition = function () {
            return true;
          };
        }
      });
    }
    rule.compiled = true;
    return rule;
  };
  R2L.applyRule = function (text, rule, overrideTitle, wholeMatch, history, overrideMatches) {
    var rawReference = text.trim();
    wholeMatch = wholeMatch.trim();
    var p = rule.pattern.source;
    if (rule.forced) {
      p = '(?:' + rule.type + '\\s*\\[\\s*(?:' + p + '(?:\\s*\\|\\s*(?:[^\\]]+))?' + ')\\s*\\])';
    }
    var pattern = new RegExp(p, 'gm' + (rule.casesensitive ? '' : 'i')),
      args = overrideMatches ? overrideMatches : pattern.exec(rawReference),
      ref2link = {
        rule: rule,
        match: rawReference,
        views: {},
        alternatives: [],
        matches: [],
        offsets: [],
        counter: 0,
        reference: text,
        link: overrideTitle || text,
        wholeMatch: wholeMatch || text
      };
    if (!args) {
      return null;
    }
    ref2link.reference = args[1];
    ref2link.matches = args;
    if (history.length > 0) {
      for (var index = history.length - 1; index >= 0; index--) {
        var listRef = (0, _list.getListCore)(history[index].rule, history[index].matches);
        if (listRef.length > 0) {
          (0, _list.cloneListCore)(history[index], ref2link);
          (0, _list.cloneListIdentifiers)(history[index], ref2link);
          break;
        }
      }
      args = ref2link.matches;
    }

    /** Could be an inverted list so if the item still has no prefix/data don't bother */
    if (rule.isListItem) {
      var listRef = (0, _list.getListCore)(rule, ref2link.matches);
      if (listRef.length === 0) {
        /** Cannot render item, we need to get to the end of the list */
        return ref2link;
      }
    }
    rule.views.sort(_index.orderSorter);
    var contextObj = {
      data: {}
    };
    rule.views.forEach(function (_view) {
      var viewName = _view.target;
      var isEnabled = ((0, _functions.intersect)(R2L.filters.environments, _view.environments).length || _view.environments.indexOf('*') >= 0) && (!R2L.filters.targets || !R2L.filters.targets.length || R2L.filters.targets.indexOf(_view.target) >= 0) && (!R2L.filters.types || !R2L.filters.types.length || R2L.filters.types.indexOf(rule.type) >= 0);

      // Check if there are any custom target options to be applied
      var _currentViewAttributes = R2L.getViewAttributes(_view.baseTarget || _view.target);
      if (isEnabled && _view.condition.apply(contextObj, args)) {
        ref2link.views[viewName] = _view.template.apply(contextObj, args);

        // append the attributes of the view to the args so they can be subsequently reused
        var attributes = (0, _functions.extractAttributes)(Object.values(ref2link.views));
        Object.keys(attributes).forEach(function (key) {
          var cleanKey = key.replace('data-ref-', '');
          cleanKey = cleanKey.replace('data-', '');
          contextObj.data[cleanKey] = attributes[key];
        });

        /**                
         * keep a map of initial match and what was rendered
         * han and curiaj rule render something different than it matches
         */
        var $rendered = (0, _jquery.$)('<div></div>').append(ref2link.views[viewName]),
          renderedText;
        $rendered.find(R2L.settings.classSimple).each(function () {
          var $view = (0, _jquery.$)(this);
          $view.addClass(R2L.settings.generatedClassName);
          $view.attr('id', 'r2l-' + (0, _functions.getUuid)());
          R2L.linkClassName && $view.addClass(R2L.linkClassName);
          if (R2L.viewUsesTarget) {
            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).attr('target', '_blank');
          } else {
            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).removeAttr('target');
          }
          if ((R2L.viewTitlePrefix || R2L.viewTitleSuffix) && $view.attr('title')) {
            var titleParts = [(R2L.viewTitlePrefix || '').toString(), $view.attr('title').toString(), (R2L.viewTitleSuffix || '').toString()];
            $view.attr('title', titleParts.join(' ').trim());
          }
          if (overrideTitle) {
            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).html(overrideTitle);
          }
          $view.attr(R2L.settings.dataInitialAttribute, wholeMatch);
          if (_currentViewAttributes && _typeof(_currentViewAttributes) === 'object') {
            Object.keys(_currentViewAttributes).forEach(function (key) {
              $view.attr(key, _currentViewAttributes[key]);
            });
          }
        });
        ref2link.views[viewName] = $rendered.html();
        ref2link.alternatives.push({
          rule: _objectSpread(_objectSpread({}, rule), {
            pattern: null,
            fullPattern: null
          }),
          view: ref2link.views[viewName],
          viewName: viewName,
          match: text,
          order: _view.order,
          common: _view.common,
          groupTarget: _view.groupTarget,
          reference: args[1],
          link: overrideTitle || text,
          wholeMatch: wholeMatch || text
        });
        renderedText = overrideTitle || $rendered.find('[href]').text();
        R2L.globalViews[renderedText] = wholeMatch || text;
      }
    });
    return ref2link;
  };
  R2L.getGlobalMatch = function (match, context) {
    return this.globalMatches[context] && this.globalMatches[context][match] ? this.globalMatches[context][match] : {};
  };
  R2L.setGlobalMatches = function (matches) {
    var _this2 = this;
    Object.keys(matches).forEach(function (_match) {
      var offsets = matches[_match] ? matches[_match].offsets : [];
      for (var i = 0; i < offsets.length; i++) {
        var offset = offsets[i];
        if (!_this2.globalMatches[offset.context]) {
          _this2.globalMatches[offset.context] = {};
        }

        /** Deep clone the match **/
        var newMatch = {
          alternatives: offset.alternatives,
          views: offset.views,
          context: offset.context,
          rule: _objectSpread(_objectSpread({}, matches[_match].rule), {
            pattern: null,
            fullPattern: null
          }),
          //without patterns
          match: matches[_match].match,
          offsets: matches[_match].offsets,
          reference: matches[_match].reference
        };
        _this2.globalMatches[offset.context][offset.match] = newMatch;
      }
    });
  };
  try {
    R2L.addRules(JSON.parse(_lzstring["default"].decompressFromBase64(R2L.getConstant("R2L_TYPED_RULES"))));
  } catch (e) {
    console.error(e);
  }
}

},{"../jquery.js":9,"../utils/base64.js":52,"../utils/converters.js":53,"../utils/functions.js":56,"../utils/letters.js":57,"../utils/list.js":58,"../utils/lzstring.js":59,"../ux/index.js":63}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.viewOptions = exports.settings = exports.SPARQL_SLOW_MODE = exports.SPARQL_OPTIMAL_MODE = exports.SPARQL_FAST_MODE = exports.SPARQL_EXPERT_MODE = exports.LD_MODE_SEQ_NUMBER = exports.LD_MODE_METADATA = exports.LD_MODE_CHECK_EXISTS = exports.LD_MODE_ALL = exports.LD_ADVANCED_MODE_SHORT_TITLES = exports.LD_ADVANCED_MODE_KM_HANDOC = exports.LD_ADVANCED_MODE_KM_CIS = exports.LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT = exports.LD_ADVANCED_MODE_CORRECTIONS = void 0;
/**
 * Pattern optimizers!
 */
var PATTERN_OPTIMIZERS = {
  /** 
   * Checks if other char codes than '32' have been used for space within the text.
   * If not, we can reduce the {{ non_breaking_space }} pattern to just `(?: )`
   * 
   * NOTE: The `searchSubpattern` must match the defined {{ non_breaking_space }} pattern. 
   * 
   * IMPORTANT! Do not modify the {{ non_breaking_space }} pattern definition without modifying the optimizer. If done so the optimizers will never be used. 
   */
  space: [{
    guardRegExp: /(?:[\u00a0\u202F]|(?:\x26(?:amp;)?nbsp;))/,
    searchSubpattern: "(?:[\\u00a0\\u202F ]|(?:(?:\\x26(?:amp;)?)nbsp;))",
    replaceSubpattern: "(?: )"
  }, {
    guardRegExp: /(?:[\u00a0\u202F]|(?:(?:\x26)amp;nbsp;))/,
    searchSubpattern: "(?:[\\u00a0\\u202F ]|(?:(?:\\x26(?:amp;)?)nbsp;))",
    replaceSubpattern: "(?: |(?:\\x26nbsp;))"
  }],
  quote: [{
    guardRegExp: /[\u02b9\u02bb\u02bf\u02c8\u02ca\u02cb\u02f4\u0384\u0374\u2018\u2019\u201b\u2032\u2035]/,
    searchSubpattern: "\\u02b9\\u02bb\\u02bf\\u02c8\\u02ca\\u02cb\\u02f4\\u0384\\u0374\\u2018\\u2019\\u201b\\u2032\\u2035",
    replaceSubpattern: ""
  }]
};

/**
 * Ref2Link settings are stored in this variable, also accessible via the API at `R2L.settings`;
 */
var settings = exports.settings = {
  /**
   * The constants are parameters loaded from a compiled rules JSON file. They contain the rule patterns, language and view options.
   */
  constants: {
    'R2L_RULE_MAP': '{"casesensitive":"c","converter":"cv","forced":"f","allowTitle":"at","customTitle":"ct","allowAttribute":"aa","guard-pattern":"gp","skip-pattern":"sp","strict-pattern":"stp","trim-pattern":"tp","item-pattern":"ip","itemForced":"g","itemType":"y","name":"n","base":"bs","order":"o","pattern":"p","ruleLibelle":"r","baseLibelle":"bl","type":"t","baseType":"bt","subtype":"st","views":"v","footnotes":"fo","prefix":"lp","skip":"lk","shared":"ls","slots":"sl","ld":"ld","coreIdentifiers":"cli","identifiers":"li","vars":"lv","commonRules":"cr","common":"cm"}',
    'R2L_VIEW_MAP': '{"condition":"x","ldCondition":"ldx","groupTarget":"gt","environments":"e","libelle":"l","order":"d","target":"a","baseTarget":"ba","template":"m","_default":"_"}',
    'R2L_VERSION': '1.3.29',
    'R2L_BUILD_INFO': 'undefined',
    'R2L_CSS_MAP': '{"ref2link.css":"LnJlZjJsaW5rLXRvb2x0aXAgewoJcG9zaXRpb246IGFic29sdXRlOwoJZGlzcGxheTogYmxvY2s7CiAgICBiYWNrZ3JvdW5kOiB3aGl0ZTsKICAgIGJvcmRlcjogMXB4IHNvbGlkICNlZWU7Cgl2aXNpYmlsaXR5OiB2aXNpYmxlOwoJcGFkZGluZzogMnB4OwoJY29sb3I6ICMzMzM7Cglmb250LXNpemU6IDEuMXJlbTsKCWN1cnNvcjogZGVmYXVsdDsKCW92ZXJmbG93OiBoaWRkZW47CiAgICBtaW4td2lkdGg6IDE2cmVtOwogICAgbWF4LXdpZHRoOiAzMHJlbTsKCS13ZWJraXQtYm94LXNoYWRvdzogMTBweCAxMHB4IDVweCAtNXB4IHJnYmEoMjgsIDI4LCAyOCwgMC41KTsKCS1tb3otYm94LXNoYWRvdzogMTBweCAxMHB4IDVweCAtNXB4IHJnYmEoMjgsIDI4LCAyOCwgMC41KTsKCWJveC1zaGFkb3c6IDEwcHggMTBweCA1cHggLTVweCByZ2JhKDI4LCAyOCwgMjgsIDAuNSk7Cn0KCi5yZWYybGluay10b29sdGlwIC50YWJsZSB7CiAgICBtYXJnaW4tYm90dG9tOiAwcHg7CiAgICBmb250LXNpemU6IDEycHg7CiAgICB3aWR0aDogMTAwJTsKICAgIGJvcmRlci1jb2xsYXBzZTogY29sbGFwc2U7IAp9CgoucmVmMmxpbmstdG9vbHRpcCAuYWN0aXZlIHRkIHsKCWJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50ICFpbXBvcnRhbnQ7Cn0KCi5yZWYybGluay10b29sdGlwIC50YWJsZSAucm93IHsKCWJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjQ0ZDRkNGOwoJbWFyZ2luOiAwIDAgNHB4IDA7CiAgICBjdXJzb3I6IHBvaW50ZXI7Cn0KCi5yZWYybGluay10b29sdGlwIC50YWJsZSAucm93OjpiZWZvcmUgewogICAgY29udGVudDogbm9uZSAhaW1wb3J0YW50Owp9CgoucmVmMmxpbmstdG9vbHRpcCAudGFibGUgLnJvdz4qIHsKCW92ZXJmbG93OiBoaWRkZW47Cn0KCi5yZWYybGluay10b29sdGlwIC50YWJsZSAucm93ID4gdGQgewogICAgYm9yZGVyLXRvcDogbm9uZTsKICAgIGxpbmUtaGVpZ2h0OiAyMHB4OwogICAgcGFkZGluZy10b3A6IC43NXJlbTsKICAgIHBhZGRpbmctYm90dG9tOiAuNzVyZW07Cn0KCi5yZWYybGluay10b29sdGlwIC50YWJsZTpsYXN0LW9mLXR5cGUgLnJvdzpsYXN0LW9mLXR5cGUgewoJYm9yZGVyLWJvdHRvbS13aWR0aDogMDsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLnRhYmxlLWhlYWRlciB7CiAgICBjdXJzb3I6IGhlbHA7Cn0KCi5yZWYybGluay10b29sdGlwIC5oZWFkaW5nIHsKCWN1cnNvcjogZGVmYXVsdDsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLnRhYmxlLWhlYWRlcjpob3ZlciB7CgliYWNrZ3JvdW5kLWNvbG9yOiBpbmhlcml0ICFpbXBvcnRhbnQ7Cn0KCi5yZWYybGluay10b29sdGlwIGlbZGF0YS1hY3Rpb249cHJldmlld10gewoJbWluLXdpZHRoOiAyMHB4OwoJdGV4dC1hbGlnbjogY2VudGVyOwoJaGVpZ2h0OiAxLjVyZW07Cn0KCi5yZWYybGluay10b29sdGlwIC5jb2wtYWN0aW9ucz4qLAoucmVmMmxpbmstdG9vbHRpcCBpW2RhdGEtYWN0aW9uPXByZXZpZXddLAoucmVmMmxpbmstdG9vbHRpcCBpW2RhdGEtZmxhZ10gewoJZGlzcGxheTogbm9uZTsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLmFjdGl2ZS1pbmRpY2F0b3I6aG92ZXIgaVtkYXRhLWFjdGlvbj1wcmV2aWV3XSwKCS5yZWYybGluay10b29sdGlwIC5hY3RpdmUgLmNvbC1hY3Rpb25zPi5ybC1saW5rLCAucmVmMmxpbmstdG9vbHRpcCAuYWN0aXZlLWluZGljYXRvcjpob3ZlciAuY29sLWFjdGlvbnM+LnJsLWxpbmssCgkucmVmMmxpbmstdG9vbHRpcCAuYWN0aXZlIFtkYXRhLWZsYWc9YWN0aXZlXSB7CglkaXNwbGF5OiBibG9jazsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLmFjdGl2ZS1pbmRpY2F0b3I6aG92ZXIgaVtkYXRhLWFjdGlvbj1wcmV2aWV3XSB7Cglwb3NpdGlvbjogYWJzb2x1dGU7CglyaWdodDogMDsKCXRvcDogMDsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLnRhYmxlICsgLnJlZjJsaW5rLXRvb2x0aXAgLnRhYmxlOmJlZm9yZSB7CglkaXNwbGF5OmJsb2NrOwoJaGVpZ2h0OiAxNXB4OwoJY29udGVudDogIiAiOwoJY2xlYXI6Ym90aDsKfQoKLyogTGlua2VkIGRhdGEgQ1NTICovCi5yZWYybGluay10b29sdGlwIC5iaWcgewoJZm9udC1zaXplOiAxM3B4OwogICAgZm9udC13ZWlnaHQ6IDQwMDsKICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjQ0ZDRkNGOwp9Ci5yZWYybGluay10b29sdGlwIC5iaWcgPiB0ZCB7CiAgICBwYWRkaW5nOiAuNXJlbTsKfQoKLnJlZjJsaW5rLXRvb2x0aXAgLnIybC10aXRsZSB7CiAgICB3aGl0ZS1zcGFjZTogcHJlLXdyYXA7Cn0KCi5yZWYybGluay10b29sdGlwIC5yMmwtZm9yY2VbZGF0YS1zdGF0dXM9JyddIHsKICAgIGRpc3BsYXk6IG5vbmU7Cn0KLnJlZjJsaW5rLXRvb2x0aXAgLnIybC1mb3JjZSAuYnVsbGV0IHsKICAgIGRpc3BsYXk6IGlubGluZS1ibG9jayAhaW1wb3J0YW50OwogICAgd2lkdGg6IDEwcHg7CiAgICBoZWlnaHQ6IDEwcHg7CiAgICBib3JkZXItcmFkaXVzOiA1MCU7Cn0KLnJlZjJsaW5rLXRvb2x0aXAgLnIybC1mb3JjZSAuYnVsbGV0OmFmdGVyIHsKICAgIG1hcmdpbi1sZWZ0OiA1cHg7Cn0KLnJlZjJsaW5rLXRvb2x0aXAgLnIybC1mb3JjZVtkYXRhLXN0YXR1cz1wZW5kaW5naW5mb3JjZV0gLmJ1bGxldCB7CiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjRURDQjA5Owp9Ci5yZWYybGluay10b29sdGlwIC5yMmwtZm9yY2VbZGF0YS1zdGF0dXM9aW5mb3JjZV0gLmJ1bGxldCB7CiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjNjI4ZTU3Owp9Ci5yZWYybGluay10b29sdGlwIC5yMmwtZm9yY2VbZGF0YS1zdGF0dXM9bm90aW5mb3JjZV0gLmJ1bGxldCB7CiAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjQ0ZDRkNGOwp9Ci5yZWYybGluay10b29sdGlwIC5yMmwtZm9yY2VbZGF0YS1zdGF0dXM9bm9sb25nZXJpbmZvcmNlXSAuYnVsbGV0IHsKICAgIGJhY2tncm91bmQtY29sb3I6ICNkYTIxMzA7Cn0KCi8qIHRpdGxlIHN0YXR1cyBDU1MgKi8KLnJlZjJsaW5rLXRvb2x0aXAgLnIybC10aXRsZS1zdGF0dXNbZGF0YS1zdGF0dXM9ZXJyb3JdIHsKICAgIGNvbG9yOiAjZGEyMTMwOwogICAgbWFyZ2luLXRvcDogNXB4Owp9Ci5yZWYybGluay10b29sdGlwIC5yMmwtdGl0bGUtc3RhdHVzW2RhdGEtc3RhdHVzPXBlbmRpbmddIHsKICAgIGhlaWdodDogMzVweDsKfQoucmVmMmxpbmstdG9vbHRpcCAucjJsLXRpdGxlLXN0YXR1c1tkYXRhLXN0YXR1cz1pbmZvXSB7CiAgICBtYXJnaW4tdG9wOiA1cHg7CiAgICBvcGFjaXR5OiAwLjU7Cn0KCi5yMmwtbG9hZGluZy1iYXItc3Bpbm5lci5zcGlubmVyIHsKICAgIHdpZHRoOiAyMHB4OwogICAgaGVpZ2h0OiAyMHB4OwogICAgbWFyZ2luLWxlZnQ6IC0zNXB4OwogICAgZGlzcGxheTogaW5saW5lLWZsZXg7CiAgICBhbmltYXRpb246IGxvYWRpbmctYmFyLXNwaW5uZXIgNDAwbXMgbGluZWFyIGluZmluaXRlOwp9CgoucjJsLWxvYWRpbmctYmFyLXNwaW5uZXIuc3Bpbm5lciAuc3Bpbm5lci1pY29uIHsKICAgIHdpZHRoOiAyMHB4OwogICAgaGVpZ2h0OiAyMHB4OwogICAgYm9yZGVyOiAgc29saWQgMXB4IHRyYW5zcGFyZW50OwogICAgYm9yZGVyLXRvcC1jb2xvcjogICMwMDQ0OTQgIWltcG9ydGFudDsKICAgIGJvcmRlci1sZWZ0LWNvbG9yOiAjMDA0NDk0ICFpbXBvcnRhbnQ7CiAgICBib3JkZXItcmFkaXVzOiA1MCU7Cn0KCkBrZXlmcmFtZXMgbG9hZGluZy1iYXItc3Bpbm5lciB7CiAgMCUgICB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9CiAgMTAwJSB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH0KfQ=="}',
    'R2L_VIEW_OPTIONS': '{ "viewUsesTarget": true, "viewTitleSuffix": "", "viewTitlePrefix": "to", "linkClassName": "" }',
    'R2L_NAMED_PATTERNS': 'W10=',
    'R2L_TYPED_RULES': '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IT/a1jqt2skBRIH/O1Tai9rTWtM79jrbOhS7cdosO8vb6LuhOyUEmLtgDdg7iDuTDUQ66BtDOtC6B1CkOzC7jhtkO0068LvjW747EzuIuvMrATs02kS7QTtdO8S6aLo9O046RQC9O8MhiFrhO646CrqcOnlb4Ek4ugXrfDtc2zKo+Lvi2mA6szqbO0I7UrpmutI7mTrC2rs7Yjuku3s7ZLti29k7VLpWupS6GTs0upta1Lsy2jS6sTqL2vxbcTtYW3S7Fzuw2jk6BTtXOknaZHHX20y6StolO7faGjqDiGU7Dzvhs2y7hwKv29y6lyicuznb3oiNWnVbHLobgVnaudvvO1AbdTsWGoSypjtRAOqFgbrCuxY6sLo+Oj86v9ol2msomiiNDZsAErsAOpq7SLpauxa7l9uWuua6PdtouqE7NdubUVIg8rp3shC7CrqDOt+yQzvEOp47wzpzDSNbk9pwu9G7aroUOjPafjpyIaAAkzqSuh07ibooutq72zoCYTQD3TssO3M6cDupu8Mhabrgu/K6GbuGuh4beVu72/drMFqmu0tbDrto2466hLtwW1s6lruH26i6RQEku59QjDpkuxI7trr1u7za9rvpO+S7drvJuqdapzv4u/k7Zzoy24o6Ppqdugy77roCIR66jfyFDIHQxTohst676jqlO7IrT1qUWu4r7LpZ2oG6n9rcuvVaE7uGO3y7cbO0WgK6EbsWAJG6n9pRu406qrtjO5srVjq/O2K7GIHxu/46UzpGUFK7xbtoOyW64NHo2446urrlu7K6FbsCIEiDfQwD2xw6A1qKu5C6Wbv/AoRImBvKujC7ObreO7m7C7soG/C76rprDYW6kIWSukA7KNpBO2u70rpWuzK7PTugunEB27uvA+E6hru7uvIaNbpROrW70Trc23W6zrrru5Qh59rxOo27WrqXu526OztWuoFbuzo2ukw6bbtH2na6BLsUux2637qOuh271LubO927aes5OnS6FzsCOvk6AHv9ugO6qjrRBLc7XrpAGiO69zulO6y7swSVIHyMaZDju0/anLsA4e9bL9uVO9B6IbswetO7edoGSeG6grpeYV+4RtuXKl/bwrrRu8e6uBuiuku75tuyGgiBy7uTOnY7mruAuiA7CTuXu8m7V7u6u3q7AiHLDZW76bpYuxC6e7qLyPu7RNoHu546Obrf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',
    'R2L_DEFAULT_LANG_ISO3': '',
    'R2L_AI_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/openai',
    'R2L_FINLEX_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/sparql',
    //'https://ldf.fi/finlex/sparql',
    'R2L_PUBLICATIONS_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/sparql',
    //'http://publications.europa.eu/webapi/rdf/sparql',
    'R2L_CONTENT_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/eurlex',
    'R2L_ALIAS_MAP': {},
    'R2L_EULANG': new Map([['GLE', 'GA'], ['HRV', 'HR'], ['HUN', 'HU'], ['ITA', 'IT'], ['LAV', 'LV'], ['LIT', 'LT'], ['CES', 'CS'], ['POL', 'PL'], ['SLK', 'SK'], ['BUL', 'BG'], ['MLT', 'MT'], ['NLD', 'NL'], ['SLV', 'SL'], ['SPA', 'ES'], ['SWE', 'SV'], ['POR', 'PT'], ['RON', 'RO'], ['DAN', 'DA'], ['DEU', 'DE'], ['ELL', 'EL'], ['ENG', 'EN'], ['EST', 'ET'], ['FIN', 'FI'], ['FRA', 'FR']])
  },
  dataInitialAttribute: 'data-ref2link-initial',
  dataContextAttribute: 'data-ref2link-context',
  parsedAttribute: 'ref2link-parsed',
  dataAttribute: 'data-ref2link',
  "class": 'a.ref2link-generated, [role-link].ref2link-generated',
  classSimple: 'a, [role-link]',
  generatedClassName: 'ref2link-generated',
  multipleGeneratedClassName: 'ref2link-multiple',
  tooltipContainerSelector: 'body',
  maxReferenceLength: 255,
  maxTitleLength: 255,
  views: true,
  viewAttributes: {},
  sort: "position.asc",
  // by default Ref2Link operates in HTML mode. For raw text mode set the `R2L.settings.htmlMode=false`
  htmlMode: true,
  patternOptimizers: PATTERN_OPTIMIZERS,
  getConstant: function getConstant(name) {
    return this.constants[name];
  },
  setConstant: function setConstant(name, value) {
    this.constants[name] = value;
  }
};

/**
 * Ref2Link tooltip template and configuration. Accessible via the API using `R2L.viewOptions`.
 * 
 * Uses moustache templates for variable injection eg. `{{ $title }}`
 */
var viewOptions = exports.viewOptions = {
  useTargetGrouping: true,
  tooltipTrigger: 'mouseenter',
  tooltip: "<div role=\"tooltip\" class=\"ref2link-tooltip\" title=\"\">\n                <div class=\"clearfix\"><div class=\"table-responsive\"><table class=\"table table-condensed table-hover\"></table></div></div>\n            </div>",
  bottomSpacing: 75,
  enhancedHeading: "<thead class=\"row table-header hidden-xs\">\n                        <tr class=\"big r2l-celex\">\n                            <td colspan=\"2\">\n                                <div class=\"r2l-title\">{{ $title }}</div>\n                                <div class=\"r2l-oj\">{{ $oj }}</div>\n                                <div class=\"r2l-force\" data-status=\"{{ $forceStatus }}\"><span class=\"bullet\"></span> <span class=\"label\">{{ $forceLabel }}</span></div>\n                                <div class=\"r2l-eli\">{{ $eli }}</div>\n                            </td>\n                        </tr>\n                    </thead>",
  ruleHeading: '',
  groupRule: "<tr class=\"row active-indicator\" style=\"margin: 5px 0\" data-action=\"toggle\">\n            <td class=\"col-xs-2 r2l-toggle-icon-container\"></td>\n            <td class=\"col-xs-10\">{{ $title }}</td>\n        </tr>",
  rule: "\n        <tr class=\"row active-indicator\" style=\"margin:5px 0\" data-group=\"{{$group}}\">\n            <td class=\"col-xs-2\"></td>\n            <td class=\"col-xs-10\" data-action=\"preview\" title=\"Open link\">\n                <a href=\"{{$href}}\">{{$title}}</a>\n            </td>\n        </tr>",
  alert: '<div class="alert alert-dismissable alert-{{ $alertType }}" role="role"><button type="button" class="close" data-dismiss="alert" aria-label="Close">' + '<span aria-hidden="true">&times;</span>' + '</button>' + '{{ $msg }}' + '</div>',
  mode: 'view'
};

/** DEPRECATED SPARQL query modes */
var SPARQL_OPTIMAL_MODE = exports.SPARQL_OPTIMAL_MODE = 1;
var SPARQL_FAST_MODE = exports.SPARQL_FAST_MODE = 2;
var SPARQL_SLOW_MODE = exports.SPARQL_SLOW_MODE = 3;
var SPARQL_EXPERT_MODE = exports.SPARQL_EXPERT_MODE = 4;

/**
 * The user can granularly configure the linked-data mode option by combining the below modes:
 *   R2L.setOptions({ linkedDataMode: ['metadata', 'check-exist', 'seq-number']});
 * By default all options are enabled
 *   R2L.setOptions({ linkedDataMode: 'all' });
 */

// only fetch linked data (metadata) information
var LD_MODE_METADATA = exports.LD_MODE_METADATA = 'metadata';
// filter non-existing targets (CELEX/OJ)
var LD_MODE_CHECK_EXISTS = exports.LD_MODE_CHECK_EXISTS = 'check-exist';
// fill placeholders for ambiguos references 
var LD_MODE_SEQ_NUMBER = exports.LD_MODE_SEQ_NUMBER = 'seq-number';
// all of the above
var LD_MODE_ALL = exports.LD_MODE_ALL = 'all';

// fetch corrections along metadata (not enabled by default)
var LD_ADVANCED_MODE_CORRECTIONS = exports.LD_ADVANCED_MODE_CORRECTIONS = 'corrections';
// Re-parses Cellar titles to extract a shorter form of the legal reference. Example: 
// Title: `Directive 2013/34/EU of the European Parliament and of the Council of 26 June 2013 on the annual financial statements, consolidated financial statements and related reports of certain types of undertakings, amending Directive 2006/43/EC of the European Parliament and of the Council and repealing Council Directives 78/660/EEC and 83/349/EEC`
// Short title: `Directive 2013/34/EU`
var LD_ADVANCED_MODE_SHORT_TITLES = exports.LD_ADVANCED_MODE_SHORT_TITLES = 'short-titles';

// advanced mode - fetches ECAS protected data from ULM's KM API 
var LD_ADVANCED_MODE_KM_HANDOC = exports.LD_ADVANCED_MODE_KM_HANDOC = 'km-handoc';
var LD_ADVANCED_MODE_KM_CIS = exports.LD_ADVANCED_MODE_KM_CIS = 'km-cis';

// advanced mode - load judgements for joined cases
var LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT = exports.LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT = 'eucase-joined-judgement';

},{}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearLdTargets = clearLdTargets;
exports.filterTargets = filterTargets;
var _functions = require("../utils/functions.js");
var _data = require("./../utils/data.js");
var _index = require("./utils/index.js");
var _index2 = require("../settings/index.js");
var _celex = require("./filters/celex.js");
var _oj = require("./filters/oj.js");
var _consil = require("./filters/consil.js");
/**
 * Will filter targets annotated with an `ld-condition` which are not found in the Cellar graph. Targets filtered: 
 *   - CELEX - views annotated with (ld-condition="cellar-exists-celex") - will lookup the CELEX id in the graph and remove the target if not found
 *   - OJ - views annotated with (ld-condition="cellar-exists-oj") - will lookup the manifest URL in the graph and remove the target if not found
 *   - CONSIL - views annotated with (ld-condition="cellar-exists-consil") - will lookup the CONSIL id in the graph and remove the target if not found
 * 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches`
 */
function filterTargets(matches) {
  return new Promise(function (resolve, reject) {
    if (!R2L.options.metadata || !R2L.hasLinkedDataMode(_index2.LD_MODE_CHECK_EXISTS)) {
      var result = clearLdTargets(matches);
      resolve(result);
    } else {
      // sequential filtering - first filter CELEX targets then OJ
      (0, _celex.filterCelexTargets)(matches).then(function (matches) {
        return (0, _oj.filterOjTargets)(matches);
      }).then(function (matches) {
        return (0, _consil.filterConsilTargets)(matches);
      }).then(function (matches) {
        resolve(matches);
      });
    }
  });
}

/**
 * Remove targets that need filtering (ld-condition="ld-active") (used when LD is not available)
 * @param {Object} matches
 * @returns {Object} filtered matches 
 */
function clearLdTargets(matches) {
  // collect targets that need to be checked
  var ids = [];
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      // targets to be inspected
      var targets = offset.rule.views.filter(function (v) {
        return (0, _index.hasItem)(v.ldCondition, _index.LD_ACTIVE);
      }).map(function (t) {
        return t.target;
      });
      var filteredViews = {};
      var hasItems = false;
      Object.keys(offset.views).forEach(function (target) {
        if (targets.indexOf(target) !== -1) {
          filteredViews[target] = offset.views[target];
          hasItems = true;
        }
      });
      if (hasItems) {
        var attributes = (0, _functions.extractAttributes)(filteredViews);
        var _ids = (0, _data.extractIdList)(attributes);
        ids = ids.concat(_ids);
      }
    });
  });
  if (ids.length === 0) {
    return matches;
  }

  // unique ids only
  ids = ids.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  matches = (0, _celex.removeIds)(matches, ids);
  return matches;
}

},{"../settings/index.js":32,"../utils/functions.js":56,"./../utils/data.js":54,"./filters/celex.js":34,"./filters/consil.js":35,"./filters/oj.js":36,"./utils/index.js":49}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.filterCelexTargets = filterCelexTargets;
exports.getCelexLookupQuery = getCelexLookupQuery;
exports.removeCelexIds = removeCelexIds;
exports.removeIds = removeIds;
var _index = require("../utils/index.js");
var _data = require("../../utils/data.js");
var _index2 = require("../../manager/index.js");
var _functions = require("../../utils/functions.js");
var _request = require("../../utils/request.js");
/**
 * All targets that have a CELEX id (EU legal acts, EU Treaties, EU Case law) will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from the detection results).
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
function filterCelexTargets(matches) {
  return new Promise(function (resolve, reject) {
    // collect targets that need to be checked
    var celexIds = [];
    var celexActiveIds = []; // if request fails we will automatically remove these
    Object.keys(matches).forEach(function (key) {
      matches[key].offsets.forEach(function (offset) {
        // targets to be inspected
        var targets = offset.rule.views.filter(function (v) {
          return (0, _index.hasItem)(v.ldCondition, _index.LD_CELEX_CONDITION) || (0, _index.hasItem)(v.ldCondition, _index.LD_ACTIVE);
        }).map(function (t) {
          return t.target;
        });
        var filteredViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) !== -1) {
            filteredViews[target] = offset.views[target];
          }
        });
        var attributes = (0, _functions.extractAttributes)(filteredViews);
        var extractedCelexIds = (0, _data.extractCelexIdList)(attributes);
        celexIds = celexIds.concat(extractedCelexIds);
      });
    });
    if (celexIds.length === 0) {
      resolve(matches);
      return;
    }

    // unique ids only
    celexIds = celexIds.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
    var query = getCelexLookupQuery(celexIds, R2L.getLanguage() || "ENG");
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index2.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }
      var foundIds = response.results.bindings.map(function (binding) {
        var id = binding && binding.id ? binding.id.value : null;
        return id.replace("celex:", "");
      });
      var missingIds = celexIds.filter(function (id) {
        return foundIds.indexOf(id) === -1;
      });

      // remove missing celex ids
      matches = removeCelexIds(matches, missingIds);
      resolve(matches);
    })["catch"](function (err) {
      console.error(err);
      // remove them all if the request fails
      var activeCelexIds = []; // if request fails we will automatically remove these
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          // targets to be inspected
          var activeTargets = offset.rule.views.filter(function (v) {
            return (0, _index.hasItem)(v.ldCondition, _index.LD_ACTIVE);
          }).map(function (t) {
            return t.target;
          });
          var activeFilteredViews = {};
          Object.keys(offset.views).forEach(function (target) {
            if (activeTargets.indexOf(target) !== -1) {
              activeFilteredViews[target] = offset.views[target];
            }
          });
          var activeAttributes = (0, _functions.extractAttributes)(activeFilteredViews);
          var activeExtractedCelexIds = (0, _data.extractCelexIdList)(activeAttributes);
          activeCelexIds = activeCelexIds.concat(activeExtractedCelexIds);
        });
      });
      matches = removeCelexIds(matches, activeCelexIds);
      resolve(matches);
    });
  });
}

/**
 * Build CELEX lookup query
 * @param {Array<string>} celexIds 
 * @returns {String} 
 */
function getCelexLookupQuery(celexIds, langISO3) {
  // unique ids only
  celexIds = celexIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "FILTER (?workId IN (";
  for (var i = 0; i < celexIds.length; i++) {
    filters += "\"celex:".concat(celexIds[i], "\", \"celex:").concat(celexIds[i], "\"^^xsd:string"); // query both types
    if (i < celexIds.length - 1) {
      filters += ",";
    }
  }
  filters += "))";
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?workId as ?id \n        WHERE {  \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title_\n            }";

  // disable the language filter - do not exclude the act if the specific language does not exist. REFTOLINK-2016
  if (langISO3 && false) {
    query += "\n            graph ?g { \n                ?exp cdm:expression_uses_language ?lang\n                filter(?lang=lang:".concat(String(langISO3).toUpperCase(), ").  \n            }");
  }
  query += " \n            ?s cdm:work_id_document ?workId.\n            ".concat(filters, "   \n        }");
  return query;
}

/**
 * Remove LD_ACTIVE targets which have the ids we are looking for
 * @param {Object} matches 
 * @param {Array<String>} ids - an aggregate list of CELEX/ECLI/ELI/HANDOC/CIS/PROC/CONSIL ids
 * 
 * @return {Object} matches
 */
function removeIds(matches, ids) {
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      // targets to be inspected
      var targets = offset.rule.views.filter(function (v) {
        return (0, _index.hasItem)(v.ldCondition, _index.LD_ACTIVE);
      }).map(function (t) {
        return t.target;
      });
      ids.forEach(function (id) {
        // build a regex str  
        var regexStr = new RegExp("=\"".concat((0, _functions.regExpEscape)(id), "\""));
        offset.alternatives = offset.alternatives.filter(function (alt) {
          return targets.indexOf(alt.viewName) === -1 || regexStr.test(alt.view) === false;
        });
        offset.alternatives.map(function (alternative) {
          // remove the celex id from the view
          alternative.view = alternative.view.replace(regexStr, "");
        });
        var newViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) === -1 || regexStr.test(offset.views[target]) === false) {
            newViews[target] = offset.views[target].replace(regexStr, "");
          }
        });
        offset.views = newViews;
      });
    });
  });
  return matches;
}

/**
 * @param {Object} matches 
 * @param {Array<string>} celexIds
 * @returns {Object} matches 
 */
function removeCelexIds(matches, celexIds) {
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      // targets to be inspected
      var targets = offset.rule.views.filter(function (v) {
        return (0, _index.hasItem)(v.ldCondition, _index.LD_CELEX_CONDITION) || (0, _index.hasItem)(v.ldCondition, _index.LD_ACTIVE);
      }).map(function (t) {
        return t.target;
      });
      celexIds.forEach(function (celexId) {
        // celex are not unique across views. might use ordinal suffixes eg. data-ref-celex-1, data-ref-celex-2 etc.
        // build a regex str for all possible CELEX suffixes 
        var regexCelexStr = new RegExp("data-ref-celex(?:".concat(_index2.LD_CELEX_SUFFIXES.join("|"), ")=\"").concat((0, _functions.regExpEscape)(celexId), "\""));
        offset.alternatives = offset.alternatives.filter(function (alt) {
          return targets.indexOf(alt.viewName) === -1 || regexCelexStr.test(alt.view) === false;
        });
        offset.alternatives.map(function (alternative) {
          // remove the celex id from the view
          alternative.view = alternative.view.replace(regexCelexStr, "");
        });
        var newViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) === -1 || regexCelexStr.test(offset.views[target]) === false) {
            newViews[target] = offset.views[target].replace(regexCelexStr, "");
          }
        });
        offset.views = newViews;
      });
    });
  });
  return matches;
}

},{"../../manager/index.js":18,"../../utils/data.js":54,"../../utils/functions.js":56,"../../utils/request.js":61,"../utils/index.js":49}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.filterConsilTargets = filterConsilTargets;
var _index = require("../../manager/index.js");
var _index2 = require("../utils/index.js");
var _functions = require("../../utils/functions.js");
var _request = require("../../utils/request.js");
/**
 * Official Journal targets that have a `consil` identifier will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from detection results). 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
function filterConsilTargets(matches) {
  return new Promise(function (resolve, reject) {
    // collect targets that need to be checked
    var attributesList = [];
    Object.keys(matches).forEach(function (key) {
      matches[key].offsets.forEach(function (offset) {
        // targets to be inspected
        var targets = offset.rule.views.filter(function (v) {
          return v.ldCondition === _index2.LD_CONSIL_CONDITION;
        }).map(function (t) {
          return t.target;
        });
        var filteredViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) !== -1) {
            filteredViews[target] = offset.views[target];
          }
        });
        var attributes = (0, _functions.extractAttributes)(filteredViews);
        if (attributes["data-ref-consil"]) {
          attributesList.push({
            consil: attributes["data-ref-consil"]
          });
        }
      });
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }
      var missingItems = attributesList.filter(function (item) {
        var found = response.results.bindings.filter(function (binding) {
          var consilId = binding && binding.id ? binding.id.value : null;
          return consilId === "consil:" + item.consil;
        }).length;
        return !found;
      });

      // remove missing items
      matches = removeConsilTargets(matches, missingItems);
      resolve(matches);
    })["catch"](function (err) {
      console.error(err);
      // no removal
      resolve(matches);
    });
  });
}

/**
 * Eliminate Consil targets which don't have a valid URL
 * @param {Object} matches 
 * @param {Array<object>} items 
 */
function removeConsilTargets(matches, items) {
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      // targets to be inspected
      var targets = offset.rule.views.filter(function (v) {
        return v.ldCondition === _index2.LD_CONSIL_CONDITION;
      }).map(function (t) {
        return t.target;
      });
      items.forEach(function (item) {
        var consilStr = "data-ref-consil=\"".concat(item.consil, "\"");
        offset.alternatives = offset.alternatives.filter(function (alt) {
          return targets.indexOf(alt.viewName) === -1 || alt.view.indexOf(consilStr) === -1;
        });
        offset.alternatives.map(function (alternative) {
          // remove the consil id from the view
          alternative.view = alternative.view.replace(consilStr, "");
        });
        var newViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) === -1 || offset.views[target].indexOf(consilStr) === -1) {
            newViews[target] = offset.views[target].replace(consilStr, "");
          }
        });
        offset.views = newViews;
      });
    });
  });
  return matches;
}

/**
 * Build lookup query
 * @param {Array<Object>} consilItems 
 * @returns {String}
 */
function getQuery(consilItems) {
  var idFilters = "";
  if (consilItems.length === 0) {
    idFilters = "?id = 0";
  }
  for (var i = 0; i < consilItems.length; i++) {
    idFilters += "?id = \"consil:".concat(consilItems[i].consil, "\"^^xsd:string");
    if (i < consilItems.length - 1) {
      idFilters += " || ";
    }
  }
  var query = "\nPREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX skos:<http://www.w3.org/2004/02/skos/core#>\nPREFIX dc:<http://purl.org/dc/elements/1.1/>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\nPREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\nPREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\n\nSELECT DISTINCT ?id WHERE {\n\n    ?s cdm:work_id_document ?id\n            \n    FILTER (".concat(idFilters, ")\n\n}\n    ");
  return query;
}

},{"../../manager/index.js":18,"../../utils/functions.js":56,"../../utils/request.js":61,"../utils/index.js":49}],36:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.filterOjTargets = filterOjTargets;
var _index = require("../../manager/index.js");
var _index2 = require("../utils/index.js");
var _functions = require("../../utils/functions.js");
var _request = require("../../utils/request.js");
/**
 * Official Journal targets that have a `uriserv` URI will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from detection results). 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
function filterOjTargets(matches) {
  return new Promise(function (resolve, reject) {
    // collect targets that need to be checked
    var attributesList = [];
    Object.keys(matches).forEach(function (key) {
      matches[key].offsets.forEach(function (offset) {
        // targets to be inspected
        var targets = offset.rule.views.filter(function (v) {
          return v.ldCondition === _index2.LD_OJ_CONDITION;
        }).map(function (t) {
          return t.target;
        });
        var filteredViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) !== -1) {
            filteredViews[target] = offset.views[target];
          }
        });
        var attributes = (0, _functions.extractAttributes)(filteredViews);
        if (attributes["data-ref-oj"] && attributes["data-ref-uriserv"]) {
          attributesList.push({
            oj: attributes["data-ref-oj"],
            uriserv: attributes["data-ref-uriserv"]
          });
        }
      });
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }
      var missingItems = attributesList.filter(function (item) {
        var found = response.results.bindings.filter(function (binding) {
          var ojId = binding && binding.ojId ? binding.ojId.value : null;
          var uriserv = binding && binding.uriserv ? binding.uriserv.value : null;
          return ojId === item.oj && uriserv.indexOf(item.uriserv) !== -1;
        }).length;
        return !found;
      });

      // remove missing items
      matches = removeOjTargets(matches, missingItems);
      matches = appendCelexIds(matches, response);
      resolve(matches);
    })["catch"](function (err) {
      console.error(err);
      // no removal
      resolve(matches);
    });
  });
}

/**
 * Eliminate OJ targets which don't have a valid URL
 * @param {Object} matches 
 * @param {Array<object>} items 
 */
function removeOjTargets(matches, items) {
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      // targets to be inspected
      var targets = offset.rule.views.filter(function (v) {
        return v.ldCondition === _index2.LD_OJ_CONDITION;
      }).map(function (t) {
        return t.target;
      });
      items.forEach(function (item) {
        var ojStr = "data-ref-uriserv=\"".concat(item.uriserv, "\"");
        offset.alternatives = offset.alternatives.filter(function (alt) {
          return targets.indexOf(alt.viewName) === -1 || alt.view.indexOf(ojStr) === -1;
        });
        offset.alternatives.map(function (alternative) {
          // remove the oj id from the view
          alternative.view = alternative.view.replace(ojStr, "");
        });
        var newViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (targets.indexOf(target) === -1 || offset.views[target].indexOf(ojStr) === -1) {
            newViews[target] = offset.views[target].replace(ojStr, "");
          }
        });
        offset.views = newViews;
      });
    });
  });
  return matches;
}

/**
 * Append CELEX ids to the targets
 * @param {Object} matches 
 * @param {Object} items 
 */
function appendCelexIds(matches, response) {
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      response.results.bindings.forEach(function (binding) {
        if (!binding.celexId || !binding.celexId.value) {
          return;
        }
        var celexId = String(binding.celexId.value).toUpperCase().replace("CELEX:", "");
        var uriservUrlValue = String(binding.uriserv ? binding.uriserv.value : '').split('.').slice(0, -1).join('.');
        var uriservValue = uriservUrlValue.split('/uriserv/')[1] || '';
        var ojStr = "data-ref-uriserv=\"".concat(uriservValue, "\"");
        offset.alternatives = offset.alternatives.map(function (alt) {
          alt.view;
          if (alt.view.indexOf(ojStr) > -1) {
            alt.view = alt.view.replace(ojStr, ojStr + " data-ref-celex=\"" + celexId + "\"");
          }
          return alt;
        });
        var newViews = {};
        Object.keys(offset.views).forEach(function (target) {
          if (offset.views[target].indexOf(ojStr) > -1) {
            newViews[target] = offset.views[target].replace(ojStr, ojStr + " data-ref-celex=\"" + celexId + "\"");
          } else {
            newViews[target] = offset.views[target];
          }
        });
        offset.views = newViews;
      });
    });
  });
  return matches;
}

/**
 * Build OJ uri lookup query
 * @param {Array<Object>} ojItems 
 * @returns {String}
 */
function getQuery(ojItems) {
  var idFilters = "";
  var uriFilters = "";
  for (var i = 0; i < ojItems.length; i++) {
    idFilters += "\"".concat(ojItems[i].oj, "\"^^xsd:string");
    uriFilters += "(REGEX(?manifUrl, \"".concat(ojItems[i].uriserv, "\"))");
    if (i < ojItems.length - 1) {
      idFilters += ",";
      uriFilters += " || ";
    }
  }
  var query = "\nPREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX skos:<http://www.w3.org/2004/02/skos/core#>\nPREFIX dc:<http://purl.org/dc/elements/1.1/>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\nPREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\nPREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\n\nSELECT DISTINCT ?celexId ?ojId ?manifUrl as ?uriserv WHERE {\n    graph ?ge { \n        ?exp cdm:expression_belongs_to_work ?s \n    }\n   \n    # MANIFEST \n    ?manif cdm:manifestation_manifests_expression ?exp. \n    ?manif owl:sameAs ?manifUrl .\n\n    OPTIONAL {\n        ?s owl:sameAs ?celexResourceUrl .\n        FILTER (REGEX(?celexResourceUrl, \"/celex/\"))\n        ?celexWork owl:sameAs ?celexResourceUrl .\n        ?celexWork cdm:work_id_document ?celexId .\n        FILTER (REGEX(STR(?celexId), \"celex:\"))\n    }\n\n    ?s cdm:resource_legal_published_in_official-journal ?q .\n    ?q cdm:work_id_document ?ojId\n     \n    # first filter on all OJ ids         \n    FILTER (?ojId IN (".concat(idFilters, "))\n   \n    # filter urls\n    FILTER (\n        ").concat(uriFilters, "\n    )\n}\n    ");
  return query;
}

},{"../../manager/index.js":18,"../../utils/functions.js":56,"../../utils/request.js":61,"../utils/index.js":49}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fillPlaceholders = fillPlaceholders;
var _index = require("./utils/index.js");
var _index2 = require("../settings/index.js");
var _committee_regions_dec = require("./placeholders/rules/eurlex/committee_regions_dec.js");
var _act = require("./placeholders/rules/eurlex/act.js");
var _staff_regs = require("./placeholders/rules/eurlex/staff_regs.js");
var _act_legacy = require("./placeholders/rules/eurlex/act_legacy.js");
var _eea_joint_committee_dec = require("./placeholders/rules/eurlex/eea_joint_committee_dec.js");
var _partnership_council_dec = require("./placeholders/rules/eurlex/partnership_council_dec.js");
var _united_nations_reg = require("./placeholders/rules/eurlex/united_nations_reg.js");
var _oj_eli = require("./placeholders/rules/eurlex/oj_eli.js");
var _filter = require("./filter.js");
var _subdivision = require("./placeholders/rules/eurlex/subdivision.js");
var _eucase = require("./placeholders/rules/eucase/eucase.js");
var _ecb_eli = require("./placeholders/rules/ecb/ecb_eli.js");
/**
 * Will settle (fill or remove) CELEX and ELI placeholders {{ LD:CELLAR:NUMBER:CELEX}}, {{ LD:CELLAR:SUBNUMBER:CELEX }} in case of ambiguos identifiers
 * `Decision No 70/2008/EC` will resolve to CELEX id `32008D0070(01)` and ELI `/eli/dec/2008/70(1)/oj`
 * The filling is done by looking up information on the matched text in Cellar and resolving the ambiguity
 * 
 * @param {Object} matches 
 * @returns {Promise<Object>} - the settled `matches 
 */
function fillPlaceholders(matches) {
  return new Promise(function (resolve, reject) {
    var promises = [];
    if (!R2L.options.metadata || !R2L.hasLinkedDataMode(_index2.LD_MODE_SEQ_NUMBER)) {
      matches = (0, _filter.clearLdTargets)(matches);
      matches = (0, _index.clearPlaceholders)(matches);
      resolve(matches);
      return;
    }

    // will mutate the matches object
    promises.push(fillEliBaseUrls(matches));
    promises.push(fillLegacyActsPlaceholders(matches));
    promises.push(fillCelexConsolidationPlaceholders(matches));
    promises.push(fillEcbIds(matches));
    promises.push(fillCelexSubnumberPlaceholders(matches));
    promises.push(fillCelexNumberPlaceholders(matches));
    promises.push(fillUnitedNationsRegulationPlaceholders(matches));
    promises.push(fillOjEli(matches));
    promises.push(fillEucaseCelexIds(matches));
    promises.push(fillEucaseJoinedJudgements(matches));
    Promise.all(promises).then(function (_) {
      // clear remaining placeholders
      matches = (0, _index.clearPlaceholders)(matches);
      resolve(matches);
    })["catch"](function (e) {
      console.error(e);
      // can't do much
      matches = (0, _index.clearPlaceholders)(matches);
      resolve(matches);
    });
  });
}
function fillEucaseCelexIds(matches) {
  return (0, _eucase.resolveEucaseCelexIds)(matches);
}
function fillEucaseJoinedJudgements(matches) {
  return (0, _eucase.resolveEucaseJoinedJudgements)(matches);
}
function fillEcbIds(matches) {
  return (0, _ecb_eli.resolveEcbEli)(matches).then(function (matches) {
    return (0, _ecb_eli.resolveEcbActCelex)(matches);
  });
}

/**
 * Resolve CELEX subnumber placeholders eg: 32008D0070 {{ (01) }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexSubnumberPlaceholders(matches) {
  return (0, _act.resolveCelexSubnumber)(matches);
}

/**
 * Resolve ELIs for OJ new references
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillOjEli(matches) {
  return (0, _oj_eli.resolveOjEli)(matches);
}

/**
 * Resolve CELEX number placeholders eg: 32020{{ Q1120(01) }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexNumberPlaceholders(matches) {
  // resolve committee of regions decisions which don't have a (type + number)
  return (0, _committee_regions_dec.resolveCorDecisionNumber)(matches).then(function (matches) {
    // resolve EEA decisions
    return (0, _eea_joint_committee_dec.resolveEeaJointCommitteeDecisionNumber)(matches).then(function (matches) {
      // resolve Partnership Council decisions
      return (0, _partnership_council_dec.resolvePartnershipCouncilDecisionNumber)(matches);
    });
  });
}

/**
 * Resolve CELEX number & ELI url placeholders for legacy acts eg: 3{{ 1959R0007 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillLegacyActsPlaceholders(matches) {
  //legacy acts with missing year
  return (0, _act_legacy.resolveLegacyActs)(matches);
}

/**
 * Resolve CELEX number & ELI url placeholders for UN regulations eg: 3{{ 1959R0007 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillUnitedNationsRegulationPlaceholders(matches) {
  return (0, _united_nations_reg.resolveUnitedNationsRegulationActs)(matches);
}

/**
 * Resolve CELEX consolidation placeholders eg: 01962R0031{{ -20200101 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexConsolidationPlaceholders(matches) {
  return new Promise(function (resolve, reject) {
    resolve(matches);
    /**
     * staff regs consolidation numbers
     * currently disabled as we use default values
    resolveStaffRegsConsolidation(matches).then(matches => {
        resolve(matches);
    })
    */
  });
}
function fillEliBaseUrls(matches) {
  return (0, _subdivision.resolveEliBaseUrl)(matches);
}

},{"../settings/index.js":32,"./filter.js":33,"./placeholders/rules/ecb/ecb_eli.js":38,"./placeholders/rules/eucase/eucase.js":39,"./placeholders/rules/eurlex/act.js":40,"./placeholders/rules/eurlex/act_legacy.js":41,"./placeholders/rules/eurlex/committee_regions_dec.js":42,"./placeholders/rules/eurlex/eea_joint_committee_dec.js":43,"./placeholders/rules/eurlex/oj_eli.js":44,"./placeholders/rules/eurlex/partnership_council_dec.js":45,"./placeholders/rules/eurlex/staff_regs.js":46,"./placeholders/rules/eurlex/subdivision.js":47,"./placeholders/rules/eurlex/united_nations_reg.js":48,"./utils/index.js":49}],38:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveEcbEli = exports.resolveEcbActCelex = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * Will query Cellar to retrieve the ELI of the act behind an ECB reference - REFTOLINK-1978
 * 
 * Processes placeholders: LD_CELLAR_ECB_CELEX, LD_CELLAR_ECB_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveEcbEli = exports.resolveEcbEli = function resolveEcbEli(matches) {
  return new Promise(function (resolve, reject) {
    // we lookup matches that have the LD_CELLAR_ECB_CELEX marking and have a valid 'data-ref-ecb' attribute
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_ECB_CELEX).map(function (attributes) {
      return {
        no: attributes['data-ref-no'],
        year: attributes['data-ref-year'],
        ecb: attributes['data-ref-ecb']
      };
    }).filter(function (attr) {
      return attr.ecb;
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var currentBindings = bindings;
          var optimalBinding = findOptimalBinding(attributes, currentBindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":ECB:CELEX") !== -1) {
              // use the celex id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.replace('celex:', '') : 'INVALID'; // 'INVALID' will be discarded by the `cellar-exists-celex` attribute
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":ECB:ELI") !== -1 && optimalBinding) {
              var targetLang = R2L.getLanguage();
              offset = (0, _index2.replace)(offset, placeholder, optimalBinding.eli ? optimalBinding.eli.value + (targetLang ? '/' + targetLang : '') : optimalBinding.ojUrl.value);
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Cache old ECB Guideline acts internally 
 */
var __oldEcbGuidelineActs;
function getOldEcbGuidelineActs() {
  return new Promise(function (resolve, reject) {
    if (__oldEcbGuidelineActs) {
      resolve(__oldEcbGuidelineActs);
    }
    var query = getOldEcbGuidelineActsQuery();
    var format = 'application/json';
    return (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      __oldEcbGuidelineActs = response;
      resolve(__oldEcbGuidelineActs);
    });
  });
}
/**
 * Will query Cellar to retrieve the CELEX of the act behind an ECB act - REFTOLINK-1978
 * 
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveEcbActCelex = exports.resolveEcbActCelex = function resolveEcbActCelex(matches) {
  return new Promise(function (resolve, reject) {
    // check if we have ECB acts to avoid querying CELLAR for no reason
    var foundGuidelines = false;
    Object.keys(matches).forEach(function (key) {
      matches[key].offsets.forEach(function (offset) {
        var urls = (0, _functions.extractUrls)(offset.views);
        urls.forEach(function (url) {
          var match = /https?:\/\/data.europa.eu\/eli\/guideline\/(\d+)\/(\d+)/gi.exec(url);
          if (match) {
            foundGuidelines = true;
          }
        });
      });
    });
    if (!foundGuidelines) {
      resolve(matches);
      return;
    }
    getOldEcbGuidelineActs().then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          var urls = (0, _functions.extractUrls)(offset.views);
          if (!celexId) {
            return;
          }

          // find the eli fragment and compare to the celex 
          var eliUrlData;
          var celexData;
          urls.forEach(function (url) {
            var match = /https?:\/\/data.europa.eu\/eli\/guideline\/(\d+)\/(\d+)/gi.exec(url);
            if (match) {
              eliUrlData = {
                year: match[1],
                no: match[2],
                root: match[0]
              };
            }
          });
          var match = /^3(\d{4})O(\d{4})/gi.exec(celexId);
          if (match) {
            celexData = {
              year: match[1],
              no: String(parseInt(match[2])),
              root: match[0]
            };
          }
          if (celexData && eliUrlData) {
            // we need to adjust the CELEX id as it does not follow the same numbering. the ELI is the correct one. See example: https://eur-lex.europa.eu/eli/guideline/2014/528/oj

            bindings.forEach(function (binding) {
              if (binding.eli.value.indexOf(eliUrlData.root + "/") > -1) {
                // find the right CELEX number
                var bindingCelexId = binding.id.value.replace("celex:", "");
                if (bindingCelexId !== celexData.root) {
                  // raw replacement
                  Object.keys(offset.views).forEach(function (key) {
                    if (String(offset.views[key]).indexOf(celexData.root) > -1) {
                      offset.views[key] = String(offset.views[key]).replaceAll(celexData.root, bindingCelexId);
                    }
                  });
                  offset.alternatives.forEach(function (alternative) {
                    if (String(alternative.view).indexOf(celexData.root) > -1) {
                      alternative.view = String(alternative.view).replaceAll(celexData.root, bindingCelexId);
                    }
                  });
                }
              }
            });
          }
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    var regexCelexId = 'celex:[2345]' + attributesList[i].year + '.{1,2}' + String(attributesList[i].no).padStart(4, '0');
    filters += "(REGEX(STR(?workId), '".concat(regexCelexId, "$') || (STR(?ecbRef) = '").concat(attributesList[i].ecb, "' AND REGEX(STR(?workId), 'celex:')))");
  }
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id \n        ?eli\n        ?ecbRef\n        ?ojUrl\n    WHERE {  \n        graph ?ge { \n            ?exp cdm:expression_belongs_to_work ?s .\n            ?exp cdm:expression_title ?title_\n        } \n        ?s cdm:work_id_document ?workId.\n        OPTIONAL {\n            ?s cdm:resource_legal_published_in_official-journal ?ojUrl\n        }\n        OPTIONAL {\n            ?s cdm:resource_legal_manuscript_ref ?ecbRef .\n        }\n        ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/ECB> .\n        OPTIONAL {\n            ?s cdm:resource_legal_eli ?eli .\n        }\n        FILTER (".concat(filters, ") \n}\nORDER BY ASC(?workId)\n");
  return query;
}

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getOldEcbGuidelineActsQuery() {
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id \n        ?eli\n    WHERE {  \n        ?s cdm:work_id_document ?workId.\n        ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/ECB> .\n        ?s cdm:resource_legal_eli ?eli .\n        ?s cdm:resource_legal_year ?year\n        FILTER (STR(?year) < \"2020\" AND REGEX(STR(?eli), \"http://data.europa.eu/eli/guideline/\") AND !REGEX(STR(?eli), \"corrigendum\") AND REGEX(STR(?workId), \"celex:3\")) \n    }";
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {String} match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {
  var found = bindings.filter(function (binding) {
    return attributes['data-ref-ecb'] === String(binding.ecbRef ? binding.ecbRef.value : "");
  }).shift();
  if (!found) {
    var regexCelexId = 'celex:[2345]' + attributes['data-ref-year'] + '.{1,2}' + String(attributes['data-ref-no']).padStart(4, '0');
    found = bindings.filter(function (binding) {
      var pattern = new RegExp(regexCelexId, 'gi');
      return pattern.test(String(binding.id.value));
    }).shift();
  }
  return found && (found.eli || found.ojUrl) ? found : null;
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveEucaseJoinedJudgements = exports.resolveEucaseCelexIds = exports.removeEucaseJoinedJudgements = void 0;
var _index = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
var _index2 = require("../../../../manager/index.js");
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index3 = require("../../../../settings/index.js");
/**
 * The CELEX ids of EU cases is not deterministic for Orders, Judgments, Opinions. For example: 
 *   `T-184/01` order has CELEX id 62001TO0184(02)
 *   `T-184/01 R` order has CELEX id 62001TO0184
 * 
 * This transformer will:
 *   - query all CELEX orders which contain '62001TO0184';
 *   - match the titles with the case label eg. 'T-184/01 R';
 *   - resolve the correct CELEX ids matching the case label;
 * 
 * @param {Object} matches
 * 
 * @return {Promise<Object>} 
 */
var resolveEucaseCelexIds = exports.resolveEucaseCelexIds = function resolveEucaseCelexIds(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesArr = (0, _data.extractCelexAttributes)(matches, _index.LD_CELLAR_EUCASE_SUBNUMBER_CELEX);
    var celexMap = {};
    attributesArr.forEach(function (attributes) {
      var celexId = null;
      Object.keys(attributes).forEach(function (key) {
        if (attributes[key].indexOf(_index.LD_CELLAR_EUCASE_SUBNUMBER_CELEX) > -1) {
          celexId = attributes[key];
          var suffix = key.split("celex")[1] || '';
          celexMap[celexId] = celexMap[celexId] || [];
          if (attributes['data-ref-label' + suffix]) {
            celexMap[celexId].push(attributes['data-ref-label' + suffix]);
          }
        }
      });
    });

    // nothing to check
    if (Object.keys(celexMap).length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(celexMap);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index2.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }
      var newCelexMap = {};
      Object.keys(celexMap).forEach(function (celexId) {
        var labels = celexMap[celexId];
        labels.forEach(function (label) {
          // reconcile the celex ids with the case labels (with/without the 'R' suffix)
          response.results.bindings.forEach(function (binding) {
            // we look for the pattern: `<caseLabel>.` (with an ending dot). Example: 
            //   Affaire C-78/14 P-R.

            if (!binding.title || !binding.title.value) {
              return;
            }

            // clean spaces
            var val = String(binding.title.value).split("#").pop().replace(/[\u202F\u00A0]/g, " ").replace(/ /g, "");
            if (val.indexOf(String(label).replace(/\s/g, '') + '.') > -1 && celexId.substr(0, 10) === binding.id.value.replace("celex:", "").substr(0, 10)) {
              //matched
              newCelexMap[celexId] = newCelexMap[celexId] || [];
              newCelexMap[celexId].push({
                celexId: binding.id.value.replace('celex:', ''),
                label: label
              });
            }
            // if there is no label match we will keep the Order/Judgment/Opinion document of the main CELEX id, there is no target filtering happening here
          });
        });
      });
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexIds = (0, _data.extractCelexIdList)(attributes);
          celexIds = celexIds.filter(function (celexId) {
            return celexId.indexOf(_index.LD_CELLAR_EUCASE_SUBNUMBER_CELEX) > -1;
          });
          if (celexIds.length === 0) {
            return;
          }
          celexIds.forEach(function (celexId) {
            // find in newCelexMap
            var finalCelexIds = newCelexMap[celexId] || [];
            finalCelexIds.forEach(function (finalCelexIdData) {
              var finalCelexId = finalCelexIdData.celexId;
              var finalLabel = finalCelexIdData.label;
              var regex = new RegExp("data-ref-label(?:-\\d+)?=\"" + (0, _functions.regExpEscape)(finalLabel) + "\"", "i");

              // raw replacement
              Object.keys(offset.views).forEach(function (key) {
                if (regex.test(String(offset.views[key]))) {
                  offset.views[key] = String(offset.views[key]).replaceAll(celexId, finalCelexId);
                }
              });
              offset.alternatives.forEach(function (alternative) {
                if (regex.test(String(alternative.view))) {
                  alternative.view = String(alternative.view).replaceAll(celexId, finalCelexId);
                }
              });
            });
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};
function getQuery(celexMap) {
  var filters = "";
  var i = 0;
  Object.keys(celexMap).forEach(function (celexId) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(STRSTARTS(STR(?workId), \"celex:".concat(celexId.replace('{{ LD:CELLAR:EUCASE:SUBNUMBER:CELEX }}', ''), "\"))");
    i++;
  });
  var str = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id ?title\n    WHERE {  \n        graph ?ge { \n            ?exp cdm:expression_belongs_to_work ?s .\n            ?exp cdm:expression_title ?title .\n            ?exp cdm:expression_uses_language ?lang\n            FILTER (?lang IN (lang:FRA))\n        } \n        ?s cdm:resource_legal_id_sector \"6\"^^xsd:string .\n        ?s cdm:work_has_resource-type ?resourceType .\n        FILTER (\n            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/ORDER> || \n            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/OPIN_JUR> ||\n            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/JUDG> \n        )  .\n        \n        ?s cdm:work_id_document ?workId.\n\n        FILTER ((".concat(filters, ") AND !REGEX(STR(?workId), \"_INF\", \"i\")) \n    }\n    ORDER BY ?workId\n");
  return str;
}
var removeEucaseJoinedJudgements = exports.removeEucaseJoinedJudgements = function removeEucaseJoinedJudgements(matches) {
  var regex = new RegExp("{{\\s?" + _index.LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}");
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      var newViews = {};
      var newAlternatives = [];
      // raw replacement
      Object.keys(offset.views).forEach(function (key) {
        if (!regex.test(offset.views[key])) {
          newViews[key] = offset.views[key];
        }
      });
      offset.views = newViews;
      offset.alternatives.forEach(function (alternative) {
        if (!regex.test(String(alternative.view))) {
          newAlternatives.push(alternative);
        }
        offset.alternatives = newAlternatives;
      });
    });
  });
  return matches;
};
var resolveEucaseJoinedJudgements = exports.resolveEucaseJoinedJudgements = function resolveEucaseJoinedJudgements(matches) {
  return new Promise(function (resolve, reject) {
    // advanced linked data mode must be enabled
    if (R2L.options.linkedDataMode.indexOf(_index3.LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT) === -1) {
      // clean them up first
      return resolve(removeEucaseJoinedJudgements(matches));
    }

    // get joined case data
    R2L.ldm.getJoinedCaseData().then(function (joinedCaseData) {
      // loop matches and see if they're in the joined cases list
      // build a map for fast lookup
      var fastCaseLabelLookupMap = {};
      joinedCaseData.results.bindings.map(function (binding) {
        var caseLabels = binding.title.value.split(",").map(function (cl) {
          return cl.replace(/\s/g, "").replace("‑", "-");
        });
        // we are not interested in the first item of the list (check if position > 0) as that is the main case. 
        caseLabels.forEach(function (caseLabel, index) {
          if (index > 0) {
            fastCaseLabelLookupMap[caseLabel] = (binding.id ? binding.id.value : '').replace('celex:', '');
          }
        });
      });
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexIds = (0, _data.extractCelexIdList)(attributes);
          celexIds = celexIds.filter(function (celexId) {
            return celexId.indexOf(_index.LD_CELLAR_EUCASE_JOINED_JUDGEMENT) > -1;
          });
          if (celexIds.length === 0) {
            return;
          }
          var currentLabel = String(attributes['data-ref-label']).replace(/\s/g, "").replace("‑", "-");

          // look for the label in the joined cases list
          var mainJudgementCelexId = fastCaseLabelLookupMap[currentLabel];
          var regex = new RegExp("{{\\s?" + _index.LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}");
          var newViews = {};
          var newAlternatives = [];
          // raw replacement
          Object.keys(offset.views).forEach(function (key) {
            if (regex.test(offset.views[key])) {
              if (mainJudgementCelexId) {
                newViews[key] = String(offset.views[key]).replace(new RegExp("{{\\s?" + _index.LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}", "g"), mainJudgementCelexId);
              }
            } else {
              newViews[key] = offset.views[key];
            }
          });
          offset.views = newViews;
          offset.alternatives.forEach(function (alternative) {
            if (regex.test(String(alternative.view))) {
              if (mainJudgementCelexId) {
                alternative.view = String(alternative.view).replace(new RegExp("{{\\s?" + _index.LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}", "g"), mainJudgementCelexId);
                newAlternatives.push(alternative);
              }
            } else {
              newAlternatives.push(alternative);
            }
            offset.alternatives = newAlternatives;
          });
        });
      });
      resolve(matches);
    })["catch"](function (err) {
      console.error(err);
      resolve(matches);
    });
  });
};

},{"../../../../manager/index.js":18,"../../../../settings/index.js":32,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveCelexSubnumber = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * Will resolve CELEX and ELI ambiguous references in CELEX-based rules (EUR-Lex acts).
 * Processes placeholders: LD_CELLAR_SUBNUMBER_CELEX, LD_CELLAR_SUBNUMBER_ELI
 * 
 * Example: `Decision No 70/2008/EC of the European Parliament and of the Council` - 32008D0070(01) - http://data.europa.eu/eli/dec/2008/70(1)/oj 
 * 
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
var resolveCelexSubnumber = exports.resolveCelexSubnumber = function resolveCelexSubnumber(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var celexIds = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_SUBNUMBER_CELEX).map(function (attributes) {
      // strip placeholders
      var id = (0, _data.extractCelexId)(attributes);
      return id.replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), '');
    });

    // nothing to check
    if (celexIds.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(celexIds, R2L.getLanguage() || "ENG");
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          var celexIdVariation = getCelexIdVariation(rawCelexId);

          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            if (celexIdVariation) {
              return binding.id.value.includes(rawCelexId) || binding.id.value.includes(celexIdVariation);
            } else {
              return binding.id.value.includes(rawCelexId);
            }
          });
          if (currentBindings.length >= 1) {
            var optimalBinding = findOptimalBinding(match, currentBindings);
            //try to resolve duplicate using matched reference

            offset.rule.ld.forEach(function (placeholder) {
              if (placeholder.indexOf(":SUBNUMBER:CELEX") !== -1) {
                // replace CELEX id entirely
                var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6) : '';
                Object.keys(offset.views).forEach(function (key) {
                  offset.views[key] = String(offset.views[key]).replaceAll(celexId, replacementCelex);
                });
                offset.alternatives.forEach(function (alternative) {
                  alternative.view = String(alternative.view).replaceAll(celexId, replacementCelex);
                });
              }
              if (placeholder.indexOf(":SUBNUMBER:ELI") !== -1) {
                // use the subnumber from the optimal ELI URL
                var eliParts = optimalBinding && optimalBinding.eli ? (optimalBinding.eli.value || "").split("/eli/") : [];
                if (eliParts.length > 1) {
                  var arr = eliParts[1].match(/^[a-z_]+\/\d+\/\d+(\(\d+\))/i);
                  var replacementEli = arr && arr[1] ? arr[1] : "";
                  offset = (0, _index2.replace)(offset, placeholder, replacementEli);
                }
              }
            });
          }
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};
function getCelexIdVariation(celexId) {
  var year = parseInt(celexId.slice(1, 5));
  var type = celexId.slice(5, 6);
  // ECSC celex ids can use an 'S' instead of 'D'
  if (year <= 2002 && type === 'D') {
    var ecscCelexId = celexId.replace('D', 'S');
    return ecscCelexId;
  }
  return null;
}

/**
 * Query by CELEX ids (CONTAINS)
 * @param {Array<String>} celexIds 
 * @returns {String}
 */
function getQuery(celexIds, langISO3) {
  langISO3 = langISO3 || "ENG";
  langISO3 = String(langISO3).toUpperCase();

  // unique ids only
  celexIds = celexIds.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  var filters = "";
  for (var i = 0; i < celexIds.length; i++) {
    if (i > 0) {
      filters += " UNION ";
    }
    var celexIdVariationFilter = "";
    var celexIdVariation = getCelexIdVariation(celexIds[i]);
    if (celexIdVariation) {
      celexIdVariationFilter = ",  \"celex:".concat(celexIdVariation, "\", \"celex:").concat(celexIdVariation, "\"^^xsd:string");
    }
    filters += "{\n            ?s cdm:work_id_document ?workId. \n\n            FILTER (?workId IN (\n                \"celex:".concat(celexIds[i], "\", \"celex:").concat(celexIds[i], "\"^^xsd:string, \n                \"celex:").concat(celexIds[i], "(01)\", \"celex:").concat(celexIds[i], "(01)\"^^xsd:string,\n                \"celex:").concat(celexIds[i], "(02)\", \"celex:").concat(celexIds[i], "(02)\"^^xsd:string,\n                \"celex:").concat(celexIds[i], "(03)\", \"celex:").concat(celexIds[i], "(03)\"^^xsd:string\n                ").concat(celexIdVariationFilter, "\n            ))\n        }");
  }
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n        SELECT DISTINCT \n            ?workId as ?id \n            ?title_ as ?title\n            ?eli\n        WHERE {  \n            graph ?ge { \n                ?exp cdm:expression_belongs_to_work ?s .\n                ?exp cdm:expression_title ?title_\n            }\n            graph ?g { \n                ?exp cdm:expression_uses_language ?lang\n                filter(?lang=lang:".concat(langISO3, ").  \n            } \n            OPTIONAL {\n                ?s cdm:resource_legal_eli ?eli .\n            }\n\n            ").concat(filters, "   \n        }\n        \n        ORDER BY DESC(?workId)\n        ");
  return query;
}

/**
 * Find the best subnumber binding to use for the match.
 * @param {String} match (reference) 
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, bindings) {
  // find the reference word eg. 70/2008(/EC)
  var optimalBinding = bindings.filter(function (binding) {
    var parts = (0, _index2.sanitize)(binding.title.value).split(" ").filter(function (part) {
      return String(part).match("\\d{1,8}\\/\\d{1,8}");
    });
    var matchParts = (0, _index2.sanitize)(match).split(" ").filter(function (part) {
      return String(part).match("\\d{1,8}\\/\\d{1,8}");
    });

    //check whether parts and matchParts have a common reference token
    if (parts.length > 0 && matchParts.length > 0) {
      // in old acts we might find a colon at the end eg: '2003/426/EC:
      var str = String(parts[0]).slice(-1) === ':' ? String(parts[0]).slice(0, -1) : String(parts[0]);
      var matchStr = String(matchParts[0]).slice(-1) === ':' ? String(matchParts[0]).slice(0, -1) : String(matchParts[0]);
      return str === matchStr;
    }
    return false;
  }).pop();
  if (!optimalBinding) {
    return bindings[0];
  }
  return optimalBinding;
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveLegacyActs = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * Resolve legacy act ELIs (urls). Very old acts (before 1962) do not reference the year so we need to query Cellar for it. 
 * Example: `Règlement n 12 de la Commission` - http://data.europa.eu/eli/reg/1961/12/oj
 * 
 * Processes placeholders: LD_CELLAR_ACT_NUMBER_CELEX, LD_CELLAR_ACT_URL_ELI
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
var resolveLegacyActs = exports.resolveLegacyActs = function resolveLegacyActs(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_ACT_URL_ELI).map(function (attributes) {
      // strip placeholders
      return {
        number: attributes["data-ref-no"],
        author: attributes["data-ref-author"],
        type: attributes["data-ref-type"],
        celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), '')
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');
          var optimalBinding = findOptimalBinding(attributes, bindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":ACT:NUMBER:CELEX") !== -1) {
              // use the subnumber from the optimal CELEX id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6).replace(rawCelexId, '') : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":ACT:URL:ELI") !== -1) {
              var replacementEliUrl = optimalBinding ? optimalBinding.eli.value : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementEliUrl);
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(STRSTARTS(?workId, \"celex:\") AND STR(?year)<'1962-01-01' AND ?author=<http://publications.europa.eu/resource/authority/corporate-body/".concat(attributesList[i].author, "> AND ?type='").concat(attributesList[i].type, "'^^xsd:string AND ?no = ").concat(attributesList[i].number, ")");
  }
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n    \n    SELECT DISTINCT \n        ?workId as ?id \n        ?eli\n        ?year\n        ?type\n        ?author\n        ?no\n        ?title_ as ?title\n    WHERE {  \n        graph ?ge { \n            ?exp cdm:expression_belongs_to_work ?s .\n            ?exp cdm:expression_title ?title_\n        }\n        graph ?g { \n            ?exp cdm:expression_uses_language ?lang\n            filter(?lang=lang:FRA).  \n        } \n    \n        ?s cdm:resource_legal_eli ?eli.\n        ?s cdm:work_id_document ?workId. \n        ?s cdm:resource_legal_type ?type .\n        ?s cdm:resource_legal_number_natural ?no .\n        ?s cdm:resource_legal_year ?year .\n        ?s cdm:work_created_by_agent ?author\n    \n    FILTER (".concat(filters, ") \n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {Object} attributes
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {
  // find the right ref
  return bindings.filter(function (binding) {
    return binding.author.value === "http://publications.europa.eu/resource/authority/corporate-body/" + attributes['data-ref-author'] && binding.no.value === attributes['data-ref-no'] && binding.type.value === attributes['data-ref-type'];
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],42:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveCorDecisionNumber = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * The Committee of the Regions uses a different register for act numbering and thus the captured number does not correspond the ELI/CELEX.
 * 
 * Example: `COMMITTEE OF THE REGIONS DECISION No 18/2020` - https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32020Q1120(01)
 * 
 * 
 * Processes placeholders: LD_CELLAR_COR_NUMBER_CELEX
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveCorDecisionNumber = exports.resolveCorDecisionNumber = function resolveCorDecisionNumber(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_COR_NUMBER_CELEX).map(function (attributes) {
      // strip placeholders
      return {
        number: attributes["data-ref-no"],
        celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), ''),
        year: String(attributes["data-ref-celex"]).substr(1, 4)
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            return binding.id.value.includes(rawCelexId);
          });
          var optimalBinding = findOptimalBinding(match, currentBindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":COR:NUMBER:CELEX") !== -1) {
              // use the subnumber from the optimal CELEX id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6).replace(rawCelexId, '') : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(\n            STRSTARTS( ?workId, \"celex:".concat(attributesList[i].celexId, "\") AND \n            REGEX( ?title_, \"[\u202F\xA0 ]").concat(attributesList[i].number, "/").concat(attributesList[i].year, "\")\n        )");
  }
  var query = "\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        \nSELECT DISTINCT \n    ?workId as ?id\n    ?title_ as ?title\nWHERE {  \n    graph ?ge { \n        ?exp cdm:expression_belongs_to_work ?s .\n        ?exp cdm:expression_title ?title_\n    }\n    graph ?g { \n        ?exp cdm:expression_uses_language ?lang\n        filter(?lang=lang:ENG).  \n    } \n    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/COR> . \n    ?s cdm:work_id_document ?workId. \n    FILTER (".concat(filters, ")\n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param string match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, bindings) {
  // find the reference number eg. 18/2020
  return bindings.filter(function (binding) {
    var parts = (0, _index2.sanitize)(binding.title.value).split(" ").filter(function (part) {
      return String(part).match("\\d{1,8}\\/\\d{1,8}");
    });
    var matchParts = (0, _index2.sanitize)(match).split(" ").filter(function (part) {
      return String(part).match("\\d{1,8}\\/\\d{1,8}");
    });

    //check whether parts and matchParts have a common reference {{no}}/{{year}}
    if (parts.length > 0 && matchParts.length > 0) {
      return parts[0] === matchParts[0];
    }
    return false;
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],43:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveEeaJointCommitteeDecisionNumber = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * EEA Joint committee decisions use a different register for numbering acts which does not correspond to the URL:
 * 
 * Example: `DECISION OF THE EEA JOINT COMMITTEE No 188/2019` - http://data.europa.eu/eli/dec/2019/1401/oj
 * 
 * Processes placeholders: LD_CELLAR_EEAJC_NUMBER_CELEX, LD_CELLAR_EEAJC_NUMBER_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveEeaJointCommitteeDecisionNumber = exports.resolveEeaJointCommitteeDecisionNumber = function resolveEeaJointCommitteeDecisionNumber(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_EEAJC_NUMBER_CELEX).map(function (attributes) {
      // strip placeholders
      return {
        number: attributes["data-ref-no"],
        celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), ''),
        year: String(attributes["data-ref-celex"]).substr(1, 4)
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            return binding.id.value.includes(rawCelexId);
          });
          var optimalBinding = findOptimalBinding(match, currentBindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":EEAJC:NUMBER:CELEX") !== -1) {
              // use the subnumber from the optimal CELEX id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6).replace(rawCelexId, '') : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":EEAJC:NUMBER:ELI") !== -1) {
              // use the subnumber from the optimal ELI URL
              var eliParts = optimalBinding ? (optimalBinding.eli.value || "").split("/eli/") : [];
              if (eliParts.length > 1) {
                var arr = eliParts[1].match(/^[a-z_]+\/\d+\/(.+)$/i);
                var replacementEli = arr && arr[1] ? arr[1] : "";
                offset = (0, _index2.replace)(offset, placeholder, replacementEli);
              }
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(\n            STRSTARTS( ?workId, \"celex:".concat(attributesList[i].celexId, "\") AND \n            REGEX( ?title_, \"[\u202F\xA0 ]").concat(attributesList[i].number, "/").concat(attributesList[i].year, "\")\n        )");
  }
  var query = "\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        \nSELECT DISTINCT \n    ?workId as ?id\n    ?title_ as ?title\n    ?eli    \nWHERE {  \n    graph ?ge { \n        ?exp cdm:expression_belongs_to_work ?s .\n        ?exp cdm:expression_title ?title_\n    }\n    graph ?g { \n        ?exp cdm:expression_uses_language ?lang\n        filter(?lang=lang:ENG).  \n    } \n    ?s cdm:resource_legal_eli ?eli.\n    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/CMT_MIX_EEAREA> . \n    ?s cdm:work_id_document ?workId. \n    FILTER (".concat(filters, ") \n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {String} match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, bindings) {
  // find the reference number eg. 18/2020
  return bindings.filter(function (binding) {
    var parts = (0, _index2.sanitize)(binding.title.value).split(" ").filter(function (part) {
      return String(part).match("\\d+\\/\\d+");
    });
    var matchParts = (0, _index2.sanitize)(match).split(" ").filter(function (part) {
      return String(part).match("\\d+\\/\\d+");
    });

    //check whether parts and matchParts have a common reference {{no}}/{{year}}
    if (parts.length > 0 && matchParts.length > 0) {
      return parts[0] === matchParts[0];
    }
    return false;
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],44:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveOjEli = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * Will query Cellar to retrieve the ELI of the act behind an OJ reference - REFTOLINK-1516
 * 
 * Processes placeholders: LD_CELLAR_OJ_CELEX, LD_CELLAR_OJ_TYPE_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveOjEli = exports.resolveOjEli = function resolveOjEli(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_OJ_CELEX).map(function (attributes) {
      // strip placeholders
      return {
        no: attributes['data-ref-no'],
        eliType: attributes['data-ref-eli-type'],
        year: attributes['data-ref-year'],
        month: attributes['data-ref-month'],
        day: attributes['data-ref-day'],
        date: "".concat(attributes['data-ref-year'], "-").concat(String(attributes['data-ref-month']).padStart(2, '0'), "-").concat(String(attributes['data-ref-day']).padStart(2, '0'))
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            return binding.id.value.includes(rawCelexId);
          });
          var optimalBinding = findOptimalBinding(attributes, currentBindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":OJ:CELEX") !== -1) {
              // use the celex id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.replace('celex:', '') : 'INVALID'; // 'INVALID' will be discarded by the `cellar-exists-celex` attribute
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":OJ:TYPE:ELI") !== -1) {
              if (attributes.eliType) {
                offset = (0, _index2.replace)(offset, placeholder, attributes.eliType);
              } else {
                // use the type from the optimal ELI URL
                var eliParts = optimalBinding ? (optimalBinding.eli.value || "").split("/eli/") : [];
                if (eliParts.length > 1) {
                  var arr = eliParts[1].match(/^([a-z_]+)\/\d+\/.+$/i);
                  var replacementEli = arr && arr[1] ? arr[1] : "";
                  offset = (0, _index2.replace)(offset, placeholder, replacementEli);
                }
              }
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(?natNumber IN (".concat(attributesList[i].no, ") AND (STR(?ojDatePublication) = '").concat(attributesList[i].date, "') AND regex(str(?workId), \"celex:\"))");
  }
  var query = "\n    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n    PREFIX dc:<http://purl.org/dc/elements/1.1/>\n    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n    PREFIX owl:<http://www.w3.org/2002/07/owl#>\n\n    SELECT DISTINCT \n        ?workId as ?id \n        ?ojDatePublication\n        ?year\n        ?natNumber\n        ?eli\n    WHERE {  \n        graph ?ge { \n            ?exp cdm:expression_belongs_to_work ?s .\n            ?exp cdm:expression_title ?title_\n        } \n        ?s cdm:resource_legal_year ?year .\n        ?s cdm:resource_legal_number_natural ?natNumber .\n        ?s cdm:work_id_document ?workId.\n        ?s cdm:resource_legal_eli ?eli .\n        OPTIONAL {\n            ?s cdm:resource_legal_published_in_official-journal ?q .\n            ?q cdm:publication_general_date_publication ?ojDatePublicationOld .\n        }\n        OPTIONAL {\n            FILTER (!BOUND(?ojDatePublicationOld))\n            ?s cdm:official-journal-act_date_publication ?ojDatePublicationNew .\n        }\n        BIND(IF(BOUND(?ojDatePublicationOld), ?ojDatePublicationOld, ?ojDatePublicationNew) as ?ojDatePublication)\n\n        FILTER (".concat(filters, ") \n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {String} match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {
  return bindings.filter(function (binding) {
    return binding.ojDatePublication.value === "".concat(attributes['data-ref-year'], "-").concat(String(attributes['data-ref-month']).padStart(2, '0'), "-").concat(String(attributes['data-ref-day']).padStart(2, '0')) && binding.year.value === String(attributes['data-ref-year']) && binding.natNumber.value === String(attributes['data-ref-no']);
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],45:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolvePartnershipCouncilDecisionNumber = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * Partnership Council decisions use a different register for the act numbering so we need Cellar to resolve the correct identifier/URL.
 * Example: `Décision No 1/2021 du Conseil de partenariat` -  http://data.europa.eu/eli/dec/2021/356/oj
 * 
 * 
 * Processes placeholders: LD_CELLAR_PC_NUMBER_CELEX, LD_CELLAR_PC_NUMBER_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolvePartnershipCouncilDecisionNumber = exports.resolvePartnershipCouncilDecisionNumber = function resolvePartnershipCouncilDecisionNumber(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_PC_NUMBER_CELEX).map(function (attributes) {
      // strip placeholders
      return {
        number: attributes["data-ref-no"],
        celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), ''),
        year: String(attributes["data-ref-celex"]).substr(1, 4)
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            return binding.id.value.includes(rawCelexId);
          });
          var optimalBinding = findOptimalBinding(attributes, currentBindings);
          //try to resolve duplicate using matched reference

          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":PC:NUMBER:CELEX") !== -1) {
              // use the subnumber from the optimal CELEX id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6).replace(rawCelexId, '') : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":PC:NUMBER:ELI") !== -1) {
              // use the subnumber from the optimal ELI URL
              var eliParts = optimalBinding ? (optimalBinding.eli.value || "").split("/eli/") : [];
              if (eliParts.length > 1) {
                var arr = eliParts[1].match(/^[a-z_]+\/\d+\/(.+)$/i);
                var replacementEli = arr && arr[1] ? arr[1] : "";
                offset = (0, _index2.replace)(offset, placeholder, replacementEli);
              }
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(STRSTARTS( ?workId, \"celex:".concat(attributesList[i].celexId, "\") AND \n            REGEX(?title_, \"^Decision.No.").concat(attributesList[i].number, "/").concat(attributesList[i].year, "\"))");
  }
  var query = "\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        \nSELECT DISTINCT \n    ?workId as ?id\n    ?title_ as ?title\n    ?eli    \nWHERE {  \n    graph ?ge { \n        ?exp cdm:expression_belongs_to_work ?s .\n        ?exp cdm:expression_title ?title_\n    }\n    graph ?g { \n        ?exp cdm:expression_uses_language ?lang\n        filter(?lang=lang:ENG).  \n    } \n    ?s cdm:resource_legal_eli ?eli.\n    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/EURUN> .\n    ?s cdm:work_id_document ?workId. \n    FILTER (".concat(filters, ") \n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param string match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {
  // query is strict enough, should only return 1 result
  var ref = "NO " + attributes["data-ref-no"] + "/" + attributes["data-ref-year"];
  var re = new RegExp(String.fromCharCode(160), "gi");
  return bindings.filter(function (binding) {
    var upperTitle = (binding.title.value || "").toUpperCase().replace(re, " ");
    return upperTitle.indexOf(ref) !== -1 && upperTitle.indexOf("PARTNERSHIP COUNCIL") !== -1;
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],46:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveStaffRegsConsolidation = void 0;
var _functions = require("../../../../utils/functions.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
var _data = require("../../../../utils/data.js");
/**
 * NOT IN USE
 * Staff Regulations rule can use this transformer to resolve the latest consolidation. 
 * 
 * Processes placeholders: LD_CELLAR_CONSOLIDATION_CELEX, LD_CELLAR_CONSOLIDATION_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveStaffRegsConsolidation = exports.resolveStaffRegsConsolidation = function resolveStaffRegsConsolidation(matches) {
  return new Promise(function (resolve, reject) {
    var query = getQuery();
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[^\\s}]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var optimalBinding = bindings.pop();
          offset.rule.ld.forEach(function (placeholder) {
            if (placeholder.indexOf(":CONSOLIDATION:CELEX") !== -1) {
              // use the subnumber from the optimal CELEX id
              var replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6).replace(rawCelexId, '') : '';
              offset = (0, _index2.replace)(offset, placeholder, replacementCelex);
            }
            if (placeholder.indexOf(":CONSOLIDATION:ELI") !== -1) {
              // use the subnumber from the optimal ELI URL
              var eliParts = (optimalBinding.eli.value || "").split("/eli/");
              if (eliParts.length > 1) {
                var date = eliParts[1].split("/").slice(-1).pop();
                var replacementEli = date && /^\d\d\d\d-\d\d-\d\d$/.test(date) ? date : "";
                offset = (0, _index2.replace)(offset, placeholder, replacementEli);
              }
            }
          });
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};
function getQuery() {
  var query = "\n        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n        PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\n        PREFIX skos:<http://www.w3.org/2004/02/skos/core#>\n        PREFIX dc:<http://purl.org/dc/elements/1.1/>\n        PREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>\n        PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n        PREFIX owl:<http://www.w3.org/2002/07/owl#>\n        \n        SELECT DISTINCT \n        ?workId as ?id\n        ?title_ as ?title\n        ?eli\n\n        WHERE {  \n        graph ?ge { \n            ?exp cdm:expression_belongs_to_work ?s .\n            ?exp cdm:expression_title ?title_\n        }\n        graph ?g { \n            ?exp cdm:expression_uses_language ?lang\n            filter(?lang=lang:ENG).  \n        } \n        ?s cdm:work_id_document ?workId. \n        ?s cdm:resource_legal_year '1962'^^xsd:gYear . \n        ?s cdm:resource_legal_type 'R'^^xsd:string .\n        ?s cdm:resource_legal_eli ?eli\n\n        FILTER ( (STRSTARTS( ?workId, \"celex:01962R0031\"))) \n        }\n        ORDER BY DESC(?workId)\n        LIMIT 1\n        ";
  return query;
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],47:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveEliBaseUrl = void 0;
var _index = require("../../../utils/index.js");
/**
 * Resolve subdivisions - inject a context legal act (ELI) to use with detected subdivisions
 * The base ELI is fetched from the $LD_ELI_BASE_URL global (@see R2L.settings.constants)
 * 
 * Processes placeholders: ELI_BASE_URL
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
var resolveEliBaseUrl = exports.resolveEliBaseUrl = function resolveEliBaseUrl(matches) {
  return new Promise(function (resolve, reject) {
    Object.keys(matches).forEach(function (key) {
      matches[key].offsets.forEach(function (offset) {
        offset.rule.ld.forEach(function (placeholder) {
          if (placeholder === _index.LD_ELI_BASE_URL) {
            var replacementEliUrl = R2L.getConstant(_index.LD_ELI_BASE_URL) || "";
            offset = (0, _index.replace)(offset, placeholder, replacementEliUrl);
          }
        });
      });
    });
    resolve(matches);
  });
};

},{"../../../utils/index.js":49}],48:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.resolveUnitedNationsRegulationActs = void 0;
var _functions = require("../../../../utils/functions.js");
var _data = require("../../../../utils/data.js");
var _index = require("../../../../manager/index.js");
var _index2 = require("../../../utils/index.js");
var _request = require("../../../../utils/request.js");
/**
 * The UN uses a different register for act numbering so we need CELLAR to resolve the correct identifier/URL.
 * Example: `UN Regulation No 155` - http://data.europa.eu/eli/reg/2021/387/oj
 * 
 * Processes placeholders: LD_CELLAR_UN_REG_CELEX, LD_CELLAR_UN_REG_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
var resolveUnitedNationsRegulationActs = exports.resolveUnitedNationsRegulationActs = function resolveUnitedNationsRegulationActs(matches) {
  return new Promise(function (resolve, reject) {
    // fill CELEX/ELI placeholders
    var attributesList = (0, _data.extractCelexAttributes)(matches, _index2.LD_CELLAR_UN_REG).map(function (attributes) {
      // strip placeholders
      return {
        number: attributes["data-ref-no"]
      };
    });
    if (attributesList.length === 0) {
      resolve(matches);
      return;
    }
    var query = getQuery(attributesList);
    var format = 'application/json';
    (0, _request.getRequestPromise)(R2L.ldm.getEndpoint(_index.LD_TYPE_CELEX), "POST", {
      query: query,
      format: format,
      origin: '*'
    }).then(function (response) {
      if (!response || !response.results) {
        resolve(matches);
        return;
      }

      // de-duplicate celex ids
      var bindings = response.results.bindings;
      Object.keys(matches).forEach(function (key) {
        matches[key].offsets.forEach(function (offset) {
          var attributes = (0, _functions.extractAttributes)(offset.views);
          var celexId = (0, _data.extractCelexId)(attributes);
          if (!celexId) {
            return;
          }
          var rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

          //nothing to parse
          if (celexId === rawCelexId) {
            return;
          }
          var match = offset.context || offset.match;
          // check if celexId is unique among the bindings
          var currentBindings = bindings.filter(function (binding) {
            return binding.id.value.includes(rawCelexId);
          });
          var optimalBinding = findOptimalBinding(match, attributes, currentBindings);
          //try to resolve duplicate using matched reference

          // use the optimal CELEX id
          var replacementCelex = (optimalBinding ? optimalBinding.id.value : '').replace("celex:", "");
          offset = (0, _index2.replace)(offset, _index2.LD_CELLAR_UN_REG_CELEX, replacementCelex);

          // use optimal ELI url
          var replacementEli = optimalBinding ? optimalBinding.eli.value : "";
          offset = (0, _index2.replace)(offset, _index2.LD_CELLAR_UN_REG_ELI, replacementEli);
        });
      });
      resolve(matches);
    })["catch"](function (error) {
      console.error(error);
      resolve(matches);
    });
  });
};

/**
 * Query by ref number and author
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
  var filters = "";
  for (var i = 0; i < attributesList.length; i++) {
    if (i > 0) {
      filters += " || ";
    }
    filters += "(?type='X'^^xsd:string AND REGEX(?title_, '\\\\bRegulation[\u202F\xA0 ]No[\u202F\xA0 ]".concat(attributesList[i].number, "\\\\b', \"i\"))");
  }
  var query = "\nPREFIX cdm:<http://publications.europa.eu/ontology/cdm#>\nPREFIX owl:<http://www.w3.org/2002/07/owl#>\nPREFIX lang:<http://publications.europa.eu/resource/authority/language/>\n        \nSELECT DISTINCT \n    ?workId as ?id\n    ?title_ as ?title\n    ?eli    \nWHERE {  \n    graph ?ge { \n        ?exp cdm:expression_belongs_to_work ?s .\n        ?exp cdm:expression_title ?title_\n    }\n    graph ?g { \n        ?exp cdm:expression_uses_language ?lang\n        filter(?lang=lang:ENG).  \n    } \n    ?s cdm:resource_legal_eli ?eli.\n    ?s cdm:resource_legal_type ?type .\n    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/UNECE> . \n    ?s cdm:work_id_document ?workId . \n    FILTER (".concat(filters, ") \n    FILTER (STRSTARTS( ?workId, \"celex:\"))\n}");
  return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {String} match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, attributes, bindings) {
  // find the reference number eg. "Regulation No 155"
  return bindings.filter(function (binding) {
    return (0, _index2.sanitize)(binding.title.value).match("^(UN )?Regulation No " + attributes["data-ref-no"] + "\\b");
  }).pop();
}

},{"../../../../manager/index.js":18,"../../../../utils/data.js":54,"../../../../utils/functions.js":56,"../../../../utils/request.js":61,"../../../utils/index.js":49}],49:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LD_OJ_CONDITION = exports.LD_ELI_BASE_URL = exports.LD_CONSIL_CONDITION = exports.LD_CELLAR_UN_REG_ELI = exports.LD_CELLAR_UN_REG_CELEX = exports.LD_CELLAR_UN_REG = exports.LD_CELLAR_SUBNUMBER_CELEX = exports.LD_CELLAR_PC_NUMBER_ELI = exports.LD_CELLAR_PC_NUMBER_CELEX = exports.LD_CELLAR_OJ_TYPE_ELI = exports.LD_CELLAR_OJ_CELEX = exports.LD_CELLAR_EUCASE_SUBNUMBER_CELEX = exports.LD_CELLAR_EUCASE_JOINED_JUDGEMENT = exports.LD_CELLAR_EEAJC_NUMBER_ELI = exports.LD_CELLAR_EEAJC_NUMBER_CELEX = exports.LD_CELLAR_ECB_ELI = exports.LD_CELLAR_ECB_CELEX = exports.LD_CELLAR_COR_NUMBER_CELEX = exports.LD_CELLAR_CONSOLIDATION_ELI = exports.LD_CELLAR_CONSOLIDATION_CELEX = exports.LD_CELLAR_ACT_URL_ELI = exports.LD_CELLAR_ACT_NUMBER_CELEX = exports.LD_CELEX_IF_NONE_CONDITION = exports.LD_CELEX_CONDITION = exports.LD_ACTIVE = void 0;
exports.clearPlaceholders = clearPlaceholders;
exports.sanitize = exports.replaceStr = exports.replace = exports.hasItem = void 0;
// legacy act rule 
var LD_CELLAR_ACT_NUMBER_CELEX = exports.LD_CELLAR_ACT_NUMBER_CELEX = "LD:CELLAR:ACT:NUMBER:CELEX";
var LD_CELLAR_ACT_URL_ELI = exports.LD_CELLAR_ACT_URL_ELI = "LD:CELLAR:ACT:URL:ELI";

// committee of regions decision rule
var LD_CELLAR_COR_NUMBER_CELEX = exports.LD_CELLAR_COR_NUMBER_CELEX = "LD:CELLAR:COR:NUMBER:CELEX";

// eea joint committee decision rule
var LD_CELLAR_EEAJC_NUMBER_CELEX = exports.LD_CELLAR_EEAJC_NUMBER_CELEX = "LD:CELLAR:EEAJC:NUMBER:CELEX";
var LD_CELLAR_EEAJC_NUMBER_ELI = exports.LD_CELLAR_EEAJC_NUMBER_ELI = "LD:CELLAR:EEAJC:NUMBER:ELI";

// partnership council decision rule
var LD_CELLAR_PC_NUMBER_CELEX = exports.LD_CELLAR_PC_NUMBER_CELEX = "LD:CELLAR:PC:NUMBER:CELEX";
var LD_CELLAR_PC_NUMBER_ELI = exports.LD_CELLAR_PC_NUMBER_ELI = "LD:CELLAR:PC:NUMBER:ELI";

// OJ ELI target
var LD_CELLAR_OJ_CELEX = exports.LD_CELLAR_OJ_CELEX = "LD:CELLAR:OJ:CELEX";
var LD_CELLAR_OJ_TYPE_ELI = exports.LD_CELLAR_OJ_TYPE_ELI = "LD:CELLAR:OJ:TYPE:ELI";

// ECB ELI target
var LD_CELLAR_ECB_CELEX = exports.LD_CELLAR_ECB_CELEX = "LD:CELLAR:ECB:CELEX";
var LD_CELLAR_ECB_ELI = exports.LD_CELLAR_ECB_ELI = "LD:CELLAR:ECB:ELI";

// EUCASE Order subnumber
var LD_CELLAR_EUCASE_SUBNUMBER_CELEX = exports.LD_CELLAR_EUCASE_SUBNUMBER_CELEX = "LD:CELLAR:EUCASE:SUBNUMBER:CELEX";

// generic marking used for act rule, celex rule
var LD_CELLAR_SUBNUMBER_CELEX = exports.LD_CELLAR_SUBNUMBER_CELEX = "LD:CELLAR:SUBNUMBER:CELEX";

// marking used in subdivision rule
var LD_ELI_BASE_URL = exports.LD_ELI_BASE_URL = "LD:ELI:BASE:URL";
var LD_CELLAR_EUCASE_JOINED_JUDGEMENT = exports.LD_CELLAR_EUCASE_JOINED_JUDGEMENT = "LD:CELLAR:EUCASE:JOINED:JUDGEMENT";

// staff regs rule
var LD_CELLAR_CONSOLIDATION_CELEX = exports.LD_CELLAR_CONSOLIDATION_CELEX = "LD:CELLAR:CONSOLIDATION:CELEX";
var LD_CELLAR_CONSOLIDATION_ELI = exports.LD_CELLAR_CONSOLIDATION_ELI = "LD:CELLAR:CONSOLIDATION:ELI";
var LD_CELLAR_UN_REG = exports.LD_CELLAR_UN_REG = "LD:CELLAR:UN:REG";
var LD_CELLAR_UN_REG_CELEX = exports.LD_CELLAR_UN_REG_CELEX = "LD:CELLAR:UN:REG:CELEX";
var LD_CELLAR_UN_REG_ELI = exports.LD_CELLAR_UN_REG_ELI = "LD:CELLAR:UN:REG:ELI";

// filter markings
var LD_ACTIVE = exports.LD_ACTIVE = "ld-active";
var LD_CELEX_CONDITION = exports.LD_CELEX_CONDITION = "cellar-exists-celex";
var LD_CELEX_IF_NONE_CONDITION = exports.LD_CELEX_IF_NONE_CONDITION = "cellar-if-none-celex";
var LD_OJ_CONDITION = exports.LD_OJ_CONDITION = "cellar-exists-oj";
var LD_CONSIL_CONDITION = exports.LD_CONSIL_CONDITION = "cellar-exists-consil";

/**
 * Clears placeholders
 * @param {Object} matches 
 * @param {String|null} type (LD:CELLAR:COR:NUMBER:CELEX, LD:CELLAR:SUBNUMBER:CELEX)
 * @param {String} replacement
 * 
 * @returns {Object} matches 
 */
function clearPlaceholders(matches, type, replacement) {
  replacement = replacement || "";

  // go through matches and fill LD placeholders
  Object.keys(matches).forEach(function (key) {
    if (matches[key].offsets) {
      matches[key].offsets.forEach(function (offset) {
        var rule = offset.rule;
        if (rule.ld && rule.ld.length > 0) {
          if (!type || rule.ld.indexOf(type) !== -1) {
            rule.ld.forEach(function (placeholder) {
              offset = replace(offset, placeholder, replacement);
            });
          }
        }
      });
    }
  });
  return matches;
}

/**
 * Replace linked-data placeholders in the match object
 * @param {Object} match 
 * @param {String} placeholder LD:CELLAR:NUMBER:CELEX|LD:CELLAR:SUBNUMBER:ELI
 * @param {String} replacement (defaults to '')
 * @returns {Object} match
 */
var replace = exports.replace = function replace(match, placeholder, replacement) {
  Object.keys(match.views).forEach(function (key) {
    match.views[key] = replaceStr(String(match.views[key]), placeholder, replacement);
  });
  match.alternatives.forEach(function (alternative) {
    alternative.view = replaceStr(alternative.view, placeholder, replacement);
  });
  return match;
};

/**
 * Replace placeholder in string
 * @param {String} str 
 * @param {String} placeholder 
 * @param {String} replacement
 * 
 * @returns {String}  
 */
var replaceStr = exports.replaceStr = function replaceStr(str, placeholder, replacement) {
  replacement = replacement || '';
  // if the placeholder provides a default and we have no replacement then use it
  // eg. {{ LD:CELLAR:CONSOLIDATION:CELEX|2020-01-01 }} 
  var regex = new RegExp('{{\\s?' + placeholder + '(?:\\|([^\\s}]*))?\\s?}}', 'gi');
  return String(str).replace(regex, function (match, capture) {
    return capture && !replacement ? capture : replacement;
  });
};

/**
 * Smooth over spaces and odd chars
 * @param {String} str
 * @returns {String} 
 */
var sanitize = exports.sanitize = function sanitize(str) {
  str = str.replace(/[\u202F\u00A0]/g, " ");
  return str;
};
var hasItem = exports.hasItem = function hasItem(str, item) {
  if (!str) {
    return false;
  }
  var items = String(str).split(" ").filter(function (l) {
    return !!l;
  }).map(function (l) {
    return l.trim();
  });
  return items.indexOf(item) !== -1;
};

},{}],50:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TRANSLATIONS = exports.LANGUAGE_MAP = void 0;
/**
 * Translations map
 * Used by the linked-data feature to build tooltip labels
 * Supports templated strings:
 *   # translation definition
 *   "my.translation.tag": { "EN": "{{ organization }} not found" }
 *
 *   # returns `EU COMM not found`
 *   getTranslation("my.translation.tag", "EN", { organization: "EU COMM"});
 */
var TRANSLATIONS = exports.TRANSLATIONS = {
  "ld.not.found": {
    "EN": "No linked data found"
  },
  "ld.connection.failure": {
    "EN": "Linked data connection failure"
  },
  "eurlex.act.original": {
    "EN": "Access initial legal act",
    "BG": "Достъп до първоначалния правен акт",
    "ES": "Acceder al acto jurídico inicial",
    "CS": "Jít na původní právní akt",
    "DA": "Adgang til den oprindelige retsakt",
    "DE": "Zum ursprünglichen Rechtsakt",
    "ET": "Esialgse õigusakti juurde",
    "EL": "Πρόσβαση στην αρχική νομική πράξη",
    "FR": "Accéder à l’acte juridique initial",
    "GA": "Téigh chuig an ngníomh dlí tosaigh",
    "HR": "Pristup početnom pravnom aktu",
    "IT": "Accedi all'atto giuridico iniziale",
    "LV": "Aplūkot sākotnējo tiesību aktu",
    "LT": "Žiūrėti pradinį teisės aktą",
    "HU": "Hozzáférés az eredeti jogi aktushoz",
    "MT": "Aċċessa l-att legali inizjali",
    "NL": "Naar de oorspronkelijke rechtshandeling",
    "PL": "Dostęp do pierwotnego aktu prawnego",
    "PT": "Aceder ao ato jurídico original",
    "RO": "Actul juridic inițial",
    "SK": "Prejsť na pôvodný právny akt",
    "SL": "Dostop do prvotnega pravnega akta",
    "FI": "Siirry alkuperäiseen säädökseen",
    "SV": "Gå till ursprunglig rättsakt"
  },
  "eurlex.consolidated.text": {
    "EN": "Consolidated text",
    "BG": "Консолидиран текст",
    "ES": "Texto consolidado",
    "CS": "Konsolidovaný text",
    "DA": "Konsolideret tekst",
    "DE": "Konsolideeritud tekst",
    "ET": "Konsolideeritud tekst",
    "EL": "Ενοποιημένο κείμενο",
    "FR": "Texte consolidé",
    "GA": "Téacs comhdhlúite",
    "HR": "Pročišćeni tekst",
    "IT": "Testo consolidato",
    "LV": "Konsolidēts teksts",
    "LT": "Konsoliduotas tekstas",
    "HU": "Egységes szerkezetbe foglalt szöveg",
    "MT": "Test konsolidat",
    "NL": "Geconsolideerde tekst",
    "PL": "Tekst skonsolidowany",
    "PT": "Texto consolidado",
    "RO": "Text consolidat",
    "SK": "Konsolidované znenie",
    "SL": "Konsolidirano besedilo",
    "FI": "Konsolidoitu teksti",
    "SV": "Konsoliderad text"
  },
  "eurlex.act.changed": {
    "EN": "This act has been changed. Current consolidated version:",
    "FR": "Cet acte a été modifié. Version consolidée actuelle:",
    "DE": "Dieser Rechtsakt wurde geändert. Aktuelle konsolidierte Fassung:",
    "ES": "Este acto se ha modificado. Versión consolidada actual:",
    "BG": "Този акт е изменен. Настояща консолидирана версия:",
    "CS": "Tento akt byl změněn. Stávající konsolidované znění:",
    "DA": "Denne retsakt er ændret. Nuværende konsoliderede version:",
    "ET": "Seda akti on muudetud. Praegune konsolideeritud versioon:",
    "EL": "Η πράξη αυτή έχει τροποποιηθεί. Τρέχουσα ενοποιημένη έκδοση:",
    "GA": "thraíodh an gníomh seo. Leagan comhdhlúite reatha:",
    "HR": "Ovaj je akt izmijenjen. Trenutačni pročišćeni tekst:",
    "IT": "Questo atto è stato modificato. Versione consolidata attuale:",
    "LV": "Šis tiesību akts ticis izmainīts. Pašreizējā konsolidētā versija:",
    "LT": "Šis aktas pakeistas. Dabartinė konsoliduota redakcija:",
    "HU": "Ez a jogi aktus módosult. Jelenlegi egységes szerkezetbe foglalt változat:",
    "MT": "Danl-attinbidel. Verżjoni kkonsolidata kurrenti:",
    "NL": "Deze handeling is gewijzigd. Huidige geconsolideerde versie:",
    "PL": "Tenaktzostałzmieniony. Aktualna wersja skonsolidowana:",
    "PT": "Este ato foi alterado. Versão consolidada atual:",
    "RO": "Acest act a fost modificat. Versiunea actuală consolidată:",
    "SK": "Tentoaktbolzmenený. Aktuálne konsolidované znenie:",
    "SL": "Ta akt je bil spremenjen. Trenutna prečiščena različica:",
    "FI": "Tätä säädöstä on muutettu. Viimeisin konsolidoitu versio:",
    "SV": "Den här rättsakten har ändrats. Aktuell konsoliderad version:"
  },
  "eurlex.act.initial": {
    "EN": "Access initial legal act",
    "FR": "Accéder à l’acte juridique initial",
    "DE": "Zum ursprünglichen Rechtsakt",
    "ES": "Acceder al acto jurídico inicial",
    "BG": "Достъп до първоначалния правен акт",
    "CS": "Jít na původní právní akt",
    "DA": "Adgang til den oprindelige retsakt",
    "ET": "Esialgse õigusakti juurde",
    "EL": "Πρόσβαση στην αρχική νομική πράξη",
    "GA": "Téigh chuig an ngníomh dlí tosaigh",
    "HR": "Pristup početnom pravnom aktu",
    "IT": "Accedi all'atto giuridico iniziale",
    "LV": "Aplūkot sākotnējo tiesību aktu",
    "LT": "Pradinis teisės aktas",
    "HU": "Hozzáférés az eredeti jogi aktushoz",
    "MT": "Aċċessa l-att legali inizjali",
    "NL": "Naar de oorspronkelijke rechtshandeling",
    "PL": "Dostęp do pierwotnego aktu prawnego",
    "PT": "Aceder ao ato jurídico original",
    "RO": "Actul juridic inițial",
    "SK": "Prejsť na pôvodný právny akt",
    "SL": "Dostop do prvotnega pravnega akta",
    "FI": "Siirry alkuperäiseen säädökseen",
    "SV": "Gå till ursprunglig rättsakt"
  },
  "eurlex.act.in.force": {
    "EN": "In force",
    "FR": "En vigeur",
    "DE": "In Kraft",
    "ES": "Vigente",
    "BG": "В сила",
    "CS": "platné",
    "DA": "I kraft",
    "ET": "Kehtivad",
    "EL": "Ισχύει",
    "GA": "I bhfeidhm",
    "HR": "Na snazi",
    "IT": "In vigore",
    "LV": "Spēkā",
    "LT": "Galioja",
    "HU": "Hatályos",
    "MT": "Fis-seħħ",
    "NL": "Van kracht",
    "PL": "Obowiązujące",
    "PT": "Em vigor",
    "RO": "care este în vigoare",
    "SK": "Účinné",
    "SL": "V veljavi",
    "FI": "Voimassa",
    "SV": "Gällande"
  },
  "eurlex.act.not.in.force": {
    "EN": "Not in force",
    "FR": "Pas en vigueur",
    "DE": "Nicht in Kraft",
    "ES": "No está vigente",
    "BG": "Не е в сила",
    "CS": "Není v platné",
    "DA": "Ikke i kraft",
    "ET": "Ei kehti",
    "EL": "Δεν ισχύει",
    "GA": "Níl sé i bhfeidhm",
    "HR": "Nije na snazi",
    "IT": "Non in vigore",
    "LV": "Nav spēkā",
    "LT": "Negalioja",
    "HU": "Nincs érvényben",
    "MT": "Mhux fis-seħħ",
    "NL": "Niet van kracht",
    "PL": "Nie obowiązuje",
    "PT": "Não está em vigor",
    "RO": "Nu este în vigoare",
    "SK": "Neplatná",
    "SL": "Ni v veljavi",
    "FI": "Ei voimassa",
    "SV": "Ej i kraft"
  },
  "eurlex.act.no.longer.in.force": {
    "EN": "No longer in force",
    "FR": "Plus en vigueur",
    "DE": "Nicht mehr in Kraft",
    "ES": "Ya no está vigente",
    "BG": "Вече не е в сила",
    "CS": "Již není platné",
    "DA": "Ikke længere i kraft",
    "ET": "Kehtetud",
    "EL": "Δεν ισχύει πλέον",
    "GA": "Gan a bheith i bhfeidhm a thuilleadh",
    "HR": "Više nije na snazi",
    "IT": "Non più in vigore",
    "LV": "Vairs nav spēkā",
    "LT": "Nebegalioja",
    "HU": "Már nem hatályos",
    "MT": "M’għadux fis-seħħ",
    "NL": "Niet meer van kracht",
    "PL": "Już nie obowiązuje",
    "PT": "Já não está em vigor",
    "RO": "Nu mai este în vigoare",
    "SK": "Už nie je účinné",
    "SL": "Ne velja več",
    "FI": "Ei enää voimassa",
    "SV": "Inte längre i kraft"
  },
  "eurlex.act.validity.date.end": {
    "EN": "Date of end of validity:",
    "FR": "Date de fin de validité:",
    "DE": "Datum des Endes der Gültigkeit:",
    "ES": "Fecha de fin de validez:",
    "BG": "Дата на изтичане на валидността:",
    "CS": "Datum konce platnosti:",
    "DA": "Gyldighedsperiodens slutdato:",
    "ET": "Kehtetuks muutumise kuupäev:",
    "EL": "Ημερομηνία λήξης ισχύος:",
    "GA": "Deireadh bailíochta:",
    "HR": "Datum isteka:",
    "IT": "Data di fine della validità:",
    "LV": "Datums, līdz kuram ir spēkā:",
    "LT": "Galiojimo pabaigos data:",
    "HU": "Érvényesség vége:",
    "MT": "Data tat-tmiem tal-validitàà:",
    "NL": "Datum einde geldigheid:",
    "PL": "Data zakończenia ważności:",
    "PT": "Data do termo de validade:",
    "RO": "Data încetării:",
    "SK": "Dátum ukončenia platnosti:",
    "SL": "Datum konca veljavnosti:",
    "FI": "Voimassaolon päättymispäivämäärä:",
    "SV": "Sista giltighetsdag:"
  },
  "eurlex.act.repealed.by": {
    "EN": "Repealed and replaced by",
    "FR": "abrogé et remplacé par",
    "DE": "Aufgehoben und ersetzt durch",
    "ES": "derogado y sustituido por",
    "BG": "отменен и заместен от",
    "CS": "Zrušeno a nahrazeno",
    "DA": "ophævet og erstattet af",
    "ET": "kehtetuks tunnistatud ja asendatud",
    "EL": "καταργήθηκε και αντικαταστάθηκε από",
    "GA": "Arna aisghairm agus arna ionadú ag",
    "HR": "Stavljeno izvan snage i zamijenjeno",
    "IT": "abrogato e sostituito da",
    "LV": "Atcelts un aizstāts ar",
    "LT": "pakeitė ir anuliavo",
    "HU": "hatályon kívül helyzete és felváltotta",
    "MT": "Revokat u sostitwit bi",
    "NL": "afgeschaft en vervangen door",
    "PL": "Uchylony i zastąpiony przez",
    "PT": "revogado e substituído por",
    "RO": "abrogat şi înlocuit prin",
    "SK": "Zrušil a nahradil",
    "SL": "se razveljavijo in nadomestijo z",
    "FI": "Kumoava ja korvaava",
    "SV": "upphävd och ersatt av"
  },
  "eurlex.act.access.current.version": {
    "EN": "Access current version",
    "FR": "Accéder à la version actuelle",
    "DE": "Zur geltenden Fassung",
    "ES": "Acceder a la versión actual",
    "BG": "Достъп до настоящата версия",
    "CS": "Jít na aktuální verzi",
    "DA": "Adgang til nuværende version",
    "ET": "Praeguse versiooni juurde",
    "EL": "Πρόσβαση στην τρέχουσα έκδοση",
    "HR": "Pristup verziji koja je trenutačno na snazi",
    "IT": "Accedi alla versione attuale",
    "LV": "Aplūkot spēkā esošo versiju",
    "LT": "Dabartinė redakcija",
    "HU": "Hozzáférés a jelenlegi változathoz",
    "MT": "Aċċessa l-verżjoni kurrenti",
    "NL": "Huidige versie",
    "PL": "Dostęp do aktualnej wersji",
    "PT": "Aceder à versão atual",
    "RO": "Versiunea actuală",
    "SK": "Prejsť k aktuálnej verzii",
    "SL": "Dostop do trenutne različice",
    "FI": "Siirry nykyiseen versioon",
    "SV": "Gå till aktuell version"
  },
  "eurlex.act.notification.pending": {
    "EN": "Date of entry into force unknown (pending notification) or not yet in force. Date of effect: ",
    "FR": "Date d’entrée en vigueur inconnue (en attente de notification) ou pas encore en vigueur. Date de prise d'effet: ",
    "DE": "Datum des Inkrafttretens unbekannt (wg. ausstehender Mitteilung) oder Rechtsakt noch nicht in Kraft. Datum des Wirksamwerdens: ",
    "ES": "Fecha de entrada en vigor desconocida (pendiente de notificación) o aún no está en vigor. Fecha de efecto: ",
    "BG": "Датата на влизане в сила не е известна (предстоящо уведомление) или документът все още не е в сила., Дата на влизане в сила: ",
    "CS": "Datum vstupu dokumentu v platnost není známo (až do jeho oznámení), nebo dokument dosud nevstoupil v platnost., Datum nabytí účinku: ",
    "DA": "Dato for ikrafttrædelse kendes ikke (afventer meddelelse), eller retsakten er endnu ikke trådt i kraft., Ikrafttrædelsesdato: ",
    "ET": "Jõustumiskuupäev teadmata (teate ootel) või veel ei kehti., Jõustumise kuupäev: ",
    "EL": "Η ημερομηνία έναρξης ισχύος δεν είναι γνωστή (εν αναμονή της κοινοποίησης) ή δεν έχει ακόμη τεθεί σε ισχύ., Ημερομηνία θέσης σε ισχύ: ",
    "GA": "Níl an dáta teacht i bhfeidhm ar eolas (táthar ag fanacht lena fhógairt), sin nó níl sé i bhfeidhm fós., Teacht i bhfeidhm: ",
    "HR": "Datum stupanja na snagu nije poznat (u iščekivanju obavijesti) ili akt nije još stupio na snagu., Datum stupanja na snagu: ",
    "IT": "Data di entrata in vigore sconosciuta (in attesa di notifica) o non ancora in vigore., Data di entrata in vigore: ",
    "LV": "Stāšanās spēkā datums nav zināms (gaidāms paziņojums) vai vēl nav spēkā. Spēkā stāšanās datums: ",
    "LT": "Įsigaliojimo data nežinoma (dar negautas pranešimas) arba dar neįsigaliojo., Įsigaliojimo data: ",
    "HU": "Még nem lehet tudni, mikor lép hatályba (értesítés folyamatban), vagy még nem lépett hatályba., Hatálybalépés időpontja: ",
    "MT": "Data tad-dħul fis-seħħ mhux magħrufa (notifika pendenti) jew għada mhux fis-seħħ., Data tal-effett: ",
    "NL": "Nog niet in werking of datum inwerkingtreding onbekend (in afwachting van kennisgeving)., Datum inwerkingtreding: ",
    "PL": "Data wejścia w życie nieznana (jeszcze niezgłoszona) lub jeszcze nie obowiązuje., Data wejściawżycie: ",
    "PT": "Data de entrada em vigor desconhecida (na pendência de notificação) ou ainda não em vigor., Data de efeito: ",
    "RO": "Nu se cunoaște data intrării în vigoare (în așteptarea notificării) sau nu a intrat încă în vigoare., Dataintrăriiînvigoare: ",
    "SK": "Dátum nadobudnutia platnosti dokumentu nie je známy (až do jeho oznámenia) alebo dokument ešte nenadobudol účinnosť., Dátum nadobudnutia účinnosti: ",
    "SL": "Datum začetka veljavnosti ni znan (do uradnega obvestila) oziroma še ne velja., Datum začetka učinkovanja: ",
    "FI": "Voimaantulopäivä tuntematon (ilmoitusmenettely kesken) tai ei vielä voimassa., Voimaantulopäivämäärä: ",
    "SV": "Dag för ikraftträdande okänd (i avvaktan på delgivning) eller rättsakten har ännu inte trätt i kraft., Dag för ikraftträdande: "
  },
  'official.journal.label': {
    "EN": "OJ {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "FR": "JO {{ ojPart }} {{ ojNumber }} du {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "DE": "ABl. {{ ojPart }} {{ ojNumber }} vom {{ ojPublicationDate }}, S. {{ ojPageFirst }}",
    "ES": "DO {{ ojPart }} {{ ojNumber }} de {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "BG": "OB {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}г., стр. {{ ojPageFirst }}",
    "CS": "Úř. věst. {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, s. {{ ojPageFirst }}",
    "DA": "EUT {{ ojPart }} {{ ojNumber }} af {{ ojPublicationDate }}, s. {{ ojPageFirst }}",
    "ET": "ELT {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, lk {{ ojPageFirst }}",
    "EL": "ΕΕ {{ ojPart }} {{ ojNumber }} της {{ ojPublicationDate }}, σ. {{ ojPageFirst }}",
    "GA": "IO {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, lgh. {{ ojPageFirst }}",
    "HR": "SL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}., str. {{ ojPageFirst }}",
    "IT": "GU {{ ojPart }} {{ ojNumber }} del {{ ojPublicationDate }}, pagg. {{ ojPageFirst }}",
    "LV": "OV {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}., {{ ojPageFirst }}. lpp.",
    "LT": "OL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDateYear }} {{ ojPublicationDateMonth }} {{ ojPublicationDateDay }}, p. {{ ojPageFirst }}",
    "HU": "HL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDateYear }}.{{ ojPublicationDateMonth }}.{{ ojPublicationDateDay }}., {{ ojPageFirst }} o.",
    "MT": "ĠU {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "NL": "PB {{ ojPart }} {{ ojNumber }} van {{ ojPublicationDate }}, blz. {{ ojPageFirst }}",
    "PL": "Dz.U. {{ ojPart }} {{ ojNumber }} z {{ ojPublicationDate }}, str. {{ ojPageFirst }}",
    "PT": "JO {{ ojPart }} {{ ojNumber }} de {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "RO": "JO {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, p. {{ ojPageFirst }}",
    "SK": "Ú. v. EÚ {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, s. {{ ojPageFirst }}",
    "SL": "UL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, str. {{ ojPageFirst }}",
    "FI": "EUVL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, s. {{ ojPageFirst }}",
    "SV": "EUT {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}, s. {{ ojPageFirst }}"
  },
  'official.journal.label.nopage': {
    "EN": "OJ {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "FR": "JO {{ ojPart }} {{ ojNumber }} du {{ ojPublicationDate }}",
    "DE": "ABl. {{ ojPart }} {{ ojNumber }} vom {{ ojPublicationDate }}",
    "ES": "DO {{ ojPart }} {{ ojNumber }} de {{ ojPublicationDate }}",
    "BG": "OB {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}г.",
    "CS": "Úř. věst. {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "DA": "EUT {{ ojPart }} {{ ojNumber }} af {{ ojPublicationDate }}",
    "ET": "ELT {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "EL": "ΕΕ {{ ojPart }} {{ ojNumber }} της {{ ojPublicationDate }}",
    "GA": "IO {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "HR": "SL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "IT": "GU {{ ojPart }} {{ ojNumber }} del {{ ojPublicationDate }}",
    "LV": "OV {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}.",
    "LT": "OL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDateYear }} {{ ojPublicationDateMonth }} {{ ojPublicationDateDay }}",
    "HU": "HL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDateYear }}.{{ ojPublicationDateMonth }}.{{ ojPublicationDateDay }}.",
    "MT": "ĠU {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "NL": "PB {{ ojPart }} {{ ojNumber }} van {{ ojPublicationDate }}",
    "PL": "Dz.U. {{ ojPart }} {{ ojNumber }} z {{ ojPublicationDate }}",
    "PT": "JO {{ ojPart }} {{ ojNumber }} de {{ ojPublicationDate }}",
    "RO": "JO {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "SK": "Ú. v. EÚ {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "SL": "UL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "FI": "EUVL {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}",
    "SV": "EUT {{ ojPart }} {{ ojNumber }}, {{ ojPublicationDate }}"
  },
  'official.journal.label.new': {
    "EN": "OJ {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "FR": "JO {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "DE": "ABl. {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "ES": "DO {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "BG": "OB {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "CS": "Úř. věst. {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "DA": "EUT {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "ET": "ELT {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "EL": "ΕΕ {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "GA": "IO {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "HR": "SL {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "IT": "GU {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "LV": "OV {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "LT": "OL {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "HU": "HL {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "MT": "ĠU {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "NL": "PB {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "PL": "Dz.U. {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "PT": "JO {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "RO": "JO {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "SK": "Ú. v. EÚ {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "SL": "UL {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "FI": "EUVL {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}",
    "SV": "EUT {{ ojPart }}, {{ ojPartPrefix }}{{ ojYear }}/{{ ojNumber }}, {{ ojPublicationDate }}"
  }
};
var LANGUAGE_MAP = exports.LANGUAGE_MAP = new Map([
// tslint:disable-next-line:max-line-length
['BG', {
  iso3: 'BUL',
  officialName: 'български (BG)'
}], ['ES', {
  iso3: 'SPA',
  officialName: 'Español (ES)'
}], ['CS', {
  iso3: 'CES',
  officialName: 'Čeština (CS)'
}], ['DA', {
  iso3: 'DAN',
  officialName: 'Dansk (DA)'
}], ['DE', {
  iso3: 'DEU',
  officialName: 'Deutsch (DE)'
}], ['ET', {
  iso3: 'EST',
  officialName: 'Eesti (ET)'
}], ['EL', {
  iso3: 'ELL',
  officialName: 'ελληνικά (EL)'
}], ['EN', {
  iso3: 'ENG',
  officialName: 'English (EN)'
}], ['FR', {
  iso3: 'FRA',
  officialName: 'Français (FR)'
}], ['GA', {
  iso3: 'GLE',
  officialName: 'Gaeilge (GA)'
}], ['HR', {
  iso3: 'HRV',
  officialName: 'Hrvatski (HR)'
}], ['IT', {
  iso3: 'ITA',
  officialName: 'Italiano (IT)'
}], ['LV', {
  iso3: 'LAV',
  officialName: 'Latviešu (LV)'
}], ['LT', {
  iso3: 'LIT',
  officialName: 'Lietuvių (LT)'
}], ['HU', {
  iso3: 'HUN',
  officialName: 'Magyar (HU)'
}], ['MT', {
  iso3: 'MLT',
  officialName: 'Malti (MT)'
}], ['NL', {
  iso3: 'NLD',
  officialName: 'Nederlands (NL)'
}], ['PL', {
  iso3: 'POL',
  officialName: 'Polski (PL)'
}], ['PT', {
  iso3: 'POR',
  officialName: 'Português (PT)'
}], ['RO', {
  iso3: 'RON',
  officialName: 'Română (RO)'
}], ['SK', {
  iso3: 'SLK',
  officialName: 'Slovenčina (SK)'
}], ['SL', {
  iso3: 'SLV',
  officialName: 'Slovenščina (SL)'
}], ['FI', {
  iso3: 'FIN',
  officialName: 'Suomi (FI)'
}], ['SV', {
  iso3: 'SWE',
  officialName: 'Svenska (SV)'
}]]);

},{}],51:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DEFAULT_LD_LANG = void 0;
exports.getISO2Lang = getISO2Lang;
exports.getISO3Lang = getISO3Lang;
exports.getTranslation = void 0;
var _params = require("./config/params.js");
var DEFAULT_LD_LANG = exports.DEFAULT_LD_LANG = "EN";

/**
 * Resolves a translation tag in the language of choice. Supports templating eg. "Repealed by {{ date }} immediately"
 * 
 * Usage: 
 *   getTranslation("eurlex.act.no.longer.in.force", "FR")
 * 
 * @param {String} name 
 * @param {String} language ISO2 language
 * @param {Object} params { key: value } pairs to inject into the templated strings
 * 
 * @returns {String}
 */
var getTranslation = exports.getTranslation = function getTranslation(name, language, params) {
  if (!_params.TRANSLATIONS[name]) {
    return null;
  }
  language = String(language).toUpperCase();
  var str = _params.TRANSLATIONS[name][language] || _params.TRANSLATIONS[name][DEFAULT_LD_LANG];
  if (!str) {
    return null;
  }
  params = params || {};
  Object.keys(params).forEach(function (key) {
    try {
      str = str.replace(new RegExp("{{\\s?" + key + "\\s?}}", 'gi'), params[key]);
    } catch (e) {
      console.error(e);
    }
  });
  return str;
};

/**
 * Language conversion utility function ISO2 -> ISO3
 * @param {String} iso3 
 * @returns {String}
 */
function getISO2Lang(iso3) {
  var iso2 = null;
  _params.LANGUAGE_MAP.forEach(function (value, key) {
    if (value.iso3 === iso3) {
      iso2 = key;
    }
  });
  return iso2;
}

/**
 * Language conversion utility function ISO3 -> ISO2
 * @param {String} iso2 
 * @returns {String}
 */
function getISO3Lang(iso2) {
  var data = _params.LANGUAGE_MAP.get(iso2);
  return data ? data.iso3 : null;
}

},{"./config/params.js":50}],52:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Base64 = void 0;
var Base64 = exports.Base64 = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  encode: function encode(r) {
    var t,
      e,
      o,
      a,
      h,
      n,
      c,
      d = "",
      C = 0;
    for (r = Base64._utf8_encode(r); C < r.length;) t = r.charCodeAt(C++), e = r.charCodeAt(C++), o = r.charCodeAt(C++), a = t >> 2, h = (3 & t) << 4 | e >> 4, n = (15 & e) << 2 | o >> 6, c = 63 & o, isNaN(e) ? n = c = 64 : isNaN(o) && (c = 64), d = d + this._keyStr.charAt(a) + this._keyStr.charAt(h) + this._keyStr.charAt(n) + this._keyStr.charAt(c);
    return d;
  },
  decode: function decode(r) {
    var t,
      e,
      o,
      a,
      h,
      n,
      c,
      d = "",
      C = 0;
    for (r = r.replace(/[^A-Za-z0-9\+\/\=]/g, ""); C < r.length;) a = this._keyStr.indexOf(r.charAt(C++)), h = this._keyStr.indexOf(r.charAt(C++)), n = this._keyStr.indexOf(r.charAt(C++)), c = this._keyStr.indexOf(r.charAt(C++)), t = a << 2 | h >> 4, e = (15 & h) << 4 | n >> 2, o = (3 & n) << 6 | c, d += String.fromCharCode(t), 64 != n && (d += String.fromCharCode(e)), 64 != c && (d += String.fromCharCode(o));
    return d = Base64._utf8_decode(d);
  },
  _utf8_encode: function _utf8_encode(r) {
    r = r.replace(/\r\n/g, "\n");
    for (var t = "", e = 0; e < r.length; e++) {
      var o = r.charCodeAt(e);
      128 > o ? t += String.fromCharCode(o) : o > 127 && 2048 > o ? (t += String.fromCharCode(o >> 6 | 192), t += String.fromCharCode(63 & o | 128)) : (t += String.fromCharCode(o >> 12 | 224), t += String.fromCharCode(o >> 6 & 63 | 128), t += String.fromCharCode(63 & o | 128));
    }
    return t;
  },
  _utf8_decode: function _utf8_decode(r) {
    var c1, c2, c3;
    for (var t = "", e = 0, o = c1 = c2 = 0; e < r.length;) o = r.charCodeAt(e), 128 > o ? (t += String.fromCharCode(o), e++) : o > 191 && 224 > o ? (c2 = r.charCodeAt(e + 1), t += String.fromCharCode((31 & o) << 6 | 63 & c2), e += 2) : (c2 = r.charCodeAt(e + 1), c3 = r.charCodeAt(e + 2), t += String.fromCharCode((15 & o) << 12 | (63 & c2) << 6 | 63 & c3), e += 3);
    return t;
  }
};

},{}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.converters = void 0;
/**
 * Converter pipes to be used in rules.
 * Usage: 
 * {{ $3|replace:'str1':'str2' }}  // will call R2L.converters.replace(backref3, 'str1', 'str2')
 */
var converters = exports.converters = {
  // Outputs the target language ISO3 eg: `/eng`. Defaults to empty string if target lang is configured by the user.
  lang: function lang() {
    if (R2L.options && R2L.options.language && typeof R2L.options.language === "string") {
      return '/' + R2L.options.language;
    } else {
      return '';
    }
  },
  wrap: function wrap(str, startStr, endStr) {
    if (!str) {
      return '';
    }
    return startStr + String(str) + endStr;
  },
  multiLangIso2OrLangIso2: function multiLangIso2OrLangIso2(str) {
    return R2L.converters.multiLangIso2() || R2L.converters.langIso2() || 'EN';
  },
  // Outputs the target language ISO2 eg: `FR`.
  langIso2: function langIso2(str, defaultLang) {
    var lang = R2L.getLanguage();
    if (typeof lang === "string") {
      if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
        return R2L.getConstant("R2L_EULANG").get(lang.toUpperCase());
      }
      return defaultLang || 'EN';
    } else {
      return defaultLang || 'EN';
    }
  },
  // Outputs the source language ISO2 eg: `FR`.
  multiLangIso2: function multiLangIso2(str) {
    var lang = R2L.getMultiLanguage();
    if (typeof lang === "string") {
      var parts = lang.split("-");
      parts = parts.map(function (part) {
        if (R2L.getConstant("R2L_EULANG").has(part.toUpperCase())) {
          return R2L.getConstant("R2L_EULANG").get(part.toUpperCase());
        }
        return null;
      });
      parts = parts.filter(function (part) {
        return !!part;
      });
      if (parts.length === 0) {
        return '';
      } else {
        return parts.join("-");
      }
    } else {
      return '';
    }
  },
  // returns `/` prefixed language ISO2 eg: /DE
  langIsoA2: function langIsoA2() {
    var lang = R2L.getLanguage();
    if (typeof lang === "string") {
      if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
        return '/' + R2L.getConstant("R2L_EULANG").get(lang.toUpperCase());
      }
      return '';
    } else {
      return '';
    }
  },
  // returns raw language ISO3
  langIso3: function langIso3(str, defaultLang) {
    var lang = R2L.getLanguage();
    if (typeof lang === "string") {
      if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
        return lang;
      }
      return defaultLang || 'ENG';
    } else {
      return defaultLang || 'ENG';
    }
  },
  // returns language ISO3 prefixed by `/` eg: /FRA 
  langIsoA3: function langIsoA3() {
    var lang = R2L.getLanguage();
    if (typeof lang === "string") {
      if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
        return '/' + lang;
      }
      return '';
    } else {
      return '';
    }
  },
  // returns the pre-configured date to use as an ELI point in time. Format: `/YYYY-MM-DD`. Defaults to `/oj`.
  eliPointInTime: function pointInTime(reference, defaultDate) {
    var pointInTime = R2L.options.pointInTime || null;
    var d = new Date(String(pointInTime));
    if (!pointInTime || d.toString() === "Invalid Date") {
      return defaultDate !== undefined ? "/" + defaultDate : "/oj";
    }

    // ELI date should have format: `YYYY-MM-DD`
    var dateStr = d.toISOString().split('T')[0];
    return "/" + dateStr;
  },
  // maps a month label to a number. Example: `November`|month returns `11`
  month: function month(str) {
    if (str && !isNaN(str)) {
      return str;
    }
    var converterRule = R2L.getConverterRules().filter(function (r) {
      return r.type === 'label_month';
    })[0];
    if (!converterRule) {
      return '';
    }
    str = str ? String(str) : "";
    var matches = str.match(new RegExp(converterRule.pattern.source, "im"));
    if (matches && matches.length > 0) {
      for (var i = 1; i <= 12; i++) {
        if (matches[i]) {
          return String(i);
        }
      }
    }
    return '';
  },
  // maps a numeration label to a number. Example: `second`|numeration returns `2`. Only works until 5.
  numeration: function numeration(str) {
    if (String(str).length > 0 && !isNaN(str)) {
      return str;
    }
    var converterRule = R2L.getConverterRules().filter(function (r) {
      return r.type === 'label_numeration';
    })[0];
    if (!converterRule) {
      return '';
    }
    str = str ? String(str) : "";
    var matches = str.match(new RegExp(converterRule.pattern.source, "im"));
    if (matches && matches.length > 0) {
      for (var i = 1; i <= 5; i++) {
        if (matches[i]) {
          return String(i);
        }
      }
    }
    return '';
  },
  // pad a string. 
  pad: function pad(str, _pad, len, position, strict) {
    str = str || '';
    if (strict && !str) {
      return '';
    }
    len = len || 0;
    _pad = (_pad === 0 ? '0' : _pad) || '';
    var chars = len - ('' + str).length;
    if (chars > 0) {
      switch (position) {
        case 'right':
          return str + ('' + _pad).repeat(chars);
        case 'left':
        default:
          return ('' + _pad).repeat(chars) + str;
      }
    }
    return str;
  },
  // convert a 2-digit year into a 4-digit year; Works between 1958 - 2057;
  year: function year(str) {
    str = str || '';
    if (('' + str).length === 4 && !isNaN(str)) {
      return Number(str);
    }
    if (('' + str).length == 2) {
      var y = parseInt(str, 10);
      if (y <= 57) {
        return Number('20' + str);
      } else {
        return Number('19' + str);
      }
    }
    if (!str) {
      return Number(new Date().getFullYear());
    }
  },
  // convert a 4-digit year into a 2-digit year; Works between 1958 - 2057;
  shortYear: function shortYear(str) {
    str = str || '';
    if (('' + str).length === 2) {
      return Number(str);
    }
    if (('' + str).length === 4) {
      return Number(str.substr(2, 3));
    }
  },
  // trims a string (optional list of chars to trim)
  trim: function trim(str, chars) {
    var regExpEscape = function regExpEscape(pattern) {
      return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    };
    str = str || '';
    chars = chars || '';
    if (chars.trim()) {
      var re = new RegExp("^[" + regExpEscape(chars) + "]+|[" + regExpEscape(chars) + "]+$", "g");
      return str.replace(re, '');
    } else {
      return str.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    }
  },
  // Replace string in string; The `what` parameter can be a regular expression string (eg. /1[23]/) or a normal string;
  replace: function replace(str, what, replacement, isRegexp) {
    return (String(str) || '').replace(R2L.delimiter2RegExp(what), replacement === undefined ? '' : replacement);
  },
  // Returns length of Array
  length: function length(obj) {
    return obj && obj.hasOwnProperty('length') ? obj.length : 0;
  },
  // Splits a string using a delimiter; Accepts both a regex string eg. `/1[23]/` or a regular string eg. `12`. 
  split: function split(str, delimiter) {
    return (str || '').split(R2L.delimiter2RegExp(delimiter));
  },
  // 
  // @deprecated
  _default: function _default(str, defaultValue) {
    return (str === 0 ? '0' : str) || (defaultValue ? encodeURIComponent(defaultValue) : '') || '';
  },
  // logical OR operator. Usage: {{ $1|any:($2):($3):($4) }} # will return the first non-empty string among the 4 backreferences;
  any: function any() {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === "number") {
        return String(arguments[i]);
      }
      if (typeof arguments[i] !== "string") {
        continue;
      }
      if (arguments[i].length > 0) {
        return arguments[i];
      }
    }
    return '';
  },
  // Logical operator: returns empty string if any of the args is not false(y); Usage: 
  // {{ $1|emptyIf:($2):($3):($4) }} === $1    # IF $2 AND $3 AND $4 are not empty return $1;
  emptyIf: function emptyIf() {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i]) {
        return "";
      }
    }
    return arguments[0];
  },
  // parse a number which contains a suffix;
  numberExt: function numberExt(input) {
    // support numeral labels like 'first', 'second' etc.
    if (/^[^0-9]/.test(input)) {
      return R2L.converters.numeration(input) || 1;
    }

    // can handle subpart suffixes like '23 bis', '23a', '23.a', '23b' (REFTOLINK-1115)
    if (/^\d+$/.test(input)) {
      return parseInt(input, 10);
    }

    // we clear out suffixes like 'nd', 'rd', 'st', 'er': 
    if (/^\d+(st|nd|rd|er)$/i.test(input)) {
      var parsedInput = input.replace(/(st|nd|rd|er)$/i, '');
      return parseInt(parsedInput, 10);
    }
    var cleanedInput = input.replace(/[аα]/gi, 'a');
    // we accept all other letters as a suffix and we keep it
    if (/^(\d+)[a-z][a-z]?$/i.test(String(cleanedInput))) {
      return cleanedInput;
    }
    if (!R2L.settings.constants.R2L_DEFAULT_LANG_ISO3 || R2L.settings.constants.R2L_DEFAULT_LANG_ISO3 === 'POR') {
      // handling of PT style suffixes (using a dot): artigo 12.o-F do Regulamento de Execução (UE) n.o 725/2011 
      if (/^(\d+)(\.[o°])?-[a-z][a-z]?$/i.test(String(cleanedInput))) {
        var parts = cleanedInput.split("-");
        var digits = parts[0].split(".");
        return digits[0] + String(parts[1]).toLowerCase();
      }

      // handling of PT style suffixes (using a dot): artigo 12.o
      if (/^(\d+)(\.[o°])$/i.test(String(cleanedInput))) {
        var _parts = cleanedInput.split(".");
        return _parts[0];
      }
    }

    // handling of LV style suffixes (using a dot): Komisijas Īstenošanas regulas (ES) Nr. 725/2011 12.t pantam
    if (/^(\d+)\.[a-z][a-z]?$/i.test(String(cleanedInput))) {
      var _parts2 = cleanedInput.split(".");
      return _parts2[0] + String(_parts2[1]).toLowerCase();
    }

    // every other suffix will be turned into an "a"
    return String(input).replace(/^(\d+).+/i, "\$1a");
  },
  // Parse a roman number into arabic. {{ 'IV'|number }} === '4'
  number: function number(input) {
    var romans = {
        ι: 1,
        i: 1,
        v: 5,
        χ: 10,
        x: 10,
        l: 50,
        c: 100,
        d: 500,
        m: 1000
      },
      pos = 0,
      _char,
      nextchar,
      thisSum,
      result = 0;
    input = (input || '').toLowerCase();
    if (/^\d+$/.test(input)) {
      return parseInt(input, 10);
    }
    while (pos < input.length) {
      _char = input[pos];
      // are we NOT at the end?
      if (pos != input.length) {
        // check next character - if bigger, replace with a sub
        nextchar = input[pos + 1];
        if (romans[_char] < romans[nextchar]) {
          thisSum = romans[nextchar] - romans[_char];
          result += thisSum;
          pos += 2;
        } else {
          result += romans[_char];
          pos++;
        }
      } else {
        result += romans[_char];
        pos++;
      }
    }
    return result ? result : '';
  },
  asciiRoman: function asciiRoman(input) {
    if (!input) {
      return input;
    }
    input = input.replace(/ι/gi, 'I');
    input = input.replace(/χ/gi, 'X');
    input = input.replace(/Ι/gi, 'I');
    return input.toUpperCase();
  },
  castToNumber: function castToNumber(num) {
    return Number(num);
  },
  toRoman: function toRoman(num) {
    if (!num || !/^\d+$/.test(String(num)) || Number(num) === 0) {
      return num;
    }
    num = Number(num);
    var roman = {
      M: 1000,
      CM: 900,
      D: 500,
      CD: 400,
      C: 100,
      XC: 90,
      L: 50,
      XL: 40,
      X: 10,
      IX: 9,
      V: 5,
      IV: 4,
      I: 1
    };
    var str = '';
    for (var _i = 0, _Object$keys = Object.keys(roman); _i < _Object$keys.length; _i++) {
      var i = _Object$keys[_i];
      var q = Math.floor(num / roman[i]);
      num -= q * roman[i];
      str += i.repeat(q);
    }
    return str;
  },
  roman: function roman(input) {
    var romans = {
        ι: 1,
        i: 1,
        v: 5,
        χ: 10,
        x: 10,
        l: 50,
        c: 100,
        d: 500,
        m: 1000
      },
      pos = 0,
      _char2,
      nextchar,
      thisSum,
      result = 0;

    // Can be used as connector words (and, or)
    if (input === 'i' || input === 'v') {
      return '';
    }
    input = (input || '').toLowerCase();
    if (/^\d+$/.test(input)) {
      return parseInt(input, 10);
    }
    while (pos < input.length) {
      _char2 = input[pos];
      // are we NOT at the end?
      if (pos != input.length) {
        // check next character - if bigger, replace with a sub
        nextchar = input[pos + 1];
        if (romans[_char2] < romans[nextchar]) {
          thisSum = romans[nextchar] - romans[_char2];
          result += thisSum;
          pos += 2;
        } else {
          result += romans[_char2];
          pos++;
        }
      } else {
        result += romans[_char2];
        pos++;
      }
    }
    return result ? result : '';
  },
  // Turns cyrilic/greek letters into latin equivalents. Example: 
  // {{ 'в'|letterToLatin }} === 'b'
  letterToLatin: function letterToLatin(characters) {
    var letters = R2L.letters;
    var ReCyrillic = new RegExp("[" + letters.cyrillic + "]");
    var ReGreek = new RegExp("[" + letters.greek + "]");
    var latinCodes = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
    var latinTranslation = "";
    characters = characters.toLowerCase();
    if (ReCyrillic.test(characters)) {
      var cyrilicCodes = ["а", "б", "в", "г", "д", "е", "ж", "з", "и", "й", "к", "л", "м", "н", "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч", "ш", "щ"];
      var i = characters.length;
      var index = 0;
      while (i--) {
        index = cyrilicCodes.indexOf(characters.charAt(i));
        latinTranslation = latinCodes[index] + latinTranslation;
      }
      return latinTranslation;
    } else if (ReGreek.test(characters)) {
      var greekSingleCodes = ["α", "β", "γ", "δ", "ε", "στ", "ζ", "η", "θ"];
      var greekTensCodes = ["", "ι", "κ", "λ", "μ"];
      var _i2 = characters.length;
      var _index = 0;
      while (_i2--) {
        var letter = characters.charAt(_i2);
        if (characters.charAt(_i2) == "τ") {
          _i2--;
          letter = characters.charAt(_i2) + letter;
        }
        ;
        if (greekSingleCodes.indexOf(letter) > 0) {
          _index = _index + greekSingleCodes.indexOf(letter);
        }
        ;
        if (greekTensCodes.indexOf(letter) >= 0) {
          _index = _index + greekTensCodes.indexOf(letter) * (greekSingleCodes.length + 1);
        }
        ;
      }
      var firstLetter = parseInt(_index / latinCodes.length) - 1;
      var secondLetter = _index % latinCodes.length;
      if (firstLetter >= 0) {
        return latinCodes[firstLetter] + latinCodes[secondLetter];
      } else {
        return latinCodes[secondLetter];
      }
    }
    ;
    return characters;
  },
  // Replace string with replacement value if the input passes the regex test. Example:
  // {{ 'er123'|testReplace:'/r\d+/':'444' }} === '444'    # passes the test
  // {{ 'er123'|testReplace:'/x\d+/':'444' }} === 'er123'  # fails the test
  testReplace: function testReplace(str, what, replacement) {
    var reg = R2L.delimiter2RegExp(what);
    str = String(str) || '';
    if (reg.test(str)) {
      return replacement === undefined ? '' : replacement;
    }
    return str;
  },
  // Replace string with replacement value if the input does NOT the regex test. Example:
  // {{ 'er123'|testNotReplace:'/r\d+/':'444' }} === 'er123'    # passes the test
  // {{ 'er123'|testNotReplace:'/x\d+/':'444' }} === '444'      # fails the test
  testNotReplace: function testNotReplace(str, what, replacement) {
    var reg = R2L.delimiter2RegExp(what);
    str = String(str) || '';
    if (!reg.test(str)) {
      return replacement === undefined ? '' : replacement;
    }
    return str;
  },
  replaceIf: function replaceIf(str, what, replacement) {
    str = String(str) || '';
    if (what) {
      return replacement;
    }
    return str;
  },
  // Decrement number by 1;
  dec: function dec(n) {
    if (!isNaN(n)) {
      return --n;
    }
    return NaN;
  },
  // Uppercase string
  upper: function upper(t) {
    return (t || '').toUpperCase();
  },
  // Lowercase string
  lower: function lower(t) {
    return (t || '').toLowerCase();
  },
  // Slice string. Usage: {{ 'mike'|slice:1:3 }} === 'ik'
  slice: function slice(t, start, end) {
    return t.slice(start, end);
  },
  // URL encode string
  urlencode: function urlencode(url) {
    return encodeURIComponent(url || '');
  },
  // Uppercase first letter only
  ucfirst: function ucfirst(str) {
    return ((str || '')[0] || '').toUpperCase() + ((str || '').substring(1) || '');
  },
  // Checks if string is part of a comma-separated list;
  is: function is(str, list) {
    return list.split(',').indexOf(str) >= 0;
  },
  // Checks if a string matches a regex; returns a boolean. 
  // Example: {{ '123a|match:'/[a-h]$/i' }} === true
  match: function match(str, expr) {
    var e = R2L.delimiter2RegExp(expr);
    if (e) {
      return e.test(str);
    }
  },
  // Check if string is valid year: Works between 1958 - 2057
  isYear: function isYear(str) {
    var no = R2L.converters.number(str),
      year = new Date().getFullYear();
    if (('' + no).length === 2 || ('' + no).length === 1 && '0' + no === str) {
      return no >= 58 || no >= 0 && no <= year % 2000;
    }
    if (('' + no).length === 4) {
      return no >= 1958 && no <= year;
    }
    return false;
  },
  // Negate 
  not: function not(bool) {
    return !bool;
  },
  // Remap function; takes an Array of regexes and an Array of output strings as params. 
  // Example: {{ $1|remap:['/M/','/SA/']:['_M','_SA'] }}}}
  remap: function remap(val, map, dest) {
    if (!Array.isArray(map)) {
      map = [map];
    }
    if (!Array.isArray(dest)) {
      dest = [dest];
    }
    if (map.length !== dest.length) {
      throw '"remap" map.length !== dest.length';
    }
    for (var i = 0; i < map.length; i++) {
      var e = R2L.delimiter2RegExp(map[i]);
      if (e && e.test(val)) {
        return dest[i];
      }
    }
    return val;
  },
  // Compare 2 values. Returns true if they are equal;
  equals: function equals(strFirst, strSecond) {
    return strFirst === strSecond;
  },
  // Compare 2 values; Returns false if they are equal;
  nequals: function nequals(strFirst, strSecond) {
    return strFirst !== strSecond;
  },
  // Encode string as base64
  base64: function base64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function toSolidBytes(match, p1) {
      return String.fromCharCode('0x' + p1);
    }).replace('%20', ' '));
  },
  // Concatenate 2 strings. Example: {{ $1|concat:($2) }} === $1 + $2
  concat: function concat(strFirst, strSecond) {
    strFirst = strFirst || '';
    strSecond = strSecond || '';
    return strFirst.concat(strSecond);
  },
  debug: function debug(val) {
    debugger;
    return val;
  },
  // Sums 2 numbers;
  sum: function sum(intFirst, intSecond) {
    var result = Number(intFirst) + Number(intSecond);
    return isNaN(result) ? 0 : result;
  },
  // Returns true if a string is a numeric value
  isNumeric: function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },
  /**
   * 5th EP
   * 20 July 1999 – 5 May 2004
   * 
   * 6th EP
   * 20 July 2004 – 7 May 2009
   * 
   * 7th EP
   * 14 July 2009 – 17 April 2014
   * 
   * 8th EP
   * 1 July 2014 – 18 April 2019
   * 
   * 9th EP
   * 2 July 2019 – 15 July 2024
   * 
   * 10th EP
   * 16 July 2024 – TBD
   * 
   * @param {String} str 
   * @param {String} year 
   * @param {String} month 
   * @param {String} day 
   */
  parliamentTerm: function parliamentTerm(str, year, month, day) {
    var ymd = R2L.converters.year(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var intervals = [['1999-07-20', '2004-05-05'],
    // 5th term
    ['2004-07-20', '2009-05-07'], ['2009-07-14', '2014-04-17'], ['2014-07-01', '2019-04-18'], ['2019-07-02', '2024-07-15'], ['2024-07-16', '2029-06-01']];
    for (var i = 0; i < intervals.length; i++) {
      var interval = intervals[i];
      if (ymd < interval[0]) {
        return i + 4;
      } else if (ymd < interval[1]) {
        return i + 5;
      }
    }

    // current term if none matches
    return 10;
  }
};

},{}],54:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractIdList = exports.extractId = exports.extractCelexIdList = exports.extractCelexId = exports.extractCelexAttributes = void 0;
exports.extractLinkedDataId = extractLinkedDataId;
exports.extractLinkedDataIds = extractLinkedDataIds;
exports.extractLinkedDataType = extractLinkedDataType;
var _index = require("../manager/index.js");
var _functions = require("../utils/functions.js");
var _index2 = require("../settings/index.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/**
 * Extract CELEX id from attributes map
 * @param {Object} data
 * @returns {String|null} celex id if found 
 */
var extractCelexId = exports.extractCelexId = function extractCelexId(data) {
  for (var i = 0; i < _index.LD_CELEX_SUFFIXES.length; i++) {
    var suffix = _index.LD_CELEX_SUFFIXES[i];
    if (data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix]) {
      return data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix];
    }
  }
  return null;
};

/**
 * Returns a list of celex ids from the attributes (sometimes views have different celex id variants eg. Compos/AG)
 * @param {Object} data
 * @returns {Array<string>} 
 */
var extractCelexIdList = exports.extractCelexIdList = function extractCelexIdList(data) {
  var ids = [];
  var suffixes = _index.LD_CELEX_SUFFIXES;
  Object.keys(data).forEach(function (key) {
    suffixes.forEach(function (suffix) {
      var id = data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix];
      if (id) {
        ids.push(id);
      }
    });
  });

  //unique ids only
  return ids.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
};
var extractIdList = exports.extractIdList = function extractIdList(data) {
  var ids = [];
  var id;

  // collect CELEX ids
  var suffixes = _index.LD_CELEX_SUFFIXES;
  Object.keys(data).forEach(function (key) {
    suffixes.forEach(function (suffix) {
      id = data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix];
      if (id) {
        ids.push(id);
      }
    });
  });

  // collect ELI ids
  id = data[_index.LD_TYPE_ELI] || data["data-" + _index.LD_TYPE_ELI] || data["data-ref-" + _index.LD_TYPE_ELI];
  if (id) {
    ids.push(id);
  }

  // collect ECLI ids
  id = data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI];
  if (id) {
    ids.push(id);
  }

  // collect OJ ids
  id = data[_index.LD_TYPE_OJ] || data["data-" + _index.LD_TYPE_OJ] || data["data-ref-" + _index.LD_TYPE_OJ];
  if (id) {
    ids.push(id);
  }

  // collect PROC ids
  id = data[_index.LD_TYPE_PROCEDURE] || data["data-" + _index.LD_TYPE_PROCEDURE] || data["data-ref-" + _index.LD_TYPE_PROCEDURE];
  if (id) {
    ids.push(id);
  }

  // collect CONSIL ids
  id = data[_index.LD_TYPE_CONSIL] || data["data-" + _index.LD_TYPE_CONSIL] || data["data-ref-" + _index.LD_TYPE_CONSIL];
  if (id) {
    ids.push(id);
  }

  // collect CIS ids
  id = data[_index.LD_TYPE_CIS] || data["data-" + _index.LD_TYPE_CIS] || data["data-ref-" + _index.LD_TYPE_CIS];
  if (id) {
    ids.push(id);
  }

  // collect HANDOC ids
  id = data[_index.LD_TYPE_HANDOC] || data["data-" + _index.LD_TYPE_HANDOC] || data["data-ref-" + _index.LD_TYPE_HANDOC];
  if (id) {
    ids.push(id);
  }

  //unique ids only
  ids = ids.filter(function (v, i, a) {
    return a.indexOf(v) === i;
  });
  return ids;
};

/**
 * Extract the id from a target attributes (CELEX/ELI/ECLI/HANDOC/CIS/PROCDOC/CONSIL)
 * @param {Object} data
 * @returns {String|null} celex id if found 
 */
var extractId = exports.extractId = function extractId(data) {
  var id;
  for (var i = 0; i < _index.LD_CELEX_SUFFIXES.length; i++) {
    var suffix = _index.LD_CELEX_SUFFIXES[i];
    if (data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix]) {
      id = data[_index.LD_TYPE_CELEX + suffix] || data["data-" + _index.LD_TYPE_CELEX + suffix] || data["data-ref-" + _index.LD_TYPE_CELEX + suffix];
    }
  }
  if (id) {
    return id;
  }

  // collect ELI ids
  id = data[_index.LD_TYPE_ELI] || data["data-" + _index.LD_TYPE_ELI] || data["data-ref-" + _index.LD_TYPE_ELI];
  if (id) {
    return id;
  }

  // collect ECLI ids
  id = data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI];
  if (id) {
    return id;
  }

  // collect PROC ids
  id = data[_index.LD_TYPE_PROCEDURE] || data["data-" + _index.LD_TYPE_PROCEDURE] || data["data-ref-" + _index.LD_TYPE_PROCEDURE];
  if (id) {
    return id;
  }

  // collect CONSIL ids
  id = data[_index.LD_TYPE_CONSIL] || data["data-" + _index.LD_TYPE_CONSIL] || data["data-ref-" + _index.LD_TYPE_CONSIL];
  if (id) {
    return id;
  }

  // collect CIS ids
  id = data[_index.LD_TYPE_CIS] || data["data-" + _index.LD_TYPE_CIS] || data["data-ref-" + _index.LD_TYPE_CIS];
  if (id) {
    return id;
  }

  // collect HANDOC ids
  id = data[_index.LD_TYPE_HANDOC] || data["data-" + _index.LD_TYPE_HANDOC] || data["data-ref-" + _index.LD_TYPE_HANDOC];
  if (id) {
    return id;
  }

  // collect OJ ids
  id = data[_index.LD_TYPE_OJ] || data["data-" + _index.LD_TYPE_OJ] || data["data-ref-" + _index.LD_TYPE_OJ];
  if (id) {
    return id;
  }
  return null;
};

/**
 * Used to extract target attributes from matches marked with a specific LD type
 * @param {Object} matches
 * @param {String} type LD_CELLAR_NUMBER_CELEX|LD_CELLAR_SUBNUMBER_CELEX
 * @returns {Array<Object>} list of attributes 
 */
var extractCelexAttributes = exports.extractCelexAttributes = function extractCelexAttributes(matches, type) {
  var attributesList = [];
  Object.keys(matches).forEach(function (key) {
    matches[key].offsets.forEach(function (offset) {
      var attributes = (0, _functions.extractAttributes)(offset.views);
      var celexId = extractCelexId(attributes);
      //if the rule has linked-data markings we add the celexId 
      if (offset.rule.ld.length > 0 && offset.rule.ld.indexOf(type) !== -1 && celexId) {
        attributesList.push(attributes);
      }
    });
  });
  return attributesList;
};

/**
 * Extract property to be used as identifier (of a supported type) from target attributes
 * @param {Object} data
 * @returns {String|null} unique linked data identifier 
 */
function extractLinkedDataId(data) {
  // attributes might contain multiple celex ids (suffixed by numbers eg. data-ref-celex-1)
  var celexId = extractCelexId(data);
  if (celexId) {
    return celexId;
  }
  if (data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI]) {
    var ecliLinkedDataId = data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI];
    // For non-EU ECLI ids we don't have linked data
    if (ecliLinkedDataId && String(ecliLinkedDataId).slice(0, 5) === "ECLI:" && String(ecliLinkedDataId).slice(0, 7) !== "ECLI:EU") {
      return null;
    }
    return ecliLinkedDataId;
  }
  if (data[_index.LD_TYPE_OJ] || data["data-" + _index.LD_TYPE_OJ] || data["data-ref-" + _index.LD_TYPE_OJ]) {
    var eliId = data[_index.LD_TYPE_OJ] || data["data-" + _index.LD_TYPE_OJ] || data["data-ref-" + _index.LD_TYPE_OJ];
    return eliId;
  }
  if (data[_index.LD_TYPE_ELI] || data["data-" + _index.LD_TYPE_ELI] || data["data-ref-" + _index.LD_TYPE_ELI]) {
    var _eliId = data[_index.LD_TYPE_ELI] || data["data-" + _index.LD_TYPE_ELI] || data["data-ref-" + _index.LD_TYPE_ELI];
    return _eliId;
  }
  if (data[_index.LD_TYPE_PROCEDURE] || data["data-" + _index.LD_TYPE_PROCEDURE] || data["data-ref-" + _index.LD_TYPE_PROCEDURE]) {
    return data[_index.LD_TYPE_PROCEDURE] || data["data-" + _index.LD_TYPE_PROCEDURE] || data["data-ref-" + _index.LD_TYPE_PROCEDURE];
  }
  if (data[_index.LD_TYPE_CONSIL] || data["data-" + _index.LD_TYPE_CONSIL] || data["data-ref-" + _index.LD_TYPE_CONSIL]) {
    return data[_index.LD_TYPE_CONSIL] || data["data-" + _index.LD_TYPE_CONSIL] || data["data-ref-" + _index.LD_TYPE_CONSIL];
  }
  if (data[_index.LD_TYPE_FINLEX] || data["data-" + _index.LD_TYPE_FINLEX] || data["data-ref-" + _index.LD_TYPE_FINLEX]) {
    return data[_index.LD_TYPE_FINLEX] || data["data-" + _index.LD_TYPE_FINLEX] || data["data-ref-" + _index.LD_TYPE_FINLEX];
  }
  if (R2L.hasLinkedDataMode(_index2.LD_ADVANCED_MODE_KM_HANDOC)) {
    if (data[_index.LD_TYPE_HANDOC] || data["data-" + _index.LD_TYPE_HANDOC] || data["data-ref-" + _index.LD_TYPE_HANDOC]) {
      return data[_index.LD_TYPE_HANDOC] || data["data-" + _index.LD_TYPE_HANDOC] || data["data-ref-" + _index.LD_TYPE_HANDOC];
    }
  }
  if (R2L.hasLinkedDataMode(_index2.LD_ADVANCED_MODE_KM_CIS)) {
    if (data[_index.LD_TYPE_CIS] || data["data-" + _index.LD_TYPE_CIS] || data["data-ref-" + _index.LD_TYPE_CIS]) {
      return data[_index.LD_TYPE_CIS] || data["data-" + _index.LD_TYPE_CIS] || data["data-ref-" + _index.LD_TYPE_CIS];
    }
  }
  return null;
}
function extractLinkedDataType(data) {
  // attributes might contain multiple celex ids (suffixed by numbers eg. data-ref-celex-1)
  var celexId = extractCelexId(data);
  if (celexId) {
    return _index.LD_TYPE_CELEX;
  }
  if (data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI]) {
    var ecliLinkedDataId = data[_index.LD_TYPE_ECLI] || data["data-" + _index.LD_TYPE_ECLI] || data["data-ref-" + _index.LD_TYPE_ECLI];
    // For non-EU ECLI ids we don't have linked data
    if (ecliLinkedDataId && String(ecliLinkedDataId).slice(0, 5) === "ECLI:" && String(ecliLinkedDataId).slice(0, 7) !== "ECLI:EU") {
      return null;
    }
    return _index.LD_TYPE_ECLI;
  }
  if (data[_index.LD_TYPE_ELI] || data["data-" + _index.LD_TYPE_ELI] || data["data-ref-" + _index.LD_TYPE_ELI]) {
    return _index.LD_TYPE_ELI;
  }
  if (data[_index.LD_TYPE_PROCEDURE] || data["data-" + _index.LD_TYPE_PROCEDURE] || data["data-ref-" + _index.LD_TYPE_PROCEDURE]) {
    return _index.LD_TYPE_PROCEDURE;
  }
  if (data[_index.LD_TYPE_FINLEX] || data["data-" + _index.LD_TYPE_FINLEX] || data["data-ref-" + _index.LD_TYPE_FINLEX]) {
    return _index.LD_TYPE_FINLEX;
  }
  if (data[_index.LD_TYPE_HANDOC] || data["data-" + _index.LD_TYPE_HANDOC] || data["data-ref-" + _index.LD_TYPE_HANDOC]) {
    return _index.LD_TYPE_HANDOC;
  }
  if (data[_index.LD_TYPE_CIS] || data["data-" + _index.LD_TYPE_CIS] || data["data-ref-" + _index.LD_TYPE_CIS]) {
    return _index.LD_TYPE_CIS;
  }
  if (data[_index.LD_TYPE_CONSIL] || data["data-" + _index.LD_TYPE_CONSIL] || data["data-ref-" + _index.LD_TYPE_CONSIL]) {
    return _index.LD_TYPE_CONSIL;
  }
  if (data[_index.LD_TYPE_OJ] || data["data-" + _index.LD_TYPE_OJ] || data["data-ref-" + _index.LD_TYPE_OJ]) {
    return _index.LD_TYPE_OJ;
  }
  return null;
}

/**
 * Collect linked data ids by type from nodes
 * @param {Array<Object>} nodes
 * 
 * @returns {Object} map of identifiers
 */
function extractLinkedDataIds(nodes) {
  var celexIds = [];
  var ecliIds = [];
  var eliIds = [];
  var procedureIds = [];
  var finlexEliIds = [];
  var aresHandocIds = [];
  var cisIds = [];
  var consilIds = [];
  var ojIds = [];
  nodes.forEach(function (ref) {
    celexIds = celexIds.concat(ref.data.map(function (d) {
      return extractCelexId(d);
    }));
    eliIds = eliIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_ELI];
    }));
    procedureIds = procedureIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_PROCEDURE];
    }));
    finlexEliIds = finlexEliIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_FINLEX];
    }));
    aresHandocIds = aresHandocIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_HANDOC];
    }));
    cisIds = cisIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_CIS];
    }));
    consilIds = consilIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_CONSIL];
    }));
    ojIds = ojIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_OJ];
    }));
  });
  celexIds = celexIds.filter(function (celexId) {
    return !!celexId;
  });
  eliIds = eliIds.filter(function (eliId) {
    return !!eliId;
  });
  procedureIds = procedureIds.filter(function (procedureId) {
    return !!procedureId;
  });
  finlexEliIds = finlexEliIds.filter(function (finlexEliId) {
    return !!finlexEliId;
  });
  aresHandocIds = aresHandocIds.filter(function (aresId) {
    return !!aresId;
  });
  consilIds = consilIds.filter(function (consilId) {
    return !!consilId;
  });
  cisIds = cisIds.filter(function (cisId) {
    return !!cisId;
  });
  ojIds = ojIds.filter(function (ojId) {
    return !!ojId;
  });
  nodes.forEach(function (ref) {
    ecliIds = ecliIds.concat(ref.data.map(function (d) {
      return d[_index.LD_TYPE_CELEX] ? null : d[_index.LD_TYPE_ECLI];
    })); //if there's a CELEX don't load anything
  });
  ecliIds = ecliIds.filter(function (ecliId) {
    return !!ecliId && String(ecliId).slice(0, 7) === "ECLI:EU"; // only use ECLI EU ids
  });
  return _defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty(_defineProperty({}, _index.LD_TYPE_CELEX, celexIds), _index.LD_TYPE_ECLI, ecliIds), _index.LD_TYPE_ELI, eliIds), _index.LD_TYPE_PROCEDURE, procedureIds), _index.LD_TYPE_FINLEX, finlexEliIds), _index.LD_TYPE_HANDOC, aresHandocIds), _index.LD_TYPE_CIS, cisIds), _index.LD_TYPE_CONSIL, consilIds), _index.LD_TYPE_OJ, ojIds);
}

},{"../manager/index.js":18,"../settings/index.js":32,"../utils/functions.js":56}],55:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.insertLinkedData = insertLinkedData;
exports.insertNodeData = insertNodeData;
var _jquery = require("../jquery.js");
var _index = require("../settings/index.js");
var _index2 = require("../manager/index.js");
var _functions = require("./functions.js");
var _data = require("../utils/data.js");
/**
 * Embed linked-data into HTML content based on CELLAR identifiers
 * @param {String} html 
 * @param {Object} linkedData 
 * 
 * @returns {String} HTML content enriched with `data-ref2link-ld` attributes for detected references
 */
function insertLinkedData(html, linkedData) {
  var $container = (0, _jquery.$)("<div>".concat(html, "</div>"));
  var $nodes = (0, _jquery.$)(".".concat(_index.settings.generatedClassName), $container);
  $nodes.each(function (idx, node) {
    var initialHtml = node.outerHTML;
    var data = buildAttributesMap(node);
    var linkedDataId = (0, _data.extractLinkedDataId)(data);
    if (linkedData[linkedDataId] && linkedData[linkedDataId].status === _index2.SPARQL_STATUS_SUCCESS) {
      // set linked data object
      (0, _jquery.$)(node).attr("data-ref2link-ld", JSON.stringify((0, _index2.cleanLinkedDataBinding)(linkedData[linkedDataId])));
      // replace in content
      html = html.split(initialHtml).join(node.outerHTML);
    }
  });
  return html;
}

/**
 * 
 * @param {String} html content 
 * @param {Object} references 
 * 
 * @returns {String} HTML content with additional `data-ref2link-*` attributes containing all targets.
 */
function insertNodeData(html, references) {
  var matchNodes = R2L.getNodes(references);
  var $container = (0, _jquery.$)("<div>".concat(html, "</div>"));
  var $nodes = (0, _jquery.$)(".".concat(_index.settings.generatedClassName), $container);
  $nodes.each(function (idx, node) {
    var initialHtml = node.outerHTML;
    var data = buildAttributesMap(node);

    // find the right node match using the context/matched-text pair
    var foundMatchNode = matchNodes.filter(function (matchNode) {
      var foundOffset = matchNode.matches.filter(function (offset) {
        return offset.context === data['data-ref2link-context'] && (offset.match === data['data-ref2link-initial'] || offset.match === node.textContent || offset.match.replace(/&nbsp;/g, String.fromCharCode(160)) === node.textContent);
      }).pop();
      return !!foundOffset;
    }).pop();
    if (foundMatchNode) {
      // set linked data object
      (0, _jquery.$)(node).attr("data-ref2link-urls", JSON.stringify(foundMatchNode.urls.map(function (url) {
        return {
          title: url.title,
          href: url.href
        };
      })));
      (0, _jquery.$)(node).attr("data-ref2link-type", foundMatchNode.type);
      (0, _jquery.$)(node).attr("data-ref2link-uuid", (0, _functions.getUuid)());

      // replace in content (only first occurence because the uuid is different even for duplicate matches)
      html = html.replace(initialHtml, node.outerHTML);
    } else {
      console.debug("Node not found", data);
    }
  });
  return html;
}
function buildAttributesMap(node) {
  if (!node.attributes) {
    return {};
  }
  var data = {};
  try {
    for (var i = 0; i < node.attributes.length; i++) {
      data[node.attributes[i].name] = node.attributes[i].value;
    }
    return data;
  } catch (e) {
    return data;
  }
}

},{"../jquery.js":9,"../manager/index.js":18,"../settings/index.js":32,"../utils/data.js":54,"./functions.js":56}],56:[function(require,module,exports){
(function (global){(function (){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildAttributesData = buildAttributesData;
exports.buildDocumentObject = buildDocumentObject;
exports.cleanAttributes = cleanAttributes;
exports.cleanMatches = cleanMatches;
exports.delimiter2RegExp = delimiter2RegExp;
exports.escapeHTML = escapeHTML;
exports.extractAttributes = extractAttributes;
exports.extractOrderedAttributes = extractOrderedAttributes;
exports.extractUrls = extractUrls;
exports.getAllViewTargetMap = getAllViewTargetMap;
exports.getBaseTargetName = getBaseTargetName;
exports.getFullTitle = getFullTitle;
exports.getLookAhead = getLookAhead;
exports.getLookBehind = getLookBehind;
exports.getNonCapturingPattern = getNonCapturingPattern;
exports.getReferences = getReferences;
exports.getTextNodesIn = getTextNodesIn;
exports.getUuid = getUuid;
exports.hasTags = hasTags;
exports.identity = identity;
exports.indent = indent;
exports.intersect = intersect;
exports.matchIdentity = matchIdentity;
exports.mergeMatches = mergeMatches;
exports.normalizeString = normalizeString;
exports.regExpEscape = regExpEscape;
exports.sanitizeHtml = sanitizeHtml;
exports.simpleParse = simpleParse;
exports.supportNegativeLookbehind = supportNegativeLookbehind;
exports.xmlEscape = xmlEscape;
var _jquery = require("../jquery.js");
var _index = require("../ux/index.js");
var _index2 = require("../settings/index.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function regExpEscape(pattern) {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
;
function xmlEscape(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
    }
  });
}
function supportNegativeLookbehind() {
  try {
    var r = new RegExp("(?<!1)");
    return true;
  } catch (e) {
    return false;
  }
}
;
function intersect(a, b) {
  var t;
  if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
  return a.filter(function (e) {
    return b.indexOf(e) > -1;
  });
}
;
function getLookBehind(pattern) {
  return supportNegativeLookbehind() ? '(?<!' + pattern + ')' : '';
}
;
function getLookAhead(pattern) {
  return '(?!' + pattern + ')';
}
;
function delimiter2RegExp(delimiter) {
  var expr = null;
  if (Object.prototype.toString.call(delimiter) !== "[object RegExp]") {
    if (R2L.getNamedRule(delimiter)) {
      expr = R2L.getNamedRule(delimiter).pattern;
    }
    if (!expr && delimiter) {
      if (delimiter[0] === '/' && delimiter.length > 1) {
        var parts = delimiter.split('/');
        parts.shift();
        var modifiers = parts.pop();
        expr = new RegExp(parts.join('/'), modifiers);
      }
    }
    if (!expr && delimiter) {
      expr = new RegExp(regExpEscape(delimiter), 'gi');
    }
  } else {
    expr = delimiter;
  }
  return expr;
}
;
var _div;
/**
 * Sanitizes a string to make sure it does not contain HTML markup;
 * @param {String} str 
 * @returns {String} HTML encoded string
 */
function sanitizeHtml(str) {
  str = String(str);
  // reuse DOM Element instead of creating a new one every time this function is called
  _div = _div || document.createElement('div');
  _div.innerHTML = str;
  return _div.textContent;
}
function simpleParse(tpl, data) {
  return tpl.replace(/\{\{\s*\$([^}]{1,50}?)\s*\}\}/ig, function (match, varName) {
    return varName && data.hasOwnProperty(varName) ? data[varName] : '';
  });
}
;
function getNonCapturingPattern(pattern) {
  return pattern.replace(/\((?!\?[<!=:])/g, function (match, position) {
    if (position > 3) {
      if (pattern[position - 3] + pattern[position - 2] + pattern[position - 1] === '(?=') {
        return match;
      }
    }
    if (position == 0 || position > 0 && pattern[position - 1] !== '\\') {
      return '(?:';
    }
    return match;
  });
}
;
function matchIdentity() {
  var match = {
      count: this.counter,
      match: this.match,
      wholeMatch: this.wholeMatch,
      type: this.rule.type,
      label: this.rule.ruleLibelle,
      views: [],
      rule: this.rule
    },
    renderedViews = [];
  this.alternatives.sort(_index.orderSorter);
  var defaultRendered = false;
  this.alternatives.reverse.forEach(function (_alternative) {
    if (_alternative.viewName == '_default' || !String(_alternative.view || '').trim() || renderedViews.indexOf(_alternative.view) >= 0) {
      return;
    }
    match.views.push({
      target: _alternative.viewName,
      view: _alternative.view,
      _default: !defaultRendered,
      order: _alternative.order
    });
    defaultRendered = true;
    renderedViews.push(_alternative.view);
  });
  return match;
}
function identity(inTextMatches) {
  var result = [];
  Object.keys(inTextMatches || {}).forEach(function (_matchKey) {
    result.push(matchIdentity.call(inTextMatches[_matchKey]));
  });
  return result;
}
;
function getReferences() {
  var $this = (0, _jquery.$)(this),
    inTextMatches = {},
    $ref2links = $this.find(".".concat(_index2.settings.generatedClassName));
  ;
  if (!$ref2links.length && !(0, _jquery.$)($this).attr(_index2.settings.parsedAttribute)) {
    // parsing should already have happened
    return {};
  }
  $ref2links.each(function () {
    var reference = (0, _jquery.$)(this).getRef2linkMatch();
    if (!reference || !reference.reference) {
      return;
    }
    if (!inTextMatches.hasOwnProperty(reference.reference)) {
      inTextMatches[reference.reference] = Object.assign({}, reference);
      inTextMatches[reference.reference].counter = 0;
    } else {
      // the reference offsets should already be grouped, but not in the case of aliases
      reference.offsets.forEach(function (offset) {
        var existing = inTextMatches[reference.reference].offsets.filter(function (o) {
          return o.position === offset.position;
        }).length > 0;
        if (!existing) {
          inTextMatches[reference.reference].offsets.push(offset);
        }
      });
    }
    inTextMatches[reference.reference].counter++;
  });
  return inTextMatches;
}
;
function mergeMatches(matches1, matches2) {
  Object.keys(matches1).forEach(function (key) {
    if (matches2[key]) {
      // add offsets
      matches1[key].offsets = matches1[key].offsets.concat(matches2[key].offsets);
      matches1[key].counter += matches2[key].counter;
    }
  });
  return _objectSpread(_objectSpread({}, matches2), matches1);
}
function buildAttributesData(attributesList) {
  var data = {};
  // custom handling for CELEX ids
  var celexIds = [];
  attributesList.forEach(function (attrItem) {
    var attrKey = attrItem.key;
    var attrValue = attrItem.value;
    var key = attrKey.replace("data-ref-", "");
    key = key.replace("data-", "");

    // a ref might have multiple (CELEX) ids (celex-1, celex-2 ...), add them all to an array
    if (key.match(/celex-\d+$/)) {
      celexIds.push(attrValue);
    } else {
      data[key] = attrValue;
      // add main celex id if any
      if (key === 'celex') {
        celexIds.push(data[key]);
      }
    }
  });
  if (celexIds.length > 0) {
    data['celexIds'] = celexIds.filter(function (value, index, array) {
      return array.indexOf(value) === index;
    });
    //REFTOLINK-1474
    data['celex'] = celexIds[0];
  }
  return data;
}

/**
 * Returns an ordered list of attribute data
 * @param {Array<Object>} alternatives 
 * @returns {Array<Object}
 */
function extractOrderedAttributes(alternatives) {
  var attributes = [];
  var keys = [];
  alternatives.forEach(function (alternative) {
    if (alternative.viewName === "table") {
      return;
    }
    var view = alternative.view || "";
    if (!view) {
      return;
    }

    // extract attributes from HTML using a REGEX
    var regex = /\s(data-(?:[^=]+))="([^"]+)"/gi;
    var result;
    while ((result = regex.exec(view)) !== null) {
      if (!result) {
        continue;
      }
      var name = result[1] || "";
      var value = result[2] || "";
      if (name.slice(0, 4) !== 'data') {
        continue;
      }
      if (!value || value === "null") {
        continue;
      }
      if (keys.indexOf(name) === -1 && ['data-debug', 'data-ref2link-initial', 'data-ref2link-context'].indexOf(name) === -1) {
        attributes.push({
          key: name,
          value: value
        });
        keys.push(name);
      }
    }
  });
  return attributes;
}
function extractUrls(views) {
  var urls = [];
  Object.keys(views).forEach(function (_view) {
    if (_view === "table") {
      return;
    }
    var view = views[_view];
    if (!view) {
      return;
    }

    // extract attributes from HTML using a REGEX
    var regex = /\shref="([^"]+)"/gi;
    var result;
    while ((result = regex.exec(view)) !== null) {
      if (!result) {
        continue;
      }
      var url = result[1] || "";
      if (url) {
        urls.push(url);
      }
    }
  });
  return urls;
}
;

/**
 * Extract data-* attributes from views
 * @param {Array<Object>} views 
 * 
 * @returns {Object} map of attr => values
 */
function extractAttributes(views) {
  var attributes = {};
  Object.keys(views).forEach(function (_view) {
    if (_view === "table") {
      return;
    }
    var view = views[_view];
    if (!view) {
      return;
    }

    // extract attributes from HTML using a REGEX
    var regex = /\s(data-(?:[^=]+))="([^"]+)"/gi;
    var result;
    while ((result = regex.exec(view)) !== null) {
      if (!result) {
        continue;
      }
      var name = result[1] || "";
      var value = result[2] || "";
      if (name.slice(0, 4) !== 'data') {
        continue;
      }
      if (!value || value === "null") {
        continue;
      }
      if (['data-debug', 'data-ref2link-initial', 'data-ref2link-context'].indexOf(name) === -1) {
        attributes[name] = value;
      }
    }
  });
  return attributes;
}
;

/**
 * Remove CELEX suffixes `-0`, `-1` from attributes `data-ref-celex-0`, `data-ref-celex-1` ...
 * @param {Object} attributes
 * 
 * @return {Object}  
 */
function cleanAttributes(attributes) {
  var newAttributes = {};
  Object.keys(attributes).reverse().forEach(function (key) {
    newAttributes[key.replace(/-\d+$/, '')] = attributes[key];
  });
  return newAttributes;
}

/**
 * Remove top-level match info as we manage the data using the offsets property
 * @param {Object} matches
 * @returns {Object} matches 
 */
function cleanMatches(matches) {
  Object.keys(matches).forEach(function (key) {
    matches[key].alternatives = null;
    matches[key].views = null;
    matches[key].startPosition = null;
    matches[key].rule = null;
    matches[key].matches = null;
  });
  return matches;
}
function indent(indent, text) {
  return ' '.repeat(2 * indent) + text + '\r\n';
}
function getUuid() {
  return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function (c) {
    var r = Math.floor(Math.random() * 16);
    return r.toString(16);
  });
}
function escapeHTML(text) {
  return (0, _jquery.$)('<div><div>').text(text).html();
}

/**
 * Check if a string is HTML/XML by looking for ending tags. 
 * Parsing the string using DOMParser might return false positives by randomly using `<` or `>` tags.
 * Example: "He said <hello world>!" 
 * @param {String} str 
 * @returns {Boolean}
 */
function hasTags(str) {
  // remove <ref2link-object> tags first
  var regex = /<ref2link-object oid="N\d+N"><\/ref2link-object>/g;
  str = str.replace(regex, '');

  // detects closing tags: </element>
  var hasClosingTags = /<\/[a-zA-Z]\w{0,12}([-_.:]\w{1,10})*\s*>/g.test(str);

  // detects self closing tabs: <element />
  var hasSelfClosingTags = /<[a-zA-Z]\w{0,12}([-_.:]\w{1,10})*\s*\/>/g.test(str);
  return hasClosingTags || hasSelfClosingTags;
}

/**
 * Returns the document element built from the input string (if valid HTML)
 * 
 * @param {String} str 
 * @returns {HTMLElement|null}
 */
function buildDocumentObject(str) {
  if (!window || !global || !global.window) {
    return null;
  }
  try {
    var doc = new (window || global.window).DOMParser().parseFromString(str, "text/html");
    var hasNodes = Array.from(doc.body.childNodes).some(function (node) {
      return node.nodeType === 1;
    });
    return hasNodes ? doc : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}
function getTextNodesIn(node, includeWhitespaceNodes) {
  var textNodes = [],
    nonWhitespaceMatcher = /\S/;
  function getTextNodes(node) {
    if (node.nodeType == 3) {
      if (includeWhitespaceNodes || nonWhitespaceMatcher.test(node.nodeValue)) {
        textNodes.push(node);
      }
    } else {
      for (var i = 0, len = node.childNodes.length; i < len; ++i) {
        // we don't parse anchor nodes as we cannot replace inside them
        if (node.localName !== "a") {
          getTextNodes(node.childNodes[i]);
        }
      }
    }
  }
  getTextNodes(node);
  return textNodes;
}
var _allTargets = {};

/**
 * Returns a map of `target: baseTarget` for easy lookups
 * @param {Boolean} refresh 
 * @returns {Object}
 */
function getAllViewTargetMap(refresh) {
  if (!refresh && Object.keys(_allTargets).length) {
    return _allTargets;
  }
  var rules = R2L.getAllRules();
  _allTargets = {};
  rules.forEach(function (rule) {
    rule.views.forEach(function (view) {
      _allTargets[view.target] = view.baseTarget;
    });
  });
  return _allTargets;
}
function getBaseTargetName(targetName) {
  var allViewTargets = getAllViewTargetMap();
  return allViewTargets[targetName] || targetName;
}

// if no grouping happens but it's part of a group we need to move the prefix in front
// Example: 'EUR-Lex to Judgement' => 'to EUR-Lex Judgement'
function getFullTitle(title, groupTarget) {
  var fullTitle = title;
  if (groupTarget && R2L.viewTitlePrefix) {
    var prefix = R2L.viewTitlePrefix + " ";
    if (title.indexOf(prefix) === 0) {
      fullTitle = prefix + groupTarget + " " + fullTitle.replace(prefix, "");
    }
  }
  return fullTitle;
}
function normalizeString(str) {
  return str.replace(/[εέ]/g, "[εέ]").replace(/[ύυ]/g, "[υύ]").replace(/[οό]/g, "[οό]").replace(/[ωώ]/g, "[ωώ]").replace(/[αά]/g, "[αά]").replace(/[ιί]/g, "[ιί]").replace(/[ηή]/g, "[ηή]").replace(/\n/g, " ").replace(/[aáãăâ]/g, "[aáãăâ]").replace(/[eéèê]/g, "[eéèê]").replace(/[iíîïì]/g, "[iíîïì]").replace(/[oóôõ]/g, "[oóôõ]").replace(/[sș]/g, "[sș]").replace(/[tț]/g, "[tț]").replace(/[uúü]/g, "[uúü]").replace(/[cç]/g, "[cç]");
}

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../jquery.js":9,"../settings/index.js":32,"../ux/index.js":63}],57:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.letters = void 0;
var letters = exports.letters = {
  latin: "a-zA-Z",
  cyrillic: "ЁёА-я",
  greek: "Α-ω",
  specialChars: "ÄäÅåÁáÀàÂâĂăĄąĀāĊċĆćČčÇçĎďĐđĘęĖėËëÉéÈèÊêĒēĚěĢģĠġĦħÏïÎîÌìÍíĪīĮįĶķŁłĹĺĽľĻļŃńŇňÑñŅņÖöÔôÓóŐőÒòÕõØøŔŕŘřŚśŠšȘșẞßȚțŤťÜüŮůÙùÚúŰűÛûŪūŲųŸÿŻżŹźŽžŒœÆæ"
};

},{}],58:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cloneCoreIdentifiers = cloneCoreIdentifiers;
exports.cloneListCore = cloneListCore;
exports.cloneListIdentifiers = cloneListIdentifiers;
exports.getCoreIdentifiers = getCoreIdentifiers;
exports.getListCore = getListCore;
exports.getListIdentifiers = getListIdentifiers;
exports.getListShared = getListShared;
exports.getListSkips = getListSkips;
exports.getListVars = getListVars;
exports.getOffsetMap = getOffsetMap;
exports.getSubpartIdentifiers = getSubpartIdentifiers;
/**
 * Utility functions that operate on `list` rules. 
 * 
 * List rules are the rules that capture lists of subdivisions (EU legal acts, treaties). 
 * Example:
 *     articles 101 and 102 of the TFEU    # The engine will detect 2 nodes: `articles 101`, `102 of the TFEU`
 * 
 * Within a reference block containing multiple nodes (subdivision), some will capture more information than others, which means the data needs to be shared between the items.
 * In our example above, the first node `articles 101` does not 'know' we are referring to the TFEU treaty, hence why we need to share the information from the second item to the first.
 * 
 * Data will be shared between nodes based on the `list-prefix` / `list-shared` / `list-identifiers` / `list-vars` / `list-skip` attributes of the XML rule declaration.
 * Only particular offsets should be shared in order to ensure consistency. In the example below: 
 * 
 *     Article 25(6), (7) and (8) of Regulation (EU) 2018/1725
 * 
 *     Detects 3 nodes: 
 *         `Article 25(6)`             # Contains 'article' and 'paragraph' information, but is missing act type/year/number (Regulation/2018/1725);
 *         `(7)`                       # Contains 'paragraph' information, needs 'article' information from node #1 and act type/year/number from node #3;
 *         `(8) of Regulation (EU) 2018/1725` # Contains all information except the 'article' number from node #1;
 * 
 * Note that data needs to be shared between both left-hand nodes and right-hand nodes. 
 * 
 * In the example above, the attributes should be defined as follows:
 *   - `list-prefix` offsets should point to the capture group of the act label: "Regulation";
 *      This data is always copied between nodes;
 * 
 *   - `list-shared` offsets should point to the year and number of the act: "2018" and "1725";
 *      This data is copied only when missing from target nodes;
 * 
 *   - `list-identifiers` offsets should point to the article number: "25";
 *      All division-specific (article/annex and deeper) offsets are identifiers. This data is copied only when missing from target nodes;
 * 
 *   - `list-vars` offsets are a sub-part of identifier offsets, used for nodes which are ambiguous, like a single number. Examples: 
 *        - articles 2, 3 and 4 of TFUE;           # '3' is a variable offset, representing an article number
 *        - article 1 paragraph 2, 3 and 4 of TFUE   # '4' is a variable offset, representing a paragraph number
 * 
 *      Special treatment is required to evaluate what subdivision level a variable offset represents;
 * 
 *   - `list-skip` offsets are used to skip certain identifier offsets from copying left or right;
 *       
 */

/**
 * Copy the identifiers of a subpart - Exclude point level
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
function cloneCoreIdentifiers(sourceRef, destRef) {
  var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);
  var coreIndexes = sourceRef.rule.coreIdentifiers ? String(sourceRef.rule.coreIdentifiers).split(" ") : [];
  var destVar = null;
  var destVars = getListVars(destRef.rule, destRef.matches);

  /* Constructs like "32.4" number.number (SV) should not clone identifiers */
  if (/^\d+\.\d+/.test(sourceRef.matches[0])) {
    return true;
  }

  /* Constructs with brackets like "13(b)" article(point letter) should not clone identifiers */
  if (destVars.length === 1 && !/^\d+\([a-z0-9]+\)/.test(destRef.matches[0])) {
    destVar = destVars[0].match;
    destRef.matches[parseInt(destVars[0].index)] = undefined;
  }
  var filteredSourceVars = [];
  for (var i = 0; i < sourceIds.length; i++) {
    if (coreIndexes.indexOf(sourceIds[i].index) !== -1) {
      filteredSourceVars.push(sourceIds[i]);
    } else {
      if (destVar) {
        destRef.matches[parseInt(sourceIds[i].index)] = destVar;
      }
    }
  }
  for (var i = 0; i < filteredSourceVars.length; i++) {
    if (!destRef.matches[parseInt(filteredSourceVars[i].index)]) {
      destRef.matches[parseInt(filteredSourceVars[i].index)] = filteredSourceVars[i].match;
    }
  }
  return true;
}

/**
 * Adjust destRef identifiers in case of standalone numbers by merging with source
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
function cloneListIdentifiers(sourceRef, destRef) {
  if (!sourceRef.rule || !sourceRef.rule.type) {
    return false;
  }
  var destVars = getListVars(destRef.rule, destRef.matches);
  var destCoreIds = getListCore(destRef.rule, destRef.matches);
  var destIds = getListIdentifiers(destRef.rule, destRef.matches);
  destIds = destIds.filter(function (id) {
    return id.type === 'identifiers';
  });

  // default behavior "article 5 paragraphs 3 and 4" (copy-right)
  if (destVars.length === 1 && destIds.length === 1) {
    /* This match has variable offsets, meaning we need the context from source
     * Merge the variable value into the matches of the source. 
     */

    /* Don't overwrite prefix data */
    var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);
    var skipVars = getListSkips(sourceRef.rule, sourceRef.matches);
    var skipIndexes = skipVars.map(function (skipVar) {
      return skipVar.index;
    });

    /** 
     * If the source looks like this: "article 15 (4)" or "article 16(b)" then we need to analyse the destination 
     * in order to find the correct offsets
     */
    if (/\d{1,6}\s?\(([a-z]|[0-9]+)\)/.test(sourceRef.matches[0])) {
      /**
       * Constructs with brackets like "article 3(12) and 4 of Dir 497/2018" should not clone identifiers 
       */
      if (/^\d{1,6}(\(\w\))?$/.test(destRef.matches[0])) {
        // include all but the first sourceId as skip indexes
        for (var skipIndex = 1; skipIndex < sourceIds.length; skipIndex++) {
          skipIndexes.push(sourceIds[skipIndex].index);
        }
      }
    }

    /** If the raw reference (destination) is wrapped in brackets eg "art. 14(3) and (4)" we don't use skip vars */
    if (/^\(\d{1,6}(?:[a-z])?\)/.test(destRef.matches[0].trim())) {
      skipIndexes = [];
    }

    /** 
     * If the raw reference is a letter we don't use skip vars as it will be last-level
     * Example: article 15 point a) and b)
     */
    if (/^\(?[a-z]/.test(destRef.matches[0])) {
      skipIndexes = [];
    }

    /** 
     * Source constructs like article.paragraph should be handled differently. 
     * All raw subparts after them should be 1st level (SV) 
     */
    if (/\d{1,6}\.[a-nA-N0-9]/.test(sourceRef.matches[0])) {
      for (var _skipIndex = 1; _skipIndex < sourceIds.length; _skipIndex++) {
        skipIndexes.push(sourceIds[_skipIndex].index);
      }
    }
    var filteredSourceIds = sourceIds.filter(function (sourceId) {
      return skipIndexes.indexOf(sourceId.index) === -1;
    });
    if (filteredSourceIds.length > 0) {
      destRef.matches[parseInt(destVars[0].index)] = undefined;

      /** 
       * Find a position to insert the variable. 
       * Usually it's last level eg. article 5 paragraphs 1 and 2
       * Sometimes it's one to the left eg. article 5 paragraphs 1(a) and 2(b)
       * If there is a mismatch between type (letter vs number) we can move one position to the left
       */
      var selectedSlot = filteredSourceIds.length - 1;
      if (filteredSourceIds.length > 1 && /\d+/.test(destVars[0].match) && /[a-z]/.test(filteredSourceIds[filteredSourceIds.length - 1].match)) {
        selectedSlot--;
        filteredSourceIds.splice(-1, 1);
      }
      filteredSourceIds[selectedSlot].match = destVars[0].match;
      for (var i = 0; i < filteredSourceIds.length; i++) {
        destRef.matches[parseInt(filteredSourceIds[i].index)] = filteredSourceIds[i].match;
      }
    }
  }

  // right-hand element needs core matches and identifiers
  // REFTOLINK-1184
  if (destIds.length === 0 && destVars.length === 0) {
    var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);
    for (var i = 0; i < sourceIds.length; i++) {
      destRef.matches[parseInt(sourceIds[i].index)] = sourceIds[i].match;
    }
  }
  return true;
}
;

/**
 * Copy prefix matches from one object to the other
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
function cloneListCore(sourceRef, destRef) {
  if (!sourceRef.rule || !sourceRef.rule.type || !sourceRef.rule.prefix) {
    return false;
  }
  var indexes;
  var listRef = getListCore(destRef.rule, destRef.matches);
  if (listRef.length === 0 && sourceRef.rule.prefix) {
    var indexes = String(sourceRef.rule.prefix).split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (typeof sourceRef.matches[indexes[i]] === "string" && typeof destRef.matches[indexes[i]] === "undefined") {
        destRef.matches[indexes[i]] = sourceRef.matches[indexes[i]];
      }
    }
  }
  var sharedRef = getListShared(destRef.rule, destRef.matches);
  if (sharedRef.length === 0 && sourceRef.rule.shared) {
    indexes = String(sourceRef.rule.shared).split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (typeof sourceRef.matches[indexes[i]] === "string" && typeof destRef.matches[indexes[i]] === "undefined") {
        destRef.matches[indexes[i]] = sourceRef.matches[indexes[i]];
      }
    }
  }
  return true;
}
;

/**
 * Get map of offsets for lists
 * @param {Array<Object>} references
 * 
 * @returns {Object} map of full list matches
 */
function getOffsetMap(references) {
  var allOffsets = {};
  for (var i = 0; i < references.length; i++) {
    if (!Array.isArray(references[i].offsets)) {
      continue;
    }
    for (var j = 0; j < references[i].offsets.length; j++) {
      if (!allOffsets[references[i].offsets[j].context]) {
        allOffsets[references[i].offsets[j].context] = new Array();
      }
      allOffsets[references[i].offsets[j].context].push(references[i].offsets[j]);
    }
  }
  return allOffsets;
}
;

/**
 * Get base list information from the matches.
 * 
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getListCore(rule, matches) {
  var arr = new Array();
  if (rule.prefix) {
    rule.prefix = String(rule.prefix);
    var indexes = rule.prefix.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'prefix'
        });
      }
    }
  }
  return arr;
}
;

/**
 * Get shared list information from the matches.
 * 
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getListShared(rule, matches) {
  var arr = new Array();
  if (rule.shared) {
    rule.shared = String(rule.shared);
    var indexes = rule.shared.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'shared'
        });
      }
    }
  }
  return arr;
}
;
function getCoreIdentifiers(rule, matches) {
  var arr = new Array();
  if (rule.coreIdentifiers) {
    rule.coreIdentifiers = String(rule.coreIdentifiers);
    var indexes = rule.coreIdentifiers.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'core-identifiers'
        });
      }
    }
  }
  return arr;
}
;

/**
 * Get variables list information from the matches.
 * 
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getListVars(rule, matches) {
  var arr = new Array();
  if (rule.vars) {
    rule.vars = String(rule.vars);
    var indexes = rule.vars.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'vars'
        });
      }
    }
  }
  return arr;
}
;

/**
 * Get skip list information from the matches.
 * 
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getListSkips(rule, matches) {
  var arr = new Array();
  if (rule.skip) {
    rule.skip = String(rule.skip);
    var indexes = rule.skip.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'skip'
        });
      }
    }
  }
  return arr;
}
;

/**
 * Get subpart specific information from the matches
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getSubpartIdentifiers(rule, matches) {
  var arr = new Array();
  if (rule.identifiers) {
    rule.identifiers = String(rule.identifiers);
    var indexes = rule.identifiers.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'identifiers'
        });
      }
    }
  }
  return arr;
}
;

/**
 * Get list-item specific information from the matches
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
function getListIdentifiers(rule, matches) {
  var arr = new Array();
  if (rule.shared) {
    rule.shared = String(rule.shared);
    var indexes = rule.shared.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'shared'
        });
      }
    }
  }
  if (rule.identifiers) {
    rule.identifiers = String(rule.identifiers);
    var indexes = rule.identifiers.split(" ");
    for (var i = 0; i < indexes.length; i++) {
      if (matches[indexes[i]]) {
        arr.push({
          'index': indexes[i],
          'match': matches[indexes[i]],
          'type': 'identifiers'
        });
      }
    }
  }
  return arr;
}
;

},{}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
// Copyright (c) 2013 Pieroxy <pieroxy@pieroxy.net>
// This work is free. You can redistribute it and/or modify it
// under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// For more information, the home page:
// http://pieroxy.net/blog/pages/lz-string/testing.html
//
// LZ-based compression algorithm, version 1.4.5
var LZString = function () {
  // private property
  var f = String.fromCharCode;
  var keyStrBase64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var keyStrUriSafe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  var baseReverseDic = {};
  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (var i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }
  var LZString = {
    compressToBase64: function compressToBase64(input) {
      if (input == null) return "";
      var res = LZString._compress(input, 6, function (a) {
        return keyStrBase64.charAt(a);
      });
      switch (res.length % 4) {
        // To produce valid Base64
        default: // When could this happen ?
        case 0:
          return res;
        case 1:
          return res + "===";
        case 2:
          return res + "==";
        case 3:
          return res + "=";
      }
    },
    decompressFromBase64: function decompressFromBase64(input) {
      if (input == null) return "";
      if (input == "") return null;
      return LZString._decompress(input.length, 32, function (index) {
        return getBaseValue(keyStrBase64, input.charAt(index));
      });
    },
    compressToUTF16: function compressToUTF16(input) {
      if (input == null) return "";
      return LZString._compress(input, 15, function (a) {
        return f(a + 32);
      }) + " ";
    },
    decompressFromUTF16: function decompressFromUTF16(compressed) {
      if (compressed == null) return "";
      if (compressed == "") return null;
      return LZString._decompress(compressed.length, 16384, function (index) {
        return compressed.charCodeAt(index) - 32;
      });
    },
    //compress into uint8array (UCS-2 big endian format)
    compressToUint8Array: function compressToUint8Array(uncompressed) {
      var compressed = LZString.compress(uncompressed);
      var buf = new Uint8Array(compressed.length * 2); // 2 bytes per character

      for (var i = 0, TotalLen = compressed.length; i < TotalLen; i++) {
        var current_value = compressed.charCodeAt(i);
        buf[i * 2] = current_value >>> 8;
        buf[i * 2 + 1] = current_value % 256;
      }
      return buf;
    },
    //decompress from uint8array (UCS-2 big endian format)
    decompressFromUint8Array: function decompressFromUint8Array(compressed) {
      if (compressed === null || compressed === undefined) {
        return LZString.decompress(compressed);
      } else {
        var buf = new Array(compressed.length / 2); // 2 bytes per character
        for (var i = 0, TotalLen = buf.length; i < TotalLen; i++) {
          buf[i] = compressed[i * 2] * 256 + compressed[i * 2 + 1];
        }
        var result = [];
        buf.forEach(function (c) {
          result.push(f(c));
        });
        return LZString.decompress(result.join(''));
      }
    },
    //compress into a string that is already URI encoded
    compressToEncodedURIComponent: function compressToEncodedURIComponent(input) {
      if (input == null) return "";
      return LZString._compress(input, 6, function (a) {
        return keyStrUriSafe.charAt(a);
      });
    },
    //decompress from an output of compressToEncodedURIComponent
    decompressFromEncodedURIComponent: function decompressFromEncodedURIComponent(input) {
      if (input == null) return "";
      if (input == "") return null;
      input = input.replace(/ /g, "+");
      return LZString._decompress(input.length, 32, function (index) {
        return getBaseValue(keyStrUriSafe, input.charAt(index));
      });
    },
    compress: function compress(uncompressed) {
      return LZString._compress(uncompressed, 16, function (a) {
        return f(a);
      });
    },
    _compress: function _compress(uncompressed, bitsPerChar, getCharFromInt) {
      if (uncompressed == null) return "";
      var i,
        value,
        context_dictionary = {},
        context_dictionaryToCreate = {},
        context_c = "",
        context_wc = "",
        context_w = "",
        context_enlargeIn = 2,
        // Compensate for the first entry which should not count
        context_dictSize = 3,
        context_numBits = 2,
        context_data = [],
        context_data_val = 0,
        context_data_position = 0,
        ii;
      for (ii = 0; ii < uncompressed.length; ii += 1) {
        context_c = uncompressed.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
          context_dictionary[context_c] = context_dictSize++;
          context_dictionaryToCreate[context_c] = true;
        }
        context_wc = context_w + context_c;
        if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
          context_w = context_wc;
        } else {
          if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
            if (context_w.charCodeAt(0) < 256) {
              for (i = 0; i < context_numBits; i++) {
                context_data_val = context_data_val << 1;
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
              }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 8; i++) {
                context_data_val = context_data_val << 1 | value & 1;
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = value >> 1;
              }
            } else {
              value = 1;
              for (i = 0; i < context_numBits; i++) {
                context_data_val = context_data_val << 1 | value;
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = 0;
              }
              value = context_w.charCodeAt(0);
              for (i = 0; i < 16; i++) {
                context_data_val = context_data_val << 1 | value & 1;
                if (context_data_position == bitsPerChar - 1) {
                  context_data_position = 0;
                  context_data.push(getCharFromInt(context_data_val));
                  context_data_val = 0;
                } else {
                  context_data_position++;
                }
                value = value >> 1;
              }
            }
            context_enlargeIn--;
            if (context_enlargeIn == 0) {
              context_enlargeIn = Math.pow(2, context_numBits);
              context_numBits++;
            }
            delete context_dictionaryToCreate[context_w];
          } else {
            value = context_dictionary[context_w];
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1 | value & 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          // Add wc to the dictionary.
          context_dictionary[context_wc] = context_dictSize++;
          context_w = String(context_c);
        }
      }

      // Output the code for w.
      if (context_w !== "") {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = context_data_val << 1 | value & 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1 | value;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = context_data_val << 1 | value & 1;
              if (context_data_position == bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn == 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1 | value & 1;
            if (context_data_position == bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn == 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
      }

      // Mark the end of the stream
      value = 2;
      for (i = 0; i < context_numBits; i++) {
        context_data_val = context_data_val << 1 | value & 1;
        if (context_data_position == bitsPerChar - 1) {
          context_data_position = 0;
          context_data.push(getCharFromInt(context_data_val));
          context_data_val = 0;
        } else {
          context_data_position++;
        }
        value = value >> 1;
      }

      // Flush the last char
      while (true) {
        context_data_val = context_data_val << 1;
        if (context_data_position == bitsPerChar - 1) {
          context_data.push(getCharFromInt(context_data_val));
          break;
        } else context_data_position++;
      }
      return context_data.join('');
    },
    decompress: function decompress(compressed) {
      if (compressed == null) return "";
      if (compressed == "") return null;
      return LZString._decompress(compressed.length, 32768, function (index) {
        return compressed.charCodeAt(index);
      });
    },
    _decompress: function _decompress(length, resetValue, getNextValue) {
      var dictionary = [],
        next,
        enlargeIn = 4,
        dictSize = 4,
        numBits = 3,
        entry = "",
        result = [],
        i,
        w,
        bits,
        resb,
        maxpower,
        power,
        c,
        data = {
          val: getNextValue(0),
          position: resetValue,
          index: 1
        };
      for (i = 0; i < 3; i += 1) {
        dictionary[i] = i;
      }
      bits = 0;
      maxpower = Math.pow(2, 2);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      switch (next = bits) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          c = f(bits);
          break;
        case 2:
          return "";
      }
      dictionary[3] = c;
      w = c;
      result.push(c);
      while (true) {
        if (data.index > length) {
          return "";
        }
        bits = 0;
        maxpower = Math.pow(2, numBits);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        switch (c = bits) {
          case 0:
            bits = 0;
            maxpower = Math.pow(2, 8);
            power = 1;
            while (power != maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 1:
            bits = 0;
            maxpower = Math.pow(2, 16);
            power = 1;
            while (power != maxpower) {
              resb = data.val & data.position;
              data.position >>= 1;
              if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
              }
              bits |= (resb > 0 ? 1 : 0) * power;
              power <<= 1;
            }
            dictionary[dictSize++] = f(bits);
            c = dictSize - 1;
            enlargeIn--;
            break;
          case 2:
            return result.join('');
        }
        if (enlargeIn == 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }
        if (dictionary[c]) {
          entry = dictionary[c];
        } else {
          if (c === dictSize) {
            entry = w + w.charAt(0);
          } else {
            return null;
          }
        }
        result.push(entry);

        // Add w+entry[0] to the dictionary.
        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;
        w = entry;
        if (enlargeIn == 0) {
          enlargeIn = Math.pow(2, numBits);
          numBits++;
        }
      }
    }
  };
  return LZString;
}();
var _default = exports["default"] = LZString;

},{}],60:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._replaceHtmlInNode = _replaceHtmlInNode;
exports._replaceTextInNode = _replaceTextInNode;
exports.clearExtracts = clearExtracts;
exports.clearTextCaches = clearTextCaches;
exports.extract = extract;
exports.getExtracts = getExtracts;
exports.padCounter = padCounter;
exports.replaceBoundariedWords = replaceBoundariedWords;
exports.replaceDOMNodes = replaceDOMNodes;
exports.replaceHtmlNodes = replaceHtmlNodes;
exports.unExtractNode = unExtractNode;
exports.unExtractRaw = unExtractRaw;
exports.unpadCounter = unpadCounter;
var _jquery = require("../jquery.js");
var _functions = require("./functions.js");
var _letters = require("./letters.js");
var _list = require("./list.js");
function _replaceTextInNode(node, search, replacement) {
  var newTextContent = node.textContent.replace(new RegExp((0, _functions.regExpEscape)(search), 'g'), replacement); // only set the prop when updated to avoid re-drawing
  if (newTextContent !== node.textContent) {
    node.textContent = newTextContent;
  }
  return node;
}
function _replaceHtmlInNode(node, search, replacement) {
  var newInnerHTML = node.innerHTML.replace(new RegExp((0, _functions.regExpEscape)(search), 'g'), replacement); // only set the prop when updated to avoid re-drawing
  if (newInnerHTML !== node.innerHTML) {
    node.innerHTML = newInnerHTML;
  }
  return node;
}

/**
 * Text replace function; Works on both raw text and HTML input which will require building a DOM tree and replacing only leaf text nodes;
 * Replaces only where the search string is neighboured by boundaries
 * @param {String} toReplace
 * @param {String} replacement
 * @param {String} context
 * @param {Boolean} allowAttribute
 * @param {Boolean} isMain
 * @param {Array<HTMLElement>} prevTextNodes - array of text nodes (leaf nodes) extracted from input (to be reused by subsequent calls)
 * @param {HTMLElement} prevCtx - wrapper node (to be reused by subsequent calls)
 *
 * @returns {Object}  
 *   { 
 *     content: replaced text,
 *     textNodes: HTML nodes parsed from input (used for caching) 
 *     ctx: HTML element wrapper (used for caching)
 *   }
 */
function replaceBoundariedWords(toReplace, replacement, context, allowAttribute, isMain, prevTextNodes, prevCtx) {
  if (allowAttribute !== false) {
    allowAttribute = true;
  }
  var letterPattern = "[/0-9" + _letters.letters.latin + _letters.letters.cyrillic + _letters.letters.greek + _letters.letters.specialChars + (allowAttribute ? '' : '"') + "]";
  var lookahead = (0, _functions.getLookAhead)(letterPattern);
  var lookbehind = (0, _functions.getLookBehind)(letterPattern);
  toReplace = lookbehind + toReplace + lookahead;

  // doc can be an HTMLElement or an HTMLDocument (with body)
  var doc = prevCtx;
  if (R2L.settings.htmlMode && isMain && (prevCtx || (0, _functions.hasTags)(context) && (doc = (0, _functions.buildDocumentObject)(context)))) {
    // we parse the HTML content so we need to only replace text while preserving attributes
    try {
      var textNodes = prevTextNodes || (0, _functions.getTextNodesIn)(doc.body || doc, false);
      var i = textNodes.length;
      var node;
      var escapedToReplace = toReplace.replace(/&nbsp;/g, String.fromCharCode(160)).replace(/&amp;/g, "&");
      var escapedReplacement = replacement.replace(/&nbsp;/g, String.fromCharCode(160)).replace(/&amp;/g, "&");
      var toReplaceRegexp = new RegExp(escapedToReplace, 'g');
      while (i--) {
        node = textNodes[i]; // handle &nbsp; in textContent

        var newTextContent = (node.r2lTextContent || node.textContent).replace(toReplaceRegexp, escapedReplacement); // only set the prop when updated to avoid re-drawing

        if (newTextContent !== node.textContent) {
          node.r2lTextContent = newTextContent;
        }
      }
      return {
        toRender: true,
        content: null,
        // let the caller calculate content as it is a heavy computation
        ctx: doc,
        textNodes: textNodes
      };
    } catch (e) {
      //console.error(e, "Cannot be parsed as HTML content");
      // not HTML content, move on.
    }
  }
  return {
    ctx: prevCtx,
    content: context.replace(new RegExp(toReplace, 'g'), replacement)
  };
}
;

/**
 * Will replace detected references with <ref2link> nodes, operating on the current HTMLElement.
 * This preserves existing DOM events.
 * Used by the JQuery API only: $('.selector').parseDeferred();
 * 
 * @param {HTMLElement} node 
 * @param {Object} matches 
 * @returns {HTMLElement}
 */
function replaceDOMNodes(node, matches) {
  var et1 = performance.now();
  console.log("Start replace DOMNodes", et1);
  var keys = Object.keys(matches);
  keys.sort(function (left, right) {
    return right.length - left.length;
  });
  var allOffsets = (0, _list.getOffsetMap)(Object.values(matches));
  /** replace keys in descending order */
  var offsetKeys = Object.keys(allOffsets);
  offsetKeys.sort(function (a, b) {
    return a.length < b.length ? 1 : -1;
  });
  var _loop = function _loop() {
      offset = allOffsets[offsetKeys[oIndex]];
      replacement = offsetKeys[oIndex];
      /** replace inside list in descending order **/
      offset.sort(function (a, b) {
        return a.match.length > b.match.length ? -1 : 1;
      });
      var allowAttribute = true;
      for (k = 0; k < offset.length; k++) {
        if (offset[k].alternatives.length > 0) {
          var view = "";
          for (l = 0; l < offset[k].alternatives.length; l++) {
            _alternative = offset[k].alternatives[l];
            if (_alternative.view && _alternative.viewName !== "table") {
              view = _alternative.view;
              break;
            }
          }
          ;
          if (!view) {
            continue;
          }
          $view = (0, _jquery.$)('<div>' + view + '</div>');
          extract($view, R2L.settings["class"], false);
          viewHtml = $view.html();
          search = offset[k].match;
          offset[k].alternatives.forEach(function (alt) {
            if (alt.rule && alt.rule.allowAttribute === false) {
              allowAttribute = false;
            }
          });
          if (search.length > 0) {
            replacement = replaceBoundariedWords((0, _functions.regExpEscape)(search), viewHtml, replacement, allowAttribute, false, null, node).content;
          }
        }
      }

      /** replace all */
      var toReplace = (0, _functions.regExpEscape)(offsetKeys[oIndex]);
      var replacementResult = replaceBoundariedWords(toReplace, replacement, "", allowAttribute, true, null, node);
      node = replacementResult.ctx;
    },
    offset,
    replacement,
    k,
    l,
    _alternative,
    $view,
    viewHtml,
    search;
  for (var oIndex = 0; oIndex < offsetKeys.length; oIndex++) {
    _loop();
  }
  ;
  var et2 = performance.now();
  console.log("Stop replace DOMNodes", et2);
  return node;
}

/**
 * First step of replacement. Will replace the initial content with <ref2link oid="$id"></ref2link> nodes 
 * Used by the R2L programatic API eg: R2L.parse('<div><span>C-99/99</span></div>', 'html');
 * @param {String} html 
 * @param {Object} matches
 * 
 * @returns {String} - content with <ref2link></ref2link> nodes 
 */
function replaceHtmlNodes(html, matches) {
  var _cachedTextNodes = null;
  var _cachedCtx = null;
  var _toRender = false;
  var _originalHtml = html;
  var keys = Object.keys(matches);
  keys.sort(function (left, right) {
    return right.length - left.length;
  });
  var allOffsets = (0, _list.getOffsetMap)(Object.values(matches));
  /** replace keys in descending order */
  var offsetKeys = Object.keys(allOffsets);
  offsetKeys.sort(function (a, b) {
    return a.length < b.length ? 1 : -1;
  });
  var _loop2 = function _loop2() {
      offset = allOffsets[offsetKeys[oIndex]];
      replacement = offsetKeys[oIndex];
      /** replace inside list in descending order **/
      offset.sort(function (a, b) {
        return a.match.length > b.match.length ? -1 : 1;
      });
      var allowAttribute = true;
      for (k = 0; k < offset.length; k++) {
        if (offset[k].alternatives.length > 0) {
          var view = "";
          for (l = 0; l < offset[k].alternatives.length; l++) {
            _alternative = offset[k].alternatives[l];
            if (_alternative.view && _alternative.viewName !== "table") {
              view = _alternative.view;
              break;
            }
          }
          ;
          if (!view) {
            continue;
          }
          $view = (0, _jquery.$)('<div>' + view + '</div>');
          extract($view, R2L.settings["class"], false);
          viewHtml = $view.html();
          search = offset[k].match;
          offset[k].alternatives.forEach(function (alt) {
            if (alt.rule && alt.rule.allowAttribute === false) {
              allowAttribute = false;
            }
          });
          if (search.length > 0) {
            replacement = replaceBoundariedWords((0, _functions.regExpEscape)(search), viewHtml, replacement, allowAttribute).content;
          }
        }
      }

      /** replace all */
      var toReplace = (0, _functions.regExpEscape)(offsetKeys[oIndex]);
      var replacementResult = replaceBoundariedWords(toReplace, replacement, html, allowAttribute, true, _cachedTextNodes, _cachedCtx);
      // content might be empty as we don't want to re-calculate after each replacement
      html = replacementResult.content;
      _toRender = replacementResult.toRender || false;
      // cache the tree (expensive to re-calculate after each ref replacement)
      _cachedTextNodes = replacementResult.textNodes;
      _cachedCtx = replacementResult.ctx;
    },
    offset,
    replacement,
    k,
    l,
    _alternative,
    $view,
    viewHtml,
    search;
  for (var oIndex = 0; oIndex < offsetKeys.length; oIndex++) {
    _loop2();
  }
  ;

  // only render HTML output once for perf improvements
  if (_toRender && _cachedCtx && _cachedCtx.body) {
    // generate HTML from r2lTextContent props
    _cachedTextNodes.forEach(function (textNode) {
      if (textNode.r2lTextContent && textNode.r2lTextContent !== textNode.textContent) {
        textNode.textContent = textNode.r2lTextContent;
      }
    });

    // if  the input contains a <head> and <body> we replace only inside the <body> contents
    var bodyMatches = /<body[^>]*>([\s\S]*)<\/body>/gi.exec(_originalHtml);
    if (bodyMatches && bodyMatches[1]) {
      html = _originalHtml.replace(bodyMatches[1], _cachedCtx.body.innerHTML);
    } else {
      html = _cachedCtx.body.innerHTML;
    }
  }
  return html;
}

/**
 * 2nd step of the replacement: 
 *   - takes as input a string containing <ref2link-object> nodes and replaces them with the final links (from extracts)
 * @param {String} html 
 * @returns {String} html string with final links
 */
function unExtractRaw(html) {
  var parsedHtml = html;
  if (html.indexOf('ref2link-object') === -1) {
    return parsedHtml;
  }
  for (var i = extracts.length - 1; i >= 0; i--) {
    var $node = extracts[i].$this;
    var outerHTML = $node.prop('outerHTML');
    var replacement = outerHTML;
    var search = new RegExp("(?:<|&lt;)ref2link-object oid=\"".concat(padCounter(i), "\"(?:>|&gt;)(?:<|&lt;)/ref2link-object(?:>|&gt;)"), 'g');
    replacement = outerHTML;
    parsedHtml = parsedHtml.split(search).join(replacement);
  }
  return parsedHtml;
}

/**
 * Remove extracts 
 * @param {int} age - in miliseconds, remove only if all of them are older than `now() - age` 
 */
function clearExtracts(age) {
  if (!age) {
    extracts = [];
  }
  var t = new Date().getTime();
  var isExpired = extracts.filter(function (extract) {
    return t - extract.t < age;
  }).length === 0;
  if (isExpired) {
    extracts = [];
  }
}

// @deprecated
var textCaches = {};

// Used for pre-processing
var extracts = [];
function clearTextCaches() {
  textCaches = {};
}
function getExtracts() {
  return extracts;
}
function padCounter(counter) {
  return 'N' + counter + 'N';
}
;
function unpadCounter(paddedCounter) {
  return ("" + paddedCounter).substr(1, paddedCounter.length - 1);
}
;
function extract($node, selector, whole) {
  var extractCounter = extracts.length;
  $node.find(selector).each(function () {
    var $this = (0, _jquery.$)(this),
      html = '<ref2link-object oid="' + padCounter(extractCounter) + '">';
    if (whole) {
      html += $this.html();
    }
    html += '</ref2link-object>';
    $this.replaceWith(html);
    var e = {
      $this: $this,
      whole: whole,
      t: new Date().getTime()
    };
    extracts.push(e);
    extractCounter++;
  });
}
;
var _tempEl = document.createElement("p");

/**
 * Used only by the JQuery API to operate on DOM nodes 
 * Example: $('.selector').parseReferences();
 * 
 * @param {HTMLElement} node 
 * @returns {HTMLElement}
 */
function unExtractNode(node) {
  var textNodes = (0, _functions.getTextNodesIn)(node, false);
  var j = textNodes.length;
  while (j--) {
    // we use a new prop to mark that the node needs Ref2Link treatment
    var initialTextContent = textNodes[j].r2lTextContent;
    if (!initialTextContent) {
      continue;
    } else {
      _tempEl = _tempEl || document.createElement("p");
      _tempEl.textContent = initialTextContent;

      // We need the HTML encoded data
      var convertedTextContent = _tempEl.innerHTML;
      textNodes[j].innerHTML = convertedTextContent;
      for (var i = extracts.length - 1; i >= 0; i--) {
        var $node = extracts[i].$this;
        var outerHTML = $node.prop('outerHTML');
        var replacement = outerHTML;
        var search = "&lt;ref2link-object oid=\"".concat(padCounter(i), "\"&gt;&lt;/ref2link-object&gt;");
        replacement = outerHTML;
        textNodes[j] = _replaceHtmlInNode(textNodes[j], search, replacement);
      }

      // if the textNode has links we re-create the children
      var span = document.createElement("span");
      span.innerHTML = textNodes[j].innerHTML;
      span.childNodes.forEach(function (childNode) {
        var newNode = childNode.cloneNode(true);
        textNodes[j].parentNode.insertBefore(newNode, textNodes[j]);
      });
      textNodes[j].parentNode.removeChild(textNodes[j]);
      delete textNodes[j].r2lTextContent;
    }
  }
  return node;
}

},{"../jquery.js":9,"./functions.js":56,"./letters.js":57,"./list.js":58}],61:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getEurlexRequestPromise = getEurlexRequestPromise;
exports.getRequestPromise = getRequestPromise;
var _jquery = require("../jquery.js");
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function getRequestPromise(endpoint, method, data, headers) {
  /**
   * Ref2Link library consumers can hook a function to the handling of SPARQL requests in order to override default behavior. 
   * This is useful in the context of the Webservice, which integrates the library and where there is no need for the library to call the WS back for linked data (circular-dependency).
   */

  if (!headers) {
    headers = {};
  }
  var allheaders = _objectSpread(_objectSpread({}, headers), R2L.ldm.getCustomHeaders());
  if (R2L.hooks.handleLinkedDataReq) {
    return R2L.hooks.handleLinkedDataReq(data, headers, false, R2L.ldm.user);
  }
  return new Promise(function (resolve, reject) {
    _jquery.$.ajax({
      url: endpoint,
      method: method,
      data: data,
      headers: allheaders,
      success: function success(response) {
        resolve(response);
      },
      error: function error(_error) {
        reject(_error);
      }
    });
  });
}
function getEurlexRequestPromise(endpoint, method, data, headers) {
  if (!headers) {
    headers = {};
  }
  var allheaders = _objectSpread(_objectSpread({}, headers), R2L.ldm.getCustomHeaders());
  if (R2L.hooks.handleEurlexReq) {
    return R2L.hooks.handleEurlexReq(endpoint, method, data, headers);
  }
  return new Promise(function (resolve, reject) {
    _jquery.$.ajax({
      url: endpoint,
      method: method,
      data: data,
      headers: allheaders,
      success: function success(response) {
        resolve(response);
      },
      error: function error(_error2) {
        reject(_error2);
      }
    });
  });
}

},{"../jquery.js":9}],62:[function(require,module,exports){
"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sharedCtx = void 0;
function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor); } }
function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); Object.defineProperty(Constructor, "prototype", { writable: false }); return Constructor; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : String(i); }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
/**
 * Used to store Web worker regular expression matching results.
 * Stores a `cursor` index to allow iterating results
 */
var SharedCtx = /*#__PURE__*/_createClass(function SharedCtx() {
  _classCallCheck(this, SharedCtx);
  var data = {};
  this.getData = function (text) {
    var items = Object.values(data).filter(function (v) {
      return v && v.text === text && v.cursor !== undefined;
    });
    return items[0];
  };
  this.setMatches = function (uuid, text, matches) {
    if (!data[uuid]) {
      data[uuid] = {};
    }
    data[uuid].cursor = 0;
    data[uuid].uuid = uuid;
    data[uuid].text = text;
    data[uuid].matches = matches;
  };
  this.setCallback = function (uuid, text, fn) {
    if (!data[uuid]) {
      data[uuid] = {
        text: text,
        fns: []
      };
    }
    data[uuid].fns.push(fn);
  };
  this.callback = function (uuid, text) {
    if (data[uuid] && data[uuid].fns) {
      data[uuid].fns.forEach(function (callable) {
        callable.call();
      });
    }
  };
  this.reset = function (uuid) {
    data[uuid] = null;
  };
  this.clear = function () {
    data = {};
  };
});
var sharedCtx = exports.sharedCtx = new SharedCtx();

},{}],63:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addStyle = addStyle;
exports.bindTooltips = bindTooltips;
exports.getTableViewReference = getTableViewReference;
exports.getTriggers = getTriggers;
exports.hideTooltipHandler = hideTooltipHandler;
exports.orderSorter = orderSorter;
exports.positionHandler = void 0;
exports.repositionTooltipHandler = repositionTooltipHandler;
exports.resetTooltips = resetTooltips;
exports.showTooltipHandler = showTooltipHandler;
var _jquery = require("../jquery.js");
var _functions = require("../utils/functions.js");
var _base = require("../utils/base64.js");
var _index = require("../manager/index.js");
var _tooltip = require("./lib/tooltip.js");
var _index2 = require("../index.js");
var _index3 = require("../settings/index.js");
var _data = require("../utils/data.js");
var TOOLTIP_CLASS = ".ref2link-tooltip";
function orderSorter(left, right) {
  // common rules always go last
  if (left.common && !right.common) {
    return 1;
  }
  if (!left.common && right.common) {
    return -1;
  }
  return left.order - right.order;
}
;
var alternativesUnion = function alternativesUnion(left, right) {
  var viewKeys = {},
    alternativeWalker = function alternativeWalker(_value) {
      var viewKey = [_value.match, _value.rule.type, _value.view].join('-----');
      if (viewKeys.hasOwnProperty(viewKey)) {
        return;
      }
      viewKeys[viewKey] = _value;
    };
  left.forEach(alternativeWalker);
  right.forEach(alternativeWalker);
  return _jquery.$.map(viewKeys, function (alternative) {
    return alternative;
  }).sort(orderSorter);
};
var stopEvent = function stopEvent(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  ev.stopImmediatePropagation();
  return false;
};
function resetTooltips() {
  //reinitialize tooltips
  (0, _jquery.$)(_index2.R2L.settings["class"]).data('tooltip', null);
  (0, _jquery.$)(TOOLTIP_CLASS).remove();
}
function hideTooltipHandler(e) {
  (0, _jquery.$)(document).find(TOOLTIP_CLASS).each(function (index, el) {
    (0, _jquery.$)(el).removeAttr('data-state').hide();
  });
}
;
function repositionTooltipHandler($el, $tooltip) {
  var zIndex = 1,
    offset = $el.offset();
  $el.parents().each(function () {
    zIndex = Math.max(parseInt((0, _jquery.$)(this).css('z-index').replace(/\D+/g, ''), 10) || 1, zIndex);
  });

  // find optimal position to place the element

  var scrollTop = (0, _jquery.$)(window).scrollTop();
  var scrollLeft = (0, _jquery.$)(window).scrollLeft();
  var distanceTop = offset.top - scrollTop;
  var distanceBottom = window.innerHeight - distanceTop + $el[0].offsetHeight;
  var distanceLeft = offset.left - scrollLeft;
  var distanceRight = window.innerWidth - distanceLeft;
  setTimeout(function () {
    // by default it goes towards the right of the page, starting at the same left offset
    var left = distanceLeft;
    // if no room we show it on the left part
    if ($tooltip.outerWidth() > distanceRight && $tooltip.outerWidth() <= distanceLeft) {
      left -= $tooltip.outerWidth() - $el.outerWidth();
    }
    var top = distanceTop + $el.outerHeight();
    var spacing = _index2.R2L.viewOptions.bottomSpacing || 60;
    // by default it goes below the element, unless there is no room
    if ($tooltip.outerHeight() > distanceBottom - spacing && $tooltip.outerHeight() <= distanceTop) {
      top -= $tooltip.outerHeight() + $el.outerHeight();
    }
    $tooltip.css({
      zIndex: zIndex + 100,
      top: top,
      left: left,
      visibility: 'visible'
    });
  }, 1);
}
;
var positionHandler = exports.positionHandler = function positionHandler() {
  (0, _jquery.$)(TOOLTIP_CLASS).each(function () {
    var $tooltip = (0, _jquery.$)(this),
      $el = $tooltip.data('ref2link');
    repositionTooltipHandler($el, $tooltip);
  });
};

/**
 * Rules with multiple CELEX attributes also have multiple linked-data bindings. This function will load an id on the fly if * another target has been selected.
 * @param {String} linkedDataId 
 * @param {String} linkedDataType
 * 
 * @return {Promise<Binding>} 
 */
function loadMetadata(linkedDataId, linkedDataType) {
  return new Promise(function (resolve, reject) {
    var currentBinding = linkedDataId ? _index2.R2L.ldm.getMetadataById(linkedDataId) : null;

    // no support for other linked data types reloading other than CELEX
    if (linkedDataType !== _index.LD_TYPE_CELEX || !_index2.R2L.options.metadata || !_index2.R2L.hasLinkedDataMode(_index3.LD_MODE_METADATA)) {
      resolve(currentBinding);
      return;
    }
    if (currentBinding) {
      resolve(currentBinding);
      return;
    } else {
      var linkedDataIds = (0, _data.extractLinkedDataIds)([]);
      linkedDataIds[linkedDataType] = [linkedDataId];
      _index2.R2L.ldm.fetch([], linkedDataIds).then(function (_) {
        console.log("Done fetching data");
        resolve(_index2.R2L.ldm.getMetadataById(linkedDataId));
      })["catch"](function (err) {
        resolve(null);
        console.error(err);
      });
    }
  });
}
function showTooltipHandler(ev, $target) {
  $target = $target || (0, _jquery.$)(ev.target);
  var $tooltip;
  // min number of targets to use grouping. When disable we set the value very large
  var GROUP_TARGET_MIN = _index2.R2L.viewOptions.useTargetGrouping ? 2 : 10000000;
  if ($target.attr('title')) {
    $target.data('_title', $target.attr('title'));
  }
  if (_index2.R2L.options.tooltipTrigger === 'notooltip') {
    $target.attr('title', $target.data('_title'));
    return;
  }
  var $self = $target.closest(_index2.R2L.settings["class"] + ', ' + TOOLTIP_CLASS).parents(_index2.R2L.settings["class"] + ', ' + TOOLTIP_CLASS).last();
  if (!$self.length) {
    $self = $target.closest(_index2.R2L.settings["class"] + ', ' + TOOLTIP_CLASS);
  }
  if ($self.is(TOOLTIP_CLASS)) {
    $self = $self.data('ref2link');
    $tooltip = $self.data('tooltip');
  }
  var ref2link = $self.getRef2linkMatch();
  if (!ref2link.alternatives) {
    return;
  }
  $tooltip = $self.data('tooltip');
  var alternatives = alternativesUnion(ref2link.alternatives, []);
  if (alternatives.length < 1 && 'view' == (_index2.R2L.options.mode || _index2.R2L.viewOptions.mode)) {
    return;
  }
  alternatives.sort(orderSorter);
  hideTooltipHandler();
  if ($tooltip && $tooltip.length && $tooltip[0] && $tooltip[0].ownerDocument.body.contains($tooltip[0])) {
    $target.removeAttr('title');
    $tooltip.attr('data-state', 'active');
    $tooltip.show();
    repositionTooltipHandler($self, $tooltip);
    return;
  }
  ref2link = Object.assign({}, ref2link);
  $tooltip = (0, _jquery.$)((0, _functions.simpleParse)(_index2.R2L.options.tooltip || _index2.R2L.viewOptions.tooltip, ref2link));
  var $table = $tooltip.find('.table');
  var lastRule = null,
    lastMatch = null,
    renderedViews = [],
    hasRows = false;
  var attributesList = (0, _functions.extractOrderedAttributes)(ref2link.alternatives);
  var attributes = (0, _functions.buildAttributesData)(attributesList);
  var groups = {};

  // REFTOLINK-1974 get attributes from selected view (lazy-load)
  var currentViewAttributes = {};
  (0, _jquery.$)($self[0].attributes).each(function (index, el) {
    // skip nulls, non-data attributes        
    if (el.nodeName.slice(0, 4) !== 'data') {
      return;
    }
    if (!el.value || el.value === "null") {
      return;
    }
    currentViewAttributes[el.nodeName] = el.value;
  });
  var currentViewLinkedDataId = (0, _data.extractLinkedDataId)(currentViewAttributes);
  var currentViewLinkedDataType = (0, _data.extractLinkedDataType)(currentViewAttributes);
  loadMetadata(currentViewLinkedDataId, currentViewLinkedDataType).then(function (globalBinding) {
    alternatives.forEach(function (_alternative) {
      if (_alternative.viewName === "table") {
        return;
      }
      var viewKey = [_alternative.rule.ruleLibelle, _alternative.view].join('-----');
      if (renderedViews.indexOf(viewKey) >= 0) {
        return;
      }
      var tpl,
        groupTpl,
        $row,
        $view = (0, _jquery.$)(_alternative.view),
        $viewLink = $view.is(_index2.R2L.settings.classSimple) ? $view : $view.find(_index2.R2L.settings.classSimple);
      if (!lastMatch) {
        lastMatch = _alternative.reference;
      }
      var linkedDataId = (0, _data.extractLinkedDataId)(attributes);
      var renderedLinkedData = false;
      if (!globalBinding) {
        var binding = linkedDataId ? _index2.R2L.ldm.getMetadataById(linkedDataId) : null;
        globalBinding = binding;
      } else {
        linkedDataId = currentViewLinkedDataId;
      }
      if (_alternative.rule.ruleLibelle !== lastRule) {
        tpl = _index2.R2L.options.ruleHeading || _index2.R2L.viewOptions.ruleHeading;
        if (!renderedLinkedData && globalBinding) {
          // make sure all data is sanitized and safe to be injected into the HTML
          $row = (0, _jquery.$)((0, _functions.simpleParse)(tpl, {
            ruleLibelle: _alternative.rule.ruleLibelle,
            match: ref2link.reference,
            status: _index2.R2L.ldm.getStatus(),
            forceStatus: (0, _tooltip.buildForceStatus)(globalBinding),
            forceLabel: (0, _tooltip.buildForceLabel)(globalBinding),
            title: (0, _tooltip.buildTitleLabel)(globalBinding, ref2link.reference, linkedDataId),
            date: (0, _tooltip.buildDate)(globalBinding),
            oj: (0, _tooltip.buildOjLabel)(globalBinding),
            eli: (0, _tooltip.buildEliLabel)(globalBinding)
          }));
          $table.append($row);
          renderedLinkedData = true;
        }
        lastRule = _alternative.rule.ruleLibelle;
      }
      tpl = _index2.R2L.options.rule || _index2.R2L.viewOptions.rule;
      groupTpl = _index2.R2L.options.groupRule || _index2.R2L.viewOptions.groupRule;
      var title = $viewLink.attr('title');
      var href = $viewLink.attr('href') || $viewLink.find("a").attr('href');
      var selfHref = $self.attr('href') || $self.find("a").attr('href');
      if (!title) {
        return;
      }
      var groupTitleWithPrefix = (0, _functions.getFullTitle)(title, _alternative.groupTarget);
      hasRows = _alternative;
      var counter = alternatives.filter(function (a) {
        return a.groupTarget === _alternative.groupTarget;
      }).length;
      $row = (0, _jquery.$)((0, _functions.simpleParse)(tpl, {
        title: _alternative.groupTarget && counter < GROUP_TARGET_MIN ? groupTitleWithPrefix : title,
        href: href,
        group: _alternative.groupTarget && counter >= GROUP_TARGET_MIN ? _alternative.groupTarget : ""
      }));
      $row.data('alternative', _alternative);
      if (href === selfHref && $viewLink.html() === $self.html()) {
        if ($row.is('.active-indicator')) {
          $row.addClass('active').attr('title', 'Current link');
        }
      }
      if (_alternative.groupTarget && counter >= GROUP_TARGET_MIN) {
        if (!groups[_alternative.groupTarget]) {
          var $groupRow = (0, _jquery.$)((0, _functions.simpleParse)(groupTpl, {
            title: _alternative.groupTarget
          }));
          $groupRow.attr("data-state", 0);
          $groupRow.click(function (e) {
            e.preventDefault();
            var $items = (0, _jquery.$)("[data-group='" + _alternative.groupTarget + "']", $table);
            $items.toggle();
            $groupRow.attr("data-state", $items.css('display') === 'none' ? 0 : 1);
            return false;
          });
          $table.append($groupRow);
          // append fake row to expand/collapse grouped rows
          groups[_alternative.groupTarget] = true;
        }
        $row.css("display", "none");
      }
      $table.append($row);
      renderedViews.push(viewKey);
    });
    if ('edit' == (_index2.R2L.options.mode || _index2.R2L.viewOptions.mode)) {
      hasRows = true;
      var $row = (0, _jquery.$)((0, _functions.simpleParse)(_index2.R2L.options.rule, {
        title: 'No link',
        href: ''
      }));
      $row.attr('title', 'Remove link');
      $table.append($row.removeClass('active-indicator').attr('data-action', 'remove'));
    }
    if (!hasRows) {
      return;
    }
    $tooltip.on('click', '[data-action]', function (ev2) {
      var $this = (0, _jquery.$)(this),
        $row = $this.closest('.row'),
        alternative = $row.length ? $row.data('alternative') : {},
        $view = alternative ? (0, _jquery.$)(alternative.view) : (0, _jquery.$)(''),
        $viewLink = $view.is(_index2.R2L.settings.classSimple) ? $view : $view.find(_index2.R2L.settings.classSimple),
        action = $this.attr('data-action');
      var href = $viewLink.attr('href') || $viewLink.find("a").attr('href');
      var selfHref = $self.attr('href') || $self.find("a").attr('href');
      switch (action) {
        case 'preview':
          if ($viewLink.length) {
            window.open(href);
          }
          break;
        case 'use':
          if ($view.length) {
            $self.setAlternative(alternative);
            $tooltip.remove();
            var id = $view.attr('id');
            setTimeout(function () {
              showTooltipHandler(null, (0, _jquery.$)('#' + id));
            }, 1);
          }
          break;
        case 'default-preview':
          window.open(selfHref);
          break;
        case 'remove':
          $self.removeReference();
          break;
        case 'close':
          $tooltip.hide();
          break;
      }
      hideTooltipHandler();
      return stopEvent(ev2);
    });
    var uuid = 'r2l-tooltip-' + (0, _functions.getUuid)();
    $target.attr('title', '').attr('aria-describedby', uuid);
    $tooltip.attr('id', uuid);
    repositionTooltipHandler($self, $tooltip);
    $tooltip.css('visibility', 'hidden');

    // make sure that only one element with this selector exist
    if ((0, _jquery.$)(_index2.R2L.settings.tooltipContainerSelector).length === 1) {
      (0, _jquery.$)(_index2.R2L.settings.tooltipContainerSelector).append($tooltip);
    } else {
      // Otherwhise insert in body
      (0, _jquery.$)('body').append($tooltip);
    }
    $self.data('tooltip', $tooltip);
    $tooltip.data('tooltip', $tooltip);
    $tooltip.data('ref2link', $self);
    $tooltip.attr('data-state', 'active');

    // cleanup attributes
    var nodeAttributes = (0, _functions.cleanAttributes)(currentViewAttributes);
    nodeAttributes.tooltipUuid = uuid;

    // we need to pass the R2LOrderedNode in the event
    var nodes = _index2.R2L.getNodes({
      0: ref2link
    });
    nodes = nodes.filter(function (node) {
      var filteredMatches = node.matches.filter(function (match) {
        return match.context === ref2link.context && match.match === ref2link.match;
      });
      return filteredMatches.length > 0;
    });
    var orderedNodes = _index2.R2L.getOrderedNodes(nodes);
    if (orderedNodes.length > 0) {
      nodeAttributes.node = orderedNodes[0];
    }

    // overwrite linked data in case target has changed
    if (globalBinding && globalBinding.data && nodeAttributes.node && nodeAttributes.node.data) {
      if (nodeAttributes.node.data[0]) {
        nodeAttributes.node.data[0].metadata = globalBinding.data;
      }
      if (!nodeAttributes.node.data[0].celex && globalBinding.data.celexId) {
        nodeAttributes.node.data[0].celex = String(globalBinding.data.celexId.value).replace("celex:", "");
      }
      if (globalBinding.data.id && globalBinding.data.id.value.indexOf("celex:") === 0) {
        nodeAttributes.node.data[0].celex = globalBinding.data.id.value.replace("celex:", "");
      }
    }
    (0, _jquery.$)(document).trigger('r2l.tooltip.create', nodeAttributes);
  });
}
;

/**
 * Get the table view (or the match text if no table view present)
 * @param {Object} ref2link
 * 
 * @return {String} 
 */
function getTableViewReference(ref2link) {
  var label = ref2link.reference;
  Object.keys(ref2link.views).forEach(function (_view) {
    var view = ref2link.views[_view];
    if (!view) {
      return;
    }
    if (String(_view) === "table") {
      label = view;
    }
  });
  return label;
}
function addStyle(styleText, styleName, $) {
  var styleFileName = styleName.split('/').pop() /** filename */.split('?').shift() /** strip query string */.replace('ref2link-', ''),
    /** ref2link version of some common packages */
    unMinifiedStyleFileName = styleFileName.replace('.min', '');
  /** attempt to see if the style is already loaded and if not so add the style to the page */
  if (!$('link[href*="' + styleFileName + '"]').length && !$('link[href*="' + unMinifiedStyleFileName + '"]').length && styleText) {
    $('head').append($('<style type="text/css"></style>').html(styleText));
  }
}
;
function getTriggers(R2L) {
  return {
    'mouseenter': {
      show: ['mouseenter', R2L.settings["class"] + ', ' + TOOLTIP_CLASS, showTooltipHandler],
      hide: ['mouseleave', R2L.settings["class"] + ', ' + TOOLTIP_CLASS, hideTooltipHandler]
    },
    'focus': {
      show: ['focus', R2L.settings["class"] + ', ' + TOOLTIP_CLASS, showTooltipHandler],
      hide: ['focusout', R2L.settings["class"] + ', ' + TOOLTIP_CLASS, hideTooltipHandler]
    },
    'notooltip': {
      show: null,
      hide: null
    }
  };
}
;

/**
 * Bind the tooltip events and API methods. Only to be used for browser integration.
 *  
 * @param {Object} R2L 
 */
function bindTooltips(R2L) {
  R2L.bindTooltips = function () {
    if (this.options.tooltipTrigger === 'notooltip' || this.tooltipInitialized) {
      return this;
    }
    this.tooltipInitialized = true;
    this.resetFilters();
    var cssMap = {};
    try {
      cssMap = JSON.parse(R2L.getConstant("R2L_CSS_MAP"));
    } catch (e) {
      console.error(e);
    }
    for (var cssIndex in cssMap) {
      addStyle(_base.Base64.decode(cssMap[cssIndex]), cssIndex, _jquery.$); // css injection
    }
    var trigger = this.triggers[this.options.tooltipTrigger || this.viewOptions.tooltipTrigger];
    var $selector = (0, _jquery.$)(trigger.show[4] || trigger.selector || document);
    $selector.on.apply($selector, trigger.show);
    $selector.on.apply($selector, trigger.hide);

    // also bind accessibility triggers (focus)
    trigger = this.triggers['focus'];
    if (trigger) {
      $selector = (0, _jquery.$)(trigger.show[4] || trigger.selector || document);
      $selector.on.apply($selector, trigger.show);
      $selector.on.apply($selector, trigger.hide);
    }
    (0, _jquery.$)(window).off('resize', positionHandler).on('resize', positionHandler);
  };
  R2L.unbindTooltips = function () {
    var trigger = this.triggers[this.options.tooltipTrigger || this.viewOptions.tooltipTrigger];
    var $selector = (0, _jquery.$)(trigger.show[4] || trigger.selector || document);
    $selector.off.apply($selector, trigger.show);
    $selector.off.apply($selector, trigger.hide);
    (0, _jquery.$)(window).off('resize', positionHandler);
    this.tooltipInitialized = false;
  };
  R2L.bindTooltips();
}
;

},{"../index.js":8,"../jquery.js":9,"../manager/index.js":18,"../settings/index.js":32,"../utils/base64.js":52,"../utils/data.js":54,"../utils/functions.js":56,"./lib/tooltip.js":64}],64:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildConsolidationLabel = buildConsolidationLabel;
exports.buildDate = buildDate;
exports.buildEliLabel = buildEliLabel;
exports.buildForceLabel = buildForceLabel;
exports.buildForceStatus = buildForceStatus;
exports.buildOjLabel = buildOjLabel;
exports.buildTitleLabel = buildTitleLabel;
var _index = require("../../index.js");
var _index2 = require("../../manager/index.js");
var _index3 = require("../../translations/index.js");
var STATUS_IN_FORCE = "inforce";
var STATUS_NOT_IN_FORCE = "notinforce";
var STATUS_NO_LONGER_IN_FORCE = "nolongerinforce";
var STATUS_PENDING_IN_FORCE = "pendinginforce";
function buildConsolidationLabel(binding) {
  var metadata = binding ? binding.data : null;
  var result = '';
  if (!metadata) {
    return result;
  }
  if (!metadata.consolidatedEli || !metadata.consolidatedDate) {
    return result;
  }
  result += (0, _index3.getTranslation)('eurlex.act.changed', (0, _index2.getLinkedDataLanguage)()) + " <a href=\"".concat(metadata.consolidatedEli.value, "\" target=\"_blank\">").concat(toPrettyDate(metadata.consolidatedDate.value), "</a>");
  return result;
}
function buildOjLabel(binding) {
  var metadata = binding ? binding.data : null;
  return metadata && metadata.oj && metadata.oj.value ? "<br>" + (String(metadata.oj.value) + "<br>") : "";
}
function buildForceLabel(binding) {
  var status = buildForceStatus(binding);
  var consolidationLabel = buildConsolidationLabel(binding);
  var content = "";
  if (!binding || !binding.data) {
    return content;
  }
  if (status === STATUS_IN_FORCE) {
    content += (0, _index3.getTranslation)('eurlex.act.in.force', (0, _index2.getLinkedDataLanguage)());
    if (binding.data.initialEli && binding.data.initialEli.value) {
      var suffixLabel = "(<a target=\"_blank\" href=\"".concat(binding.data.initialEli.value, "\">") + (0, _index3.getTranslation)('eurlex.act.initial', (0, _index2.getLinkedDataLanguage)()) + "</a>)";
      content = content + ' ' + suffixLabel;
    }
  }
  if (status === STATUS_NOT_IN_FORCE) {
    content += (0, _index3.getTranslation)('eurlex.act.not.in.force', (0, _index2.getLinkedDataLanguage)());
    if (binding.data.initialEli && binding.data.initialEli.value) {
      var _suffixLabel = "(<a target=\"_blank\" href=\"".concat(binding.data.initialEli.value, "\">") + (0, _index3.getTranslation)('eurlex.act.initial', (0, _index2.getLinkedDataLanguage)()) + "</a>)";
      content = content + ' ' + _suffixLabel;
    }
  }
  if (status === STATUS_NO_LONGER_IN_FORCE && binding) {
    content += (0, _index3.getTranslation)('eurlex.act.no.longer.in.force', (0, _index2.getLinkedDataLanguage)());
    if (binding.data.dateValidity) {
      content += ", " + (0, _index3.getTranslation)('eurlex.act.validity.date.end', (0, _index2.getLinkedDataLanguage)());
      content += " " + toPrettyDate(binding.data.dateValidity.value);
    }

    // used by ELI queries
    if (binding.data.initialEli && binding.data.initialEli.value) {
      var _suffixLabel2 = "(<a target=\"_blank\" href=\"".concat(binding.data.initialEli.value, "\">") + (0, _index3.getTranslation)('eurlex.act.initial', (0, _index2.getLinkedDataLanguage)()) + "</a>)";
      content = content + ' ' + _suffixLabel2;
    }
  }
  if ((status === STATUS_NOT_IN_FORCE || status === STATUS_NO_LONGER_IN_FORCE) && binding && binding.data.repealCelexId && binding.data.repealEli) {
    content += "; " + (0, _index3.getTranslation)('eurlex.act.repealed.by', (0, _index2.getLinkedDataLanguage)()) + " <a href=\"".concat(binding.data.repealEli.value, "\" target=\"_blank\">").concat(binding.data.repealCelexId.value, "</a>");
  }
  if (status === STATUS_PENDING_IN_FORCE) {
    content += (0, _index3.getTranslation)('eurlex.act.notification.pending', (0, _index2.getLinkedDataLanguage)()) + binding.data.dateForce.value;
  }
  if (consolidationLabel) {
    content += "\r\n" + consolidationLabel;
  }

  // used by CELEX queries (Point in time)
  if (binding.data.originalEli) {
    content += "\r\n<a target=\"_blank\" href=\"".concat(binding.data.originalEli.value, "\">") + (0, _index3.getTranslation)('eurlex.act.original', (0, _index2.getLinkedDataLanguage)()) + "</a>";
  } else if (binding.data.originalId) {
    var url = "https://eur-lex.europa.eu/legal-content/".concat((0, _index2.getLinkedDataLanguage)() || 'EN', "/AUTO/?uri=").concat(binding.data.originalId.value);
    content += "\r\n<a target=\"_blank\" href=\"".concat(url, "\">") + (0, _index3.getTranslation)('eurlex.act.original', (0, _index2.getLinkedDataLanguage)()) + "</a>";
  }

  /**
   * if this is a consolidation but there's a newer one available show a link to the latest version
   * eg. http://data.europa.eu/eli/dec/2006/415/2015-12-02
   */
  if (binding && binding.data && binding.data.initialEli && binding.data.initialEli.value) {
    // check if the final consolidation is older than current act
    if (binding.data.finalConsolidatedEli && binding.data.finalConsolidatedDate && binding.data.date && binding.data.finalConsolidatedDate.value > binding.data.date.value) {
      var finalLabel = (0, _index3.getTranslation)('eurlex.act.access.current.version', (0, _index2.getLinkedDataLanguage)()) + " (".concat(toPrettyDate(binding.data.finalConsolidatedDate.value), ")");
      content = content + '\r\n' + "<a href=\"".concat(binding.data.finalConsolidatedEli.value, "\" target=\"_blank\">").concat(finalLabel, "</a>");
    }
  }
  return content;
}
function buildDate(binding) {
  var metadata = binding ? binding.data : null;
  if (!metadata) {
    return "";
  }
  try {
    return new Date(metadata.date.value.slice(0, 10)).toISOString().slice(0, 10);
  } catch (e) {
    return "";
  }
}
function buildForceStatus(binding) {
  var metadata = binding ? binding.data : null;
  var today = new Date().toISOString().slice(0, 10);
  if (!metadata || !metadata.force || metadata.force.value === "") {
    if (metadata && metadata.initialForce && metadata.initialForce.value) {
      // "0" or "1"
      if (parseInt(metadata.initialForce.value)) {
        return STATUS_IN_FORCE;
      } else {
        //  check the initial act
        if (metadata.initialDateValidity && metadata.initialDateValidity.value < today) {
          return STATUS_NO_LONGER_IN_FORCE;
        }
        return STATUS_NOT_IN_FORCE;
      }
    }
    return "";
  } else {
    if (metadata.force && parseInt(metadata.force.value)) {
      return STATUS_IN_FORCE;
    } else {
      // check current act
      if (metadata.dateForce && metadata.dateForce.value && String(metadata.dateForce.value).slice(0, 10) > today) {
        return STATUS_PENDING_IN_FORCE;
      } else {
        if (metadata.dateValidity && metadata.dateValidity.value < today) {
          return STATUS_NO_LONGER_IN_FORCE;
        } else {
          return STATUS_NOT_IN_FORCE;
        }
      }
    }
  }
}
function buildEliLabel(binding) {
  if (!binding || !binding.data || !binding.data.eli) {
    return "";
  }
  return "ELI: <a href=\"".concat(binding.data.eli.value, "\" target=\"_blank\">").concat(binding.data.eli.value, "</a>");
}
function buildTitleLabel(binding, defaultTitle, linkedDataId) {
  var title = binding && binding.data && binding.data.title ? String(binding.data.title.value).replace(/#/g, "<br>") : defaultTitle;
  if (_index.R2L.options.metadata) {
    // if there's a Linked Data id we can add state info
    if (linkedDataId && (!binding || !binding.data) && _index.R2L.ldm.getStatus() === _index2.SPARQL_STATUS_PENDING) {
      title += "<br><div data-status=\"".concat(_index.R2L.ldm.getStatus(), "\" class=\"r2l-title-status\">\n            <div class=\"r2l-loading-bar-spinner spinner\">\n                    <div class=\"spinner-icon\"></div>\n                </div>\n            </div>");
    }
    if (linkedDataId && (!binding || binding.status === _index2.SPARQL_STATUS_ERROR)) {
      if (!binding && _index.R2L.ldm.getStatus() !== _index2.SPARQL_STATUS_PENDING) {
        title += "<br><div data-status=\"info\" class=\"r2l-title-status\">" + (0, _index3.getTranslation)('ld.not.found', (0, _index2.getLinkedDataLanguage)()) + "</div>";
      }
      if (binding) {
        title += "<br><div data-status=\"error\" class=\"r2l-title-status\">" + (0, _index3.getTranslation)('ld.connection.failure', (0, _index2.getLinkedDataLanguage)()) + "</div>";
      }
    }
  }
  return title;
}

/**
 * Turns 2020-05-21 into 21/05/2020
 * @param {string} str 
 */
function toPrettyDate(str) {
  return (str || "").split("-").reverse().join("/");
}

},{"../../index.js":8,"../../manager/index.js":18,"../../translations/index.js":51}]},{},[4]);
