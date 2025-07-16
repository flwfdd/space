---
title: 
description: 还不知道放在哪的东西
tags: []
img: 
publish: true
created: 2025-07-16 21:03:45
updated: 2025-07-16 22:32:17
---
## 快捷方式

[论文提交要求](https://chi2026.acm.org/authors/papers/)

[论文格式要求](https://chi2026.acm.org/chi-publication-formats/)

## Related Works

InstructPipe 就分了 Visual Programming 和 Interactive Systems with LLMs

主要是 VP 本身相关工作太少，如果分传统VP和AI+VP就太碎了

一些可能的分类方向：

- Code Agent：如 Copilot，对用户来说解释性不足
- Visual Programming：编辑空间受限，AI 智能化不足
- Human-AI Interaction：还得进一步细化，而且这么组织的话完全就是和 InstructPipe 一样了
- LLMOps：ChainBuddy 等面向 LLM 流程的

## Contribution

### 渐进式可视化编程交互

多粒度交互接口：自然语言、基于拖拽的可视化编程、节点内代码、传统编程

核心思想：不同的开发阶段适合不同的抽象层次，不同背景的人有不同的偏好

单论可视化编程系统：

- 面向通用
- 强类型系统、自动校验：AI 接入友好
- 丰富调试功能
- 子模块封装

但难以提炼出高层次的思想，都是一些功能优化组成的，而且 Dify 已经做到顶了

### 可视化编程全生命周期 Agent

设计、构建、编辑、调试、分析

上下文智能感知

### 交互迭代范式

可能是一些比较虚的东西？

AI 编程的套路是否已经研究的差不多了，还能有什么新东西吗？

## Experiment

需要探索的问题：

- Agent 的有效性，不仅是构建，更是编辑、调试，这个比较好做
- 多粒度交互的有效性，要说明 1 + 1 > 2，同一个任务分别限制用一种交互方式
- 面向不同背景用户的有效性

两组用户 AB，两个任务甲乙，分别包含创建任务和修改任务

A 创建甲（有 AI），B 创建乙（无 AI），然后交换编辑，A 编辑乙（无 AI），B 编辑甲（有 AI）
