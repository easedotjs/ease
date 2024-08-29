if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}
ease.extensions.require(['@easedotjs/reactive'])
ease.extensions.before(['@easedotjs/components'])

// Get the live method from the reactive extension
const live = ease.extensions.get('@easedotjs/reactive').methods.live;

/**
 * Parses a template string and converts all {{}} to <reactive-text></reactive-text>
 * @param {string} The text content of a <template> tag 
 * @returns A string with the text wrapped in <reactive-text></reactive-text>
 */
function parseTemplate(template) {
 return template.replace(/{{(.*?)}}/, '<reactive-text>$1</reactive-text>')
}

/**
 * When a component is initialized, this method is called to convert all reactive-text elements to reactive values
 * @param {object} An object containing the shadow root and args 
 */
function onInit({ shadow, args }) {
  // Find all reactive-text elements
  let reactiveTextElements = shadow.querySelectorAll('reactive-text')
  
  // Add reactive meta if it does not exist
  args.rx = args.rx || {}

  // Convert all reactive-text elements to reactive values
  reactiveTextElements.forEach((element) => {
    let key = element.textContent.trim()
    let reactiveValue = live()
    let textNode = document.createTextNode('')

    element.parentNode.replaceChild(textNode, element)
    
    reactiveValue.subscribe((value) => {
      textNode.textContent = value.value;
    });
    args.rx[key] = reactiveValue;
  });
}

ease.extensions.add({
  name: '@easedotjs/reactive-dom',
  ['@easedotjs/components']: { 
    parseTemplate,
    onInit
  }
});
