'use strict';

const uglify = require('uglify-js');
const Cleaner = require('clean-css');
const less = require('less');
const stylus = require('stylus');
const coffee = require('coffee-script');
const babel = require('babel-core');

/**
 * 调用uglifyjs模块压缩脚本文件
 * @param {String} input JavaScript source code
 */
exports.transformScript = function (input) {
  var result = uglify.minify(input, {fromString: true});
  return result.code;
};

exports.transformEcmaScript = function (input) {
  var result = babel.transform(input, {presets: ['es2015']});
  return result.code;
};

/**
 * 调用clean css模块压缩样式表文件
 * @param {String} input CSS source code
 */
exports.transformStyle = function (input) {
  return new Cleaner().minify(input).styles;
};

/**
 * 调用less模块编译less文件到CSS内容
 * @param {String} input JavaScript source code
 */
exports.transformLess = function (input, options) {
  var output;
  less.render(input, options, function (err, css) {
    if (err) {
      throw err;
    }
    output = css;
  });
  return output.css;
};

/**
 * 调用stylus模块编译stylus文件到CSS内容
 * @param {String} input JavaScript source code
 */
exports.transformStylus = function (input) {
  var output;
  stylus(input).render(function (err, css) {
    if (err) {
      throw err;
    }
    output = css;
  });
  return output;
};

/**
 * 调用coffee-script模块编译coffee文件到JS内容
 * @param {String} input JavaScript source code
 */
exports.transformCoffee = function (input) {
  return coffee.compile(input);
};
