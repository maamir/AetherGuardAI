import logging
from typing import Dict, List, Optional, Any
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

class BiasDetector:
    """Bias & Fairness Monitoring using IBM AIF360 and custom metrics"""
    
    def __init__(self):
        """Initialize bias detector with AIF360 and custom fairness metrics"""
        self.has_aif360 = False
        self.aif360_metrics = None
        
        try:
            from aif360.datasets import BinaryLabelDataset
            from aif360.metrics import ClassificationMetric, BinaryLabelDatasetMetric
            from aif360.algorithms.preprocessing import Reweighing
            from aif360.algorithms.postprocessing import CalibratedEqOddsPostprocessing
            
            self.BinaryLabelDataset = BinaryLabelDataset
            self.ClassificationMetric = ClassificationMetric
            self.BinaryLabelDatasetMetric = BinaryLabelDatasetMetric
            self.Reweighing = Reweighing
            self.CalibratedEqOddsPostprocessing = CalibratedEqOddsPostprocessing
            
            self.has_aif360 = True
            logger.info("BiasDetector initialized with IBM AIF360 support")
            
        except ImportError:
            logger.warning("IBM AIF360 not available, using heuristic bias detection")
        
        # Protected attributes for bias analysis
        self.protected_attributes = [
            "gender", "race", "age", "disability_status", "religion", 
            "sexual_orientation", "nationality", "socioeconomic_status"
        ]
        
        # Bias detection thresholds
        self.thresholds = {
            "disparate_impact": 0.8,  # Should be >= 0.8
            "equal_opportunity_diff": 0.1,  # Should be <= 0.1
            "statistical_parity_diff": 0.1,  # Should be <= 0.1
            "average_odds_diff": 0.1,  # Should be <= 0.1
            "demographic_parity": 0.1,  # Should be <= 0.1
            "equalized_odds": 0.1,  # Should be <= 0.1
        }
    
    def analyze_bias(
        self, 
        outputs: List[str], 
        metadata: List[Dict],
        predictions: Optional[List[int]] = None,
        ground_truth: Optional[List[int]] = None
    ) -> Dict:
        """
        Comprehensive bias analysis using multiple fairness metrics
        
        Args:
            outputs: List of model outputs/responses
            metadata: List of metadata dicts containing demographic info
            predictions: Optional binary predictions (0/1)
            ground_truth: Optional ground truth labels (0/1)
            
        Returns:
            Dict with bias analysis results
        """
        if self.has_aif360 and predictions and ground_truth:
            return self._analyze_bias_with_aif360(outputs, metadata, predictions, ground_truth)
        else:
            return self._analyze_bias_heuristic(outputs, metadata)
    
    def _analyze_bias_with_aif360(
        self, 
        outputs: List[str], 
        metadata: List[Dict],
        predictions: List[int],
        ground_truth: List[int]
    ) -> Dict:
        """Real bias analysis using IBM AIF360"""
        try:
            # Prepare data for AIF360
            df_data = []
            for i, (output, meta, pred, truth) in enumerate(zip(outputs, metadata, predictions, ground_truth)):
                row = {
                    'output_length': len(output),
                    'prediction': pred,
                    'ground_truth': truth,
                    'sample_id': i
                }
                
                # Add demographic attributes
                for attr in self.protected_attributes:
                    row[attr] = meta.get(attr, 'unknown')
                
                df_data.append(row)
            
            df = pd.DataFrame(df_data)
            
            # Calculate bias metrics for each protected attribute
            bias_results = {}
            overall_bias_detected = False
            
            for protected_attr in self.protected_attributes:
                if protected_attr not in df.columns or df[protected_attr].nunique() < 2:
                    continue
                
                try:
                    # Create AIF360 dataset
                    dataset = self.BinaryLabelDataset(
                        favorable_label=1,
                        unfavorable_label=0,
                        df=df,
                        label_names=['ground_truth'],
                        protected_attribute_names=[protected_attr]
                    )
                    
                    # Create predictions dataset
                    pred_dataset = dataset.copy()
                    pred_dataset.labels = df[['prediction']].values
                    
                    # Calculate fairness metrics
                    classified_metric = self.ClassificationMetric(
                        dataset, pred_dataset,
                        unprivileged_groups=[{protected_attr: df[protected_attr].unique()[0]}],
                        privileged_groups=[{protected_attr: df[protected_attr].unique()[1]}]
                    )
                    
                    # Collect metrics
                    metrics = {
                        'disparate_impact': classified_metric.disparate_impact(),
                        'statistical_parity_diff': classified_metric.statistical_parity_difference(),
                        'equal_opportunity_diff': classified_metric.equal_opportunity_difference(),
                        'average_odds_diff': classified_metric.average_odds_difference(),
                        'theil_index': classified_metric.theil_index(),
                        'selection_rate': classified_metric.selection_rate(),
                        'precision': classified_metric.precision(),
                        'recall': classified_metric.recall(),
                        'accuracy': classified_metric.accuracy()
                    }
                    
                    # Check if bias detected for this attribute
                    attr_bias_detected = (
                        metrics['disparate_impact'] < self.thresholds['disparate_impact'] or
                        abs(metrics['statistical_parity_diff']) > self.thresholds['statistical_parity_diff'] or
                        abs(metrics['equal_opportunity_diff']) > self.thresholds['equal_opportunity_diff'] or
                        abs(metrics['average_odds_diff']) > self.thresholds['average_odds_diff']
                    )
                    
                    bias_results[protected_attr] = {
                        'metrics': metrics,
                        'bias_detected': attr_bias_detected,
                        'sample_size': len(df),
                        'groups': df[protected_attr].value_counts().to_dict()
                    }
                    
                    if attr_bias_detected:
                        overall_bias_detected = True
                        
                except Exception as e:
                    logger.error(f"Error analyzing bias for {protected_attr}: {e}")
                    bias_results[protected_attr] = {
                        'error': str(e),
                        'bias_detected': False
                    }
            
            # Calculate overall bias score
            overall_score = self._calculate_overall_bias_score(bias_results)
            
            return {
                'bias_detected': overall_bias_detected,
                'overall_bias_score': overall_score,
                'protected_attributes_analyzed': list(bias_results.keys()),
                'detailed_results': bias_results,
                'flagged_for_review': overall_bias_detected,
                'method': 'aif360',
                'sample_size': len(outputs),
                'recommendations': self._generate_bias_recommendations(bias_results)
            }
            
        except Exception as e:
            logger.error(f"AIF360 bias analysis failed: {e}")
            return self._analyze_bias_heuristic(outputs, metadata)
    
    def _analyze_bias_heuristic(self, outputs: List[str], metadata: List[Dict]) -> Dict:
        """Heuristic bias analysis when AIF360 is not available"""
        bias_indicators = {}
        overall_bias_detected = False
        
        # Analyze output characteristics by demographic groups
        for protected_attr in self.protected_attributes:
            groups = {}
            
            # Group outputs by protected attribute
            for output, meta in zip(outputs, metadata):
                attr_value = meta.get(protected_attr, 'unknown')
                if attr_value not in groups:
                    groups[attr_value] = []
                groups[attr_value].append(output)
            
            if len(groups) < 2:
                continue
            
            # Calculate heuristic metrics
            group_stats = {}
            for group, group_outputs in groups.items():
                group_stats[group] = {
                    'count': len(group_outputs),
                    'avg_length': np.mean([len(out) for out in group_outputs]),
                    'response_rate': len([out for out in group_outputs if len(out.strip()) > 0]) / len(group_outputs)
                }
            
            # Check for disparities
            lengths = [stats['avg_length'] for stats in group_stats.values()]
            response_rates = [stats['response_rate'] for stats in group_stats.values()]
            
            length_disparity = (max(lengths) - min(lengths)) / max(lengths) if max(lengths) > 0 else 0
            response_disparity = max(response_rates) - min(response_rates)
            
            attr_bias_detected = length_disparity > 0.2 or response_disparity > 0.1
            
            bias_indicators[protected_attr] = {
                'length_disparity': length_disparity,
                'response_disparity': response_disparity,
                'group_stats': group_stats,
                'bias_detected': attr_bias_detected
            }
            
            if attr_bias_detected:
                overall_bias_detected = True
        
        # Calculate mock fairness metrics for compatibility
        mock_metrics = {
            'disparate_impact': 0.85 + np.random.uniform(-0.1, 0.1),
            'statistical_parity_diff': np.random.uniform(-0.05, 0.05),
            'equal_opportunity_diff': np.random.uniform(-0.03, 0.03),
            'average_odds_diff': np.random.uniform(-0.04, 0.04)
        }
        
        return {
            'bias_detected': overall_bias_detected,
            'overall_bias_score': 0.3 if overall_bias_detected else 0.1,
            'protected_attributes_analyzed': list(bias_indicators.keys()),
            'heuristic_analysis': bias_indicators,
            'mock_metrics': mock_metrics,
            'flagged_for_review': overall_bias_detected,
            'method': 'heuristic',
            'sample_size': len(outputs),
            'recommendations': self._generate_heuristic_recommendations(bias_indicators)
        }
    
    def _calculate_overall_bias_score(self, bias_results: Dict) -> float:
        """Calculate overall bias score from individual attribute results"""
        scores = []
        
        for attr, result in bias_results.items():
            if 'metrics' in result:
                metrics = result['metrics']
                # Normalize metrics to 0-1 scale where 1 is most biased
                di_score = max(0, 1 - metrics.get('disparate_impact', 1))
                sp_score = abs(metrics.get('statistical_parity_diff', 0))
                eo_score = abs(metrics.get('equal_opportunity_diff', 0))
                ao_score = abs(metrics.get('average_odds_diff', 0))
                
                attr_score = np.mean([di_score, sp_score, eo_score, ao_score])
                scores.append(attr_score)
        
        return np.mean(scores) if scores else 0.0
    
    def _generate_bias_recommendations(self, bias_results: Dict) -> List[str]:
        """Generate recommendations based on bias analysis"""
        recommendations = []
        
        for attr, result in bias_results.items():
            if result.get('bias_detected', False) and 'metrics' in result:
                metrics = result['metrics']
                
                if metrics.get('disparate_impact', 1) < 0.8:
                    recommendations.append(f"Consider rebalancing training data for {attr} to improve disparate impact")
                
                if abs(metrics.get('statistical_parity_diff', 0)) > 0.1:
                    recommendations.append(f"Review model predictions for statistical parity across {attr} groups")
                
                if abs(metrics.get('equal_opportunity_diff', 0)) > 0.1:
                    recommendations.append(f"Investigate equal opportunity differences for {attr}")
        
        if not recommendations:
            recommendations.append("No significant bias detected. Continue monitoring.")
        
        return recommendations
    
    def _generate_heuristic_recommendations(self, bias_indicators: Dict) -> List[str]:
        """Generate recommendations based on heuristic analysis"""
        recommendations = []
        
        for attr, indicators in bias_indicators.items():
            if indicators.get('bias_detected', False):
                if indicators.get('length_disparity', 0) > 0.2:
                    recommendations.append(f"Significant response length disparity detected for {attr}")
                
                if indicators.get('response_disparity', 0) > 0.1:
                    recommendations.append(f"Response rate disparity detected for {attr}")
        
        if not recommendations:
            recommendations.append("No significant bias patterns detected in heuristic analysis.")
        
        return recommendations
    
    def detect_biased_language(self, text: str) -> Dict:
        """Detect potentially biased language in text"""
        biased_terms = {
            'gender': ['guys', 'mankind', 'manpower', 'chairman', 'policeman', 'fireman'],
            'age': ['old-timer', 'senior moment', 'over the hill', 'young blood'],
            'race': ['exotic', 'articulate', 'urban', 'inner city'],
            'disability': ['crazy', 'insane', 'lame', 'blind to', 'deaf to'],
            'religion': ['crusade', 'jihad', 'fundamentalist'],
            'appearance': ['attractive', 'unattractive', 'overweight', 'skinny']
        }
        
        detected_bias = {}
        text_lower = text.lower()
        
        for category, terms in biased_terms.items():
            found_terms = [term for term in terms if term in text_lower]
            if found_terms:
                detected_bias[category] = found_terms
        
        return {
            'biased_language_detected': len(detected_bias) > 0,
            'categories': detected_bias,
            'total_terms': sum(len(terms) for terms in detected_bias.values()),
            'suggestions': self._get_inclusive_alternatives(detected_bias)
        }
    
    def _get_inclusive_alternatives(self, detected_bias: Dict) -> Dict:
        """Suggest inclusive alternatives for biased language"""
        alternatives = {
            'gender': {
                'guys': 'everyone/folks/team',
                'mankind': 'humanity/people',
                'manpower': 'workforce/staff',
                'chairman': 'chairperson/chair',
                'policeman': 'police officer',
                'fireman': 'firefighter'
            },
            'age': {
                'old-timer': 'experienced person',
                'senior moment': 'memory lapse',
                'over the hill': 'experienced',
                'young blood': 'new team member'
            },
            'disability': {
                'crazy': 'unusual/unexpected',
                'insane': 'extreme/intense',
                'lame': 'weak/ineffective',
                'blind to': 'unaware of',
                'deaf to': 'ignoring'
            }
        }
        
        suggestions = {}
        for category, terms in detected_bias.items():
            if category in alternatives:
                suggestions[category] = {
                    term: alternatives[category].get(term, 'consider more inclusive language')
                    for term in terms
                }
        
        return suggestions
