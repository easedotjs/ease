if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

const { warn, error, info } = ease.log
const { config } = ease

let componentRegistry = {}

/**
 * Fetch a component, then parse it into a shared object 
 * @param {*} name The name of the component
 * @param {*} href The URL of the component
 * @returns 
 */
async function fetchComponent(name, href) {
  let template, script, style, attributes = [], src

  await fetch(href)
    .then(async (response) => ({ content: await response.text(), code: response.status }))
    .then(({content, code}) => {
      // If the file does not exist, return an error
      if (code === 404 || code === 0) {
        template = document.createElement('template');
        style = document.createElement('style');

        if (config.core.debug) {
          error(`Failed to load component '${name}' from ${href}`)
          template.innerHTML = `<div><strong>Ease Component Error:</strong> Failed to load component '${name}' from ${href}</div>`
          style.innerText = `:host { color: #800; padding: 1rem; }`
        }
        return;
      }

      // Execute extensions that modify the content
      ease.extensions.all.forEach((extension) => {
        if (extension['@easedotjs/components']?.parseTemplate) {
          content = extension['@easedotjs/components'].parseTemplate(content)
        }
      })

      // Parse the content into a document
      let parser = new DOMParser()
      let doc = parser.parseFromString(content, 'text/html')
      
      // If the component does not contain template, treat the entire content as the template
      if (!doc.querySelector('template')) {
        template = doc.createElement('template')
        template.innerHTML = content
        doc.body.appendChild(template)
      } else {
        template = doc.querySelector('template')
        script = doc.querySelector('script:not([src])')
        style = doc.querySelector('style')
      }

      // Parse shadow node for attributes
      let attributeMeta = template.content.querySelectorAll('meta[name="attribute"]')
      attributeMeta.forEach((attribute) => {
        let attributeKey = attribute.attributes['content'].value
        attributes[attributeKey] = { 
          name: attributeKey, 
          default: attribute.attributes['default']?.value,
          style: !!attribute.attributes['style'],
        }
        attribute.remove()
      })
  }).catch((err) => {
    error(`Failed to load component '${name}' from ${href}`, err)
  })

  return { template, script, style, attributes, src: href }
}

/**
 * Load a component from a link node
 * @param {*} linkNode The link node to load the component from
 */
async function loadComponentFromLink(linkNode) {
  let name = linkNode.attributes['name']?.value
  let href = linkNode.attributes['href']?.value
  loadComponent(name, href)
}

/**
 * Load a component from a name and href
 * @param {*} name 
 * @param {*} href 
 * @returns 
 */
