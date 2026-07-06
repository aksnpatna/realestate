import json
import math
import numpy as np
import pandas as pd
from typing import List, Dict
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

def find_similar_suburbs(target_suburb: Dict, all_suburbs: List[Dict], limit=5):
    """
    Finds cheaper suburbs that share similar institutional-grade characteristics
    using KMeans clustering on normalized features.
    """
    try:
        if not all_suburbs or not target_suburb:
            return []

        target_id = target_suburb.get('id')
        target_metrics = target_suburb.get("metrics", {})
        target_price = target_metrics.get('medianPrice', 99999999)

        # Extract features for all suburbs
        data_rows = []
        for s in all_suburbs:
            metrics = s.get('metrics', {})
            price = metrics.get('medianPrice', 0)
            if not isinstance(price, (int, float)) or price <= 0:
                continue
                
            icsea = metrics.get('icseaAvg') or metrics.get('schoolQuality') or 1000
            yield_pct = metrics.get('rentalYieldPct') or (metrics.get('rentalYield') if isinstance(metrics.get('rentalYield'), (int, float)) else 4.0)
            density = metrics.get('populationDensity') or 1000
            growth = metrics.get('growthScore') or 50
            
            data_rows.append({
                'id': s.get('id'),
                'name': s.get('name'),
                'state': s.get('state'),
                'postcode': s.get('postcode'),
                'price': float(price),
                'icsea': float(icsea),
                'yield': float(yield_pct),
                'density': float(density),
                'growth': float(growth)
            })
            
        if not data_rows:
            return []
            
        df = pd.DataFrame(data_rows)
        
        # Institutional-grade features for clustering
        features = ['yield', 'icsea', 'density', 'growth']
        
        # Standardize features
        scaler = StandardScaler()
        X = scaler.fit_transform(df[features])
        
        # Determine optimal clusters (min 2, max 8)
        n_clusters = min(8, max(2, len(df) // 20))
        
        # KMeans for archetypes
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        df['cluster'] = kmeans.fit_predict(X)
        
        # Find target cluster
        target_row = df[df['id'] == target_id]
        if target_row.empty:
            return []
            
        target_cluster = target_row.iloc[0]['cluster']
        target_vec = X[target_row.index[0]]
        
        # Filter for same cluster and at least 5% cheaper (lowered from 15%)
        similar_df = df[
            (df['cluster'] == target_cluster) & 
            (df['id'] != target_id) & 
            (df['price'] < target_price * 0.95)
        ].copy()
        
        if similar_df.empty:
            # Fallback: ignore cluster, just find cheap + similar by growth
            similar_df = df[
                (df['id'] != target_id) & 
                (df['price'] < target_price * 0.95)
            ].copy()
            if similar_df.empty:
                return []
            # Use price proximity as similarity when no cluster match
            similar_df['similarity'] = similar_df['price'].apply(
                lambda p: round(100 - abs(p - target_price) / target_price * 100, 1)
            )
            similar_df = similar_df.sort_values(by='similarity', ascending=False).head(limit)
            results = []
            for _, row in similar_df.iterrows():
                results.append({
                    "suburb": row['name'],
                    "state": row['state'],
                    "postcode": row['postcode'],
                    "price": row['price'],
                    "similarity": row['similarity'],
                    "icsea": row['icsea'],
                    "yield": row['yield']
                })
            return results
            
        # Calculate cosine similarity within cluster to rank them
        def cosine_sim(vec1, vec2):
            denom = (np.linalg.norm(vec1) * np.linalg.norm(vec2))
            return np.dot(vec1, vec2) / denom if denom != 0 else 0
            
        similar_df['similarity'] = similar_df.index.map(
            lambda idx: round(cosine_sim(target_vec, X[idx]) * 100, 1)
        )
        
        # Sort by similarity descending
        similar_df = similar_df.sort_values(by='similarity', ascending=False).head(limit)
        
        results = []
        for _, row in similar_df.iterrows():
            results.append({
                "suburb": row['name'],
                "state": row['state'],
                "postcode": row['postcode'],
                "price": row['price'],
                "similarity": row['similarity'],
                "icsea": row['icsea'],
                "yield": row['yield']
            })
            
        return results
    except Exception as e:
        print(f"Clustering error: {e}")
        return []
