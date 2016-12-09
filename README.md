loader-builder
==============

- [![Dependencies Status](https://david-dm.org/JacksonTian/loader-builder.png)](https://david-dm.org/JacksonTian/loader-builder)
- [![Build Status](https://secure.travis-ci.org/JacksonTian/loader-builder.png?branch=master)](http://travis-ci.org/JacksonTian/loader-builder)
- [![Coverage Status](https://coveralls.io/repos/JacksonTian/loader-builder/badge.png)](https://coveralls.io/r/JacksonTian/loader-builder)

## Introduction

Loader's builder

用于Loader的构建器。构建器用于扫描制定目录的视图文件，将Loader语法的调用提取出来，生成资源文件的关系映射。同时还对`.less`、`.styl`、`.coffee`、`.es`格式的文件进行编译，将其转换为普通的`.js`、`.css`文件。同时还会将编译好的文件通过`uglify`/`cleancss`进行压缩。对同一个Loader标签下的js和css文件，还会将其combo成一个文件，并计算出hash。

builder完成了静态文件相关的如下操作：

- [x] 将源码翻译为原生的JavaScript和CSS，提升开发体验
  - [x] 支持less
  - [x] 支持stylus
  - [x] 支持coffee
  - [x] 支持babel
- [x] 压缩JavaScript和CSS文件，减少文件体积
  - [x] 保留debug文件，用于在线调试
- [x] 合并多个文件，减少请求数量
- [x] 计算文件签名，利于增量式发布
  - [x] 支持任意文件的引入
  - [x] 签名.css中的文件

## Loader标签
通过Loader来引入css和js的方式称为Loader标签。Builder能根据Loader/css/js/done的关键字来提取标签。

```html
<%- Loader('/assets/bootstrap-3.3.7/css/bootstrap.css', '/assets/scripts/bootstrap.js')
    .css('/assets/bootstrap-3.3.7/css/bootstrap.min.css')
    .js('/assets/scripts/lib/jquery-3.1.1.min.js')
    .js('/assets/bootstrap-3.3.7/js/bootstrap.min.js')
    .done(assets, CDN) %>

<img src="<%=Loader.file('/assets/images/logo.png').done(assets, CDN)%>" class="nav-logo">
```

## 构建

为了配合Loader的使用，builder需要通过构建的方式来生成静态文件的映射。其格式如下：

```json
{
  "/assets/images/logo.png": "/assets/images/logo.b806e460.hashed.png",
  "/assets/scripts/bootstrap.js": "/assets/scripts/bootstrap.121539c7.min.js",
  "/assets/bootstrap-3.3.7/css/bootstrap.css": "/assets/bootstrap-3.3.7/css/bootstrap.b8e0f876.min.css"
}
```

如果需要线上执行，需要该对象的传入。生成方式为：

```sh
$ builder <views_dir> <output_dir>
$ # 或者
$ npm install loader-builder --save
$ ./node_modules/.bin/builder <views_dir> <output_dir>
```

以上脚本将会遍历视图目录中寻找`Loader().js().css().done()`这样的标记，然后得到合并文件与实际文件的关系。如以上的`/assets/scripts/bootstrap.js`文件并不一定需要真正存在，进行扫描构建后，会将相关的`js`文件进行编译和合并为一个文件。并且根据文件内容进行md5取hash值，最终生成`/assets/scripts/bootstrap.121539c7.min.js`这样的文件。

遍历完目录后，将这些映射关系生成为`assets.json`文件，这个文件位于`<output_dir>`指定的目录下。使用时请正确引入该文件，并借助服务端将其传递给`.done()`函数，作为assets参数。比如：

```js
var assets = require('./assets.json');
// app.js 让assets变量在视图中可见
this.state.assets = assets;
// view.html 直接使用
<%=Loader.file('/assets/images/logo.png').done(assets)%>
// dev
// => /assets/images/logo.png
// production
// => /assets/images/logo.b806e460.hashed.png
```

## Support CDN

现在的CDN通常都具备自动回源功能，当配合CDN时，可以传入CDN前缀地址，作为`.done(assets, CDN)`的第二个参数。比如：

```js
// app.js 让CDN变量在视图中可见
this.state.CDN = 'http://cdn_domain';
// view.html 直接使用
<%=Loader.file('/assets/images/logo.png').done(assets, CDN)%>
// => http://cdn_domain/assets/images/logo.b806e460.hashed.png
```

如果不使用CDN，传入空字符串即可，表示从当前服务器拉取文件。

## Support Debug

loader-builder默认会帮助生成一个与编译合并后的文件相关的文件用于支持线上调试。比如`/assets/scripts/bootstrap.121539c7.min.js`对应的调试文件就是`/assets/scripts/bootstrap.121539c7.debug.js`。将`.min.`修改为`.debug.`即可。

通过debug文件，可以借助fiddler/anyproxy之类的HTTP请求转发工具进行对线上的代码调试。

通过添加`--no-debug`开关可以关闭debug文件的输出。如下所示：

```sh
$ builder <views_dir> <output_dir> --no-debug
```

## License
The MIT license
