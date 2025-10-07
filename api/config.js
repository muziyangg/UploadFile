// 环境配置文件
let config = null;

// 环境判断函数
export function getEnvironment() {
  try {
    // 增强process对象检查逻辑
    if (typeof process !== 'undefined') {
      // 确认process存在后，再检查process.env
      if (process.env && process.env.VERCEL === '1') {
        // 如果 process.env.VERCEL 存在且值为 '1'，则为 Vercel 环境
        return 'vercel';
      }
    }
  } catch (error) {
    // 捕获所有可能的错误
    console.debug('无法访问 process 对象或环境变量，在浏览器环境中:', error.message);
  }
  
  // 默认返回 'local'
  return 'local';
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
  // 安全地获取环境类型，防止getEnvironment函数出错
  let env = 'local';
  try {
    env = getEnvironment();
  } catch (error) {
    console.debug('获取环境类型时出错，默认使用local环境:', error.message);
  }
  
  let currentConfig = null;
  
  try {
    // 首先确认process对象是否存在
    const isProcessAvailable = typeof process !== 'undefined';
    const isProcessEnvAvailable = isProcessAvailable && process.env;
    
    if (env === 'vercel' && isProcessEnvAvailable) {
      // Vercel 环境，从环境变量获取配置
      currentConfig = {
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
      
      // 验证从环境变量获取的配置是否有效
      if (validateConfig()) {
        console.log('成功从Vercel环境变量获取配置');
      } else {
        console.warn('从Vercel环境变量获取的配置不完整，使用默认配置');
        currentConfig = getDefaultConfig();
      }
    } else {
      // 本地环境或无法访问process对象，使用默认空值配置
      currentConfig = getDefaultConfig();
      if (!isProcessAvailable) {
        console.debug('process对象不存在，在浏览器环境中使用默认配置');
      }
    }
  } catch (error) {
    console.error('获取配置时出错:', error);
    // 确保即使出错也有默认配置可用
    currentConfig = getDefaultConfig();
  }
  
  // 不缓存配置，每次调用都返回新的配置对象
  return currentConfig;
}

// 初始化配置（异步版本）
export async function initConfig() {
  try {
    // 安全地获取环境类型
    let env = 'local';
    try {
      env = getEnvironment();
    } catch (error) {
      console.debug('获取环境类型时出错，默认使用local环境:', error.message);
    }
    
    if (env !== 'vercel') {
      // 本地环境，异步读取local-config.json
      config = await readLocalConfig();
    } else {
      // Vercel环境，使用同步配置
      config = getConfig();
    }
  } catch (error) {
    console.error('初始化配置时出错:', error);
    // 确保即使初始化失败也有默认配置可用
    config = getDefaultConfig();
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