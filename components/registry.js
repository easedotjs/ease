if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}

import { parseDocument } from './parser.js';

const { warn, error, info } = ease.log
const { config } = ease

/**
 * The registry of components
 * @type {Map<string, ComponentRegistryDef>}
 */
const ComponentRegistry = new Map();

/** 
 * Defines an property 
 * 
*/
class Property {
  /** @type {string} The name of the property */
  name;
  /** @type {string} The type of the property */
  type;
  /** @type {string} The default value of the property */
  default;
  /** @type {boolean} Whether the property is required */
  required;
  /** @type {boolean} Should the property be made available to the style */
  exposeToStyles;
  /** @type {boolean} If true, expose this property as an attribute */
  attribute;

  /**
   * Creates a new property definition
   * @param {string} name The name of the property
   * @param {string} type The type of the property
   * @param {string} defaultVal The default value of the property
   * @param {boolean} attribute Should the property be exposed as an attribute
   * @param {boolean} required Whether the property is required 
   * @param {boolean} exposeToStyles Should the property be made available to the style
   */
  constructor(name, type, defaultVal, required, exposeToStyles, attribute) {
    this.name = name;
    this.type = type || 'string';
    this.default = defaultVal;
    this.required = required;
    this.attribute = attribute;
    this.exposeToStyles = exposeToStyles;
  }
}
  
/**
 * Defines a component to be entered into the registry
 */
class ComponentRegistryDef {
  /** @type {HTMLTemplateElement} The template for the component */
  template;
  /** @type {string} The tag name of the component */
  tagName;
  /** @type {string} The script body for the component, stored as a Blob */
  script;
  /** @type {string} The style for the component */
  style;
  /** @type {Property[]} The properties available in the component */
  properties;
  /** @type {string} The source of the component */
  href;

  /**
   * Creates a new component definition
   * @param {HTMLTemplateElement} template The template for the component
   * @param {string} tagName The tag name of the component
   * @param {string} script The script body for the component
   * @param {string} style The style for the component
   * @param {string} properties The properties for the component
   */
  constructor(href, template, tagName, script, style, properties) {
    this.href = href;
    this.template = template;
    this.tagName = tagName;
    this.script = this._scriptBlobFromText(script);
    this.style = style;
    this.properties = properties;
  }

  _scriptBlobFromText(text) {
    if (!text) return null;
    const blob = new Blob([text], { type: 'text/javascript' });
    return URL.createObjectURL(blob);
  }
}

/**
 * Fetches a component from a URL and returns a ComponentRegistryDef
 * @param {string} tagName The tag name of the component
 * @param {string} href The URL to fetch the component from
 * @returns {Promise<ComponentRegistryDef>} The component definition
 */
export async function fetchComponent(tagName, href) {
  if (ComponentRegistry.has(tagName)) {
    const existingItem = ComponentRegistry.get(tagName);
    if (existingItem.href !== href) {
      throw error(`Component ${tagName} already exists in the registry with a different href`).toError();
    }
    return existingItem;
  }

  return await fetch(`${href}`, { headers: { 'x-ease-fetch': 'true' } })
    .then(async (response) => ({ content: await response.text(), code: response.status }))
    .then(({content, code}) => {
      if (code !== 200) {
        throw error(`Failed to fetch component from ${href}`).toError();
        return;
      }

      const {template, script, style, properties} = parseDocument(content);

      // Run the component through extensions
      ease.extensions.getExtensionsByArtifact('@easedotjs/components').forEach(([extension, name]) => {
        if (extension.onFetchComponent) {
          try {
            extension.onFetchComponent({template, script, style});
          } catch (e) {
            error(`Failed to run extension ${name} onFetchComponent for ${href}`, e);
          }
        }
      });

      return {template, script, style, properties};
    }).then(({template, script, style, properties}) => {
      return new ComponentRegistryDef(href, template, tagName, script, style, properties);
    })
    .catch((err) => {
      error(`Failed to fetch component from ${href}`);
    });
  }

/**
 * Registers a component with the registry
 * @param {ComponentRegistryDef} def The component definition
 */
export function registerComponent(def) {
  if (!def) { return }
  // TODO: Validate the component definition
  if (!ComponentRegistry.has(def.tagName)) {
    ComponentRegistry.set(def.tagName, def);
  }
}

/**
 * Fetches a component from the registry
 * @param {string} tagName The tag name of the component
 * @returns 
 */
export function getComponent(tagName) {
  return ComponentRegistry.get(tagName);
}

/**
 * Fetches a component from a link element and registers it, or returns the existing component
 * @param {HTMLLinkElement} link The link element to fetch the component from
 * @returns {Promise<ComponentRegistryDef>} The component definition
 */
export async function fetchComponentFromLink(link) {
  return fetchComponent(link.getAttribute('rel'), link.href)
    .then((def) => {
      registerComponent(def);
      return def;
    });
}
