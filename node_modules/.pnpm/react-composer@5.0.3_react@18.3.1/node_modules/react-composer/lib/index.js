'use strict';

exports.__esModule = true;
exports.default = Composer;

var _react = require('react');

var _propTypes = require('prop-types');

var _propTypes2 = _interopRequireDefault(_propTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function Composer(props) {
  return renderRecursive(props.children, props.components);
}

Composer.propTypes = {
  children: _propTypes2.default.func.isRequired,
  components: _propTypes2.default.arrayOf(_propTypes2.default.oneOfType([_propTypes2.default.element, _propTypes2.default.func])).isRequired
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
  remaining[0]({ results, render: nextRender }) : // When it is an element, enhance the element's props with the render prop.
  (0, _react.cloneElement)(remaining[0], { children: nextRender });
}