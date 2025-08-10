// Auth status panel - returns HTML for the auth section
// This follows the One True Way - server renders based on cookie

export async function handleAuthStatusPanel(request, env) {
  const origin = request.headers.get('Origin') || 'https://music.navicore.tech';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
  
  // Import requireAuth from auth.mjs
  const { requireAuth } = await import('./auth.mjs');
  
  // Check if user is authenticated
  const user = await requireAuth(request, env);
  
  let html;
  
  if (user) {
    // Authenticated - show user info and logout button
    html = `
      <div class="flex items-center gap-3 mb-4">
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-8">
            <span class="text-xs">${user.display_name.charAt(0).toUpperCase()}</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold">${user.display_name}</div>
          <div class="text-xs opacity-60">${user.email}</div>
        </div>
      </div>
      <form hx-post="https://api.navicore.tech/auth/logout"
            hx-trigger="submit"
            hx-swap="none">
        <button type="submit" class="btn btn-ghost btn-sm w-full">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
          </svg>
          Sign Out
        </button>
      </form>
    `;
  } else {
    // Not authenticated - show login/register buttons
    html = `
      <a href="#login" 
         hx-get="/templates/login" 
         hx-target="#main-content" 
         hx-push-url="#login"
         class="btn btn-primary btn-sm w-full mb-2">
        Sign In
      </a>
      <a href="#register" 
         hx-get="/templates/register" 
         hx-target="#main-content" 
         hx-push-url="#register"
         class="btn btn-ghost btn-sm w-full">
        Create Account
      </a>
    `;
  }
  
  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html'
    }
  });
}