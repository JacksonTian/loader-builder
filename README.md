loader-builder
==============
Loader's builder

用于Loader的构建器。构建器用于扫描制定目录的视图文件，将Loader语法的调用提取出来，生成资源文件的关系映射。同时还对`.less`、`.styl`、`.coffee`、`.es`格式的文件进行编译，将其转换为普通的`.js`、`.css`文件。同时还会将编译好的文件通过`uglify`/`cleancss`进行压缩。对同一个Loader标签下的js和css文件，还会将其combo成一个文件，并计算出hash。

builder完成了静态文件相关的如下操作：

- [x] 将源码翻译为原生的JavaScript和CSS，提升开发体验
- [x] 压缩JavaScript和CSS文件，减少文件体积
- [x] 合并多个文件，减少请求数量
- [x] 计算文件签名，利于增量式发布

## Loader标签
通过Loader来引入css和js的方式称为Loader标签。Builder能根据Loader/css/js/done的关键字来提取标签。

```html
{%- Loader('/assets/styles/common.min.css')
  .css('/assets/styles/reset.css')
  .css('/assets/styles/common.css')
  .css('/assets/styles/site_nav.css')
  .css('/assets/styles/color.css')
  .css('/assets/styles/jquery.autocomplete.css')
  .done()
%}
```

## 构建
为了配合Loader的使用，builder需要通过构建的方式来生成静态文件的映射。其格式如下：

```json
{
  "/assets/index.min.js":"/assets/index.min.ecf8427e.js",
  "/assets/index.min.css":"/assets/index.min.f2fdeab1.css"
}
```

如果需要线上执行，需要该对象的传入。生成方式为：

```sh
$ builder <views_dir> <output_dir>
$ # 或者
$ npm install loader-builder --save
$ ./node_modules/loader-builder/bin/builder <views_dir> <output_dir>
```

以上脚本将会遍历视图目录中寻找`Loader().js().css().done()`这样的标记，然后得到合并文件与实际文件的关系。如以上的`assets/index.min.js`文件并不一定需要真正存在，进行扫描构建后，会将相关的`js`文件进行编译和合并为一个文件。
并且根据文件内容进行md5取hash值，最终生成`/assets/index.min.ecf8427e.js`这样的文件。

遍历完目录后，将这些映射关系生成为`assets.json`文件，这个文件位于`<output_dir>`指定的目录下。使用时请正确引入该文件。

## License
The MIT license
