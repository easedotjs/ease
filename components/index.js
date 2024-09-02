if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

const { warn, error, info } = ease.log
const { config } = ease

import { fetchComponent, registerComponent } from './registry.js'
import { createWebComponentClass } from './hydrate.js'

// Get components defined in the document
document.querySelectorAll('link[rel="component"]').forEach((link) => {
  fetchComponent(link.getAttribute('name'), link.href)
    .then((def) => {
      // Register the component
      registerComponent(def);

      // Define the custom element
      createWebComponentClass(def.tagName, def.template, def.style, def.script, def.attributes);
    })
})

// Get component definitions
document.querySelectorAll('link[rel="component-def"]').forEach((link) => {
  fetch(link.href).then((response) => {
    if (response.status === 404) {
      throw warn(`Failed to load component from ${href}`)
    }
    return response.text()
  }).then((content) => {
    // Fetch the component def xml
    let parser = new DOMParser()
    let components = parser.parseFromString(content, 'text/xml').querySelector('components')
    components.childNodes.forEach((component) => {
      if (component.nodeName === 'component') {
        fetchComponent(component.attributes['name'].value, component.attributes['href'].value)
          .then((def) => {
            // Register the component
            registerComponent(def);

            // Define the custom element
            createWebComponentClass(def.tagName, def.template, def.style, def.script, def.attributes);
          })
      }
    })
  })
})