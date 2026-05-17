# 🔮 风水AI · Cyber Feng Shui Advisor

一个面向年轻人的轻量级AI风水室内设计助手。

## 功能

- 🏠 **2D房间规划** — 拖拽家具摆放，调整房间大小
- 🧭 **罗盘方位** — 设置朝向，显示东南西北和八卦方位
- 🚪 **门窗管理** — 添加门/窗并自动吸附墙壁
- 📷 **照片分析** — 上传真实房间照片，AI直接看图分析风水
- 🎨 **效果图生成** — 通过DALL-E 3生成理想房间效果图
- 💬 **AI对话** — 描述你的困惑，获得个性化风水建议

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 http://localhost:5173

### 3. 构建生产版本

```bash
npm run build
```

## 技术栈

- **框架**: React 18 + Vite
- **AI对话 & 图片分析**: Claude API (Anthropic)
- **效果图生成**: DALL-E 3 (OpenAI, 可选)

## API说明

- **Claude API**: 已通过 claude.ai 集成，无需额外配置
- **OpenAI API**: 仅效果图生成功能需要，在界面中临时输入Key即可（不会被存储）

## 项目结构

```
fengshui-app/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx      # React 入口
    ├── App.jsx       # 主组件
    └── index.css     # 全局样式
```
