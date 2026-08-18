const userAgentKey = {
  Opera: 'Opera',
  Chrome: 'Chrome',
  Firefox: 'Firefox',
  Edge: 'Edge',
  Edg: 'Edg',
  IE: 'IE',
  Safari: 'Safari',
}

//Get platform type
function getPlatformType() {
  const { platform } = navigator
  return platform
}

function getBrowserType() {
  const { userAgent } = navigator
  // Determine if it is an Edge browser
  if (userAgent.includes('Edge')) {
    return userAgentKey.Edge
  }
  // Determine if it is an Edge browser
  if (userAgent.includes('Edg')) {
    return userAgentKey.Edg
  }
  // Determine if it is a Firefox browser
  if (userAgent.includes('Firefox')) {
    return userAgentKey.Firefox
  }
  // Determine if it is a Chrome browser
  if (userAgent.includes('Chrome')) {
    return userAgentKey.Chrome
  }
  // Determine if it is a Safari browser
  if (userAgent.includes('Safari')) {
    return userAgentKey.Safari
  }
  // Determine if it is a ie browser
  if (
    userAgent.includes('compatible') &&
    userAgent.includes('MSIE') &&
    userAgent.includes('Opera')
  ) {
    return userAgentKey.IE
  }
  // Determine if it is a Opera browser
  if (userAgent.includes('Opera')) {
    return userAgentKey.Opera
  }
  return ''
}

function getBrowserVersion(browserType) {
  const { userAgent } = navigator
  return userAgent.split(browserType)[1].split('.')[0].slice(1)
}

function checkBrowser() {
  const browserType = getBrowserType()
  const browserVersion = getBrowserVersion(browserType)
  let bSupportMultiThread = false
  let errorCode = 0
  if (typeof SharedArrayBuffer == 'undefined') {
    bSupportMultiThread = false
  } else {
    switch (browserType) {
      case userAgentKey.Chrome:
        bSupportMultiThread = browserVersion >= 91
        errorCode = 701
        break
      case userAgentKey.Firefox:
        bSupportMultiThread = browserVersion >= 97
        errorCode = 702
        break
      case userAgentKey.Edge:
        bSupportMultiThread = browserVersion >= 91
        errorCode = 703
        break
      case userAgentKey.Edg:
        bSupportMultiThread = browserVersion >= 91
        errorCode = 703
        break
      default:
        bSupportMultiThread = false
    }
  }
  return { bSupportMultiThread, browserType, errorCode }
}

function checkSupportH265MSE() {
  const browserType = getBrowserType()
  const browserVersion = getBrowserVersion(browserType)
  var bSupportH265MSE = false
  switch (browserType) {
    case userAgentKey.Chrome:
      bSupportH265MSE = browserVersion >= 104
      break
    default:
      bSupportH265MSE = 0
  }
  return bSupportH265MSE
}

function Uint8ArrayToString(dataArray) {
  var dataString = ''
  for (var i = 0; i < dataArray.length; i++) {
    var szCode = String.fromCharCode(dataArray[i])
    dataString += szCode

    if (szCode == '\0') {
      break
    }
  }

  return dataString
}

var isDebug = false
var debug = (function (flag) {
  if (flag) {
    return {
      log: function (message) {
        console.log(message)
      },
      error: function (message) {
        console.error(message)
      },
      count: function (message) {
        console.count(message)
      },
      info: function (message) {
        console.info(message)
      },
      trace: function (message) {
        console.trace(message)
      },
    }
  } else {
    return {
      log: function () {},
      error: function () {},
      count: function () {},
      info: function () {},
    }
  }
})(isDebug)

function BrowserDetect() {
  var agent = navigator.userAgent.toLowerCase(),
    name = navigator.appName,
    browser = null
  if (
    name === 'Microsoft Internet Explorer' ||
    agent.indexOf('trident') > -1 ||
    agent.indexOf('edge/') > -1
  ) {
    browser = 'ie'
    if (name === 'Microsoft Internet Explorer') {
      agent = /msie ([0-9]{1,}[\.0-9]{0,})/.exec(agent)
      browser += parseInt(agent[1])
    } else {
      if (agent.indexOf('trident') > -1) {
        browser += 11
      } else if (agent.indexOf('edge/') > -1) {
        browser = 'edge'
      }
    }
  } else if (agent.indexOf('safari') > -1) {
    if (agent.indexOf('chrome') > -1) {
      browser = 'chrome'
    } else {
      browser = 'safari'
    }
  } else if (agent.indexOf('firefox') > -1) {
    browser = 'firefox'
  }
  return browser
}

