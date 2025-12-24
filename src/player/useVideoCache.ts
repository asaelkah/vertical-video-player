/**
 * Video Caching Hook for Web (iOS Safari Compatible)
 * 
 * Uses Blob URLs to force-preload videos on iOS Safari.
 * iOS Safari refuses to preload normal video URLs, but it WILL
 * allow fetch() requests. We fetch the video, create a Blob URL,
 * and feed that to the video player.
 */

import { useState, useEffect, useRef } from 'react';

// In-memory cache for blob URLs
const blobUrlCache = new Map<string, string>();

// Track which videos are currently being fetched
const fetchingInProgress = new Set<string>();

// Pending callbacks for videos being fetched
const pendingCallbacks = new Map<string, ((url: string) => void)[]>();

/**
 * Fetch video and create blob URL
 */
const fetchVideoAsBlob = async (remoteUrl: string): Promise<string> => {
  // Check memory cache first
  if (blobUrlCache.has(remoteUrl)) {
    return blobUrlCache.get(remoteUrl)!;
  }

  // If already fetching, wait for it
  if (fetchingInProgress.has(remoteUrl)) {
    return new Promise((resolve) => {
      const callbacks = pendingCallbacks.get(remoteUrl) || [];
      callbacks.push(resolve);
      pendingCallbacks.set(remoteUrl, callbacks);
    });
  }

  fetchingInProgress.add(remoteUrl);

  try {
    // Fetch the video file
    const response = await fetch(remoteUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Convert to Blob
    const blob = await response.blob();

    // Create Object URL (acts like a local file)
    const blobUrl = URL.createObjectURL(blob);

    // Cache it
    blobUrlCache.set(remoteUrl, blobUrl);

    // Notify any pending callbacks
    const callbacks = pendingCallbacks.get(remoteUrl) || [];
    callbacks.forEach(cb => cb(blobUrl));
    pendingCallbacks.delete(remoteUrl);

    return blobUrl;
  } catch (error) {
    console.warn('Video fetch failed, using direct URL:', error);
    // Notify pending callbacks with original URL
    const callbacks = pendingCallbacks.get(remoteUrl) || [];
    callbacks.forEach(cb => cb(remoteUrl));
    pendingCallbacks.delete(remoteUrl);
    return remoteUrl;
  } finally {
    fetchingInProgress.delete(remoteUrl);
  }
};

/**
 * Hook to get cached video source as Blob URL
 * This forces iOS Safari to actually load the video
 */
export const useVideoCache = (remoteUrl: string, shouldLoad: boolean = true) => {
  const [source, setSource] = useState<string>(remoteUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [isCached, setIsCached] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!remoteUrl || !shouldLoad) {
      setIsLoading(false);
      return;
    }

    // Check if already cached
    if (blobUrlCache.has(remoteUrl)) {
      setSource(blobUrlCache.get(remoteUrl)!);
      setIsCached(true);
      setIsLoading(false);
      return;
    }

    // Start loading
    setIsLoading(true);

    // Fetch and create blob URL
    fetchVideoAsBlob(remoteUrl).then((blobUrl) => {
      if (mountedRef.current) {
        setSource(blobUrl);
        setIsCached(blobUrl !== remoteUrl);
        setIsLoading(false);
      }
    });
  }, [remoteUrl, shouldLoad]);

  return { source, isCached, isLoading };
};

/**
 * Preload a video into blob cache
 */
export const preloadToCache = (url: string): void => {
  if (url && !blobUrlCache.has(url) && !fetchingInProgress.has(url)) {
    fetchVideoAsBlob(url);
  }
};

/**
 * Preload multiple videos into cache
 */
export const preloadVideos = (urls: string[]): void => {
  urls.forEach(url => {
    if (url) {
      preloadToCache(url);
    }
  });
};

/**
 * Clear the video cache
 */
export const clearVideoCache = (): void => {
  blobUrlCache.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
  blobUrlCache.clear();
};
