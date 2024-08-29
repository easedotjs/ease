/** Ease */
import * as log from './log.js'

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
 * While Ease Core does not use extensions, they can be used to add functionality
 * to modules that use Ease.
 * 
 * @param {*} object The object to be injected
 */
export function addExtension(object) {
  let name = object.name || object.constructor.name
  config.inject.extensions.push(object)
  log.info(`Extension '${name}' has been added to Ease`)
}

export function getExtension(name) {
  return config.inject.extensions.find((extension) => extension.name === name)
}

export function hasExtension(name) {
  if (typeof name === 'string') return !!getExtension(name)
  if (typeof name === 'array') return name.every((n) => !!getExtension(n))
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
      console.error(`Extension '${name}' is already loaded - this extension should be loaded before it`)
    }
  })
}

/* Print to the console if debug mode is enabled */
if (config.core.debug) log.info('Ease Loaded in Debug Mode');

/* Export Ease */
globalThis.ease = { config, log, extensions: {
  add: addExtension,
  get: getExtension,
  has: hasExtension,
  require: requireExtensions,
  before: beforeExtensions,
  all: config.inject.extensions,
}}