# Session Management Architecture - The One True Way

## Core Principle
**The server is the single source of truth for authentication state.** 
No client-side JavaScript should ever store, cache, or make decisions about auth state.

## Implementation

### 1. Session Storage
- **Method**: HttpOnly, Secure cookies
- **Cookie Name**: `auth_token`
- **Domain**: `.navicore.tech` (works across all subdomains)
- **Contains**: JWT token with user ID and expiration
- **Set by**: Server only, via `Set-Cookie` header
- **Cleared by**: Server only, via `Set-Cookie` with `Max-Age=0`

### 2. Authentication Flow

#### Login
1. User submits login form via HTMX (`hx-post="/auth/login"`)
2. Server validates credentials
3. Server creates JWT and sets cookie
4. Server returns `HX-Refresh: true` header
5. Browser reloads page with cookie set
6. Server renders authenticated view on reload

#### Logout
1. User clicks logout button via HTMX (`hx-post="/auth/logout"`)
2. Server clears cookie
3. Server returns `HX-Refresh: true` header
4. Browser reloads page without cookie
5. Server renders unauthenticated view on reload

#### Auth Status Check
1. Every page load sends cookies automatically
2. Server checks cookie validity
3. Server renders appropriate HTML based on auth state
4. **NO JavaScript auth checks**

### 3. HTMX Integration

#### Auth-Aware UI Components
- Server renders different HTML based on auth state
- Use HTMX attributes for auth actions:
  ```html
  <!-- Login Form -->
  <form hx-post="/auth/login" hx-refresh="true">
  
  <!-- Logout Button -->
  <button hx-post="/auth/logout" hx-refresh="true">
  
  <!-- Auth Status Panel -->
  <div hx-get="/auth/status-panel" hx-trigger="load">
  ```

#### Protected Routes
- Server checks auth on every request
- Returns 401 with login form HTML if unauthorized
- No client-side route guards

### 4. What NOT to Do

❌ **Never**:
- Store tokens in localStorage
- Store tokens in sessionStorage
- Use JavaScript to check auth status
- Use JavaScript to build auth UI
- Cache user info in JavaScript variables
- Make auth decisions client-side
- Mix JSON APIs with HTMX auth flows

✅ **Always**:
- Let server handle all auth state
- Use HTMX for all auth interactions
- Render auth UI server-side
- Trust cookies as the only auth mechanism
- Use `HX-Refresh: true` for auth state changes

### 5. Security Considerations

- Cookies are HttpOnly (not accessible to JavaScript)
- Cookies are Secure (HTTPS only)
- Cookies use SameSite=None for cross-domain API access
- JWT tokens have expiration times
- Server validates JWT on every request

### 6. Testing Auth State

To verify auth is working correctly:
1. Clear all cookies in DevTools
2. Reload page - should show logged out
3. Login via form
4. Page should reload and show logged in
5. Clear cookies again
6. Reload - should show logged out immediately

If clearing cookies doesn't log you out, there's client-side state pollution.

## Current Implementation Status

✅ Implemented:
- HttpOnly secure cookies
- JWT token generation
- Server-side auth validation
- HTMX login form

❌ Needs Fixing:
- Remove JavaScript `checkAuthStatus()` function
- Remove client-side auth state rendering
- Implement server-rendered auth status panel
- Fix logout to use pure HTMX
- Remove all localStorage/sessionStorage auth code