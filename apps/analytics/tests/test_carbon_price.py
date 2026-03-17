"""Tests for the CarbonPricePredictor model."""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta, timezone

import pytest

from terraqura_analytics.models.carbon_price import (
    CarbonPricePredictor,
    _extract_features,
)
from terraqura_analytics.schemas import PriceDataPoint

from .conftest import make_price_data


class TestFeatureExtraction:
    """Tests for the feature extraction helper."""

    def test_feature_matrix_shape(self):
        data = make_price_data(n=10)
        features = _extract_features(data)
        assert features.shape == (10, 7)

    def test_raw_features_match_input(self):
        data = make_price_data(n=5)
        features = _extract_features(data)
        for i, dp in enumerate(sorted(data, key=lambda d: d.timestamp)):
            assert features[i, 0] == pytest.approx(dp.price)
            assert features[i, 1] == pytest.approx(dp.volume)
            assert features[i, 2] == pytest.approx(dp.retirement_rate)
            assert features[i, 3] == pytest.approx(dp.total_supply)

    def test_moving_average_first_element(self):
        data = make_price_data(n=5)
        features = _extract_features(data)
        # First element moving avg should equal its own price
        assert features[0, 4] == pytest.approx(features[0, 0])

    def test_rate_of_change_first_is_zero(self):
        data = make_price_data(n=5)
        features = _extract_features(data)
        assert features[0, 6] == 0.0


class TestCarbonPricePredictor:
    """Tests for the CarbonPricePredictor class."""

    def test_not_trained_initially(self):
        pred = CarbonPricePredictor()
        assert pred.is_trained is False

    def test_predict_before_training_raises(self):
        pred = CarbonPricePredictor()
        with pytest.raises(RuntimeError, match="trained"):
            pred.predict_price(30)

    def test_train_requires_minimum_data(self):
        pred = CarbonPricePredictor()
        data = make_price_data(n=3)
        with pytest.raises(ValueError, match="At least 5"):
            pred.train(data)

    def test_train_with_sufficient_data(self, price_data):
        pred = CarbonPricePredictor()
        result = pred.train(price_data)
        assert pred.is_trained is True
        assert result.samples_used == len(price_data) - 1
        assert result.model_name == "ensemble_lr_rf"

    def test_training_result_has_metrics(self, price_data):
        pred = CarbonPricePredictor()
        result = pred.train(price_data)
        assert isinstance(result.r2_score, float)
        assert isinstance(result.rmse, float)
        assert result.rmse >= 0

    def test_predict_returns_valid_prediction(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        prediction = pred.predict_price(7)
        assert prediction.predicted_price >= 0
        assert prediction.lower_bound <= prediction.predicted_price
        assert prediction.upper_bound >= prediction.predicted_price
        assert prediction.horizon_days == 7

    def test_predict_confidence_interval_widens_with_horizon(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        short = pred.predict_price(1)
        long = pred.predict_price(90)
        short_width = short.upper_bound - short.lower_bound
        long_width = long.upper_bound - long.lower_bound
        assert long_width > short_width

    def test_predict_confidence_decreases_with_horizon(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        short = pred.predict_price(1)
        long = pred.predict_price(365)
        assert short.confidence >= long.confidence

    def test_predict_horizon_validation_low(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        with pytest.raises(ValueError, match="horizon_days"):
            pred.predict_price(0)

    def test_predict_horizon_validation_high(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        with pytest.raises(ValueError, match="horizon_days"):
            pred.predict_price(400)

    def test_model_save_and_load(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        original = pred.predict_price(30)

        with tempfile.TemporaryDirectory() as tmpdir:
            pred.save(tmpdir)
            loaded = CarbonPricePredictor()
            loaded.load(tmpdir)

        assert loaded.is_trained is True
        reloaded = loaded.predict_price(30)
        assert reloaded.predicted_price == pytest.approx(original.predicted_price, rel=1e-4)

    def test_train_with_exactly_five_points(self):
        data = make_price_data(n=5)
        pred = CarbonPricePredictor()
        result = pred.train(data)
        assert result.samples_used == 4

    def test_predict_price_is_non_negative(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        for horizon in [1, 7, 30, 90, 180, 365]:
            prediction = pred.predict_price(horizon)
            assert prediction.predicted_price >= 0

    def test_train_sorts_data_by_timestamp(self):
        data = make_price_data(n=10)
        # Reverse the data so timestamps are out of order
        reversed_data = list(reversed(data))
        pred = CarbonPricePredictor()
        result = pred.train(reversed_data)
        assert result.samples_used == 9

    def test_training_result_timestamp(self, price_data):
        pred = CarbonPricePredictor()
        before = datetime.now(timezone.utc)
        result = pred.train(price_data)
        assert result.trained_at >= before

    def test_multiple_trainings_replace_model(self, price_data):
        pred = CarbonPricePredictor()
        pred.train(price_data)
        p1 = pred.predict_price(30)

        # Train again with different data
        data2 = make_price_data(n=30, base_price=50.0, seed=99)
        pred.train(data2)
        p2 = pred.predict_price(30)

        # Predictions should differ since training data differs
        assert p1.predicted_price != pytest.approx(p2.predicted_price, abs=0.01)
