// Cloudflare Pages Function: /api/health
// 健康检查接口

export async function onRequestGet(context) {
  const { env } = context;
  return Response.json({
    ok: true,
    name: 'Jakob的工作台云端同步服务',
    authEnabled: Boolean(env.APP_PASSWORD)
  });
}
