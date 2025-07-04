// Simple ZIP file parser for Cloudflare Workers
// This is a minimal implementation to read ZIP file structure

export async function parseZipFile(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const files = [];
  
  // ZIP files have entries that start with signature 0x504B0304
  const LOCAL_FILE_HEADER_SIGNATURE = 0x504B0304;
  const CENTRAL_DIRECTORY_SIGNATURE = 0x504B0102;
  
  let offset = 0;
  
  while (offset < arrayBuffer.byteLength - 4) {
    const signature = view.getUint32(offset, true);
    
    if (signature === LOCAL_FILE_HEADER_SIGNATURE) {
      // Found a file entry
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);
      const compressedSize = view.getUint32(offset + 18, true);
      
      // Extract filename
      const fileNameStart = offset + 30;
      const fileNameBytes = new Uint8Array(arrayBuffer, fileNameStart, fileNameLength);
      const fileName = new TextDecoder().decode(fileNameBytes);
      
      // Calculate where the file data starts
      const fileDataStart = fileNameStart + fileNameLength + extraFieldLength;
      
      files.push({
        name: fileName,
        compressedSize: compressedSize,
        dataOffset: fileDataStart,
        dataLength: compressedSize,
      });
      
      // Move to next entry
      offset = fileDataStart + compressedSize;
    } else if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
      // We've reached the central directory, stop parsing
      break;
    } else {
      // Move forward byte by byte to find next signature
      offset++;
    }
  }
  
  return files;
}

export function extractMetadataFromFiles(files) {
  const metadata = {
    hasMetadataFile: false,
    hasCoverArt: false,
    audioFiles: [],
    metadataFile: null,
    coverFile: null,
  };
  
  for (const file of files) {
    const nameLower = file.name.toLowerCase();
    
    // Check for metadata files
    if (nameLower === 'album.yaml' || nameLower === 'album.yml') {
      metadata.hasMetadataFile = true;
      metadata.metadataFile = file;
    } else if (nameLower === 'album.json') {
      metadata.hasMetadataFile = true;
      metadata.metadataFile = file;
    }
    
    // Check for cover art
    else if (nameLower === 'cover.jpg' || nameLower === 'cover.jpeg' || 
             nameLower === 'cover.png' || nameLower === 'album.jpg') {
      metadata.hasCoverArt = true;
      metadata.coverFile = file;
    }
    
    // Check for audio files
    else if (nameLower.endsWith('.mp3') || nameLower.endsWith('.flac') || 
             nameLower.endsWith('.ogg') || nameLower.endsWith('.m4a') || 
             nameLower.endsWith('.wav')) {
      metadata.audioFiles.push(file);
    }
  }
  
  // Sort audio files by name (to maintain track order)
  metadata.audioFiles.sort((a, b) => a.name.localeCompare(b.name));
  
  return metadata;
}

export function parseTrackInfoFromFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Try to extract track number
  const trackNumberMatch = nameWithoutExt.match(/^(\d+)[\s\-_.]/);
  const trackNumber = trackNumberMatch ? parseInt(trackNumberMatch[1]) : null;
  
  // Clean up the title
  let title = nameWithoutExt
    .replace(/^\d+[\s\-_.]*/, '') // Remove track number
    .replace(/[\-_]/g, ' ')        // Replace separators with spaces
    .replace(/\s+/g, ' ')          // Normalize spaces
    .trim();
  
  return {
    trackNumber,
    title: title || 'Untitled',
  };
}