# Standard Navigation Structure

All pages should use this exact navigation structure in the sidebar:

```html
<nav class="space-y-2">
    <a href="/home.html" class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-base-300 transition-colors">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
        </svg>
        <span>Home</span>
    </a>
    <a href="/" class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-base-300 transition-colors">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
        </svg>
        <span>Music</span>
    </a>
    <a href="/upload.html" class="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-base-300 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
        </svg>
        <span>Upload</span>
    </a>
</nav>
```

## Active State
Add `bg-base-300` class to the current page's link.

## Pages:
- `/home.html` - Dashboard with stats and quick actions
- `/` - Music view with search and multiple view modes (album/grid/list)
- `/upload.html` - Upload new music
- `/albums.html` - Redirects to Music view
- `/tracks.html` - Deleted (functionality merged into Music view)

## Music Features:
- Search across albums, artists, and tracks
- Three view modes:
  - Album view: Albums with expandable track lists
  - Grid view: Album covers in a grid
  - List view: All tracks in a flat table
- Inline album management with modal editing
- Play buttons to queue albums/tracks

## Future Considerations:
- Manage buttons will be hidden for non-artist visitors
- Play buttons will trigger WebAssembly audio player
- Authentication system for artist management