---
workflow: general-video
flow: automation
storyboard: no
message: "Signal Garden 每天从全网几千个新项目里，自动筛出真正值得打开的 10 个"
destination: embed
aspect: "16:9"
length: 20
language: zh
music: original score (assets/audio/compose.py)
---

## Intent
20 秒、无配音、无音乐。只靠画面让人看懂产品：全网噪音 → 自动扫描与过滤 → 今日 10 个信号 → 品牌收束。
用户原话："不要配音 仅靠画面就让别人知道这个是干什么的"。用户授权自行规划技术方案。

## Customizations
- 背景用 Three.js 粒子信号场（确定性、由时间驱动），前景 DOM + GSAP 排版。
- 所有数字与项目名来自本地数据库真实快照（2026-09-29 榜单，7,835 个已采集项目）。
- 视觉沿用 V3 艺术指导：黑曜玻璃、Instrument Serif 大标题、IBM Plex Mono 系统层、六色分类光。
