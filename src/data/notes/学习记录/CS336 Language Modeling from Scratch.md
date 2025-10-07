---
title:
description:
tags: []
img:
publish: true
created: 2025-09-21 00:15:02
updated: 2025-10-06 20:36:53
---
官网：[Stanford CS336 | Language Modeling from Scratch](https://stanford-cs336.github.io/spring2025/)
B 站：[大模型课程（中英字幕完结）斯坦福CS336：从头开始构建大模型](https://www.bilibili.com/video/BV18ntqzrELM/)

# Assignment 1

一份问答题参考：[mattreed.com/projects/lm-from-scratch/architecture.pdf](https://www.mattreed.com/projects/lm-from-scratch/architecture.pdf)

## BPE (Byte Pair Encoding 分词器)
Andrej Karpathy 有一个 Let's build the GPT Tokenizer

有两种容易想到的分词方法，一种是将所有词作为词典，但没有办法穷尽所有词；另一种是将字节作为词典，但这样会导致序列过长，模型难以学习。BPE 介于两者之间，通过学习的方式合并常见的字节对，从而得到一个既能表示常见词又不会导致序列过长的分词器。感觉比较像哈夫曼编码。

###  Pre-tokenization

有一些词我们不希望它们被拆分，或者不希望它们被合起来。例如 special token `<|endoftext|>`不应该被拆分，而 `cat!` 也不应该被合并（这会导致出现一大堆 `cat` 相关的冗余词）。总结来说就是两部分处理：
1. Special tokens：它们应该直接加入词表然后隐藏，不参与之后的切分。这也可以便于分块然后进行并行处理。
2. 标点符号和前后缀等：需要将标点符号和单词分开，防止它们被合并。包括但不限于：`'s`、标点符号、前导空格等等。可以通过一个正则表达式 `r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""` 配合 `regex.finditer` 来实现，切分后的结果我称为 word。

例如：`"Hello, world!<|endoftext|>It's a beautiful day."` 会被预处理成 `["Hello", ",", " world", "!", "It", "'s", " a", " beautiful", " day", "."]`。

这部分是可以并行的，统计词频再合并即可。

然后可以先做一遍合并计数，得到类似 `{([H, e, l, l, o], 1), ...}` 的结果。

### Merges

统计所有相邻的词对，假设有预分词后的 `{([a, b, c, d], 1), ...}`，配对得到 `{ab: 1, bc: 2, cd: 1}`，然后找出最多的词对进行合并（数量相同就选字典序最大的），加入词表，同时更新所有的计数。例如如果选了 `bc`，那么原来的就会更新为 `{([a, bc, d], 1), ...}`，然后不断迭代，直到词表数量达到上限。

这个过程中可以发现，当进行合并时，大部分相邻词对其实并没有改变，有改变的只有：去掉了 `ab`、`bc`、`cd`，加上了 `abc`、`bcd`，如果每轮都重复统计效率很低，因此可以考虑做一个倒查表，对于每一个相邻词对存一下包含它的语句，在这个例子中即 `abcd`。合并时，只需要遍历包含被合并词对的语句，移除旧的词对，添加新的词对即可。

最后得到词表（vocab）和合并记录（merges），形如：
```python
vocab = {
    0: b'a',
    1: b'b',
    2: b'c',
    3: b'ab',
    4: b'abc',
}
merges = [
    (b'a', b'b'),
    (b'ab', b'c'),
]
```

### Encoding & Decoding

编码是利用之前步骤得到的词表（vocab）和合并记录（merges），将文本转为 token id 列表，步骤如下：
1. 预处理文本，按照 special tokens 和 word 的正则表达式切分，与训练时不同，这里的 special tokens 需要保留并编码。
2. 对于每个 word，先将其转为字节列表，然后不断合并，直到不能再合并为止。合并时优先使用 merges 中靠前的规则。

开始实现的版本是对于每个 word，每次都从头开始遍历 merges 然后判断其是否出现过，复杂度贼高，后来加入了一个 merge 到 rank 的倒查表，每次遍历 word 中的 pair，找到 rank 最小的进行合并，由于 word 都很短效率很高。另外还加入了 `@lru_cache` 进行缓存，并且预编译了正则表达式。

处理速度在 1.5 MB/s 左右，又尝试了一下多线程，由于原本的迭代器是按行划分的，粒度太小了，多进程的开销太大，改成攒 128 KB 进行处理，8 并发可以达到 11 MB/s 左右。最后统计得到 TinyStories 上用了约 3 分钟，压缩率为 4.12；OpenWebText 上用了约 18 分钟，压缩率为 4.38。

解码就很简单了，直接将 token id 转为字节然后拼接即可。

### 坑点
- Pre-tokenization 时，对于 special tokens 应该先用它们切分成多段，然后每一段单独进行预处理，否则会出现 special tokens 前后的内容被合并的情况。
- 统计词频消耗的内存太大了，大概 12 GB 的 OpenWebText 数据要用大概 70 GB 的内存，最后分成了两阶段，先开了台大内存的服务器先把预处理做了，16 并发很快，两三分钟就完了，把词频存下来（约 93 MB），之后只需要不到 10 GB 内存，换台机器慢慢跑，大概用了三小时。