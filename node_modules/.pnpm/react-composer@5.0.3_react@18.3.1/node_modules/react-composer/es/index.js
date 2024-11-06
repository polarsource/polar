import { cloneElement } from 'react';
import PropTypes from 'prop-types';

export default function Composer(props) {
  return renderRecursive(props.children, props.components);
}

Composer.propTypes = {
  children: PropTypes.func.isRequired,
  components: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.element, PropTypes.func])).isRequired
};

/**
 * Recursively build up elements from props.components and accumulate `results` along the way.
 * @param {function} render
 * @param {Array.<ReactElement|Function>} remaining
 * @param {Array} [results]
 * @returns {ReactElement}
 */
function renderRecursive(render, remaining, results) {
  results = results || [];
  // Once components is exhausted, we can render out the results array.
  if (!remaining[0]) {
    return render(results);
  }

  // Continue recursion for remaining items.
  // results.concat([value]) ensures [...results, value] instead of [...results, ...value]
  function nextRender(value) {
    return renderRecursive(render, remaining.slice(1), results.concat([value]));
  }

  // Each props.components entry is either an element or function [element factory]
  return typeof remaining[0] === 'function' ? // When it is a function, produce an element by invoking it with "render component values".
  remaining[0]({ results: results, render: nextRender }) : // When it is an element, enhance the element's props with the render prop.
  cloneElement(remaining[0], { children: nextRender });
}