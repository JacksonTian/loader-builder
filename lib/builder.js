'use strict';

// 仅在构建时使用，运行时无需引入
const path = require('path');
const fs = require('fs');
const transform = require('./transform');
const colors = require('colors');
const kitx = require('kitx');

var md5 = function (content) {
  return kitx.md5(content, 'hex').slice(24);
};

// Loader.file('/path/to/you/file.ext')
// =>
// {target: '/path/to/your/file.ext', type: 'file'}
exports.scanFile = function (view) {
  var patt = /Loader\.file\([\s\S]*?\)/gm;
  var argPatt = /Loader\.file\(['"]([^'"]+)['"][^\)]*?\)/g;

  var retVal = [];

  var block;
  while ((block = patt.exec(view)) !== null) {
    var find = block[0];
    if (find) {
      var arg;
      while ((arg = argPatt.exec(find)) !== null) {
        var src = arg[1];
        retVal.push({target: src, type: 'file'});
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
        if (!target['.js']) {
          throw new Error('Must specfic key(.js) in block:\n' + block);
        }
        retVal.push({target: target['.js'], type: 'js', assets: jsAssets});
      }

      var cssAssets = [];
      var css;
      while ((css = cssReg.exec(find)) !== null) {
        cssAssets.push(css[1]);
      }
      if (cssAssets.length) {
        if (!target['.css']) {
          throw new Error('Must specfic key(.css) in block:\n' + block);
        }
        retVal.push({target: target['.css'], type: 'css', assets: cssAssets});
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
  var cache = {};
  var fileCache = {};
  arr.forEach(function (item, index) {
    var start = new Date();
    console.log(colors.green('Building...'), colors.green(item.target));
    var target = item.target;
    var extname = path.extname(target);
    var basename = path.basename(target, extname);
    var dirname = path.dirname(target);

    if (item.type === 'file') {
      process.stdout.write(colors.yellow('\tprocessing... ' + item.target));
      if (!fileCache[item.target]) {
        var file = fs.readFileSync(path.join(basedir, item.target));
        var hashed = md5(file);
        item.min = `${dirname}/${basename}.${hashed}.hashed${extname}`;
        fs.writeFileSync(path.join(basedir, item.min), file);
        fileCache[item.target] = item.min;
        process.stdout.write(' ..build');
      } else {
        item.min = fileCache[item.target];
        process.stdout.write(' ..cached');
      }
      process.stdout.write(` .. use ${new Date() - start}ms.\n`);
      console.log(colors.green('✔ Done.'), colors.gray('Build time'), colors.cyan(new Date() - start), colors.gray('ms.'));
      return;
    }

    // combo
    var content = '';
    var minified = '';
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
          text = transform.transformLess(text, {filename: file});
        } else if (extname === '.styl') {
          text = transform.transformStylus(text);
        } else if (extname === '.coffee') {
          text = transform.transformCoffee(text);
        } else if (extname === '.es') {
          text = transform.transformEcmaScript(text);
        }
        var transformed;
        // transformed
        try {
          if (asset.endsWith('.min.js') ||
            asset.endsWith('.min.css')) {
            transformed = text;
            process.stdout.write(' ..minified');
          } else if (extname === '.js' || extname === '.coffee' ||
              extname === '.es') {
            transformed = transform.transformScript(text);
            process.stdout.write(' ..build');
          } else {
            // 压缩css之前，将url(img)中的图片进行优化、hash、替换
            var output = exports.processUrl(basedir, text, fileCache, item.target);
            transformed = transform.transformStyle(output);
            process.stdout.write(' ..build');
          }
        } catch (ex) {
          var message = [
            '\t✘ Error! File:' + asset,
            '\t\tLine: ' + ex.line,
            '\t\tCol: ' + ex.col
          ];
          console.log(colors.red(message.join('\n')));
          ex.message = `Compress ${asset} has error:\n` + ex.message;
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

    item.min = `${dirname}/${basename}.${hash}.min${extname}`;
    item.debug = `${dirname}/${basename}.${hash}.debug${extname}`;
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
      var section = fs.readFileSync(realPath, 'utf8');
      combo = combo.concat(exports.scan(section));
      combo = combo.concat(exports.scanFile(section));
    } else if (stat.isDirectory()) {
      combo = combo.concat(exports.scanDir(realPath));
    }
  });

  return combo;
};

exports.checkTarget = function (scaned) {
  var targets = {};
  scaned.forEach(function (item) {
    // Loader.file()可以重复
    if (item.type !== 'file' && targets.hasOwnProperty(item.target)) {
      console.warn('Duplicate target: ' + item.target);
    }
    targets[item.target] = true;
  });
};

// url(xxx);
const reg = /(url\(['"]?)([^\?)'"#]*)(.*['"]?\))/g;
exports.processUrl = function (basedir, text, fileCache, to) {
  return text.replace(reg, function (match, $1, $2, $3) {
    var target = $2;

    // ignore uri & data-uri
    if (target.startsWith('http://') ||
      target.startsWith('https://') ||
      target.startsWith('data:')) {
      return $1 + target + $3;
    }

    // convert relative path to absolute path
    if (!target.startsWith('/')) {
      target = path.resolve(path.dirname(to), target);
    }

    var cache = fileCache[target];
    if (cache) {
      return $1 + cache + $3;
    }

    var extname = path.extname(target);
    var basename = path.basename(target, extname);
    var dirname = path.dirname(target);

    var file = fs.readFileSync(path.join(basedir, target));
    var hashed = dirname + '/' + basename + '.' + md5(file) + '.hashed' + extname;
    fs.writeFileSync(path.join(basedir, hashed), file);
    fileCache[target] = hashed;
    return $1 + hashed + $3;
  });
};
