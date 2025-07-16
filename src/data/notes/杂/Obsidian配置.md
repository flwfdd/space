---
title: 
description: 
tags: 
img: 
publish: "true"
created: 2025-07-16 20:15:15
updated: 2025-07-16 20:40:24
---

使用 Astro 重构了个人网站，将一个子文件夹作为笔记部分，配合 Obsidian 使用，这样就可以使用 Git 管理，同时又能够自动发布了。在此记录一些 Obsidian 相关的配置。

## 基础配置

TODO：图片管理，路径规则

## 插件

### 新建笔记模板

希望能在创建笔记时自动设置一些属性，但是又不想显式地创建一个模板，所以使用 QuickAdd 插件，创建一个 Capture，然后打开设置，在最下方的 Capture Format 中写入：

写入以下内容：
```
---
title: 
description: 
tags: []
img: 
publish: true
created: {{DATE:YYYY-MM-DD HH:mm:ss}}
updated: {{DATE:YYYY-MM-DD HH:mm:ss}}
---

```

### 自动更新时间

Update time on edit 插件可以自动更新笔记属性中的 updated 字段。

### 自动格式化

应该有挺多插件能实现类似功能的，但我主要的诉求只是在中英文间加空格。所以就选择了 Easy Typing 这个轻量级的。
