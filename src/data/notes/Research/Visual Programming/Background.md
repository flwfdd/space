---
title: 
description: 研究背景与定位
tags: []
img: 
publish: true
created: 2025-07-16 21:03:40
updated: 2025-07-16 22:32:03
---
## 背景

### Visual Programming

传统的一堆

LLMOps 的一堆

类 Agent 的一堆

### Mixed Programming Paradigm

[Low-Code Programming Models](http://arxiv.org/abs/2205.02282)
无敌相关。从可视化、演示、自然语言编程出发讨论低代码编程模型。短小精悍地指出了很多核心观点：不同编程范式混合可以视作 MVC 应用于 DSL、多种编程范式需要融合、AI 在其过程中的重要性、制作低代码工具的低代码工具（元工具）。


[Extending Jupyter with Multi-Paradigm Editors](https://dl.acm.org/doi/10.1145/3660247)
非常相关。讨论了多种编程范式，最终通过一个 Notebook + VS Code 插件，实现和流式编程的双向映射。实验先是单向，然后双向，也提到了不同编程范式的使用模式。


[mage: Fluid Moves Between Code and Graphical Work in Computational Notebooks](http://arxiv.org/abs/2009.10643)
在 Notebook 中开发了一套扩展 API，使得代码和图形化界面可以双向编辑。面向通用，开发者需要实现工具。参考文献中有很多其他基于 Notebook 混合编程范式的工作，但基本上都是面向特定领域的。

面向用户：专业数据工作者


[Block-based or graph-based? Why not both? Designing a hybrid programming environment for end-users](https://academic.oup.com/iwc/advance-article/doi/10.1093/iwc/iwaf028/8151473)
唱反调的。通过实验说明基于块的编程环境优于块和图混合的编程环境，尽管用户主观上更喜欢混合的。有一百多个用户，可以再看下实验部分。
