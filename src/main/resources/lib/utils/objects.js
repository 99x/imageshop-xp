module.exports = {
  forceArray,
  trySafe
}

/**
 * Guarantee that supplied argument is an array by encapsulating it, if required
 * @param {*} data Target object
 */
function forceArray (data) {
  if (!Array.isArray(data) && (data)) {
    data = [data]
  } else if (!data) {
    data = []
  }
  return data
}

/**
 * Executes a callback in a safe way, discarding errors and returning undefined
 * @param {Function} callback Function to be executed in a safe way
 * @param {Function} onFail Function to be executed if an error occurs on the main callback
 * @param {Array} args Arguments array to supply the function callback - Optional
 */
function trySafe (callback, onFail, args) {
  if (typeof onFail !== 'function') {
    onFail = function () { }
  }
  if (typeof callback === 'function') {
    try {
      return callback.apply(this, forceArray(args))
    } catch (e) {
      return onFail.apply(this, Array.isArray(args) ? (() => { args = args.slice(0); args.unshift(e); return args })() : [e])
    }
  }
}
