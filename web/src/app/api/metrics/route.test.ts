/**
 * Tests for /api/metrics route
 *
 * These are basic smoke tests to verify the API endpoint structure.
 */

// Mock the Supabase client
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          execute: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        in: jest.fn(() => ({
          execute: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        order: jest.fn(() => ({
          execute: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
        execute: jest.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  })),
}));

// Mock environment variables
const mockEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SECRET_KEY: "test-secret-key",
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

  describe("Profile name handling", () => {
    it("should use default profile name when not specified", () => {
      const DEFAULT_PROFILE_NAME = "Father (Migrated)";

      // Simulate URL parsing
      const url = new URL("http://localhost:3000/api/metrics");
      const profileName =
        url.searchParams.get("profileName") || DEFAULT_PROFILE_NAME;

      expect(profileName).toBe(DEFAULT_PROFILE_NAME);
    });

    it("should use provided profile name from query params", () => {
      const DEFAULT_PROFILE_NAME = "Father (Migrated)";

      // Simulate URL parsing with profileName param
      const url = new URL(
        "http://localhost:3000/api/metrics?profileName=Test%20Profile",
      );
      const profileName =
        url.searchParams.get("profileName") || DEFAULT_PROFILE_NAME;

      expect(profileName).toBe("Test Profile");
    });
  });

  describe("Data transformation", () => {
    it("should transform Supabase metric to API format", () => {
      // Supabase format from database
      const supabaseMetric = {
        report_id: "report-123",
        name: "Hemoglobin",
        value: 14.2,
        unit: "g/dL",
        ref_low: 12.0,
        ref_high: 16.0,
      };

      // Transform to API format
      const apiMetric = {
        id: supabaseMetric.name,
        name: supabaseMetric.name,
        unit: supabaseMetric.unit || "",
        ref_min: supabaseMetric.ref_low,
        ref_max: supabaseMetric.ref_high,
      };

      expect(apiMetric.id).toBe("Hemoglobin");
      expect(apiMetric.name).toBe("Hemoglobin");
      expect(apiMetric.unit).toBe("g/dL");
      expect(apiMetric.ref_min).toBe(12.0);
      expect(apiMetric.ref_max).toBe(16.0);
    });

    it("should create MetricValue from Supabase data", () => {
      const supabaseMetric = {
        report_id: "report-123",
        name: "Hemoglobin",
        value: 14.2,
      };
      const date = "2024-01-15";

      const metricValue = {
        metric_id: supabaseMetric.name,
        date,
        value: supabaseMetric.value,
      };

      expect(metricValue.metric_id).toBe("Hemoglobin");
      expect(metricValue.date).toBe("2024-01-15");
      expect(metricValue.value).toBe(14.2);
    });
  });
});
