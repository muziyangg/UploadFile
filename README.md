# GitHub 文件上传工具

这是一个使用 Node.js 和 Vue 3 开发的文件上传工具，可以将文件上传到 GitHub 仓库，并自动更新上传记录的 Markdown 文件。

## 功能特性

- 支持拖放文件上传
- 支持选择多个文件同时上传
- 密码验证功能
- 上传进度显示
- 自动更新上传记录到 Markdown 文件
- 支持 Vercel 部署

## 技术栈

- Node.js
- Vue 3 (轻量版)
- Vercel
- GitHub API

## 安装和配置

### 1. 克隆项目

```bash
git clone https://github.com/your-username/github-uploader.git
cd github-uploader
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件，添加以下配置：

```
# GitHub 配置
GITHUB_USERNAME=your-github-username
GITHUB_REPO=your-github-repo
GITHUB_BRANCH=main
GITHUB_TOKEN=your-github-token
FILE_STORAGE_PATH=path/to/store/files/

# 上传密码
UPLOAD_PASSWORD=your-upload-password

# Markdown 文件配置
MD_GITHUB_USERNAME=your-github-username (可选，默认使用GITHUB_USERNAME)
MD_GITHUB_REPO=your-github-repo (可选，默认使用GITHUB_REPO)
MD_GITHUB_BRANCH=main (可选，默认使用GITHUB_BRANCH)
MD_GITHUB_TOKEN=your-github-token (可选，默认使用GITHUB_TOKEN)
MD_FILE_STORAGE_PATH=path/to/store/md/
MD_FILE_STORAGE_NAME=upload-records.md
```

## 本地开发

```bash
npm run dev
# 或
vercel dev
```

然后在浏览器中访问 `http://localhost:3000`

## 部署到 Vercel

1. 注册并登录 [Vercel](https://vercel.com/)
2. 连接 GitHub 仓库
3. 配置环境变量
4. 点击部署按钮

## 使用说明

1. 输入上传密码和上传人姓名
2. 拖放文件到上传区域或点击选择文件按钮
3. 确认文件列表无误后，点击上传按钮
4. 等待上传完成，查看上传结果

## 注意事项

- 请妥善保管 GitHub Token，不要泄露给他人
- 上传密码用于限制上传权限，请设置安全的密码
- 大文件上传可能需要较长时间，请耐心等待
- 如果上传失败，可以查看控制台错误信息进行排查

## License

MIT