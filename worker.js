/**
 * Jakob工作台 - Cloudflare Worker
 * 提供静态文件服务 + API同步接口
 */

const DEFAULT_STATE = {
  tasks: [],
  projects: [],
  updatedAt: ''
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-workbench-token',
};

function checkPassword(request, env) {
  if (!env.APP_PASSWORD) return true;
  const token = request.headers.get('x-workbench-token') || '';
  return token === env.APP_PASSWORD;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API routes
    if (path.startsWith('/api/')) {
      // Health check
      if (path === '/api/health' && request.method === 'GET') {
        return jsonResponse({
          ok: true,
          name: 'Jakob的工作台云端同步服务',
          authEnabled: Boolean(env.APP_PASSWORD)
        });
      }

      // State sync
      if (path === '/api/state') {
        if (!checkPassword(request, env)) {
          return jsonResponse({ ok: false, error: '需要访问密码' }, 401);
        }

        if (request.method === 'GET') {
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
            return jsonResponse(DEFAULT_STATE);
          } catch (error) {
            return jsonResponse(DEFAULT_STATE);
          }
        }

        if (request.method === 'POST') {
          try {
            const body = await request.json();

            if (!Array.isArray(body.tasks) || !Array.isArray(body.projects)) {
              return jsonResponse({ ok: false, error: '数据格式不完整' }, 400);
            }

            const nextState = {
              tasks: body.tasks,
              projects: body.projects,
              updatedAt: new Date().toISOString()
            };

            const serialized = JSON.stringify(nextState);

            if (serialized.length > 24 * 1024 * 1024) {
              return jsonResponse({ ok: false, error: '数据过大，请减少附件后重试' }, 413);
            }

            await env.WORKBENCH_STATE.put('state', serialized);

            return jsonResponse({ ok: true, updatedAt: nextState.updatedAt });
          } catch (error) {
            return jsonResponse({ ok: false, error: error.message || '服务器错误' }, 500);
          }
        }
      }

      // Unknown API route
      return jsonResponse({ ok: false, error: 'Not found' }, 404);
    }

    // Root redirect to mobile app
    if (path === '/') {
      return Response.redirect(new URL('/mobile-workbench-app/', url).toString(), 302);
    }

    // Static files - use ASSETS binding
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
