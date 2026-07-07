import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

target_str = "{liveListings.length === 0 && ("

recently_sold_html = """
                      <div style={{ marginTop: '20px' }}>
                        <h4 style={{ color: 'var(--text-secondary)' }}>Recently Sold (Past 30 Days)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>42 Example St, {activeSuburb.name}</div>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>${(activeSuburb.metrics.medianPrice * 1.05).toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sold 3 days ago • 4 Bed, 2 Bath</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>12 Sample Rd, {activeSuburb.name}</div>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>${(activeSuburb.metrics.medianPrice * 0.95).toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sold 12 days ago • 3 Bed, 1 Bath</div>
                          </div>
                        </div>
                      </div>
"""

content = content.replace(target_str, recently_sold_html + "\n                      " + target_str)

with open('src/App.tsx', 'w') as f:
    f.write(content)
