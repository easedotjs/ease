import { EaseNode, EaseAttribute, EaseNodeParser } from './vdom.js';

/** Text-based document parsing to reduce dependence on DOMParser
 * @property {string} content The content of the document
 */
export function parseDocument(document) {
  const parser = new EaseNodeParser();
  const template = parser.parse(document.match(/<template>([\s\S]*)<\/template>/m)?.[1] || '');
  const script = document.match(/<script>([\s\S]*)<\/script>/m)?.[1] || '';
  const style = document.match(/<style>([\s\S]*)<\/style>/m)?.[1] || '';

  const properties = document.match(/<property\s?([^(/>)]+)\/>/g)?.map((prop) => {
      const nameMatch = prop.match(/name="([^"]+)"/);
      const typeMatch = prop.match(/type="([^"]+)"/);
      const defaultMatch = prop.match(/default="([^"]+)"/);
      const requiredMatch = prop.match(/required/);
      const exposeToStylesMatch = prop.match(/expose-to-styles/);
      const attributeMatch = prop.match(/attribute/);
  
      const name = nameMatch ? nameMatch[1] : null;
      const type = typeMatch ? typeMatch[1] : null;
      const defaultVal = defaultMatch ? defaultMatch[1] : null;
      const required = requiredMatch ? requiredMatch[1] === 'true' : false;
      const exposeToStyles = !!exposeToStylesMatch;
      const attribute = !!attributeMatch;
  
      return { name, type, default: defaultVal, required, exposeToStyles, attribute };
    }) || [];

  return {template, script, style, properties };
}

export function templateToVdom(template) {
  let i = 0;
  let vdom = new EaseNode('root', [], []);
  let activeNode = vdom;
  let currentNode;

  while (i < template.length) {
    if (template[i] === '<') {
      if (template[i + 1] === '/') {
        while (template[i] !== '>') {
          i++;
        }
        activeNode.children.push(currentNode);
      } else {
        currentNode = new EaseNode('root', [], []);
      }
    }
  }
}
