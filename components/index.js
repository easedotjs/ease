if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

const { warn, error, info } = ease.log

import { fetchComponent, registerComponent } from './registry.js'
import { createWebComponentClass } from './hydrate.js'

// Get components defined in the document
const componentPromises = Array.from(document.querySelectorAll('link[rel="component"]')).map(async (link) => {
  const def = await fetchComponent(link.getAttribute('name'), link.href);
  // Register the component
  registerComponent(def);
  // Define the custom element
  createWebComponentClass(def.tagName, def.template, def.style, def.script, def.properties);
})

// Get component definitions
const componentDefPromises = Array.from(document.querySelectorAll('link[rel="component-def"]')).map(async (link) => {
  return fetch(link.href).then((response) => {
    if (response.status === 404) {
      throw warn(`Failed to load component from ${href}`)
    }
    return response.text()
  }).then(async (content) => {
    // Fetch the component def xml
    let parser = new DOMParser()
    let components = parser.parseFromString(content, 'text/xml').querySelector('components')
    const promises = Array.from(components.childNodes).map(async (component) => {
      if (component.nodeName === 'component') {
        await fetchComponent(component.attributes['name'].value, component.attributes['href'].value)
          .then((def) => {
            // Register the component
            registerComponent(def);

            // Define the custom element
            createWebComponentClass(def.tagName, def.template, def.style, def.script, def.properties);
          })
      }
    })
    await Promise.all(promises)
    info(`Loaded component definitions from ${link.href}`)
  })
})

// Rehydrate the document if it's wrapped in a template
// This allows us to defer rendering
Promise.all([...componentPromises, ...componentDefPromises]).then(() => {
  const rootTemplate = document.querySelector('body > template');
  if (rootTemplate) {
    rootTemplate.replaceWith(rootTemplate.content);
  }
  document.body.classList.add('hydrated');
});

