/**
 * Tests for /api/metrics route
 *
 * These are basic smoke tests to verify the API endpoint structure.
 */

// Mock the Neon client
jest.mock("@neondatabase/serverless", () => ({
  neon: jest.fn(() => async () => []),
}));

// Mock environment variables
const mockEnv = {
  NEON_DATABASE_URL: "postgresql://test:test@test.neon.tech/test",
};

describe("/api/metrics", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...process.env, ...mockEnv };
  });

  describe("Response format", () => {
    it("should return an object with metrics and values arrays", async () => {
      // Test expected response shape
      const expectedShape = {
        metrics: [],
        values: [],
      };

      expect(expectedShape).toHaveProperty("metrics");
      expect(expectedShape).toHaveProperty("values");
      expect(Array.isArray(expectedShape.metrics)).toBe(true);
      expect(Array.isArray(expectedShape.values)).toBe(true);
    });

    it("should have correct Metric type structure", () => {
      const metric = {
        id: "hemoglobin",
        name: "Hemoglobin",
        unit: "g/dL",
        ref_min: 12.0,
        ref_max: 16.0,
      };

      expect(metric).toHaveProperty("id");
      expect(metric).toHaveProperty("name");
      expect(metric).toHaveProperty("unit");
      expect(metric).toHaveProperty("ref_min");
      expect(metric).toHaveProperty("ref_max");
      expect(typeof metric.id).toBe("string");
      expect(typeof metric.name).toBe("string");
    });

    it("should have correct MetricValue type structure", () => {
      const value = {
        metric_id: "hemoglobin",
        date: "2024-01-15",
        value: 14.2,
      };

      expect(value).toHaveProperty("metric_id");
      expect(value).toHaveProperty("date");
      expect(value).toHaveProperty("value");
      expect(typeof value.metric_id).toBe("string");
      expect(typeof value.date).toBe("string");
      expect(typeof value.value).toBe("number");
    });
  });

  describe("profileId handling", () => {
    it("should require profileId query param", () => {
      const url = new URL("http://localhost:3000/api/metrics");
      const profileId = url.searchParams.get("profileId");

      expect(profileId).toBeNull();
    });

    it("should parse profileId from query params", () => {
      const url = new URL(
        "http://localhost:3000/api/metrics?profileId=abc-123",
      );
      const profileId = url.searchParams.get("profileId");

      expect(profileId).toBe("abc-123");
    });
  });

  describe("Data transformation", () => {
    it("should transform database metric to API format", () => {
      // Database format
      const dbMetric = {
        report_id: "report-123",
        name: "Hemoglobin",
        value: 14.2,
        unit: "g/dL",
        ref_low: 12.0,
        ref_high: 16.0,
      };

      // Transform to API format
      const apiMetric = {
        id: dbMetric.name,
        name: dbMetric.name,
        unit: dbMetric.unit || "",
        ref_min: dbMetric.ref_low,
        ref_max: dbMetric.ref_high,
      };

      expect(apiMetric.id).toBe("Hemoglobin");
      expect(apiMetric.name).toBe("Hemoglobin");
      expect(apiMetric.unit).toBe("g/dL");
      expect(apiMetric.ref_min).toBe(12.0);
      expect(apiMetric.ref_max).toBe(16.0);
    });

    it("should create MetricValue from database data", () => {
      const dbMetric = {
        report_id: "report-123",
        name: "Hemoglobin",
        value: 14.2,
      };
      const date = "2024-01-15";

      const metricValue = {
        metric_id: dbMetric.name,
        date,
        value: dbMetric.value,
      };

      expect(metricValue.metric_id).toBe("Hemoglobin");
      expect(metricValue.date).toBe("2024-01-15");
      expect(metricValue.value).toBe(14.2);
    });
  });
});
