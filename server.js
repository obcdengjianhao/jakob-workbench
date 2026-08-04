import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const appPassword = process.env.APP_PASSWORD || '';
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'workbench-state.json');

app.use(express.json({ limit: process.env.JSON_LIMIT || '50mb' }));

function requirePassword(req, res, next) {
  if (!appPassword) return next();

  const token = req.get('x-workbench-token') || '';
  if (token === appPassword) return next();

  res.status(401).json({
    ok: false,
    error: '需要访问密码'
  });
}

async function readState() {
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.tasks) || !Array.isArray(data.projects)) {
      throw new Error('数据格式不完整');
    }
    return data;
  } catch {
    return {
      tasks: [],
      projects: [],
      updatedAt: ''
    };
  }
}

async function writeState(data) {
  if (!Array.isArray(data.tasks) || !Array.isArray(data.projects)) {
    throw new Error('数据格式不完整');
  }

  const nextState = {
    tasks: data.tasks,
    projects: data.projects,
    updatedAt: new Date().toISOString()
  };

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(nextState, null, 2), 'utf8');
  return nextState;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    name: '配方研发工作台云端同步服务',
    authEnabled: Boolean(appPassword)
  });
});

app.get('/api/state', requirePassword, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await readState());
});

app.post('/api/state', requirePassword, async (req, res) => {
  try {
    const data = await writeState(req.body);
    res.json({ ok: true, updatedAt: data.updatedAt });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: '0',
  setHeaders(res) {
    res.set('Cache-Control', 'no-store');
  }
}));

app.get('/', (req, res) => {
  res.redirect('/mobile-workbench-app/');
});

app.listen(port, () => {
  console.log(`配方研发工作台云端版已启动：http://localhost:${port}`);
});