var Script = (function script() {
  function Constructor() {}

  Constructor.createFromElementId = function (id) {
    var script = document.getElementById(id)
    //assert(script, "Could not find shader with ID: " + id);
    var source = ''
    var currentChild = script.firstChild
    while (currentChild) {
      if (currentChild.nodeType === 3) {
        source += currentChild.textContent
      }
      currentChild = currentChild.nextSibling
    }
    var res = new Constructor()
    res.type = script.type
    res.source = source
    return res
  }
  Constructor.createFromSource = function (type, source) {
    var res = new Constructor()
    res.type = type
    res.source = source
    return res
  }
  return Constructor
})()
var Shader = (function shader() {
  function Constructor(gl, script) {
    if (script.type === 'x-shader/x-fragment') {
      this.shader = gl.createShader(gl.FRAGMENT_SHADER)
    } else if (script.type === 'x-shader/x-vertex') {
      this.shader = gl.createShader(gl.VERTEX_SHADER)
    } else {
      error('Unknown shader type: ' + script.type)
      return
    }
    gl.shaderSource(this.shader, script.source)
    gl.compileShader(this.shader)
    if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
      error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(this.shader))
      return
    }
  }

  return Constructor
})()
var Program = (function () {
  function Constructor(gl) {
    this.gl = gl
    this.program = this.gl.createProgram()
  }

  Constructor.prototype = {
    attach: function (shader) {
      this.gl.attachShader(this.program, shader.shader)
    },
    link: function () {
      this.gl.linkProgram(this.program)
      //assert(this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS), "Unable to initialize the shader program.")
    },
    use: function () {
      this.gl.useProgram(this.program)
    },
    getAttributeLocation: function (name) {
      return this.gl.getAttribLocation(this.program, name)
    },
    setMatrixUniform: function (name, array) {
      var uniform = this.gl.getUniformLocation(this.program, name)
      this.gl.uniformMatrix4fv(uniform, false, array)
    },
  }
  return Constructor
})()
var Texture = (function texture() {
  var textureIDs = null

  function Constructor(gl, size, format) {
    this.gl = gl
    this.size = size
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    this.format = format ? format : gl.LUMINANCE
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.format,
      size.w,
      size.h,
      0,
      this.format,
      gl.UNSIGNED_BYTE,
      null,
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  Constructor.prototype = {
    fill: function (textureData, useTexSubImage2D) {
      var gl = this.gl
      //assert(textureData.length >= this.size.w * this.size.h, "Texture size mismatch, data:" + textureData.length + ", texture: " + this.size.w * this.size.h);
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      if (useTexSubImage2D) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          this.size.w,
          this.size.h,
          this.format,
          gl.UNSIGNED_BYTE,
          textureData,
        )
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          this.format,
          this.size.w,
          this.size.h,
          0,
          this.format,
          gl.UNSIGNED_BYTE,
          textureData,
        )
      }
    },
    bind: function (num, program, name) {
      var gl = this.gl
      if (!textureIDs) {
        textureIDs = [gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2]
      }
      gl.activeTexture(textureIDs[num])
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.uniform1i(gl.getUniformLocation(program.program, name), num)
    },
  }
  return Constructor
})()
/**
 * Created by 33596 on 2018/5/8.
 */

