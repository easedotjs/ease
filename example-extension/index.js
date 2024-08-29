/**
 * This file gives an example of how to create an extension for Ease.
 */

/** Check if Ease is loaded */
if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

/** Demonstrates exposing functions */
function sampleFunction() {
  return 'Hello World!'
}

/** Demonstrates exposing objects */
let sampleObject = {
  message: 'Hello World!'
}

/** Add the extension */
ease.extensions.add({
  name: 'example-extension',
  methods: { sampleFunction }, // @easedotjs/core 
  objects: { sampleObject }, // @easedotjs/core
  ['@easedotjs/components']: { // Demonstrates extending other extensions
    parseTemplate: (template) => {
      return template
    }
  }
})