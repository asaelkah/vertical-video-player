/**
 * Video Caching Hook for Web
 * 
 * Uses the browser's Cache API to store videos locally.
 * - First view: Streams from network, caches in background
 * - Subsequent views: Serves from local cache (instant playback)
 */

import { useState, useEffect, useRef } from 'react';

const CACHE_NAME = 'mmvp-video-cache-v1';

// In-memory cache for blob URLs (faster than Cache API lookups)
const blobUrlCache = new Map<string, string>();

// Track which videos are currently being cached
const cachingInProgress = new Set<string>();

/**
 * Check if Cache API is available
 */
const isCacheApiAvailable = () => {
  return typeof caches !== 'undefined';
};

/**
 * Generate a cache key from URL
 */
const getCacheKey = (url: string): string => {
  // Normalize URL and remove query params for consistent caching
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.pathname;
  } catch {
    return url;
  }
};

/**
 * Try to get video from cache
 */
const getFromCache = async (url: string): Promise<string | null> => {
  // First check in-memory blob cache (fastest)
  const cacheKey = getCacheKey(url);
  if (blobUrlCache.has(cacheKey)) {
    return blobUrlCache.get(cacheKey)!;
  }

  // Then check Cache API
  if (!isCacheApiAvailable()) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    
    if (response) {
      // Convert to blob URL for faster subsequent access
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(cacheKey, blobUrl);
      return blobUrl;
    }
  } catch (error) {
    console.warn('Cache read error:', error);
  }

  return null;
};

/**
 * Cache video in background
 */
const cacheInBackground = async (url: string): Promise<void> => {
  const cacheKey = getCacheKey(url);
  
  // Don't cache if already cached or in progress
  if (blobUrlCache.has(cacheKey) || cachingInProgress.has(url)) {
    return;
  }

  if (!isCacheApiAvailable()) return;

  cachingInProgress.add(url);

  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Check if already in Cache API
    const existing = await cache.match(url);
    if (existing) {
      cachingInProgress.delete(url);
      return;
    }

    // Fetch and cache
    const response = await fetch(url);
    if (response.ok) {
      // Clone response before caching (response can only be consumed once)
      const responseClone = response.clone();
      await cache.put(url, responseClone);
      
      // Also store in memory blob cache
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(cacheKey, blobUrl);
    }
  } catch (error) {
    console.warn('Cache write error:', error);
  } finally {
    cachingInProgress.delete(url);
  }
};

/**
 * Preload a video into cache without blocking
 */
export const preloadToCache = (url: string): void => {
  cacheInBackground(url);
};

/**
 * Hook to get cached video source
 * Returns the URL to use (either cached blob URL or original network URL)
 */
export const useVideoCache = (remoteUrl: string, shouldLoad: boolean = true) => {
  const [source, setSource] = useState<string>(remoteUrl);
  const [isCached, setIsCached] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!remoteUrl || !shouldLoad) return;

    const loadVideo = async () => {
      // Check if already in cache
      const cachedUrl = await getFromCache(remoteUrl);
      
      if (cachedUrl && mountedRef.current) {
        // Cache HIT - use local blob URL
        setSource(cachedUrl);
        setIsCached(true);
        return;
      }

      // Cache MISS - use network URL and cache in background
      if (mountedRef.current) {
        setSource(remoteUrl);
        setIsCached(false);
      }

      // Start background caching
      cacheInBackground(remoteUrl);
    };

    loadVideo();
  }, [remoteUrl, shouldLoad]);

  return { source, isCached };
};

/**
 * Preload multiple videos into cache
 * Call this on component mount to pre-cache upcoming videos
 */
export const preloadVideos = (urls: string[]): void => {
  urls.forEach(url => {
    if (url) {
      preloadToCache(url);
    }
  });
};

/**
 * Clear the video cache (useful for debugging or storage management)
 */
export const clearVideoCache = async (): Promise<void> => {
  // Clear blob URLs
  blobUrlCache.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
  blobUrlCache.clear();

  // Clear Cache API
  if (isCacheApiAvailable()) {
    try {
      await caches.delete(CACHE_NAME);
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }
};

