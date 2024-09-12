/** Ease */
import * as _log from './log.js'
import { live } from './live.js';
const { error, log, info } = _log;

/* Core Config */
export let config = {
  core: {
    debug: false, // Enables debug mode; prints errors to console
  },
  inject: { // Handles injected extensions
    name: '$',
    extensions: []
  }
}

/* Parse meta tags for configs */
document.querySelectorAll('meta')?.forEach((meta) => {
  if (meta.name.startsWith('ease.')) {
    let path = meta.name.replace('ease.', '').split('.')
    let key = path.pop()    

    let target = path.reduce((acc,key) => {
      if (acc[key] === undefined) acc[key] = {}
      return acc[key]
    }, config)

    target[key] = meta.content
  }
})

/**
 * Adds an extension, which adds functionality to Ease components.
 * 
 * Extensions should be objects containing:
 * - name: The name of the extension
 * - methods: An object containing methods to be added to Ease
 * - objects: An object containing properties to be added to Ease
 * 
 * These are considered "artifacts" of an extension.
 * 
 * While Ease Core itself does not use extensions, they can be used to add functionality
 * to modules that use Ease. Typically, extensions should request the modules they need
 * by those containing artifacts of their own name.
 * 
 * @param {*} object The object to be injected
 */
export function addExtension(object) {
  let name = object.name || object.constructor.name
  config.inject.extensions.push(object)
  info(`Extension '${name}' has been added to Ease`)
}

export function getExtension(name) {
  return config.inject.extensions.find((extension) => extension.name === name)
}

export function hasExtension(name) {
  if (typeof name === 'string') return !!getExtension(name)
  if (Array.isArray(name)) return name.every((n) => !!getExtension(n))
  return false
}

export function requireExtensions(names) {
  if (typeof names === 'string') names = [names]
  names.forEach((name) => {
    if (!hasExtension(name)) throw new Error(`Extension '${name}' is required but not loaded`)
  })
  return true
}

export function beforeExtensions(names) {
  if (typeof names === 'string') names = [names]
  names.forEach((name) => {
    if (getExtension(name)) {
      error(`Extension '${name}' is already loaded - this extension should be loaded before it`)
    }
  })
}

/**
 * Returns all extensions that contain a specific element
 * @param {*} element The element to search for
 * @returns A list of extensions with the given element
 */
export function getExtensionsByArtifact(element) {
  return config.inject.extensions.filter((extension) => !!extension[element])
          .map((extension) => [extension[element], extension.name])
}

/* Print to the console if debug mode is enabled */
if (config.core.debug) info('Ease Loaded in Debug Mode');

/* Export Ease */
globalThis.ease = { config, log: _log, extensions: {
  add: addExtension,
  get: getExtension,
  has: hasExtension,
  require: requireExtensions,
  before: beforeExtensions,
  getExtensionsByArtifact,
  all: config.inject.extensions,
}, live};