/**
 * If you want to provide a custom regexp, this is the configuration to use.
 * -- For historical reasons, all regexps are processed as if they have the global flag set.
 * -- Use the nonExhaustiveModeMaxMatchCount property to match a limited number of matches.
 * Note: any additional keys/props are permitted, and will be returned as-is!
 * @typedef {Object} CustomParseShape
 * @property {RegExp} pattern
 * @property {number} [nonExhaustiveModeMaxMatchCount] Enables "non-exhaustive mode", where you can limit how many matches are found. -- Must be a positive integer or Infinity matches are permitted
 * @property {Function} [renderText] arbitrary function to rewrite the matched string into something else
 * @property {Function} [onPress]
 * @property {Function} [onLongPress]
 */
/**
 * Class to encapsulate the business logic of converting text into matches & props
 */
class TextExtraction {
  /**
   * @param {String} text - Text to be parsed
   * @param {CustomParseShape[]} patterns - Patterns to be used when parsed,
   *                                 any extra attributes, will be returned from parse()
   */
  constructor(text, patterns, tagIndexArray, tagStyle) {
    this.text = text;
    this.patterns = patterns || [];
    this.tagIndexArray = tagIndexArray || {};
    this.tagStyle = tagStyle;
  }

//thia will style the tags present in text even while typing
  checkAndApplyEditing() {
    var tagArray = Object.keys(this.tagIndexArray);
		if(tagArray.length > 0) {
      //sort index array
			tagArray.sort((a,b) => {
				return a.split('|')[0] - b.split('|')[0]
      })
      var newParts = []
      let input = this.text
      let startIndex = 0, textLeft = '', styledText = '';
      tagArray.forEach((indexItem, i) => {
          let indexes = indexItem.split('|');
          if(startIndex === 0 && indexes[0] !== 0) {
            //some string at start
            textLeft = input.slice(startIndex, indexes[0])
            newParts.push({
              children: textLeft
            })
          }else {
            //strings between tags
            if(startIndex !== indexes[0]) {
              newParts.push({
                children: input.slice(startIndex, indexes[0])
              })
            }
          }
          //styling tag
          styledText = input.slice(indexes[0], indexes[1])
          newParts.push({
            children: styledText,
            _matched: true,
            style: this.tagStyle
          })
          //string after the tag
          startIndex = Number(indexes[1]);
          if(i === tagArray.length - 1) {
            newParts.push({
              children: input.slice(Number(indexes[1]))
            })
          }
      })
      return newParts
    }
    return [{ children: this.text }]
  }

  /**
   * Returns parts of the text with their own props
   * @public
   * @return {Object[]} - props for all the parts of the text
   */
  parse() {
    let parsedTexts = this.checkAndApplyEditing();
    this.patterns.forEach((pattern) => {
      let newParts = [];

      const tmp = pattern.nonExhaustiveModeMaxMatchCount || 0;
      const numberOfMatchesPermitted = Math.min(
        Math.max(Number.isInteger(tmp) ? tmp : 0, 0) ||
          Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
      );

      let currentMatches = 0;

      parsedTexts.forEach((parsedText) => {
        // Only allow for now one parsing
        if (parsedText._matched) {
          newParts.push(parsedText);
          return;
        }

        let parts = [];
        let textLeft = parsedText.children;
        let indexOfMatchedString = 0;

        /** @type {RegExpExecArray} */
        let matches;
        // Global RegExps are stateful, this makes it start at 0 if reused
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
        pattern.pattern.lastIndex = 0;
        while (textLeft && (matches = pattern.pattern.exec(textLeft))) {
          let previousText = textLeft.substr(0, matches.index);
          indexOfMatchedString = matches.index;

          if (++currentMatches > numberOfMatchesPermitted) {
            // Abort if we've exhausted our number of matches
            break;
          }

          parts.push({ children: previousText });

          parts.push(
            this.getMatchedPart(
              pattern,
              matches[0],
              matches,
              indexOfMatchedString,
            ),
          );

          textLeft = textLeft.substr(matches.index + matches[0].length);
          indexOfMatchedString += matches[0].length - 1;
          // Global RegExps are stateful, this makes it operate on the "remainder" of the string
          pattern.pattern.lastIndex = 0;
        }

        parts.push({ children: textLeft });

        newParts.push(...parts);
      });

      parsedTexts = newParts;
    });

    // Remove _matched key.
    parsedTexts.forEach((parsedText) => delete parsedText._matched);

    return parsedTexts.filter((t) => !!t.children);
  }

  // private

  /**
   * @protected
   * @param {ParseShape} matchedPattern - pattern configuration of the pattern used to match the text
   * @param {String} text - Text matching the pattern
   * @param {String[]} matches - Result of the RegExp.exec
   * @param {Integer} index - Index of the matched string in the whole string
   * @return {Object} props for the matched text
   */
  getMatchedPart(matchedPattern, text, matches, index) {
    let props = {};

    Object.keys(matchedPattern).forEach((key) => {
      if (
        key === 'pattern' ||
        key === 'renderText' ||
        key === 'nonExhaustiveModeMaxMatchCount'
      ) {
        return;
      }

      if (typeof matchedPattern[key] === 'function') {
        // Support onPress / onLongPress functions
        props[key] = () => matchedPattern[key](text, index);
      } else {
        // Set a prop with an arbitrary name to the value in the match-config
        props[key] = matchedPattern[key];
      }
    });

    let children = text;
    if (
      matchedPattern.renderText &&
      typeof matchedPattern.renderText === 'function'
    ) {
      children = matchedPattern.renderText(text, matches);
    }

    return {
      ...props,
      children: children,
      _matched: true,
    };
  }
}

export default TextExtraction;
