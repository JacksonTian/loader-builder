'use strict';

var transform = require('../lib/transform');
var should = require('should');

describe('transform', function () {
  it('uglify/CSS should work well', function () {
    transform.transformScript('(function (a, b, c, d) {console.log(\'hello world!\');}());').should.equal('!function(o,l,n,c){console.log("hello world!")}();');
    transform.transformStyle('.foo {  float: left;}').should.equal('.foo{float:left}');
  });

  it('less should work well', function () {
    transform.transformLess('.class{width: (1 + 1)}').should.equal('.class {\n  width: 2;\n}\n');
  });

  it('less should work with exception', function () {
    (function () {
      transform.transformLess('.class{width: (1 +)}');
    }).should.throw('Expected \')\'');
  });

  it('stylus should work well', function () {
    transform.transformStylus('.class{width: (1 + 1)}').should.equal('.class {\n  width: 2;\n}\n');
  });

  it('stylus should work with exception', function () {
    (function () {
      transform.transformStylus('.class{width: (1 +)}');
    }).should.throw('stylus:1:18\n   1| .class{width: (1 +)}\n-----------------------^\n\nCannot read property \'lineno\' of undefined\n    at ".class" (stylus:2:22)\n');
  });

  it('coffee should work well', function () {
    transform.transformCoffee('foo = 1').should.equal('(function() {\n  var foo;\n\n  foo = 1;\n\n}).call(this);\n');
  });

  it('coffee should work with exception', function () {
    (function () {
      transform.transformCoffee('<foo> = bar');
    }).should.throw('unexpected <');
  });

  it('babel should work well', function () {
    transform.transformEcmaScript('var [a, b] = [1, 2];').should.equal('"use strict";\n\nvar a = 1,\n    b = 2;');
  });
});
