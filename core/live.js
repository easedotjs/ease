/**
 * Creates a reactive value that can be subscribed to.
 * @param {*} initialValue The initial value of the reactive value
 * @param {*} handler An optional handler to be called when the value changes
 * @returns The reactive value
 */
export function live(initialValue = null, handler = null) {  
  let _value = initialValue
  let handlers = []

  if (handler) {
    handlers.push(handler)
  }

  return {
    get value() {
      return _value
    },
    set value(value) {
      let original = _value
      _value = value
      handlers.forEach((handler) => {
        handler({original, value: _value})
      })
    },
    /**
     * Subscribes to changes in the reactive value
     * @param {*} handler A handler to be called when the value changes
     * @returns A reference to self
     */
    subscribe: function (handler) {
      handlers.push(handler)
      return this
    },
    /**
     * Unsubscribes from changes in the reactive value
     * @param {*} handler The handler to be removed
     * @returns A reference to self
     */
    unsubscribe: function (handler) {
      handlers = handlers.filter((h) => h !== handler)
      return this
    },
    /**
     * Unsubscribes all handlers from the reactive value
     * @returns A reference to self
     */
    unsubscribeAll: function () {
      handlers = []
      return this
    }
  }
}