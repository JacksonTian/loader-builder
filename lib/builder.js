'use strict';

// 仅在构建时使用，运行时无需引入
var crypto = require('crypto');
var util = require('util');
var path = require('path');
var fs = require('fs');
var transform = require('./transform');
var colors = require('colors');
// 用于保存编译后的结果，避免重复编译
var cache = {};

var md5 = function (content) {
  var md5 = crypto.createHash('md5');
  var hash = md5.update(content).digest('hex').slice(24);
  return hash;
};

exports.scanImg = function (view) {
  var patt = /Loader\.img\([\s\S]*?\)/gm;
  var argPatt = /Loader\.img\(['"]([^'"]+)['"][^\)]*?\)/g;

  var retVal = [];

  var block;
  while ((block = patt.exec(view)) !== null) {
    var find = block[0];
    if (find) {
      var arg;
      while ((arg = argPatt.exec(find)) !== null) {
        var src = arg[1];
        retVal.push({target: src, assets: [src]});
      }
    }
  }
  return retVal;
};

/**
 * 扫描文本中的静态资源部分，提取出目标路径和文件列表。
 * 结果如下：
 * ```
 * [
 *   {target: "x.js", assets:["path1", "path2"]},
 *   {target: "x.css", assets:["path1", "path2"]}
 * ]
 * ```
 * @param {String} view view html code
 */