var base64ArrayBuffer = function (arrayBuffer) {
  var base64 = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes = new Uint8Array(arrayBuffer)
  var byteLength = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength = byteLength - byteRemainder

  var a = 0,
    b = 0,
    c = 0,
    d = 0
  var chunk = 0

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63 // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}

function CommonAudioUtil() {
  var power2 = [
    1, 2, 4, 8, 0x10, 0x20, 0x40, 0x80, 0x100, 0x200, 0x400, 0x800, 0x1000, 0x2000, 0x4000,
  ]

  /*
   * quan()
   *
   * quantizes the input val against the table of size short integers.
   * It returns i if table[i - 1] <= val < table[i].
   *
   * Using linear search for simple coding.
   */
  var quan = function (val, table, size) {
    //int, *int, int
    var i = 0 //int
    var j = 0
    for (i = 0; i < size; i++) {
      if (val < table[j]) {
        break
      } else {
        j++
      }
    }
    return i
  }

  /*
   * fmult()
   *
   * returns the integer product of the 14-bit integer "an" and
   * "floating point" representation (4-bit exponent, 6-bit mantessa) "srn".
   */

  var fmult = function (an, srn) {
    // int, int
    var anmag = 0 //int
    var anexp = 0 //int
    var anmant = 0 //int
    var wanexp = 0 //int
    var wanmant = 0 //int
    var retval = 0 //int

    anmag = an > 0 ? an : -an & 0x1fff
    anexp = quan(anmag, power2, 15) - 6
    if (anmag === 0) {
      anmant = 32
    } else {
      anmant = anexp >= 0 ? anmag >> anexp : anmag << -anexp
    }
    wanexp = anexp + ((srn >> 6) & 0xf) - 13
    wanmant = (anmant * (srn & parseInt('077', 8)) + 0x30) >> 4
    retval = wanexp >= 0 ? (wanmant << wanexp) & 0x7fff : wanmant >> -wanexp

    return (an ^ srn) < 0 ? -retval : retval
  }

  /*
   * g72x_init_state()
   *
   * This routine initializes and/or resets the g72x_state structure
   * pointed to by 'statePtr'.
   * All the initial state values are specified in the CCITT G.721 document.
   */
  this.g726InitState = function () {
    // var a[2];//int  /* Coefficients of pole portion of prediction filter. */
    // var b[6];//int  /* Coefficients of zero portion of prediction filter. */
    // var pk[2];//int /* Signs of previous two samples of a partially reconstructed signal. */
    // var dq[6];//short /* int here fails in newupdate on encode!
    //         // Previous 6 samples of the quantized difference
    //         // signal represented in an internal floating point
    //         // format.
    // var sr[2];//int /* Previous 2 samples of the quantized difference
    var statePtr = {}
    var cnta = 0 //int
    statePtr.pp = new Array(2)
    statePtr.zp = new Array(6)
    statePtr.pk = new Array(2)
    statePtr.dq = new Array(6)
    statePtr.sr = new Array(2)

    statePtr.yl = 34816
    statePtr.yu = 544
    statePtr.dms = 0
    statePtr.dml = 0
    statePtr.ppp = 0
    for (cnta = 0; cnta < 2; cnta++) {
      statePtr.pp[cnta] = 0
      statePtr.pk[cnta] = 0
      statePtr.sr[cnta] = 32
    }
    for (cnta = 0; cnta < 6; cnta++) {
      statePtr.zp[cnta] = 0
      statePtr.dq[cnta] = 32
    }
    statePtr.td = 0

    // g726_state = statePtr;
    return statePtr
  }

  /*
   * predictorZero()
   *
   * computes the estimated signal from 6-zero predictor.
   *
   */
  this.predictorZero = function (statePtr) {
    var i = 0 //int
    var sezi = 0 //int
    sezi = fmult(statePtr.zp[0] >> 2, statePtr.dq[0])
    for (i = 1; i < 6; i++) {
      /* ACCUM */
      sezi += fmult(statePtr.zp[i] >> 2, statePtr.dq[i])
    }
    return sezi
  }

  /*
   * predictorPole()
   *
   * computes the estimated signal from 2-pole predictor.
   *
   */
  this.predictorPole = function (statePtr) {
    return fmult(statePtr.pp[1] >> 2, statePtr.sr[1]) + fmult(statePtr.pp[0] >> 2, statePtr.sr[0])
  }

  /*
   * stepSize()
   *
   * computes the quantization step size of the adaptive quantizer.
   *
   */
  this.stepSize = function (statePtr) {
    var y = 0 //int
    var dif = 0 //int
    var al = 0 //int
    if (statePtr.ppp >= 256) {
      return statePtr.yu
    } else {
      y = statePtr.yl >> 6
      dif = statePtr.yu - y
      al = statePtr.ppp >> 2
      if (dif > 0) {
        y += (dif * al) >> 6
      } else if (dif < 0) {
        y += (dif * al + 0x3f) >> 6
      }
      return y
    }
  }

  /*
   * quantize()
   *
   * Given a raw sample, 'd', of the difference signal and a
   * quantization step size scale factor, 'y', this routine returns the
   * ADPCM codeword to which that sample gets quantized.  The step
   * size scale factor division operation is done in the log base 2 domain
   * as a subtraction.
   */
  this.quantize = function (
    rd /* Raw difference signal sample */,
    y /* Step size multiplier */,
    table /* quantization table */, //wjuncho
    size,
  ) /* table size of integers */ {
    var dqm = 0 //int /* Magnitude of 'd' */
    var exp = 0 //int /* Integer part of base 2 log of 'd' */
    var mant = 0 //int  /* Fractional part of base 2 log */
    var dl = 0 //int  /* Log of magnitude of 'd' */
    var dln = 0 //int /* Step size scale factor normalized log */
    var i = 0 //int

    /*
     * LOG
     *
     * Compute base 2 log of 'd', and store in 'dl'.
     */
    dqm = Math.abs(rd)
    exp = quan(dqm >> 1, power2, 15)
    mant = ((dqm << 7) >> exp) & 0x7f
    /* Fractional portion. */
    dl = (exp << 7) + mant

    /*
     * SUBTB
     *
     * "Divide" by step size multiplier.
     */
    dln = dl - (y >> 2)

    /*
     * QUAN
     *
     * Obtain codword i for 'd'.
     */
    i = quan(dln, table, size)
    if (rd < 0) {
      /* take 1's complement of i */
      return (size << 1) + 1 - i
    } else if (i === 0) {
      /* take 1's complement of 0 */
      return (size << 1) + 1
      /* new in 1988 */
    } else {
      return i
    }
  }
  /*
   * reconstruct()
   *
   * Returns reconstructed difference signal 'dq' obtained from
   * codeword 'i' and quantization step size scale factor 'y'.
   * Multiplication is performed in log base 2 domain as addition.
   */
  this.reconstruct = function (
    sign /* 0 for non-negative value */,
    dqln /* G.72x codeword */,
    y,
  ) /* Step size multiplier */ {
    var dql = 0 //int /* Log of 'dq' magnitude */
    var dex = 0 //int /* Integer part of log */
    var dqt = 0 //int
    var dq = 0 //int    /* Reconstructed difference signal sample */

    dql = dqln + (y >> 2)
    /* ADDA */

    if (dql < 0) {
      return sign ? -0x8000 : 0
    } else {
      /* ANTILOG */
      dex = (dql >> 7) & 15
      dqt = 128 + (dql & 127)
      dq = (dqt << 7) >> (14 - dex) //wjuncho convert it to (short) :: dq = (short)((dqt << 7) >> (14 - dex));
      return sign ? dq - 0x8000 : dq
    }
  }

  /*
   * update()
   *
   * updates the state variables for each output code
   */
  this.update = function (
    codeSize, //int /* distinguish 723_40 with others */
    y, //int   /* quantizer step size */
    wi, //int    /* scale factor multiplier */
    fi, //int    /* for long/short term energies */
    dq, //int    /* quantized prediction difference */
    sr, //int    /* reconstructed signal */
    dqsez, //int   /* difference from 2-pole predictor */
    statePtr,
  ) /* coder state pointer */ {
    var cnt = 0 //int
    var mag = 0,
      exp = 0 //int  /* Adaptive predictor, FLOAT A */
    var a2p = 0 //int   /* LIMC */
    var a1ul = 0 //int    /* UPA1 */
    var pks1 = 0 //int    /* UPA2 */
    var fa1 = 0 //int
    var tr = 0 //int      /* tone/transition detector */
    var ylint = 0,
      thr2 = 0,
      dqthr = 0 //int
    var ylfrac = 0,
      thr1 = 0 //int
    var pk0 = 0 //int

    pk0 = dqsez < 0 ? 1 : 0
    /* needed in updating predictor poles */

    mag = dq & 0x7fff
    /* prediction difference magnitude */
    /* TRANS */
    ylint = statePtr.yl >> 15
    /* exponent part of yl */
    ylfrac = (statePtr.yl >> 10) & 0x1f
    /* fractional part of yl */
    thr1 = (32 + ylfrac) << ylint
    /* threshold */
    thr2 = ylint > 9 ? 31 << 10 : thr1
    /* limit thr2 to 31 << 10 */
    dqthr = (thr2 + (thr2 >> 1)) >> 1
    /* dqthr = 0.75 * thr2 */
    if (statePtr.td === 0) {
      /* signal supposed voice */
      tr = 0
    } else if (mag <= dqthr) {
      /* supposed data, but small mag */
      tr = 0
      /* treated as voice */
    } else {
      /* signal is data (modem) */
      tr = 1
    }

    /*
     * Quantizer scale factor adaptation.
     */

    /* FUNCTW & FILTD & DELAY */
    /* update non-steady state step size multiplier */
    statePtr.yu = y + ((wi - y) >> 5)

    /* LIMB */
    if (statePtr.yu < 544) {
      /* 544 <= yu <= 5120 */
      statePtr.yu = 544
    } else if (statePtr.yu > 5120) {
      statePtr.yu = 5120
    }

    /* FILTE & DELAY */
    /* update steady state step size multiplier */
    statePtr.yl += statePtr.yu + (-statePtr.yl >> 6)

    /*
     * Adaptive predictor coefficients.
     */
    if (tr === 1) {
      /* reset a's and b's for modem signal */
      statePtr.pp[0] = 0
      statePtr.pp[1] = 0
      statePtr.zp[0] = 0
      statePtr.zp[1] = 0
      statePtr.zp[2] = 0
      statePtr.zp[3] = 0
      statePtr.zp[4] = 0
      statePtr.zp[5] = 0
      a2p = 0
    } else {
      /* update a's and b's */
      pks1 = pk0 ^ statePtr.pk[0]
      /* UPA2 */

      /* update predictor pole a[1] */
      a2p = statePtr.pp[1] - (statePtr.pp[1] >> 7)
      if (dqsez !== 0) {
        fa1 = pks1 ? statePtr.pp[0] : -statePtr.pp[0]
        if (fa1 < -8191) {
          /* a2p = function of fa1 */
          a2p -= 0x100
        } else if (fa1 > 8191) {
          a2p += 0xff
        } else {
          a2p += fa1 >> 5
        }

        if (pk0 ^ statePtr.pk[1]) {
          /* LIMC */
          if (a2p <= -12160) {
            a2p = -12288
          } else if (a2p >= 12416) {
            a2p = 12288
          } else {
            a2p -= 0x80
          }
        } else if (a2p <= -12416) {
          a2p = -12288
        } else if (a2p >= 12160) {
          a2p = 12288
        } else {
          a2p += 0x80
        }
      }

      /* TRIGB & DELAY */
      statePtr.pp[1] = a2p

      /* UPA1 */
      /* update predictor pole a[0] */
      statePtr.pp[0] -= statePtr.pp[0] >> 8
      if (dqsez !== 0) {
        if (pks1 === 0) {
          statePtr.pp[0] += 192
        } else {
          statePtr.pp[0] -= 192
        }
      }

      /* LIMD */
      a1ul = 15360 - a2p
      if (statePtr.pp[0] < -a1ul) {
        statePtr.pp[0] = -a1ul
      } else if (statePtr.pp[0] > a1ul) {
        statePtr.pp[0] = a1ul
      }

      /* UPB : update predictor zeros b[6] */
      for (cnt = 0; cnt < 6; cnt++) {
        if (codeSize === 5) {
          /* for 40Kbps G.723 */
          statePtr.zp[cnt] -= statePtr.zp[cnt] >> 9
        } else {
          /* for G.721 and 24Kbps G.723 */
          statePtr.zp[cnt] -= statePtr.zp[cnt] >> 8
        }
        if (dq & 0x7fff) {
          /* XOR */
          if ((dq ^ statePtr.dq[cnt]) >= 0) {
            statePtr.zp[cnt] += 128
          } else {
            statePtr.zp[cnt] -= 128
          }
        }
      }
    }

    for (cnt = 5; cnt > 0; cnt--) {
      statePtr.dq[cnt] = statePtr.dq[cnt - 1]
    }
    /* FLOAT A : convert dq[0] to 4-bit exp, 6-bit mantissa f.p. */
    if (mag === 0) {
      statePtr.dq[0] = dq >= 0 ? 0x20 : 0xfc20
    } else {
      exp = quan(mag, power2, 15)
      statePtr.dq[0] =
        dq >= 0 //wjuncho  statePtr.dq[0] = (short)((dq >= 0) ?
          ? (exp << 6) + ((mag << 6) >> exp)
          : (exp << 6) + ((mag << 6) >> exp) - 0x400
    }

    statePtr.sr[1] = statePtr.sr[0]
    /* FLOAT B : convert sr to 4-bit exp., 6-bit mantissa f.p. */
    if (sr === 0) {
      statePtr.sr[0] = 0x20
    } else if (sr > 0) {
      exp = quan(sr, power2, 15)
      statePtr.sr[0] = (exp << 6) + ((sr << 6) >> exp)
    } else if (sr > -32768) {
      mag = -sr
      exp = quan(mag, power2, 15)
      statePtr.sr[0] = (exp << 6) + ((mag << 6) >> exp) - 0x400
    } else {
      statePtr.sr[0] = 0xfc20
    }
    /* DELAY A */
    statePtr.pk[1] = statePtr.pk[0]
    statePtr.pk[0] = pk0

    /* TONE */
    if (tr === 1) {
      /* this sample has been treated as data */
      statePtr.td = 0
      /* next one will be treated as voice */
    } else if (a2p < -11776) {
      /* small sample-to-sample correlation */
      statePtr.td = 1
      /* signal may be data */
    } else {
      /* signal is voice */
      statePtr.td = 0
    }

    /*
     * Adaptation speed control.
     */
    statePtr.dms += (fi - statePtr.dms) >> 5
    /* FILTA */
    statePtr.dml += ((fi << 2) - statePtr.dml) >> 7
    /* FILTB */

    if (tr === 1) {
      statePtr.ppp = 256
    } else if (y < 1536) {
      /* SUBTC */
      statePtr.ppp += (0x200 - statePtr.ppp) >> 4
    } else if (statePtr.td === 1) {
      statePtr.ppp += (0x200 - statePtr.ppp) >> 4
    } else if (Math.abs((statePtr.dms << 2) - statePtr.dml) >= statePtr.dml >> 3) {
      statePtr.ppp += (0x200 - statePtr.ppp) >> 4
    } else {
      statePtr.ppp += -statePtr.ppp >> 4
    }
    return statePtr
  }

  /*
   * tandem_adjust(sr, se, y, i, sign)
   *
   * At the end of ADPCM decoding, it simulates an encoder which may be receiving
   * the output of this decoder as a tandem process. If the output of the
   * simulated encoder differs from the input to this decoder, the decoder output
   * is adjusted by one level of A-law or u-law codes.
   *
   * Input:
   *  sr  decoder output linear PCM sample,
   *  se  predictor estimate sample,
   *  y quantizer step size,
   *  i decoder input code,
   *  sign  sign bit of code i
   *
   * Return:
   *  adjusted A-law or u-law compressed sample.
   */
  // var tandem_adjust_alaw = function(
  //   sr, /* decoder output linear PCM sample */ //int
  //   se, /* predictor estimate sample */ //int
  //   y,  /* quantizer step size */ //int
  //   i,  /* decoder input code */ //int
  //   sign,  //int
  //   qtab) //*int
  // {
  //   var sp; /* A-law compressed 8-bit code */
  //   var dx; /* prediction error */
  //   var id; /* quantized prediction error */
  //   var sd; /* adjusted A-law decoded sample value */
  //   var im; /* biased magnitude of i */
  //   var imx;  /* biased magnitude of id */

  //   if (sr <= -32768)
  //     sr = -1;
  //   sp = linear2alaw((sr >> 1) << 3); /* short to A-law compression */
  //   dx = (alaw2linear(sp) >> 2) - se; /* 16-bit prediction error */
  //   id = quantize(dx, y, qtab, sign - 1);

  //   if (id === i) {       no adjustment on sp
  //     return (sp);
  //   } else {      /* sp adjustment needed */
  //     /* ADPCM codes : 8, 9, ... F, 0, 1, ... , 6, 7 */
  //     im = i ^ sign;    /* 2's complement to biased unsigned */
  //     imx = id ^ sign;

  //     if (imx > im) {   /* sp adjusted to next lower value */
  //       if (sp & 0x80) {
  //         sd = (sp === 0xD5) ? 0x55 :
  //             ((sp ^ 0x55) - 1) ^ 0x55;
  //       } else {
  //         sd = (sp === 0x2A) ? 0x2A :
  //             ((sp ^ 0x55) + 1) ^ 0x55;
  //       }
  //     } else {    /* sp adjusted to next higher value */
  //       if (sp & 0x80)
  //         sd = (sp === 0xAA) ? 0xAA :
  //             ((sp ^ 0x55) + 1) ^ 0x55;
  //       else
  //         sd = (sp === 0x55) ? 0xD5 :
  //             ((sp ^ 0x55) - 1) ^ 0x55;
  //     }
  //     return (sd);
  //   }
  // };

  // var tandem_adjust_ulaw = function(
  //   sr, /* decoder output linear PCM sample */ // int
  //   se, /* predictor estimate sample */ // int
  //   y,  /* quantizer step size */ // int
  //   i,  /* decoder input code */ // int
  //   sign, // int
  //   qtab) // *int
  // {
  //   var sp; /* u-law compressed 8-bit code */
  //   var dx; /* prediction error */
  //   var id; /* quantized prediction error */
  //   var sd; /* adjusted u-law decoded sample value */
  //   var im; /* biased magnitude of i */
  //   var imx;  /* biased magnitude of id */

  //   if (sr <= -32768){
  //     sr = 0;
  //   }
  //   sp = linear2ulaw(sr << 2);  /* short to u-law compression */
  //   dx = (ulaw2linear(sp) >> 2) - se;  16-bit prediction error
  //   id = quantize(dx, y, qtab, sign - 1);
  //   if (id === i) {
  //     return (sp);
  //   } else {
  //     /* ADPCM codes : 8, 9, ... F, 0, 1, ... , 6, 7 */
  //     im = i ^ sign;    /* 2's complement to biased unsigned */
  //     imx = id ^ sign;
  //     if (imx > im) {   /* sp adjusted to next lower value */
  //       if (sp & 0x80)
  //         sd = (sp === 0xFF) ? 0x7E : sp + 1;
  //       else
  //         sd = (sp === 0) ? 0 : sp - 1;

  //     } else {    /* sp adjusted to next higher value */
  //       if (sp & 0x80)
  //         sd = (sp === 0x80) ? 0x80 : sp - 1;
  //       else
  //         sd = (sp === 0x7F) ? 0xFE : sp + 1;
  //     }
  //     return (sd);
  //   }
  // };

  // constructor.prototype = {
  //   quan: function(val, table, size) {
  //     return quan(val, table, size);
  //   },
  //   fmult: function(an, srn) {
  //     return fmult(an, srn);
  //   },
  //   g726InitState: function() {
  //     return g726InitState();
  //   },
  //   predictorZero: function(statePtr) {
  //     return predictorZero(statePtr);
  //   },
  //   predictorPole: function(statePtr) {
  //     return predictorPole(statePtr);
  //   },
  //   stepSize: function(statePtr) {
  //     return stepSize(statePtr);
  //   },
  //   quantize: function(d, y, table, size) {
  //     return quantize(d, y, table, size);
  //   },
  //   reconstruct: function(sign, dqln, y) {
  //     return reconstruct(sign, dqln, y);
  //   },
  //   update: function(codeSize, y, wi, fi, dq, sr, dqsez, statePtr) {
  //     return update(codeSize, y, wi, fi, dq, sr, dqsez, statePtr);
  //   },
  //   // tandem_adjust_alaw: function(sr, se, y, i, sign, qtab) {
  //   //   return tandem_adjust_alaw(sr, se, y, i, sign, qtab);
  //   // },
  //   // tandem_adjust_ulaw: function(sr, se, y, i, sign, qtab) {
  //   //   return tandem_adjust_ulaw(sr, se, y, i, sign, qtab);
  //   // }
  // };
  // return new constructor();
}

export {
  debug,
  BrowserDetect,
  checkBrowser,
  checkSupportH265MSE,
  Texture,
  Script,
  Program,
  Shader,
  CommonAudioUtil,
  Uint8ArrayToString,
  getPlatformType,
  getBrowserType,
}
