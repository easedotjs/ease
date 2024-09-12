if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

import { getComponent } from './registry.js';
const { config, extensions } = ease
const { error } = ease.log

/**
 * Creates the class for a web component from the registry
 * @param {ComponentRegistryDef} registryDef The registry definition
 * @returns {typeof HTMLElement} The web component class
 */
export function createWebComponentClass(
  tagName,
  template,
  style,
  scriptUrl,
  properties,
) {
  // TODO: A lot of this code is only needed to be initialized once 
  //       - we should make it static on the class
  const component = class extends HTMLElement {
    /** The shadow element that holds the content */
    #shadow;
    #mounted = false;
    #styleEl;
    #propStyleEl;
    eventListeners = [];
    #vdom;
    #args = {
      // The shadow
      root: undefined,
      // Elements
      elements: {},
      get el() { return this.elements },
      // Properties
      properties: {},
      get props() { return this.properties },
      // Extensions
      extensions: {},
      get ext() { return this.extensions },
      get [config.inject.name]() { return this.extensions},
      // Attributes
      attributes: {},
      get attrs() { return this.attributes },      
    };

    constructor() {
      super();

      // Allows accessing the component from methods
      let self = this;
      
      //if (template.hasAttribute('shadowless')) {
      //  this.#shadow = this;
      //} else {
        // Create the shadow DOM
        this.#shadow = this.attachShadow({mode: 'open'});
        this.#args.root = this.#shadow;
      //}

      this.#vdom = template.clone();
    }

    #applyEaseElements () {
      const self = this;
      
      // Clone the template into the shadow DOM
      this.#vdom.children.forEach((el) => {
        this.#shadow.appendChild(el.htmlNode);
      });
      
      // Load the stylesheet
      if (style) {
        this.#styleEl = document.createElement('style');
        this.#styleEl.textContent = style;
        this.#shadow.appendChild(this.#styleEl);
      } 

      // Get properties and store them in the properties object
      let propStyles = '';
      properties?.forEach?.((prop) => {
        this.#args.properties[prop.name] = {
          _listeners: [],
          _value: prop.default,
          type: prop.type,
          required: prop.required,
          exposeToStyles: prop.exposeToStyles,
          attribute: prop.attribute,
          get value() { return this._value },
          set value(v) { 
            const prev = this._value;
            this._value = v;
            this._listeners.forEach((l) => l(v, prev));
            if (this.exposeToStyles) self.updateStyles();
          },
          /**
           * Adds a watcher to the property, which receives the current and previous values
           * This will be invoked on mount and whenever the value changes
           * @param {function} callback 
           */
          watch(callback) {
            this._listeners.push(callback);
            if (!this.mounted) {
              callback(this.value, undefined);
            }
          },
          /**
           * Removes a watcher from the property
           * @param {function} callback
           */
          unwatch(callback) {
            this._listeners = _listeners.filter((l) => l !== callback);
          },
          /**
           * Removes all watchers from the property
           */
          unwatchAll() {
            this._listeners = [];
          }
        };
        
        Object.defineProperty(this, prop.name, {
          get: () => this.#args.properties[prop.name].value,
          set: (v) => { 
            this.#args.properties[prop.name].value = v
          }
        })

        // If the attribute is required, throw an error if it is not present 
        if (prop.required && prop.attribute && !this.hasAttribute(prop.name)) {
          throw error(`Attribute ${prop.name} is required`).toError();
        }

        if (prop.attribute) {
          this.#args.properties[prop.name].value = this.getAttribute(prop.name) || prop.default;
        }

        // If the property is set for style exposure, add it to the style element
        if (prop.exposeToStyles) {
          propStyles += `--${prop.name}: ${this.#args.properties[prop.name].value}; `;
        }
      });

      // Add the attribute styles to the style element
      if (propStyles) {
        this.#propStyleEl = document.createElement('style');
        this.#propStyleEl.textContent += `:host { ${propStyles} }`;
        this.#shadow.insertBefore(this.#propStyleEl, this.#styleEl);
      }

      // Get elements by ID and store them in the elements object
      this.#shadow.querySelectorAll('[id]').forEach((el) => {
        this.#args.elements[el.id] = el;
      });
      
      // Get all extensions
      this.#args.extensions = extensions.all.reduce((p, c) => {
        const objects = c.objects || {};
        const methods = c.methods || {};
        return {...p, ...objects, ...methods};
      }, {});

      // Override event listeners; this allows tracking event listeners
      // and removing them when the component is disconnected
      const shadowAddEventListener = this.#shadow.addEventListener;
      this.#shadow.addEventListener = function (name, callback) {
        self.eventListeners.push({ name, callback })
        shadowAddEventListener(name, callback)
      }
      
      const shadowRemoveEventListener = this.#shadow.removeEventListener;
      this.#shadow.removeEventListener = function (name, callback) {
        self.eventListeners = self.eventListeners.filter(({ name: n, callback: c }) => {
          if (n === name && c === callback) {
            shadowRemoveEventListener(name, callback)
            return false
          }
          return true
        })
      }
            
      // Load the script
      if (scriptUrl) {
        import(scriptUrl).then((module) => {
          if (!module.default) return;          
          // If the module has a default export, call it with the component as the argument
          if (module.default) module.default.apply(self, [{...this.#args, self }]);
          
          // Dispatch a connect event
          this.#shadow.dispatchEvent(new CustomEvent('connect'));
        });
      }

      // Handle initialization through extensions
      extensions.getExtensionsByArtifact('@easedotjs/components').forEach(([ext]) =>
        ext.onInit?.({ shadow: this.#shadow, args: this.#args, instance: self })
      );

      // Get attributes and store them in the attributes object
      Array.from(this.attributes).forEach((attr) => {
        this.#args.attributes[attr.name] = attr.value;
      });
    }

    // Update Styles to reflect attribute changes
    updateStyles() {
      if (!this.#propStyleEl) return;
      let propStyles = '';
      Object.keys(this.#args.properties).forEach((key) => {
        const prop = this?.[key];
        if (prop.exposeToStyles) {
          attrStyles += `--${key}: ${prop.value}; `;
        }
      });
      this.#propStyleEl.textContent = `:host { ${propStyles} }`;
    };

    // On connect, add watchers
    connectedCallback() {
      this.#applyEaseElements();
      this.#mounted = true;
      // Dispatch a connect event
      this.#shadow.dispatchEvent(new CustomEvent('connect'));
    }

    // On disconnect, remove all watchers
    disconnectedCallback() {
      this.#mounted = false;
      this.#args.properties?.forEach?.((attr) => {
        attr.unwatchAll();
      });
      this.#shadow.dispatchEvent(new CustomEvent('disconnect'));

      // Remove all event listeners
      this.eventListeners.forEach(({ name, callback }) => {
        this.#shadow.removeEventListener(name, callback)
      })

      // Handle cleanup through extensions
      extensions.getExtensionsByArtifact('@easedotjs/components').forEach(([ext]) =>
        ext.onCleanup?.({ shadow: this.#shadow, args: this.#args })
      );
    }

    static get observedAttributes() {
      return properties.filter((prop) => prop.attribute).map((attr) => attr.name);
    }

    get mounted() { return this.#mounted; }
    get vdom() { return this.#vdom; }
    
  }
  customElements.define(tagName, component);
  return component;
}