exports.scan = function (view) {
  var reg = /Loader\([\s\S]*?\.done\(.*\)/gm;
  var argReg = /Loader\(['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?\)/g;
  var jsReg = /.js\(['"](.*?)['"]\)/g;
  var cssReg = /.css\(['"](.*?)['"]\)/g;

  var retVal = [];

  var block;
  while ((block = reg.exec(view)) !== null) {
    var find = block[0];
    if (find) {
      var arg;
      var target = {};
      while ((arg = argReg.exec(find)) !== null) {
        target[path.extname(arg[1])] = arg[1];
        if (arg[2]) {
          target[path.extname(arg[2])] = arg[2];
        }
      }

      var jsAssets = [];
      var js;
      while ((js = jsReg.exec(find)) !== null) {
        jsAssets.push(js[1]);
      }
      if (jsAssets.length) {
        if (!target[".js"]) {
          throw new Error("Must specfic key(.js) in block:\n" + block);
        }
        retVal.push({target: target[".js"], assets: jsAssets});
      }

      var cssAssets = [];
      var css;
      while ((css = cssReg.exec(find)) !== null) {
        cssAssets.push(css[1]);
      }
      if (cssAssets.length) {
        if (!target[".css"]) {
          throw new Error("Must specfic key(.css) in block:\n" + block);
        }
        retVal.push({target: target[".css"], assets: cssAssets});
      }
    }
  }

  return retVal;
};

/**
 * 根据传入映射关系数组和指定的基本目录地址，调用uglifyjs和cleancss压缩文本
 * 并生成带MD5签名的压缩文件，以及一个debug文件
 * ```
 * [
 *   {target: "x.js", assets:["path1", "path2"]},
 *   {target: "x.css", assets:["path1", "path2"]}
 * ]
 * =>
 * [
 *   {target: "x.js", min: "x.hash.js", debug: "x.hash.debug.js",
 *      assets:["path1", "path2"]},
 *   {target: "x.css", min: "x.hash.css", debug: "x.hash.debug.css",
 *      assets:["path1", "path2"]}
 * ]
 * ```
 * @param {String} basedir 基本目录路径
 * @param {Array} arr 静态资源数组
 */
exports.minify = function (basedir, arr) {
  arr.forEach(function (item, index) {
    var start = new Date();
    console.log(colors.green('Building...'), colors.green(item.target));
    var target = item.target;
    var ext = path.extname(item.target);
    var extname = path.extname(target);
    var basename = path.basename(target, extname);
    var dir = path.dirname(target);
    var format = '%s/%s.%s.%s%s'; // {dir}/{basename}.{hash}.{version}{extname}

    if (ext !== '.js' && ext !== '.css') {
      var file = fs.readFileSync(path.join(basedir, item.target));
      var hashed = md5(file);
      item.min = util.format('%s/%s.%s%s', dir, basename, hashed, extname);
      fs.writeFileSync(path.join(basedir, item.min), file);
      return;
    }

    // combo
    var content = "";
    var minified = "";
    item.assets.forEach(function (asset) {
      var startAt = new Date();
      process.stdout.write(colors.yellow('\tprocessing... ' + asset));
      var cached = cache[asset];
      // 编译，压缩
      if (!cached) {
        var file = path.join(basedir, asset);
        var text = fs.readFileSync(file, 'utf-8');
        var extname = path.extname(file);
        if (extname === '.less') {
          text = transform.transformLess(text);
        } else if (extname === '.styl') {
          text = transform.transformStylus(text);
        } else if (extname === '.coffee') {
          text = transform.transformCoffee(text);
        }
        var transformed;
        // transformed
        try {
          if (asset.indexOf('.min.js') === asset.length - 7 ||
            asset.indexOf('.min.css') === asset.length - 8) {
            transformed = text;
            process.stdout.write(' ..minified');
          } else if (extname === ".js" || extname === '.coffee') {
            transformed = transform.transformScript(text);
            process.stdout.write(' ..build');
          } else {
            transformed = transform.transformStyle(text);
            process.stdout.write(' ..build');
          }
        } catch (ex) {
          var message = [
            '\t✘ Error! File:' + asset,
            '\t\tLine: ' + ex.line,
            '\t\tCol: ' + ex.col
          ];
          console.log(colors.red(message.join('\n')));
          ex.message = util.format('Compress %s has error:\n', asset) + ex.message;
          throw ex;
        }
        cache[asset] = {
          text: text + '\n',
          minified: transformed + '\n'
        };
        cached = cache[asset];
      } else {
        process.stdout.write(' ..cached');
      }
      process.stdout.write(' .. use ' + (new Date() - startAt) + 'ms.\n');

      minified += cached.minified;
      // debug
      content += cached.text;
    });

    // add hash
    var hash = md5(minified);
    item.min = util.format(format, dir, basename, hash, 'min', extname);
    item.debug = util.format(format, dir, basename, hash, 'debug', extname);

    // 写入压缩的文件和debug版本的文件
    fs.writeFileSync(path.join(basedir, item.min), minified);
    fs.writeFileSync(path.join(basedir, item.debug), content);
    var end = new Date();
    console.log(colors.green('✔ Done.'), colors.gray('Build time'), colors.cyan(end - start), colors.gray('ms.'));
  });
  // clean cache
  cache = {};
  return arr;
};

/**
 * 将压缩生成的文件映射关系转换为map
 * ```
 * [
 *   {target: "x.js", min: "x.hash.js", debug: "x.hash.debug.js",
 *      assets:["path1", "path2"]},
 *   {target: "x.css", min: "x.hash.css", debug: "x.hash.debug.css",
 *      assets:["path1", "path2"]}
 * ]
 * =>
 * {
 *   "x.js": "x.hash.js",
 *   "x.css": "x.hash.css"
 * }
 * ```
 * @param {Array} arr 压缩生成的映射关系数组
 */
exports.map = function (arr) {
  var map = {};
  arr.forEach(function (item) {
    map[item.target] = item.min;
  });
  return map;
};

/**
 * 扫描指定目录，生成合并压缩映射关系数组
 * 生成结构如下：
 * ```
 * [
 *   {target: "x.js", assets:["path1", "path2"]},
 *   {target: "x.css", assets:["path1", "path2"]}
 * ]
 * ```
 * @param {String} dirpath The dir path
 */
exports.scanDir = function (dirpath) {
  var views = fs.readdirSync(dirpath).sort();
  var combo = [];

  views = views.filter(function (val, index) {
    return ['.DS_Store', '.svn', '.git'].indexOf(val) === -1;
  });

  views.forEach(function (filename, index) {
    var realPath = path.join(dirpath, filename);
    var stat = fs.statSync(realPath);
    if (stat.isFile()) {
      var section = fs.readFileSync(realPath, "utf8");
      combo = combo.concat(exports.scan(section));
      combo = combo.concat(exports.scanImg(section));
    } else if (stat.isDirectory()) {
      combo = combo.concat(exports.scanDir(realPath));
    }
  });

  return combo;
};