async function loadComponent(name, href) {
  /** Validate component */
  if (!name) return error(`Component ${linkNode} missing name attribute`)
  if (!href) return error(`Component '${name}' missing href`)
  if (!name.includes('-')) return error(`Component '${name}' must contain a hyphen`)
  if (componentRegistry[name]) {
    if (componentRegistry[name].src === href) {
      return info(`Component '${name}' already exists in registry`)
    } else {
      return error(
        `Component '${name}' already exists in registry with a different source`, 
        `Existing component: ${componentRegistry[name].src}`, 
        `New component: ${href}`,
        'This will cause the existing component to be used instead of the new component',
        'If you are using a router or other dynamic loading, try using different namespaces for components')
    }
  }

  /** Load HTML into the registry */
  let componentDef = await fetchComponent(name, href)
  if (!componentDef.template) return error(`Component '${name}' missing template`)
  
  /** Add component to the registry */
  componentRegistry[name] = componentDef

  /** Define the custom element */
  customElements.define(name, class extends HTMLElement {
    attributes = {}
    eventListeners = []

    constructor() {
      super()
      let registryElement = componentRegistry[name]
      if (!registryElement) return error(`Component '${name}' not found in registry`)

      // Create our shadow node
      let shadow = this.attachShadow({ mode: 'open' })
      this.shadow = shadow
      
      // Parse shadow node for links
      let links = registryElement.template.content.querySelectorAll('link')
      links.forEach(loadComponentFromLink)
      links.forEach((link) => link.remove())

      // Append the template to the shadow node
      shadow.appendChild(registryElement.template.content.cloneNode(true))

      if (registryElement.style) shadow.appendChild(registryElement.style.cloneNode(true))
      if (registryElement.script) { 
        // Get the contents of the script tag if exists
        const scriptContent = registryElement.script.textContent
        const blob = new Blob([scriptContent], { type: 'text/javascript' })
        const moduleURL = URL.createObjectURL(blob)

        // Capture all elements with an ID
        let elements = []
        shadow.querySelectorAll('[id]').forEach((element) => { elements[element.id] = element })

        // Load the module and execute it
        import(moduleURL).then((module) => {
          // Ensure the script exists and is not empty
          if (!module.default && !registryElement.script.attributes['no-warn']) return warn(`Component '${name}' contains script tag but does not export a default. Use the no-warn attribute on the script tag if this is the intended behavior`)
          if (!module.default && registryElement.script.attributes['no-warn']) return

          // Inject the module with the shadow node and elements
          // We use names with multiple aliases to make it easier to access
          // depending on your preferences; more explicit or more verbose.
          let args = {
            root: shadow, 
            // Element access
            elements,
            get el () { return this.elements }, 
            // Attributes
            attributes: [],
            get attr () { return this.attributes },
            // Extensions
            extensions: {},
            get ext () { return this.extensions },
            get [config.inject.name] () { return this.extensions }
          }          

          // Inject extensions
          config.inject.extensions.forEach((extension) => {
            // Ensure the extension has methods
            if (extension.methods) {            
              // Add methods to the extensions
              Object.keys(extension.methods)?.forEach?.((method) => { 
                if (extension[method])  {
                  return warn(`Extension method '${method.name}' already exists in extensions, skipping`)
                }
                args.extensions[method] = extension.methods[method]
              })
            }

            // Add objects to the extensions
            Object.assign(args.extensions, extension.objects)
          })

          // Inject attributes
          Object.keys(registryElement.attributes).forEach((key) => {
            let attribute = registryElement.attributes[key]
            this.attributes[attribute.name] = {
              listeners: [],
              _value: this.getAttribute(attribute.name) || attribute.default,
              set value(newValue) {
                let oldValue = this._value
                this._value = newValue
                this.listeners.forEach((listener) => listener(newValue, oldValue))
                shadow.dispatchEvent(new CustomEvent('attribute-changed', { detail: {name: attribute.name, oldValue: oldValue, newValue: newValue }}))
              },
              get value() {
                return this._value
              },              
              watch(listener) {
                this.listeners.push(listener)
                listener(this.value, null)
              },
              unwatch(listener) {
                this.listeners = this.listeners.filter((l) => l !== listener)
              }
            }            
          })
          args.attributes = this.attributes
          
          // Handle post-parsing extensions
          ease.extensions.all.forEach((extension) => {
            if (extension['@easedotjs/components']?.onInit) {
              extension['@easedotjs/components'].onInit({ shadow, args })
            }
          })

          // Execute the module
          setTimeout(() => module.default(args))
        });

        // Dispatch attributeChanged event for initial state and handle CSS variables
        let cssVars = {}
        Object.keys(registryElement.attributes).forEach((key) => {
          let attribute = registryElement.attributes[key] 
          this.shadow.dispatchEvent(new CustomEvent('attribute-changed', { detail: {name: attribute, oldValue: null, newValue: this.getAttribute(attribute) }}))

          // If the attribute is exposed to CSS, update the CSS variable
          if (attribute.style && this.getAttribute(attribute.name)) {
            cssVars[attribute.name] = this.getAttribute(attribute.name)
          }
        })

        // Apply CSS variables
        if (Object.keys(cssVars).length > 0) {
          let style = document.createElement('style')
          let css = ':host {'
          Object.keys(cssVars).forEach((key) => {
            css += `--${key}: ${cssVars[key]};`
          })
          css += '}'
          style.innerHTML = css
          shadow.appendChild(style)
        }
      
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (this.attributes[name]) {
        this.attributes[name].value = newValue
      }
    }

    addEventListener(name, callback) {
      this.eventListeners.push({ name, callback })
      this.shadow.addEventListener(name, callback)
    }

    removeEventListener(name, callback) {
      this.eventListeners = this.eventListeners.filter((listener) => {
        if (listener.name === name && listener.callback === callback) {
          this.shadow.removeEventListener(name, callback)
          return false
        }
        return true
      })
    }

    disconnectedCallback() {
      this.eventListeners.forEach((listener) => {
        this.shadow.removeEventListener(listener.name, listener.callback)
      })
    }

    static get observedAttributes() {
      return Object.keys(componentRegistry[name].attributes)
    }
  })
}

// TODO: Consider a better way to handle this
/** If the body is replaced, scan for updated links */
document.addEventListener('ease_load_component', (event) => {
  if (event.detail.name) {
    loadComponent(event.detail.name, event.detail.href)
  }
})

/** Get all component imports */
document.addEventListener('DOMContentLoaded', () => {
  let components = document.querySelectorAll(['link[rel="component"]'])
  if (components) {  
    /** Load all components */
    components.forEach(loadComponentFromLink)
  } else warn('No components found')
});
