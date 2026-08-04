#!/usr/bin/env node
/**
 * Cloudflare Pages 部署脚本
 * 自动创建KV命名空间、初始化数据、部署到Pages
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const wranglerTomlPath = path.join(ROOT, 'wrangler.toml');
const initialStatePath = path.join(ROOT, 'data', 'workbench-state.json');

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', cwd: ROOT, ...opts }).trim();
}

function tryRun(cmd, opts = {}) {
  try { return run(cmd, opts); } catch { return null; }
}

async function main() {
  console.log('=== Jakob工作台 Cloudflare Pages 部署 ===\n');

  // Step 1: Check login
  console.log('[1/5] 检查Cloudflare登录状态...');
  const whoami = tryRun('npx wrangler whoami');
  if (!whoami || whoami.includes('not authenticated')) {
    console.log('请先运行: npx wrangler login');
    console.log('浏览器会打开Cloudflare登录页面，完成授权后重新运行此脚本。');
    process.exit(1);
  }
  console.log('已登录Cloudflare\n');

  // Step 2: Create KV namespace
  console.log('[2/5] 创建KV存储空间...');
  const kvResult = tryRun('npx wrangler kv namespace create WORKBENCH_STATE');
  let kvId = null;
  if (kvResult) {
    const match = kvResult.match(/id\s*=\s*"([a-f0-9]+)"/i);
    if (match) {
      kvId = match[1];
    }
  }
  if (!kvId) {
    // Maybe already exists, try to list
    const kvList = tryRun('npx wrangler kv namespace list');
    if (kvList) {
      try {
        const namespaces = JSON.parse(kvList);
        const found = namespaces.find(n => n.title === 'WORKBENCH_STATE');
        if (found) kvId = found.id;
      } catch {}
    }
  }
  if (!kvId) {
    console.error('无法创建或找到KV命名空间，请手动创建');
    process.exit(1);
  }
  console.log(`KV ID: ${kvId}\n`);

  // Step 3: Update wrangler.toml
  console.log('[3/5] 更新配置文件...');
  let toml = fs.readFileSync(wranglerTomlPath, 'utf8');
  toml = toml.replace('PLACEHOLDER_KV_ID', kvId);
  fs.writeFileSync(wranglerTomlPath, toml);
  console.log('wrangler.toml 已更新\n');

  // Step 4: Seed initial data
  console.log('[4/5] 初始化数据到KV...');
  if (fs.existsSync(initialStatePath)) {
    const stateData = fs.readFileSync(initialStatePath, 'utf8');
    const tmpPath = path.join(ROOT, 'tmp-seed.json');
    fs.writeFileSync(tmpPath, stateData);
    tryRun(`npx wrangler kv key put --namespace-id=${kvId} state --path="${tmpPath}"`);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    console.log('初始数据已写入KV\n');
  } else {
    console.log('跳过数据初始化（未找到初始数据文件）\n');
  }

  // Step 5: Deploy to Pages
  console.log('[5/5] 部署到Cloudflare Pages...');
  const deployResult = tryRun('npx wrangler pages deploy public --project-name=jakob-workbench --commit-message="Initial deploy"');
  console.log(deployResult);
  console.log('\n=== 部署完成！===');

  // Extract URL
  const urlMatch = deployResult?.match(/https:\/\/[^\s]+\.pages\.dev/);
  if (urlMatch) {
    console.log(`\n固定访问地址: ${urlMatch[0]}`);
    console.log(`手机端: ${urlMatch[0]}/mobile-workbench-app/`);
    console.log(`电脑端: ${urlMatch[0]}/workbench.html`);
  }
}

main().catch(e => {
  console.error('部署失败:', e.message);
  process.exit(1);
});
