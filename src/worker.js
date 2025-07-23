/**
 * Web worker 
 * 
 * Used for regular expression matching as it will help take off pressure from the main thread. 
 * Since the regex patterns are very large and time consuming they tend to affect the browser UX and responsiveness.
 * 
 * It is highly recommended that the worker is enabled in browser environments. It can be toggled on/off using the API: 
 *     R2L.setOptions({ worker: true });    # By default the Web worker is not enabled. 
 * 
 * The worker receives messages as objects of the following format:
 *   { 
 *      text: 'C-99/99 hello world hello', 
 *      pattern: /(hello)/gi, 
 *      uuid: RANDOM_STRING 
 *   } 
 * and posts back the same message with an extra `matches` array:
 *   { 
 *      text: 'C-99/99 hello world hello', 
 *      pattern: /(hello)/gi, 
 *      uuid: RANDOM_STRING, 
 *      matches: [
 *        {
 *           args: ['hello', 'hello', index: 8, input: 'C-99/99 hello world hello']
 *           lastIndex: 13
 *        },
 *        {
 *           args: ['hello', 'hello', index: 20, input: 'C-99/99 hello world hello']
 *           lastIndex: 25
 *        }
 *      ] 
 *   } 
 */
self.addEventListener('message', function(event) {
    var matches = [];
    while((args = event.data.pattern.exec(event.data.text))) {
        matches.push({
            args: args,
            lastIndex: event.data.pattern.lastIndex
        });
    }
    postMessage({ uuid: event.data.uuid, text: event.data.text, matches: matches });
});