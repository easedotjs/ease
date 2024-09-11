if (typeof ease === 'undefined') {
  throw new Error('This library requires Ease to be loaded first')
}
ease.extensions.before(['@easedotjs/components'])

const { error } = ease.log;
const { live } = ease;

// Get the live method from the reactive extension
let evals = [];

/**
 * Parses a template string and converts all {{}} to <reactive-text></reactive-text>
 * @param {string} The text content of a <template> tag 
 * @returns A string with the text wrapped in <reactive-text></reactive-text>
 */
function onFetchComponent({template}) {
  // TODO: This could be much cleaner and safer; but possibly slower if we crawl the DOM
  //       for text nodes.
  let test = template.innerHTML.replace(/{{(.*?)}}/g, '<reactive-text>$1</reactive-text>');
  let parser = new DOMParser();
  let doc = parser.parseFromString(test, 'text/html');
  template.innerHTML = doc.body.innerHTML;
}

/**
 * When a component is initialized, this method is called to convert all reactive-text elements to reactive values
 * @param {object} An object containing the shadow root and args 
 */
function onInit({ shadow, args }) {
  // Find all reactive-text elements
  let reactiveTextElements = shadow.querySelectorAll('reactive-text');

  if (reactiveTextElements.length === 0) return;
  
  // Add reactive meta if it does not exist
  args.rx = args.rx || {};

  // TODO: Make reactive attributes work

  // Convert all reactive-text elements to reactive values
  reactiveTextElements.forEach((element) => {
    // Get the key from the text content
    let key = element.textContent.trim();
    let textNode = document.createTextNode('');
    element.parentNode.replaceChild(textNode, element);

    // If the key starts with :, it's bound to an property
    if (key.startsWith(':')) {
      key = key.substring(1);

      // If the key exists, bind the reactive value to the property
      if (!args.properties[key]) {
        throw error(`Property ${key} does not exist, but is using the property binding syntax :${key}`, 
                    'In component:', shadow.tagName,
                    'At position:', shadow).toError();
      }

      args.properties[key]?.watch((value) => {
        textNode.textContent = value;
      });

      textNode.textContent = args.properties[key].value;
    } else if (key.startsWith('[')) {
      // If the key starts with [, it's an expression
      // NOTE: This is a very basic implementation and does not support complex expressions
      //       nor is it reactive. This is a proof of concept.
      function evaluate() {
        const expression = key.substring(1, key.length - 1);
        const path = expression.split('.');
        
        const targetPath = path.slice(0,-1).reduce((acc, key) => acc[key], args);
        let target = path[path.length - 1];
  
        if (target.endsWith('()')) { 
          target = target.substring(0, target.length - 2);
          textNode.textContent = targetPath[target].call(targetPath);
        } else {
          textNode.textContent = path.reduce((acc, key) => acc[key], args);
        }
      }; evaluate();
      evals.push(evaluate);

      // Add an update method to rx
      if (!args.rx.update) {
        args.rx.update = () => evals.forEach((evaluate) => evaluate());
      }
    } else {
      // If the key does not exist, create a new reactive value
      if (!args.rx[key]) {
        args.rx[key] = live();
      }
      
      args.rx[key].subscribe((value) => {
        textNode.textContent = value.value;
      });
    }
  });  
}

/**
 * Cleans up reactive values when a component is removed
 */
function onCleanup({args}) {
  if (args.rx) {
    Object.keys(args.rx).forEach((key) => {
      args.rx[key].unsubscribe();
    })
  } 
  evals = [];
}

// ease.extensions.add({
//   name: '@easedotjs/reactive-dom',
//   ['@easedotjs/components']: { 
//     onFetchComponent,
//     onInit,
//     onCleanup
//   }
// });
