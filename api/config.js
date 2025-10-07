// 环境配置文件
let config = null;

// 环境判断函数
export function getEnvironment() {
  try {
    // 尝试访问 process 对象
    if (typeof process !== 'undefined' && process.env && process.env.VERCEL === '1') {
      // 如果 process.env.VERCEL 存在且值为 '1'，则为 Vercel 环境
      return 'vercel';
    }
  } catch (error) {
    // 访问 process 对象失败，说明在浏览器环境中
    console.debug('无法访问 process 对象，在浏览器环境中');
  }
  
  // 默认返回 'local'
  return 'vercel';
}

// 从local-config.json文件读取配置
export async function readLocalConfig() {
  try {
    // 在浏览器环境中使用fetch API读取文件
    const response = await fetch('../local-config.json');
    if (response.ok) {
      const localConfig = await response.json();
      return localConfig;
    } else {
      console.warn('无法读取local-config.json文件，使用默认空值配置');
      return getDefaultConfig();
    }
  } catch (error) {
    console.warn('读取local-config.json文件时出错，使用默认空值配置:', error);
    return getDefaultConfig();
  }
}

// 获取默认空值配置
function getDefaultConfig() {
  return {
    GITHUB_USERNAME: '',
    GITHUB_REPO: '',
    GITHUB_BRANCH: 'main',
    GITHUB_TOKEN: '',
    FILE_STORAGE_PATH: 'src/upload/assets/',
    UPLOAD_PASSWORD: '',
    MD_GITHUB_USERNAME: '',
    MD_GITHUB_REPO: '',
    MD_GITHUB_BRANCH: 'main',
    MD_GITHUB_TOKEN: '',
    MD_FILE_STORAGE_PATH: 'content/post/',
    MD_FILE_STORAGE_NAME: '上传文件记录.md'
  };
}

// 获取配置信息（同步版本，用于非异步场景）
export function getConfig() {
  if (config) return config;
  
  const env = getEnvironment();
  
  if (env === 'vercel') {
    // Vercel 环境，从环境变量获取配置
    config = {
      GITHUB_USERNAME: process.env.GITHUB_USERNAME || '',
      GITHUB_REPO: process.env.GITHUB_REPO || '',
      GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
      FILE_STORAGE_PATH: process.env.FILE_STORAGE_PATH || 'src/upload/assets/',
      UPLOAD_PASSWORD: process.env.UPLOAD_PASSWORD || '',
      MD_GITHUB_USERNAME: process.env.MD_GITHUB_USERNAME || '',
      MD_GITHUB_REPO: process.env.MD_GITHUB_REPO || '',
      MD_GITHUB_BRANCH: process.env.MD_GITHUB_BRANCH || 'main',
      MD_GITHUB_TOKEN: process.env.MD_GITHUB_TOKEN || '',
      MD_FILE_STORAGE_PATH: process.env.MD_FILE_STORAGE_PATH || 'content/post/',
      MD_FILE_STORAGE_NAME: process.env.MD_FILE_STORAGE_NAME || '上传文件记录.md'
    };
  } else {
    // 本地环境，使用默认空值配置
    // 注意：在实际应用中，应在初始化时调用readLocalConfig()来异步加载配置
    config = getDefaultConfig();
  }
  
  return config;
}

// 初始化配置（异步版本）
export async function initConfig() {
  const env = getEnvironment();
  
  if (env !== 'vercel') {
    // 本地环境，异步读取local-config.json
    config = await readLocalConfig();
  } else {
    // Vercel环境，使用同步配置
    config = getConfig();
  }
  
  return config;
}

// 验证配置是否完整
export function validateConfig() {
  const config = getConfig();
  
  // 文件上传相关的必填字段
  const fileUploadFields = [
    'GITHUB_USERNAME',
    'GITHUB_REPO',
    'GITHUB_TOKEN',
    'FILE_STORAGE_PATH',
    'UPLOAD_PASSWORD'
  ];
  
  // MD文件更新相关的必填字段
  const mdFileFields = [
    'MD_GITHUB_USERNAME',
    'MD_GITHUB_REPO',
    'MD_GITHUB_TOKEN',
    'MD_FILE_STORAGE_PATH',
    'MD_FILE_STORAGE_NAME'
  ];
  
  // 检查文件上传配置
  const missingFileUploadFields = fileUploadFields.filter(field => !config[field]);
  if (missingFileUploadFields.length > 0) {
    console.error('缺少文件上传必要的配置字段:', missingFileUploadFields);
    return false;
  }
  
  // 检查MD文件更新配置
  const missingMdFileFields = mdFileFields.filter(field => !config[field]);
  if (missingMdFileFields.length > 0) {
    console.error('缺少MD文件更新必要的配置字段:', missingMdFileFields);
    return false;
  }
  
  return true;
}