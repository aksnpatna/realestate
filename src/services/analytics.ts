export function trackEvent(event: string, properties?: Record<string, any>) {
  // Only fire if user has explicitly granted marketing consent
  const consent = localStorage.getItem('marketing_consent');
  if (consent !== 'true') return;
  
  // Basic console log for development
  if (import.meta.env.DEV) {
    console.log('[Analytics Event]', event, properties);
  }

  // Send to backend for aggregation
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      event, 
      properties, 
      timestamp: Date.now(),
      url: window.location.href,
      path: window.location.pathname
    })
  }).catch(() => {
    // Silently fail if analytics endpoint is down or blocked by adblockers
  });
}
