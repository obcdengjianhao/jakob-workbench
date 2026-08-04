// Cloudflare Pages Function: /api/state
// 处理工作台数据的读取和同步

const DEFAULT_STATE = {
  tasks: [],
  projects: [],
  updatedAt: ''
};

function checkPassword(request, env) {
  if (!env.APP_PASSWORD) return true;
  const token = request.headers.get('x-workbench-token') || '';
  return token === env.APP_PASSWORD;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-workbench-token',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestGet(context) {
  const { env, request } = context;

  if (!checkPassword(request, env)) {
    return json({ ok: false, error: '需要访问密码' }, 401);
  }

  try {
    const data = await env.WORKBENCH_STATE.get('state');
    if (data) {
      return new Response(data, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          ...corsHeaders
        }
      });
    }
    return json(DEFAULT_STATE);
  } catch (error) {
    return json(DEFAULT_STATE);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;

  if (!checkPassword(request, env)) {
    return json({ ok: false, error: '需要访问密码' }, 401);
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body.tasks) || !Array.isArray(body.projects)) {
      return json({ ok: false, error: '数据格式不完整' }, 400);
    }

    const nextState = {
      tasks: body.tasks,
      projects: body.projects,
      updatedAt: new Date().toISOString()
    };

    const serialized = JSON.stringify(nextState);

    // KV 单值上限 25MB，检查数据大小
    if (serialized.length > 24 * 1024 * 1024) {
      return json({ ok: false, error: '数据过大，请减少附件后重试' }, 413);
    }

    await env.WORKBENCH_STATE.put('state', serialized);

    return json({ ok: true, updatedAt: nextState.updatedAt });
  } catch (error) {
    return json({ ok: false, error: error.message || '服务器错误' }, 500);
  }
}
