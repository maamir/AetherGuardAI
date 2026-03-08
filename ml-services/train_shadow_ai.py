"""
Shadow AI Detection Model Training

Trains a machine learning model to detect unauthorized AI service usage
with >87% accuracy target.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import joblib
import json
from datetime import datetime
from typing import Dict, List, Tuple

class ShadowAIModelTrainer:
    """Train and evaluate Shadow AI detection models"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'request_frequency',
            'avg_payload_size',
            'unique_endpoints',
            'time_variance',
            'burst_score',
            'entropy_score',
            'known_endpoint_match',
            'header_anomaly_score',
            'tls_fingerprint_match',
            'response_pattern_score',
        ]
        
    def generate_synthetic_data(self, n_samples: int = 10000) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate synthetic training data for Shadow AI detection
        
        Returns:
            X: Feature matrix
            y: Labels (0 = legitimate, 1 = shadow AI)
        """
        np.random.seed(42)
        
        # Legitimate traffic (50%)
        n_legitimate = n_samples // 2
        legitimate_features = np.array([
            np.random.normal(10, 3, n_legitimate),  # request_frequency (lower)
            np.random.normal(500, 100, n_legitimate),  # avg_payload_size (smaller)
            np.random.randint(1, 5, n_legitimate),  # unique_endpoints (fewer)
            np.random.normal(0.3, 0.1, n_legitimate),  # time_variance (regular)
            np.random.normal(0.2, 0.1, n_legitimate),  # burst_score (low)
            np.random.normal(0.4, 0.1, n_legitimate),  # entropy_score (normal)
            np.random.uniform(0.8, 1.0, n_legitimate),  # known_endpoint_match (high)
            np.random.normal(0.1, 0.05, n_legitimate),  # header_anomaly_score (low)
            np.random.uniform(0.9, 1.0, n_legitimate),  # tls_fingerprint_match (high)
            np.random.normal(0.8, 0.1, n_legitimate),  # response_pattern_score (normal)
        ]).T
        
        # Shadow AI traffic (50%)
        n_shadow = n_samples - n_legitimate
        shadow_features = np.array([
            np.random.normal(50, 15, n_shadow),  # request_frequency (higher)
            np.random.normal(2000, 500, n_shadow),  # avg_payload_size (larger)
            np.random.randint(5, 20, n_shadow),  # unique_endpoints (more)
            np.random.normal(0.7, 0.2, n_shadow),  # time_variance (irregular)
            np.random.normal(0.8, 0.15, n_shadow),  # burst_score (high)
            np.random.normal(0.7, 0.15, n_shadow),  # entropy_score (high)
            np.random.uniform(0.0, 0.3, n_shadow),  # known_endpoint_match (low)
            np.random.normal(0.7, 0.2, n_shadow),  # header_anomaly_score (high)
            np.random.uniform(0.0, 0.4, n_shadow),  # tls_fingerprint_match (low)
            np.random.normal(0.3, 0.15, n_shadow),  # response_pattern_score (anomalous)
        ]).T
        
        # Combine and create labels
        X = np.vstack([legitimate_features, shadow_features])
        y = np.hstack([np.zeros(n_legitimate), np.ones(n_shadow)])
        
        # Shuffle
        indices = np.random.permutation(len(X))
        return X[indices], y[indices]
    
    def train(self, X: np.ndarray, y: np.ndarray) -> Dict:
        """
        Train the Shadow AI detection model
        
        Args:
            X: Feature matrix
            y: Labels
            
        Returns:
            Training metrics
        """
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Random Forest model
        print("Training Random Forest model...")
        rf_model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        rf_model.fit(X_train_scaled, y_train)
        
        # Train Gradient Boosting model
        print("Training Gradient Boosting model...")
        gb_model = GradientBoostingClassifier(
            n_estimators=150,
            max_depth=10,
            learning_rate=0.1,
            random_state=42
        )
        gb_model.fit(X_train_scaled, y_train)
        
        # Evaluate both models
        rf_score = rf_model.score(X_test_scaled, y_test)
        gb_score = gb_model.score(X_test_scaled, y_test)
        
        print(f"Random Forest accuracy: {rf_score:.4f}")
        print(f"Gradient Boosting accuracy: {gb_score:.4f}")
        
        # Use the better model
        if rf_score >= gb_score:
            self.model = rf_model
            model_type = "RandomForest"
            accuracy = rf_score
        else:
            self.model = gb_model
            model_type = "GradientBoosting"
            accuracy = gb_score
        
        # Predictions
        y_pred = self.model.predict(X_test_scaled)
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5)
        
        # Feature importance
        feature_importance = dict(zip(
            self.feature_names,
            self.model.feature_importances_
        ))
        
        # Metrics
        metrics = {
            'model_type': model_type,
            'accuracy': float(accuracy),
            'cv_mean': float(cv_scores.mean()),
            'cv_std': float(cv_scores.std()),
            'classification_report': classification_report(y_test, y_pred, output_dict=True),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            'feature_importance': {k: float(v) for k, v in sorted(
                feature_importance.items(), key=lambda x: x[1], reverse=True
            )},
            'training_date': datetime.utcnow().isoformat(),
            'n_samples': len(X),
            'n_features': X.shape[1],
        }
        
        print(f"\nModel: {model_type}")
        print(f"Accuracy: {accuracy:.4f} (Target: >0.87)")
        print(f"Cross-validation: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Legitimate', 'Shadow AI']))
        print("\nTop 5 Important Features:")
        for feature, importance in list(feature_importance.items())[:5]:
            print(f"  {feature}: {importance:.4f}")
        
        return metrics
    
    def save_model(self, model_path: str = 'models/shadow_ai_detector.pkl',
                   metrics_path: str = 'models/shadow_ai_metrics.json'):
        """Save trained model and metrics"""
        if self.model is None:
            raise ValueError("No model trained yet")
        
        # Save model and scaler
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
        }, model_path)
        
        print(f"Model saved to {model_path}")
    
    def load_model(self, model_path: str = 'models/shadow_ai_detector.pkl'):
        """Load trained model"""
        data = joblib.load(model_path)
        self.model = data['model']
        self.scaler = data['scaler']
        self.feature_names = data['feature_names']
        print(f"Model loaded from {model_path}")
    
    def predict(self, features: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict Shadow AI probability
        
        Args:
            features: Feature matrix
            
        Returns:
            predictions: Binary predictions (0 or 1)
            probabilities: Probability scores
        """
        if self.model is None:
            raise ValueError("No model loaded")
        
        features_scaled = self.scaler.transform(features)
        predictions = self.model.predict(features_scaled)
        probabilities = self.model.predict_proba(features_scaled)[:, 1]
        
        return predictions, probabilities


