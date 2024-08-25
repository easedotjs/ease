/*** 
 * Event Bridge
 * ============
 * A simpler interface for sending/receiving events.
 * While this utilizes the browser's built-in EventTarget, it simplifies the 
 * process of sending and receiving events by providing a more intuitive API.
 * 
 * In addition, this modules provides a mechanism to request objects from
 * anywhere without polluting the global scope.
 * 
 * It's highly recommended to namespace your events to avoid conflicts.
 */

import { error } from './log.js'

let emitter = new EventTarget()
let fetchHandlerIds = []

/**
 * EventBridgeEvent is a custom event that handles simplified event dispatching.
 */
class EventBridgeEvent extends CustomEvent {
  constructor(name, data) {
    super(`event-bridge--${name}`, { detail: { data } })
  }
}

/**
 * EventBridgeFetchEvent is a custom event that facilitates requesting data
 * from anywhere as long as the event is registered.
 * If a response is not provided, the event is a request.
 * If a response is provided, the event is a response to a request.
 */
class EventBridgeFetchEvent extends CustomEvent {
  constructor(name, response) {
    let _name = response ? 
      `event-bridge-fetch-response--${name}` : 
      `event-bridge-fetch-request--${name}`
    super(_name, { detail: { response } })
  }
}

/**
 * Dispatches an event with the given name and data.
 * @param {string} name The name of the event 
 * @param {object} data Additional data to send with the event 
 */
export function send(name, data) {
  emitter.dispatchEvent(new EventBridgeEvent(name, data))
}

/**
 * Listen for an event with the given name.
 * @param {string} name The name of the event to listen for
 * @param {function} callback The method to invoke when the event is fired 
 * @returns an object with an off method to remove the event listener
 */
export function on(name, callback) {
  emitter.addEventListener(`event-bridge--${name}`, (event) => {
    callback?.(event.detail.data)
  })
  return {
    off: () => emitter.removeEventListener('ease-event-bridge', callback)
  }
}

/**
 * Listen for a fetch event with the given name.
 * @param {string} name The name of the event to listen for
 * @param {object|function} response A response object or callback method
 * @returns an object with an off method to remove the event listener
 */
export function onFetch(name, response) {
  fetchHandlerIds.push(name)
  emitter.addEventListener(`event-bridge-fetch-response--${name}`, (event) => {
    if (typeof response === 'function') {
      emitter.dispatchEvent(new EventBridgeFetchEvent(name, response))
    } else if (typeof response === 'boolean') {
      emitter.dispatchEvent(new EventBridgeFetchEvent(name, true))
    } else if (typeof response === 'undefined') {
      error(`onFetch requires a response object or callback method, but none was provided.`)
    } else {
      emitter.dispatchEvent(new EventBridgeFetchEvent(name, response))
    }
  })
  return {
    off: () => {
      fetchHandlerIds = fetchHandlerIds.filter((id) => id !== name)
      emitter.removeEventListener('ease-event-bridge-fetch', callback)
    }
  }
}

/**
 * Listen for an event with the given name, but only once.
 * @param {string} name The name of the event to listen for
 * @param {function} callback The method to invoke when the event is fired
 */
export function once(name, callback) {
  return on(name, (data) => {
    handler.off()
    callback(data)
  })
}

/**
 * Fetches data from an event with the given name.
 * @param {string} name The name of the event to fetch
 * @returns the data from the event
 */
export function fetch(name) {
  return new Promise((resolve, reject) => {
    if (!fetchHandlerIds.includes(name)) {
      error(`No fetch handler found for '${name}'`)
      reject()
    }
  
    emitter.addEventListener(`event-bridge-fetch-response--${name}`, (event) => {
      resolve(event.detail.response)
    })
    
    emitter.dispatchEvent(new EventBridgeFetchEvent(name))
  });
}

/* Add to global allowing any and all modules to access the EventBridge
 * In the future, this will allow other modules to function in the 
 * absence of the Ease framework.
 */
globalThis.EventBridge = { send, on, onFetch, once, fetch }