---
title: CS336 Language Modeling from Scratch
description:
tags: []
img:
publish: true
created: 2025-09-21 00:15:02
updated: 2025-12-07 17:35:07
---
官网：[Stanford CS336 | Language Modeling from Scratch](https://stanford-cs336.github.io/spring2025/)
B 站：[大模型课程（中英字幕完结）斯坦福CS336：从头开始构建大模型](https://www.bilibili.com/video/BV18ntqzrELM/)

# Assignment 1

一份问答题参考：[mattreed.com/projects/lm-from-scratch/architecture.pdf](https://www.mattreed.com/projects/lm-from-scratch/architecture.pdf)
我的代码实现：[flwfdd/cs336-assignment1-basics: Student version of Assignment 1 for Stanford CS336 - Language Modeling From Scratch](https://github.com/flwfdd/cs336-assignment1-basics) （虽然说不鼓励分享代码，但感觉真遇到调很久找不出来的问题还是有个参考比较好）

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

## Transformer

近年来 Transformer 的改进：
- Layer Norm 放到了 FFN 前面，不在残差连接后面的原因可能是会破坏残差连接的恒等性
- RMS Norm 和 Layer Norm 效果相近，但是 RMS Norm 计算量更少，免费提升
- 门控线性单元（如 SwiGLU）替代传统 ReLU
- RoPE 相对位置编码成为通行做法
- 超参数设置经验：
	- 线性隐藏层维度一般为模型维度的 4 倍，但如果使用 GLU，由于其包含了参数，为了使得总体参数量一致，倍率调整到 8/3=2.67 左右
	- 多头注意力中一般 num_heads * head_dim = model_dim
	- 宽高比方面一般 model_dim / num_layers = 100~200
	- 预训练中只过一轮，理论上不会有过拟合问题，dropout 没人用了，但是还有很多用权重衰减，相对于正则化，目的更多是优化损失函数值

![模型架构](assets/Pasted%20image%2020251103170256.png)

课程中强烈推荐使用声明式的向量操作，einsum、einops、einx 的区别：einsum 用于矩阵计算，einops 用于维度转换，einx 比较新希望大一统。

代码实现部分不算难，基本上只需要按照文档描述做然后跑测试就行，断断续续写了好长时间。模型参数量其实只有 17 M，存下来的 checkpoint 大概 260 MB。

训练观测部分推荐使用 [Weights & Biases](https://wandb.ai/)，写完先用 MacBook Air M2 跑了一下，用了大概两个半小时，看样子只需要 5GB 左右内存。然后整了台 H100 跑，但不管怎么调参 loss 最低也就能到 2.2 左右，远远达不到要求的 1.45，最后 AUV 您猜怎么着？拿去让 Gemini 检查了下发现是 `TransformerLM` 中的 `layers` 放在了一个普通的列表中，torch 是拿不到的，所以实际上主要的 Transformer 参数完全就没有被训练到，这居然都还能到 2.2 也是挺神奇的。改了这个之后就轻松跑到 1.5 以下了，生成了下虽然逻辑有点唐但也像模像样的。

生出来了！人生第一个小模型！

## MoE

问题：1. Infra 困难，但当不得不拆分模型，每个专家又占据一个节点的时候这变成了好事。2. 路由是不可分的。

一般 MoE 用来替换 MLP 而非 Transformer attention heads。

路由模式：一般采用 token 选择 expert，另外还有 expert 选择 token 以及全局分配。具体地，每个 token 计算出 Top-K 喜欢的 expert（k>=2，否则就没有探索性了），然后同时处理后按照亲和度加权求和。

后面又出现了分为 shared expert（不需要路由一定通过）和 fine-grained expert（隐藏层相比普通的更小从而增加 expert 数量），但 shared expert 的作用在某些研究中并不显著。

为了解决路由分配均衡问题，DeepSeek V1-2 采用的是一个单独的 loss 来优化，而 V3 采用了一个在线学习的偏移量来增加或减小某个 expert 的权重，但实际上也还是用了 loss 的。

# Assignment 2

GPU 计算模型：SM (streaming multiprocessors) 是处理器单元，有自己的缓存、控制器等；每个 SM 包含很多 SP (streaming processor) 是基本的计算单元

GPU 执行模型：SIMT（Single Instruction Multiple Thread，单指令多线程），Block、Warp、Thread。每个 Block 是一个任务组，被分配给一个 SM，其中包含很多 Thread，这些 Thread 每 32 个组成一个 Wrap 并行计算。

GPU 内存模型：寄存器（Thread 私有）、共享内存（Block 私有） / L1 缓存、L2 缓存、全局内存。

加速技巧：
- 低精度、混合精度计算
- 对于一连串操作，避免来回搬数据，一次性在 GPU 计算完再返回。
- 有时重新计算会比内存操作开销小，如简单函数的反向传播计算，可以计算反向传播时再计算一次正向的，减少存储和访存。
- 根据局部性原理内存会预加载（Burst Read），但是和 CPU 是反着的，因为有多个线程同时运行，所以应该让多个线程访问相邻的内存块，而不是单个线程使用整块的，这会导致多个线程同时读取不同的内存块。
- 分块（Tile），例如矩阵乘法，可以一次性加载小块，然后把所有相关计算结果累加到结果矩阵里。为了防止和预加载不对齐，需要进行 padding。

Benchmark：进行性能分析的前提，注意需要先跑几次 warmup，然后多次测量，以及前后使用 `torch.cuda.synchronize()` 同步 CPU 和 GPU 状态。

Profile：更细粒度地查看运行详情，可以通过 torch 自带的但粒度较大，也可以通过 NVidia 的 GUI 工具，可以发现 CPU 发送指令超前于 GPU 实际执行，中间存在一个队列。

CUDA 是用 C++ 写的，Triton 是 OpenAI 开发的一种 Python 环境下的 DSL。

All Reduce = Reduce-Scatter + All Gather
数据并行：
- 将数据分发到每台机器，每台机器都需要完整的参数（消耗大量内存），传递梯度，通信开销为两倍参数量。
- ZeRO Stage 1、2：优化器参数、梯度分片。每台机器计算完整梯度，将每部分梯度发到对应机器累积（Reduce Scatter），然后再更新到每一台机器上（All Gather）。带宽不变但节省大量内存。
- ZeRO Stage 3（FSDP）：进一步对模型参数进行分片，需要更高的通信开销。
- 批大小必须大于机器数量。
模型并行：
- 流水线并行：通信开销较小，但气泡大小也受到批大小限制。
- 张量并行：对通信要求极高，一般限于 8 卡内。
一般先张量并行，然后流水线，然后数据并行，流水线和数据并行都会消耗 batch size。


看完了第六课，暂时先跳到后训练部分。

##  Assignment 5

InstructGPT
1. SFT：利用原有 NLP 数据集、人类标注数据集等。超出模型知识的可能会损害模型（如假参考文献）。需要拒绝回复有害问题的数据。现在很多 SFT 数据也被混进了预训练的最后退火阶段。
2. RLHF：目标从拟合一个理想模型变为最大化奖励，有时机器生成的会比人工标注的更好。使用了 PPO，算法本身很复杂，人们一直在找能取代它的方法，最后找到了 DPO。存在过度优化问题，因为人类反馈是有噪声的，奖励模型不可能完全复原。

GRPO 问题：
- 除以标准差：当标准差很小时，说明问题太难活太简单，这个时候由于标准差很小，反馈会被放大，会导致不稳定。
- 长度归一化：当模型回答错误时，会倾向于增大回复长度来降低负反馈，这会导致错误回答很长，同理正确回答会变短。
GRPO 在 LLM 后才出现的原因可能是，环境就仅仅是 prompt，可以批量生成结果，而这对例如机器人无法做到。

纯 RL 的输出可能比较反人类，也就是 R1-Zero 和 R1 的区别。在 RL 之前即便极少量的 SFT 也能大大提高模型能力。

之后得好好读读 DeepSeek-R1、Kimi-K1.5、Qwen3

### Zero-shot MATH Baseline
下了数据 [qwedsacf/competition_math · Datasets at Hugging Face](https://huggingface.co/datasets/qwedsacf/competition_math)，按 6:4 把 12500 条数据划分为 7500 条训练集和 5000 条测试集（从文档里推断是这样的）。

在 AutoDL 开了个 3080 Ti，5000 条测试集跑了 6 分钟，测得结果：`{'format_reward': 0.1748, 'answer_reward': 0.0294, 'reward': 0.0294}`，还是挺低的。DeepSeek-V3.2-Exp 得到 `{'format_reward': 0.7418, 'answer_reward': 0.6088, 'reward': 0.6088}`。

发现 DeepSeek 输出的 `</think>` 和 `<answer>` 之间不一定是空格，`r1_zero_reward_fn` 会判断为错，结果是手动修复后的。又试了一次 1.5B 修复后的结果为 `{'format_reward': 0.2624, 'answer_reward': 0.0418, 'reward': 0.0418}`，还是太菜。

由于 SFT 数据也没有公开，所以把所有训练集用 DeepSeek API 跑了一遍，100 并发花了大概 30 分钟，筛出其中正确的 4271 条作为 SFT 数据。跑训练集和测试集全部加起来花了二三十元。


`tests/conftest.py` 中的 `model_id` 要替换成实际的模型路径。