def main():
    """Train and save Shadow AI detection model"""
    print("=" * 60)
    print("Shadow AI Detection Model Training")
    print("=" * 60)
    print()
    
    # Initialize trainer
    trainer = ShadowAIModelTrainer()
    
    # Generate synthetic training data
    print("Generating synthetic training data...")
    X, y = trainer.generate_synthetic_data(n_samples=10000)
    print(f"Generated {len(X)} samples with {X.shape[1]} features")
    print(f"Class distribution: {np.bincount(y.astype(int))}")
    print()
    
    # Train model
    metrics = trainer.train(X, y)
    print()
    
    # Save model
    trainer.save_model()
    
    # Save metrics
    with open('models/shadow_ai_metrics.json', 'w') as f:
        json.dump(metrics, f, indent=2)
    print("Metrics saved to models/shadow_ai_metrics.json")
    print()
    
    # Test prediction
    print("Testing prediction on sample data...")
    test_features = np.array([[
        45.0,  # request_frequency (high)
        1800.0,  # avg_payload_size (large)
        12,  # unique_endpoints (many)
        0.65,  # time_variance (irregular)
        0.75,  # burst_score (high)
        0.68,  # entropy_score (high)
        0.15,  # known_endpoint_match (low)
        0.72,  # header_anomaly_score (high)
        0.25,  # tls_fingerprint_match (low)
        0.35,  # response_pattern_score (anomalous)
    ]])
    
    predictions, probabilities = trainer.predict(test_features)
    print(f"Prediction: {'Shadow AI' if predictions[0] == 1 else 'Legitimate'}")
    print(f"Confidence: {probabilities[0]:.4f}")
    print()
    
    # Summary
    print("=" * 60)
    print("Training Complete!")
    print("=" * 60)
    print(f"Model Type: {metrics['model_type']}")
    print(f"Accuracy: {metrics['accuracy']:.4f} (Target: >0.87)")
    print(f"Status: {'✅ PASSED' if metrics['accuracy'] >= 0.87 else '⚠️  NEEDS IMPROVEMENT'}")
    print()


if __name__ == '__main__':
    main()
